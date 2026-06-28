// ─────────────────────────────────────────────────────────────────────────
// route-shots — the per-shot model auto-router backend.
//
// Loads a project's shot list, scores each shot against every video engine
// (shot-engine-router), and persists the winning engine per shot into
// movie_projects.routing_map. generate-single-clip then renders each shot on
// its routed engine instead of one engine for the whole film.
//
// Pure compute (no Replicate / LLM call) → owner-gated but NOT credit-charged.
// Cinema-tier engines (veo/runway/sora) are only offered when the project was
// created with a cinema engine (proves the user can use them) — so the router
// never assigns an engine the caller isn't entitled to.
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  validateAuth,
  unauthorizedResponse,
  assertProjectOwnership,
} from "../_shared/auth-guard.ts";
import { routeShots, type ShotForRouting, type EngineToken } from "../_shared/shot-engine-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CINEMA_ENGINES = new Set(["veo", "runway", "sora"]);

// deno-lint-ignore no-explicit-any
function shotsFromProject(project: any): ShotForRouting[] {
  // Prefer the approved/pending script shots; fall back to generated_script.
  let raw: any[] | null = null;
  const tasks = project?.pending_video_tasks;
  if (tasks?.script?.shots && Array.isArray(tasks.script.shots)) {
    raw = tasks.script.shots;
  } else if (project?.generated_script) {
    try {
      const parsed = typeof project.generated_script === "string"
        ? JSON.parse(project.generated_script)
        : project.generated_script;
      if (parsed?.shots && Array.isArray(parsed.shots)) raw = parsed.shots;
    } catch {
      raw = null;
    }
  }
  if (!raw) return [];
  return raw.map((s, idx) => ({
    index: idx,
    durationSeconds: s.durationSeconds ?? s.duration ?? 5,
    dialogue: s.dialogue ?? null,
    sceneType: s.sceneType ?? null,
    cameraScale: s.cameraScale ?? null,
    movementType: s.movementType ?? null,
    motionDirection: s.motionDirection ?? null,
    mood: s.mood ?? null,
    hasCharacters: Array.isArray(s.characters) ? s.characters.length > 0 : undefined,
    visualAnchors: Array.isArray(s.visualAnchors) ? s.visualAnchors : null,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const body = await req.json().catch(() => ({}));
    const projectId: string | null = body.projectId ?? null;
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const forbidden = await assertProjectOwnership(supabase, auth, projectId, corsHeaders);
    if (forbidden) return forbidden;

    const { data: project } = await supabase
      .from("movie_projects")
      .select("video_engine, generated_script, pending_video_tasks")
      .eq("id", projectId)
      .maybeSingle();

    const shots = shotsFromProject(project);
    if (shots.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_shots", message: "No script shots to route yet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Offer cinema engines only when the project already uses one (entitlement-safe).
    const allowCinema = CINEMA_ENGINES.has((project?.video_engine as string) ?? "");
    const routing = routeShots(shots, { allowCinema });

    // routing_map: { [index]: { engine, engineLabel, score, reasons } }
    const routingMap: Record<string, unknown> = {};
    for (const r of routing) {
      routingMap[String(r.index)] = {
        engine: r.engine,
        engineLabel: r.engineLabel,
        score: r.score,
        reasons: r.reasons,
      };
    }

    await supabase
      .from("movie_projects")
      .update({ routing_map: routingMap, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return new Response(
      JSON.stringify({ success: true, allowCinema, routing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[route-shots]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// keep EngineToken referenced for type-only import stripping safety
export type { EngineToken };
