import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate HLS Playlist v2.0
 * 
 * Generates an HLS .m3u8 playlist from a project's video clips.
 * Called by UniversalVideoPlayer for multi-clip playback.
 * 
 * Input: { projectId }
 * Output: { success, hlsPlaylistUrl, clipUrls }
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validateAuth, unauthorizedResponse, forbiddenResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── OWNERSHIP GATE ───────────────────────────────────────────────────────
    // This handler uses the service-role client (RLS bypassed). Without an
    // explicit ownership check, any authenticated user could pass any projectId
    // and retrieve another user's private signed video URLs (IDOR).
    //
    // Access is allowed for, in order:
    //   • internal service-role callers — the render pipeline generating a
    //     playlist is not acting on behalf of a specific user and is trusted
    //     (holding the service-role key already implies full DB access);
    //   • a public project (is_public);
    //   • the project owner (user_id);
    //   • a member of the project's organization (checked below).
    const { data: proj, error: projErr } = await supabase
      .from("movie_projects")
      .select("user_id, organization_id, is_public")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr) throw new Error(`Failed to load project: ${projErr.message}`);
    if (!proj) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let allowed = auth.isServiceRole === true || proj.is_public === true || proj.user_id === auth.userId;
    if (!allowed && proj.organization_id && auth.userId) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", proj.organization_id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      allowed = !!membership;
    }
    if (!allowed) {
      return forbiddenResponse(corsHeaders, "You don't have access to this project.");
    }

    console.log(`[HLSPlaylist] Generating playlist for project ${projectId}`);

    // Get completed clips ordered by shot_index
    const { data: clips, error: clipsError } = await supabase
      .from("video_clips")
      .select("video_url, shot_index, duration_seconds")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .not("video_url", "is", null)
      .order("shot_index", { ascending: true });

    if (clipsError) throw new Error(`Failed to fetch clips: ${clipsError.message}`);
    if (!clips || clips.length === 0) {
      // Check if project has a single video_url
      const { data: project } = await supabase
        .from("movie_projects")
        .select("video_url")
        .eq("id", projectId)
        .maybeSingle();

      if (project?.video_url && typeof project.video_url === "string" && 
          (project.video_url.endsWith(".mp4") || project.video_url.endsWith(".webm"))) {
        return new Response(
          JSON.stringify({
            success: true,
            hlsPlaylistUrl: project.video_url,
            clipUrls: [project.video_url],
            clipCount: 1,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "No completed clips found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clipUrls = clips.map((c) => c.video_url).filter(Boolean) as string[];

    // Build M3U8 playlist
    let m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:";
    const maxDuration = Math.max(...clips.map((c) => c.duration_seconds || 6));
    m3u8 += `${maxDuration}\n#EXT-X-MEDIA-SEQUENCE:0\n`;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const duration = clip.duration_seconds || 6;
      // Each AI-generated clip is from a separate source — requires discontinuity tag
      if (i > 0) {
        m3u8 += `#EXT-X-DISCONTINUITY\n`;
      }
      m3u8 += `#EXTINF:${duration.toFixed(3)},\n${clip.video_url}\n`;
    }
    m3u8 += "#EXT-X-ENDLIST\n";

    // Upload playlist to storage
    const filename = `${projectId}/playlist-${Date.now()}.m3u8`;
    const { error: uploadError } = await supabase.storage
      .from("hls-playlists")
      .upload(filename, new TextEncoder().encode(m3u8), {
        contentType: "application/vnd.apple.mpegurl",
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[HLSPlaylist] Storage upload failed: ${uploadError.message}`);
      // Fallback: return clips directly for client-side playback
      return new Response(
        JSON.stringify({
          success: true,
          hlsPlaylistUrl: clipUrls[0], // First clip as fallback
          clipUrls,
          clipCount: clipUrls.length,
          note: "HLS storage upload failed, using direct clip URLs",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hlsPlaylistUrl = supabase.storage
      .from("hls-playlists")
      .getPublicUrl(filename).data.publicUrl;

    console.log(`[HLSPlaylist] ✅ Playlist created with ${clipUrls.length} clips`);

    // Cache HLS URL in project for faster subsequent loads
    try {
      const { data: existing } = await supabase
        .from("movie_projects")
        .select("pending_video_tasks")
        .eq("id", projectId)
        .maybeSingle();

      const existingTasks = (existing?.pending_video_tasks as Record<string, unknown>) || {};
      await supabase
        .from("movie_projects")
        .update({
          pending_video_tasks: {
            ...existingTasks,
            hlsPlaylistUrl,
            mseClipUrls: clipUrls,
          },
        })
        .eq("id", projectId);
    } catch (cacheErr) {
      console.warn("[HLSPlaylist] Cache update failed:", cacheErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        hlsPlaylistUrl,
        clipUrls,
        clipCount: clipUrls.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[HLSPlaylist] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: publicErrorMessage(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
