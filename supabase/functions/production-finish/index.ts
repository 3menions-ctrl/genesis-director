// ─────────────────────────────────────────────────────────────────────────
// production-finish — the Finishing Studio backend.
//
// Takes a project's stitched master (movie_projects.video_url) and runs ONE
// Replicate-ffmpeg pass that applies, in order:
//   1. a unified house color-grade (a LUT from the shared library),
//   2. optional 60fps motion interpolation (minterpolate, at source res — cheap),
//   3. optional 4K Lanczos upscale (aspect-preserving).
//
// The result is persisted to the private `published-renders` bucket and written
// to movie_projects.finished_video_url, leaving video_url (the ungraded master)
// intact as a fallback.
//
// Gating: owner-only (assertProjectOwnership) + credit-gated (preflightAiGate /
// chargeAiGate) so this expensive compute endpoint is never free to call.
// Charge-on-success; cached re-requests don't re-run ffmpeg or re-charge.
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  validateAuth,
  unauthorizedResponse,
  assertProjectOwnership,
} from "../_shared/auth-guard.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";
import { compileClipColorFilter } from "../_shared/color-grade-filters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Same Replicate cog-ffmpeg model the stitcher uses.
const FFMPEG_MODEL_VERSION =
  "efd0b79b577bcd58ae7d035bce9de5c4659a59e09faafac4d426d61c04249251";

const OUTPUT_BUCKET = "published-renders";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days — longer than the stitcher's 24h.

// Credit cost: base finishing pass + per-enhancement. Mirrors the relative
// compute cost (interpolation is the most expensive, upscale next).
const COST_BASE = 10;
const COST_UPSCALE_4K = 15;
const COST_INTERP_60 = 20;
const DAILY_CAP = 30;

interface FinishOptions {
  houseLutId?: string | null;
  upscale4k?: boolean;
  interpolate60fps?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function costFor(opts: FinishOptions): number {
  return (
    COST_BASE +
    (opts.upscale4k ? COST_UPSCALE_4K : 0) +
    (opts.interpolate60fps ? COST_INTERP_60 : 0)
  );
}

// Build the single-input ffmpeg command. Uses `file1` for input and the
// trailing `output1` token, exactly as the cog runner expects (it rewrites
// file1 → /tmp/file1 and output1 → the output filename).
function buildFinishCommand(opts: FinishOptions): string {
  const chain: string[] = [];

  // Unified house grade — resolve the LUT by id (handled inside the compiler).
  if (opts.houseLutId) {
    const grade = compileClipColorFilter({ lutId: opts.houseLutId } as never);
    if (grade) chain.push(grade);
  }

  // Interpolate at SOURCE resolution first (far cheaper than at 4K).
  if (opts.interpolate60fps) {
    chain.push("minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1");
  }

  // Aspect-preserving 4K-class upscale: long edge → 3840, other edge auto
  // (kept divisible-by-2 via -2). Commas inside the if() are quoted so the
  // filtergraph parser doesn't read them as filter separators.
  if (opts.upscale4k) {
    chain.push("scale='if(gt(iw,ih),3840,-2)':'if(gt(iw,ih),-2,3840)':flags=lanczos");
  }

  const vf = chain.length ? chain.join(",") : "null";
  return (
    `ffmpeg -i file1 -vf "${vf}" ` +
    `-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p ` +
    `-profile:v high -level:v 5.1 ` +
    `-c:a copy -movflags +faststart ` +
    `output1`
  );
}

// ── Replicate cog-ffmpeg runner (mirrors seamless-stitcher) ───────────────
async function runFfmpeg(args: {
  replicateKey: string;
  command: string;
  inputs: Record<string, string>;
  outputName: string;
}): Promise<string> {
  if (!args.replicateKey) {
    throw new Error(
      "REPLICATE_API_KEY not configured — set it in Supabase → Edge Functions → Secrets so finishing can run.",
    );
  }
  // Adapt to the magpai-app/cog-ffmpeg convention: input refs must be
  // /tmp/fileN, the output token becomes the output filename, and literal
  // braces are escaped (the cog's .format() round-trips {{ }} back to { }).
  let cogCommand = args.command
    .replace(/\bfile([1-9])\b/g, "/tmp/file$1")
    .replace(/\boutput([1-2])\b/g, args.outputName);
  cogCommand = cogCommand.replace(/\{/g, "{{").replace(/\}/g, "}}");

  const submit = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.replicateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: FFMPEG_MODEL_VERSION,
      input: { command: cogCommand, output1: args.outputName, ...args.inputs },
    }),
  });
  if (!submit.ok) {
    const text = await submit.text();
    throw new Error(`replicate_submit_${submit.status}: ${text.slice(0, 200)}`);
  }
  const predictionId = (await submit.json()).id as string;
  if (!predictionId) throw new Error("no_prediction_id");

  // Match the stitcher's proven 4-minute envelope (longer risks the platform
  // killing the function mid-run). Very long films may exceed this and surface
  // as a timeout in finishing_state.
  const deadline = Date.now() + 240_000;
  let lastStatus = "";
  let consecutiveFailures = 0;
  while (Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${args.replicateKey}` } },
    );
    if (!pollRes.ok) {
      if (++consecutiveFailures >= 3) {
        throw new Error(`replicate_poll_failed_${pollRes.status}: 3 consecutive non-OK responses`);
      }
      continue;
    }
    consecutiveFailures = 0;
    const pred = await pollRes.json();
    lastStatus = pred.status;
    if (pred.status === "succeeded") {
      const out = pred.output?.files ?? pred.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (typeof url === "string" && url.startsWith("http")) return url;
      throw new Error("succeeded_but_no_url");
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`replicate_${pred.status}: ${pred.error ?? "no detail"}`);
    }
  }
  throw new Error(`replicate_timeout_after_4m (last=${lastStatus})`);
}

// ── Persist (download → validate MP4 → upload → sign) ─────────────────────
async function persistOutput(
  supabase: ReturnType<typeof createClient>,
  replicateUrl: string,
  outputKey: string,
): Promise<string> {
  const res = await fetch(replicateUrl);
  if (!res.ok) throw new Error(`replicate_download_${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`replicate_output_too_small: ${bytes.length} bytes`);
  }
  const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (ftyp !== "ftyp") {
    throw new Error(`replicate_output_not_mp4: header reads "${ftyp}"`);
  }
  const { error: upErr } = await supabase.storage
    .from(OUTPUT_BUCKET)
    .upload(outputKey, bytes, { contentType: "video/mp4", upsert: true });
  if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(OUTPUT_BUCKET)
    .createSignedUrl(outputKey, SIGNED_URL_TTL);
  if (signErr) throw new Error(`sign_failed: ${signErr.message}`);
  return signed.signedUrl;
}

// Return a signed URL for an already-rendered output, or null on cache miss.
async function cachedSignedUrl(
  supabase: ReturnType<typeof createClient>,
  outputKey: string,
): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .createSignedUrl(outputKey, SIGNED_URL_TTL);
    if (!data?.signedUrl) return null;
    const probe = await fetch(data.signedUrl, { method: "HEAD" });
    return probe.ok ? data.signedUrl : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let projectId: string | null = null;

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const body = await req.json().catch(() => ({}));
    projectId = body.projectId ?? null;
    const opts: FinishOptions = {
      houseLutId: body.options?.houseLutId ?? null,
      upscale4k: !!body.options?.upscale4k,
      interpolate60fps: !!body.options?.interpolate60fps,
    };

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!opts.houseLutId && !opts.upscale4k && !opts.interpolate60fps) {
      return new Response(
        JSON.stringify({ error: "select at least one finishing option" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Owner-only.
    const forbidden = await assertProjectOwnership(supabase, auth, projectId, corsHeaders);
    if (forbidden) return forbidden;

    // Load the stitched master.
    const { data: project } = await supabase
      .from("movie_projects")
      .select("video_url, finishing_state")
      .eq("id", projectId)
      .maybeSingle();

    const sourceUrl = project?.video_url as string | undefined;
    if (!sourceUrl) {
      return new Response(
        JSON.stringify({ error: "no_master", message: "This project has no finished film to finish yet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (sourceUrl.endsWith(".json")) {
      return new Response(
        JSON.stringify({ error: "manifest_source", message: "Finishing needs a stitched film. Render the final cut first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Concurrency guard: don't kick off a second expensive pass while one runs.
    const prev = project?.finishing_state as Record<string, unknown> | null;
    if (prev?.status === "processing" && typeof prev.startedAt === "string") {
      const ageMs = Date.now() - Date.parse(prev.startedAt as string);
      if (Number.isFinite(ageMs) && ageMs < 6 * 60_000) {
        return new Response(
          JSON.stringify({ error: "already_processing", message: "A finishing pass is already running for this project." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const cost = costFor(opts);
    const hash = (await sha256Hex(sourceUrl + JSON.stringify(opts))).slice(0, 32);
    const outputKey = `${projectId}/finished_${hash}.mp4`;

    // Cache hit — already rendered this exact combination. No compute, no charge.
    const cached = await cachedSignedUrl(supabase, outputKey);
    if (cached) {
      await supabase
        .from("movie_projects")
        .update({
          finished_video_url: cached,
          finishing_state: {
            status: "completed",
            options: opts,
            sourceUrl,
            cost: 0,
            cached: true,
            finishedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      return new Response(
        JSON.stringify({ success: true, url: cached, cached: true, cost: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Credit gate (rate-limit + balance). projectId lets deduct_credits route to
    // an org pool when the project belongs to an org.
    const gateCtx = {
      supabase,
      fnName: "production-finish",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      projectId,
      cost,
      dailyCap: DAILY_CAP,
      idempotencyKey: `finish:${projectId}:${hash}`,
      corsHeaders,
    };
    const blocked = await preflightAiGate(gateCtx);
    if (blocked) return blocked;

    // Mark processing.
    await supabase
      .from("movie_projects")
      .update({
        finishing_state: {
          status: "processing",
          options: opts,
          sourceUrl,
          cost,
          startedAt: new Date().toISOString(),
        },
      })
      .eq("id", projectId);

    // Render.
    const command = buildFinishCommand(opts);
    const replicateUrl = await runFfmpeg({
      replicateKey: Deno.env.get("REPLICATE_API_KEY")!,
      command,
      inputs: { file1: sourceUrl },
      outputName: `finished_${hash}.mp4`,
    });
    const finishedUrl = await persistOutput(supabase, replicateUrl, outputKey);

    // Charge on success.
    const charged = await chargeAiGate(gateCtx);

    await supabase
      .from("movie_projects")
      .update({
        finished_video_url: finishedUrl,
        finishing_state: {
          status: "completed",
          options: opts,
          sourceUrl,
          cost: charged,
          cached: false,
          finishedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return new Response(
      JSON.stringify({ success: true, url: finishedUrl, cached: false, cost: charged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[production-finish]", message);
    // Record the failure so the UI can surface it and re-enable the button.
    if (projectId) {
      await supabase
        .from("movie_projects")
        .update({
          finishing_state: {
            status: "error",
            error: message,
            finishedAt: new Date().toISOString(),
          },
        })
        .eq("id", projectId)
        .then(() => {}, () => {});
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
