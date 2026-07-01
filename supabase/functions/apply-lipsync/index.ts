// ─────────────────────────────────────────────────────────────────────────
// apply-lipsync — universal post lip-sync for a single dialogue clip.
//
// Decouples lip-sync from the generator: takes a clip rendered on ANY engine,
// generates TTS for the shot's dialogue (via the existing generate-voice fn),
// runs LatentSync over the clip + audio, persists the result, and points the
// clip's video_url at it (preserving the original) so a re-stitch incorporates
// the synced clip into the final film.
//
// Owner-gated + credit-gated (charge-on-success). Additive — no core-pipeline
// changes; only this clip's row is touched.
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  validateAuth,
  unauthorizedResponse,
  assertProjectOwnership,
} from "../_shared/auth-guard.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";
import { persistVideoToStorage } from "../_shared/video-persistence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// bytedance/latentsync — 147k+ runs; inputs: video, audio, guidance_scale, seed.
const LATENTSYNC_VERSION =
  "637ce1919f807ca20da3a448ddc2743535d2853649574cd52a933120e9b9e293";

const LIPSYNC_COST = 14;
const DAILY_CAP = 40;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// deno-lint-ignore no-explicit-any
function dialogueForShot(project: any, shotIndex: number): string | null {
  const tasks = project?.pending_video_tasks;
  let shots: any[] | null = null;
  if (tasks?.script?.shots && Array.isArray(tasks.script.shots)) shots = tasks.script.shots;
  else if (project?.generated_script) {
    try {
      const parsed = typeof project.generated_script === "string"
        ? JSON.parse(project.generated_script)
        : project.generated_script;
      if (parsed?.shots && Array.isArray(parsed.shots)) shots = parsed.shots;
    } catch { shots = null; }
  }
  const d = shots?.[shotIndex]?.dialogue;
  return typeof d === "string" && d.trim().length > 1 ? d.trim() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const body = await req.json().catch(() => ({}));
    const projectId: string | null = body.projectId ?? null;
    const shotIndex: number = Number(body.shotIndex ?? -1);
    if (!projectId || shotIndex < 0) {
      return new Response(JSON.stringify({ error: "projectId and shotIndex required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forbidden = await assertProjectOwnership(supabase, auth, projectId, corsHeaders);
    if (forbidden) return forbidden;

    const { data: project } = await supabase
      .from("movie_projects")
      .select("generated_script, pending_video_tasks")
      .eq("id", projectId)
      .maybeSingle();

    const dialogue = dialogueForShot(project, shotIndex);
    if (!dialogue) {
      return new Response(
        JSON.stringify({ error: "no_dialogue", message: "This shot has no dialogue to lip-sync." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: clip } = await supabase
      .from("video_clips")
      .select("id, video_url, source_video_url, status")
      .eq("project_id", projectId)
      .eq("shot_index", shotIndex)
      .maybeSingle();

    // Always lip-sync the ORIGINAL source (so re-sync doesn't stack on a synced clip).
    const sourceUrl = (clip?.source_video_url as string) || (clip?.video_url as string);
    if (!clip || clip.status !== "completed" || !sourceUrl) {
      return new Response(
        JSON.stringify({ error: "no_clip", message: "This shot has no finished clip to sync yet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const replicateKey = Deno.env.get("REPLICATE_API_KEY")!;
    if (!replicateKey) throw new Error("REPLICATE_API_KEY not configured");

    // Credit gate.
    const gateCtx = {
      supabase,
      fnName: "apply-lipsync",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      projectId,
      cost: LIPSYNC_COST,
      dailyCap: DAILY_CAP,
      idempotencyKey: `lipsync:${projectId}:${shotIndex}`,
      corsHeaders,
    };
    const blocked = await preflightAiGate(gateCtx);
    if (blocked) return blocked;

    // 1) TTS for the dialogue (reuse the existing voice pipeline).
    const { data: voice, error: voiceErr } = await supabase.functions.invoke("generate-voice", {
      body: { text: dialogue, projectId, speed: 0.9 },
    });
    const audioUrl = voice?.audioUrl as string | undefined;
    if (voiceErr || !audioUrl) {
      throw new Error(`tts_failed: ${voiceErr?.message ?? "no audio"}`);
    }

    // 2) LatentSync over the clip video + dialogue audio.
    const submit = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${replicateKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: LATENTSYNC_VERSION,
        input: { video: sourceUrl, audio: audioUrl, guidance_scale: 1.5 },
      }),
    });
    if (!submit.ok) {
      throw new Error(`latentsync_submit_${submit.status}: ${(await submit.text()).slice(0, 200)}`);
    }
    const predId = (await submit.json()).id as string;
    if (!predId) throw new Error("no_prediction_id");

    const deadline = Date.now() + 240_000;
    let outUrl: string | null = null;
    let fails = 0;
    let lastStatus = "";
    while (Date.now() < deadline) {
      await sleep(3000);
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Bearer ${replicateKey}` },
      });
      if (!poll.ok) {
        if (++fails >= 3) throw new Error(`latentsync_poll_failed_${poll.status}`);
        continue;
      }
      fails = 0;
      const pred = await poll.json();
      lastStatus = pred.status;
      if (pred.status === "succeeded") {
        const out = pred.output;
        outUrl = Array.isArray(out) ? out[0] : out;
        break;
      }
      if (pred.status === "failed" || pred.status === "canceled") {
        throw new Error(`latentsync_${pred.status}: ${pred.error ?? "no detail"}`);
      }
    }
    if (!outUrl) throw new Error(`latentsync_timeout (last=${lastStatus})`);

    // 3) Persist to permanent storage.
    const persisted = await persistVideoToStorage(supabase, outUrl, projectId, {
      prefix: "lipsync",
      bucket: "video-clips",
      clipIndex: shotIndex,
    });
    const finalUrl = persisted || outUrl;

    // 4) Update the clip: preserve original, set lipsync + point video_url at it.
    await supabase
      .from("video_clips")
      .update({
        source_video_url: clip.source_video_url || clip.video_url,
        lipsync_url: finalUrl,
        video_url: finalUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clip.id);

    const charged = await chargeAiGate(gateCtx);

    return new Response(
      JSON.stringify({ success: true, url: finalUrl, shotIndex, cost: charged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[apply-lipsync]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
