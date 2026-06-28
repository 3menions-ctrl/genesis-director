// ─────────────────────────────────────────────────────────────────────────
// generate-storyboard — previz keyframes the director approves BEFORE spending
// video credits.
//
// Generates a FLUX keyframe per shot and writes it into
// movie_projects.scene_images — the exact { sceneNumber, imageUrl, prompt }
// shape the pipeline already reads to SEED each clip's image-to-video start
// frame. So approved keyframes become the render seeds with NO pipeline change.
//
// Owner-gated + credit-gated (image gen is cheap vs. video). Supports
// regenerating a single shot ({ shotIndex }) or the whole board ({ } -> all).
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  validateAuth,
  unauthorizedResponse,
  assertProjectOwnership,
} from "../_shared/auth-guard.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SCENE_BUCKET = "scene-images";
const COST_PER_FRAME = 3;
const DAILY_CAP = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// deno-lint-ignore no-explicit-any
function shotsFromProject(project: any): any[] {
  const tasks = project?.pending_video_tasks;
  if (tasks?.script?.shots && Array.isArray(tasks.script.shots)) return tasks.script.shots;
  if (project?.generated_script) {
    try {
      const parsed = typeof project.generated_script === "string"
        ? JSON.parse(project.generated_script) : project.generated_script;
      if (parsed?.shots && Array.isArray(parsed.shots)) return parsed.shots;
    } catch { /* ignore */ }
  }
  return [];
}

// deno-lint-ignore no-explicit-any
function buildPrompt(shot: any): string {
  const bits: string[] = [];
  bits.push(shot.description || shot.title || "cinematic scene");
  if (shot.cameraScale) bits.push(`${shot.cameraScale} shot`);
  if (shot.cameraAngle) bits.push(`${String(shot.cameraAngle).replace("-", " ")} angle`);
  if (shot.mood) bits.push(`${shot.mood} mood`);
  if (Array.isArray(shot.visualAnchors) && shot.visualAnchors.length) bits.push(shot.visualAnchors.join(", "));
  if (shot.lightingHint) bits.push(shot.lightingHint);
  bits.push("cinematic film still, photorealistic, dramatic lighting, shallow depth of field, high detail, 8k");
  return bits.join(". ").slice(0, 2400);
}

async function fluxKeyframe(prompt: string, apiKey: string): Promise<string> {
  const submit = async (model: string) =>
    fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { prompt, aspect_ratio: "16:9", output_format: "png", output_quality: 100, prompt_upsampling: true, safety_tolerance: 5 },
      }),
    });

  let res = await submit("black-forest-labs/flux-1.1-pro-ultra");
  if (!res.ok) res = await submit("black-forest-labs/flux-1.1-pro"); // fallback
  if (!res.ok) throw new Error(`flux_${res.status}: ${(await res.text()).slice(0, 160)}`);
  let pred = await res.json();

  const deadline = Date.now() + 120_000;
  while (pred.status !== "succeeded") {
    if (pred.status === "failed" || pred.status === "canceled") throw new Error(`flux_${pred.status}`);
    if (Date.now() > deadline) throw new Error("flux_timeout");
    await sleep(2500);
    pred = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then((r) => r.json());
  }
  const out = pred.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (typeof url !== "string") throw new Error("flux_no_output");
  return url;
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
    const onlyShot: number | null = (body.shotIndex ?? null) === null ? null : Number(body.shotIndex);
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forbidden = await assertProjectOwnership(supabase, auth, projectId, corsHeaders);
    if (forbidden) return forbidden;

    const { data: project } = await supabase
      .from("movie_projects")
      .select("generated_script, pending_video_tasks, scene_images")
      .eq("id", projectId)
      .maybeSingle();

    const shots = shotsFromProject(project);
    if (shots.length === 0) {
      return new Response(JSON.stringify({ error: "no_shots", message: "No script shots to storyboard yet." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targets = onlyShot !== null
      ? (onlyShot >= 0 && onlyShot < shots.length ? [onlyShot] : [])
      : shots.map((_, i) => i);
    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: "bad_shot_index" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("REPLICATE_API_KEY")!;
    if (!apiKey) throw new Error("REPLICATE_API_KEY not configured");

    const gateCtx = {
      supabase, fnName: "generate-storyboard", userId: auth.userId, isServiceRole: auth.isServiceRole,
      projectId, cost: COST_PER_FRAME * targets.length, dailyCap: DAILY_CAP, corsHeaders,
    };
    const blocked = await preflightAiGate(gateCtx);
    if (blocked) return blocked;

    // Existing scene_images keyed by sceneNumber (1-based).
    const existing = Array.isArray(project?.scene_images) ? project!.scene_images : [];
    // deno-lint-ignore no-explicit-any
    const byScene = new Map<number, any>();
    for (const e of existing) if (e?.sceneNumber) byScene.set(e.sceneNumber, e);

    const frames: { index: number; imageUrl: string }[] = [];
    for (const i of targets) {
      const prompt = buildPrompt(shots[i]);
      const fluxUrl = await fluxKeyframe(prompt, apiKey);

      // Persist to storage.
      let imageUrl = fluxUrl;
      try {
        const bytes = new Uint8Array(await (await fetch(fluxUrl)).arrayBuffer());
        const key = `${projectId}/scene-${i + 1}-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from(SCENE_BUCKET).upload(key, bytes, {
          contentType: "image/png", upsert: true,
        });
        if (!upErr) imageUrl = supabase.storage.from(SCENE_BUCKET).getPublicUrl(key).data.publicUrl;
      } catch (e) {
        console.warn("[generate-storyboard] persist failed, using flux url:", e);
      }

      byScene.set(i + 1, { sceneNumber: i + 1, imageUrl, prompt });
      frames.push({ index: i, imageUrl });
    }

    const merged = Array.from(byScene.values()).sort((a, b) => a.sceneNumber - b.sceneNumber);
    await supabase
      .from("movie_projects")
      .update({ scene_images: merged, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    const charged = await chargeAiGate(gateCtx);

    return new Response(JSON.stringify({ success: true, frames, cost: charged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[generate-storyboard]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
