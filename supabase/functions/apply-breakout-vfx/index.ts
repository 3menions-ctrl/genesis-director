// apply-breakout-vfx — the EFFECTS-phase stage of the creation pipeline.
//
// Takes an already-generated clip (from the live Replicate engine) and runs it
// through the Breakout VFX Cog model (CPU compositor: digital-UI chrome +
// glass-shatter), returning a new clip URL with the effect baked in.
//
// FAIL-OPEN BY DESIGN: if the model isn't configured, the token is missing, or
// the render errors/times out, this returns the ORIGINAL clip URL with
// applied=false. Wiring it into the pipeline therefore can NEVER break a render —
// worst case the user gets the un-composited clip (today's behavior).
//
// Activated per-project by the `isBreakout` / crossover-template path; the
// orchestrator passes the resolved chrome_kind + recipe_slug. Deploy the Cog
// (python/breakout_pipeline) then set REPLICATE_BREAKOUT_MODEL=owner/name:version.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireServiceRole } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface VfxRequest {
  clipUrl: string;
  chromeKind?: string;
  recipeSlug?: string;
  templateSlug?: string;
  aspect?: "9:16" | "16:9" | "1:1";
  fps?: number;
  sfxTags?: string;
  colorLut?: string;
  seed?: number;
  projectId?: string;
  shotId?: string;
}

const REPLICATE_POLL_MS = 4000;
const REPLICATE_TIMEOUT_MS = 8 * 60 * 1000; // breakout VFX is CPU; allow generous headroom
const OUTPUT_BUCKET = "video-clips";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Internal pipeline stage only — the orchestrator calls it with the service role.
  if (!requireServiceRole(req)) {
    return json(403, { applied: false, error: "service_role_required" });
  }

  let body: VfxRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { applied: false, error: "invalid_json" });
  }
  const clipUrl = body.clipUrl;
  if (!clipUrl) return json(400, { applied: false, error: "missing_clipUrl" });

  // ── FAIL-OPEN guards: any missing prerequisite → return the original clip ──
  const model = Deno.env.get("REPLICATE_BREAKOUT_MODEL");
  const token = Deno.env.get("REPLICATE_API_KEY");
  if (!model || !token) {
    console.log("[breakout-vfx] not configured (model/token absent) → passthrough");
    return json(200, { applied: false, url: clipUrl, reason: "model_not_configured" });
  }

  try {
    const input: Record<string, unknown> = {
      video: clipUrl,
      chrome_kind: body.chromeKind ?? "tiktok",
      recipe_slug: body.recipeSlug ?? "",
      template_slug: body.templateSlug ?? "the-dancers-leap",
      aspect: body.aspect ?? "9:16",
      fps: body.fps ?? 24,
      sfx_tags: body.sfxTags ?? "",
      color_lut: body.colorLut ?? "",
      seed: body.seed ?? 42,
    };

    // Create the prediction. Support both "owner/name:version" and "owner/name".
    const [modelRef, version] = model.split(":");
    const createUrl = version
      ? "https://api.replicate.com/v1/predictions"
      : `https://api.replicate.com/v1/models/${modelRef}/predictions`;
    const createBody = version ? { version, input } : { input };

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => "");
      console.error(`[breakout-vfx] create failed ${createRes.status}: ${txt.slice(0, 200)}`);
      return json(200, { applied: false, url: clipUrl, reason: `create_${createRes.status}` });
    }
    let pred = await createRes.json();

    // Poll to completion (fail-open on timeout).
    const startedAt = Date.now();
    while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
      if (Date.now() - startedAt > REPLICATE_TIMEOUT_MS) {
        console.warn("[breakout-vfx] timeout → passthrough");
        return json(200, { applied: false, url: clipUrl, reason: "timeout" });
      }
      await new Promise((r) => setTimeout(r, REPLICATE_POLL_MS));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!poll.ok) continue;
      pred = await poll.json();
    }

    if (pred.status !== "succeeded") {
      console.warn(`[breakout-vfx] prediction ${pred.status} → passthrough`);
      return json(200, { applied: false, url: clipUrl, reason: pred.status });
    }

    // Cog returns a single file → a URL (or [url]).
    const outUrl: string | undefined = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!outUrl) return json(200, { applied: false, url: clipUrl, reason: "no_output" });

    // Persist to our own storage (Replicate output URLs are ephemeral).
    const bytes = new Uint8Array(await (await fetch(outUrl)).arrayBuffer());
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const key = `breakout/${body.projectId ?? "adhoc"}/${body.shotId ?? Date.now()}.mp4`;
    const { error: upErr } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .upload(key, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) {
      console.error("[breakout-vfx] upload failed:", upErr.message);
      // Still better than nothing: hand back the (ephemeral) Replicate URL.
      return json(200, { applied: true, url: outUrl, ephemeral: true });
    }
    const { data } = supabase.storage.from(OUTPUT_BUCKET).getPublicUrl(key);
    console.log(`[breakout-vfx] applied → ${data.publicUrl}`);
    return json(200, { applied: true, url: data.publicUrl });
  } catch (e) {
    console.error("[breakout-vfx] unexpected error → passthrough:", e instanceof Error ? e.message : String(e));
    return json(200, { applied: false, url: clipUrl, reason: "exception" });
  }
});
