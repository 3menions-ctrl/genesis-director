import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    // Invoke seamless-stitcher with trailer cut settings.
    const { data: stitchResult, error: stitchError } = await supabase.functions
      .invoke("seamless-stitcher", {
        body: {
          projectId: body.projectId,
          userId: auth.userId,
          mode: "trailer",
          maxClipSeconds: 3,
          clipsOverride: selected.map((c: { id: string; video_url: string | null }) => ({
            id: c.id,
            video_url: c.video_url,
          })),
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

    const trailerUrl =
      (stitchResult as { finalVideoUrl?: string })?.finalVideoUrl ?? null;

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
        error: error instanceof Error ? error.message : "Unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
