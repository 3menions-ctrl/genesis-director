import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * generate-project-trailer — assembles a 15s trailer cut from a project's
 * best 5 shots and writes the URL back to project_shares.
 *
 * Strategy:
 *   1. Pull all completed video_clips for the project, ordered by created_at
 *   2. Pick the top 5 (by duration or shot_index — heuristic v1)
 *   3. Call seamless-stitcher with a "trailer" preset (each clip clamped to 3s)
 *   4. Write the resulting MP4 URL into project_shares.trailer_url
 *
 * Idempotent — if a trailer already exists for the project it returns
 * the existing one unless `force=true` is passed.
 */

interface TrailerRequest {
  projectId: string;
  force?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { validateAuth, unauthorizedResponse } = await import(
      "../_shared/auth-guard.ts"
    );
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body = (await req.json()) as TrailerRequest;
    if (!body.projectId) throw new Error("projectId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify ownership.
    const { data: project } = await supabase
      .from("movie_projects")
      .select("id, user_id, title")
      .eq("id", body.projectId)
      .maybeSingle();
    if (!project || project.user_id !== auth.userId) {
      return new Response(
        JSON.stringify({ error: "not_owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check existing share.
    const { data: existing } = await supabase
      .from("project_shares")
      .select("id, trailer_url, trailer_generated_at")
      .eq("project_id", body.projectId)
      .maybeSingle();

    if (existing?.trailer_url && !body.force) {
      return new Response(
        JSON.stringify({
          ok: true,
          trailer_url: existing.trailer_url,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull top 5 shots.
    const { data: clips } = await supabase
      .from("video_clips")
      .select("id, video_url, shot_index, duration_seconds, created_at")
      .eq("project_id", body.projectId)
      .eq("status", "completed")
      .not("video_url", "is", null)
      .order("shot_index", { ascending: true })
      .limit(8);

    const selected = (clips ?? [])
      .filter((c: { video_url: string | null }) => c.video_url)
      .slice(0, 5);

    if (selected.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "no_clips",
          message: "No completed clips available to assemble.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // P1-12: use the stitcher's real CLIPS mode. The old request body used field
    // names the stitcher never reads, so it fell through to project-mode and
    // re-rendered the FULL film as the "trailer". Clips mode takes
    // clips:[{url,duration}] (per-clip clamp) + a sessionId, intro off.
    const trailerClips = selected.map((c: { video_url: string | null; duration_seconds: number | null }) => ({
      url: c.video_url as string,
      duration: Math.min(3, Number(c.duration_seconds) || 3),
    }));
    const { data: stitchResult, error: stitchError } = await supabase.functions
      .invoke("seamless-stitcher", {
        body: {
          clips: trailerClips,
          sessionId: `trailer-${body.projectId}`,
          includeIntro: false,
        },
      });

    if (stitchError) {
      console.error("[generate-trailer] stitch error:", stitchError);
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "stitch_failed",
          message: stitchError.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let trailerUrl =
      (stitchResult as { finalVideoUrl?: string; url?: string })?.finalVideoUrl ??
      (stitchResult as { url?: string })?.url ??
      null;

    // P1-12/P0-1: the stitcher returns a 24h signed URL. Persist it durably so the
    // public share page doesn't 404 a day later.
    if (trailerUrl) {
      const { persistVideoToStorage, isTemporaryReplicateUrl } = await import(
        "../_shared/video-persistence.ts"
      );
      if (isTemporaryReplicateUrl(trailerUrl)) {
        const persisted = await persistVideoToStorage(
          supabase as unknown as Parameters<typeof persistVideoToStorage>[0],
          trailerUrl,
          body.projectId,
          { prefix: "trailer" },
        );
        if (persisted) trailerUrl = persisted;
      }
    }

    if (trailerUrl) {
      // Upsert into project_shares so the public page can render it.
      await supabase.from("project_shares").upsert(
        {
          project_id: body.projectId,
          user_id: auth.userId,
          slug:
            existing?.id != null
              ? undefined
              : `${(project.title ?? "trailer")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .slice(0, 32)}-${crypto.randomUUID().slice(0, 4)}`,
          trailer_url: trailerUrl,
          trailer_generated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        trailer_url: trailerUrl,
        clips_used: selected.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[generate-trailer] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: publicErrorMessage(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
