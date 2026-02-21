import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Generate HLS Playlist Edge Function v2
 * 
 * Creates a REAL HLS playlist (m3u8) with #EXT-X-DISCONTINUITY tags
 * for seamless playback. Also returns clip URLs for crossfade fallback.
 * 
 * Strategy:
 * - Safari/iOS: Native HLS handles raw MP4 with discontinuity markers = gapless
 * - Chrome/Firefox: hls.js attempts HLS; if raw MP4 segments fail, player
 *   falls back to crossfade mode using the returned clipUrls
 * - Always stores hlsPlaylistUrl so all future plays attempt HLS first
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HLSPlaylistRequest {
  projectId: string;
  userId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    const { projectId } = await req.json() as HLSPlaylistRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[HLS-Playlist] Generating HLS for project: ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all completed clips ordered by shot_index
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds, quality_score')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index')
      .order('quality_score', { ascending: false, nullsFirst: false });

    if (clipsError) {
      throw new Error(`Failed to fetch clips: ${clipsError.message}`);
    }

    // Check for avatar-style videos if no clips in video_clips table
    let avatarClips: Array<{ id: string; shot_index: number; video_url: string; duration_seconds: number; quality_score: number | null }> = [];
    let expectedClipCount = 0;
    let isAvatarMode = false;
    
    if (!clips || clips.length === 0) {
      const { data: projectData, error: projectError } = await supabase
        .from('movie_projects')
        .select('pending_video_tasks, video_url, mode')
        .eq('id', projectId)
        .single();
      
      isAvatarMode = projectData?.mode === 'avatar';
      
      if (!projectError && projectData?.pending_video_tasks) {
        const tasks = projectData.pending_video_tasks as Record<string, unknown>;
        
        // Check for mseClipUrls (recovered projects)
        const mseClipUrls = tasks.mseClipUrls as string[] | undefined;
        if (mseClipUrls && Array.isArray(mseClipUrls) && mseClipUrls.length > 0) {
          const clipDuration = (tasks.totalDuration as number || mseClipUrls.length * 6) / mseClipUrls.length;
          avatarClips = mseClipUrls.map((url, idx) => ({
            id: `mse-clip-${idx}`,
            shot_index: idx,
            video_url: url,
            duration_seconds: clipDuration,
            quality_score: 1,
          }));
          console.log(`[HLS-Playlist] Found ${avatarClips.length} clips from mseClipUrls`);
        }
        
        // Check for avatar predictions
        if (avatarClips.length === 0) {
          const predictions = tasks.predictions as Array<{ videoUrl?: string; status?: string; clipIndex?: number }> | undefined;
          expectedClipCount = predictions?.length || 0;
          
          if (predictions && Array.isArray(predictions)) {
            avatarClips = predictions
              .filter(p => p.videoUrl && p.status === 'completed')
              .map((p, idx) => ({
                id: `avatar-clip-${idx}`,
                shot_index: p.clipIndex ?? idx,
                video_url: p.videoUrl as string,
                duration_seconds: 10,
                quality_score: 1,
              }));
            
            console.log(`[HLS-Playlist] Found ${avatarClips.length}/${expectedClipCount} avatar clips`);
            
            if (isAvatarMode && expectedClipCount > 0 && avatarClips.length < expectedClipCount) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: `Only ${avatarClips.length} of ${expectedClipCount} clips ready`,
                  reason: "clips_pending",
                  clipsReady: avatarClips.length,
                  clipsExpected: expectedClipCount,
                  processingTimeMs: Date.now() - startTime,
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
        
        // Single video_url fallback
        if (avatarClips.length === 0 && projectData.video_url && typeof projectData.video_url === 'string') {
          const videoUrl = projectData.video_url;
          if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.includes('/video-clips/')) {
            avatarClips = [{
              id: 'single-clip',
              shot_index: 0,
              video_url: videoUrl,
              duration_seconds: 10,
              quality_score: 1,
            }];
          }
        }
      }
    }

    const allClips = (clips && clips.length > 0) ? clips : avatarClips;

    if (allClips.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No completed clips found for this project",
          reason: "draft_or_incomplete",
          processingTimeMs: Date.now() - startTime,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select best clip per shot_index
    const bestClipsMap = new Map<number, typeof allClips[0]>();
    for (const clip of allClips) {
      const existing = bestClipsMap.get(clip.shot_index);
      if (!existing) {
        bestClipsMap.set(clip.shot_index, clip);
      } else {
        const existingScore = existing.quality_score ?? -1;
        const newScore = clip.quality_score ?? -1;
        if (newScore > existingScore) {
          bestClipsMap.set(clip.shot_index, clip);
        }
      }
    }

    const orderedClips = Array.from(bestClipsMap.values()).sort((a, b) => a.shot_index - b.shot_index);
    console.log(`[HLS-Playlist] Processing ${orderedClips.length} clips`);

    // Get project audio configuration
    const { data: project } = await supabase
      .from('movie_projects')
      .select('voice_audio_url, music_url, include_narration, pipeline_state, mode')
      .eq('id', projectId)
      .single();

    if (project?.mode === 'avatar') {
      isAvatarMode = true;
    }

    const pipelineState = project?.pipeline_state as Record<string, unknown> | null;
    const masterAudioUrl = (pipelineState?.masterAudioUrl as string) || project?.voice_audio_url || undefined;

    // Calculate total duration
    const totalDuration = orderedClips.reduce((sum, c) => sum + (c.duration_seconds || 5), 0);

    // ═══════════════════════════════════════════════════════════════════
    // GENERATE REAL HLS PLAYLIST (m3u8) WITH DISCONTINUITY MARKERS
    // Safari native HLS handles raw MP4 with discontinuity tags = gapless
    // Chrome/Firefox: hls.js will attempt; falls back to crossfade if it fails
    // ═══════════════════════════════════════════════════════════════════
    
    let hlsPlaylistUrl: string | null = null;
    const timestamp = Date.now();
    
    try {
      const maxClipDuration = Math.ceil(Math.max(...orderedClips.map(c => c.duration_seconds || 5)));
      
      let hlsContent = `#EXTM3U\n`;
      hlsContent += `#EXT-X-VERSION:3\n`;
      hlsContent += `#EXT-X-TARGETDURATION:${maxClipDuration}\n`;
      hlsContent += `#EXT-X-MEDIA-SEQUENCE:0\n`;
      hlsContent += `#EXT-X-PLAYLIST-TYPE:VOD\n`;

      orderedClips.forEach((clip, index) => {
        if (index > 0) {
          hlsContent += `#EXT-X-DISCONTINUITY\n`;
        }
        hlsContent += `#EXTINF:${(clip.duration_seconds || 5).toFixed(6)},\n`;
        hlsContent += `${clip.video_url}\n`;
      });
      
      hlsContent += `#EXT-X-ENDLIST\n`;
      
      const hlsFileName = `hls_${projectId}_${timestamp}.m3u8`;
      const hlsBytes = new TextEncoder().encode(hlsContent);
      
      const { error: uploadError } = await supabase.storage
        .from('temp-frames')
        .upload(hlsFileName, hlsBytes, { 
          contentType: 'application/vnd.apple.mpegurl',
          upsert: true 
        });
      
      if (uploadError) {
        console.warn(`[HLS-Playlist] HLS upload failed:`, uploadError);
      } else {
        hlsPlaylistUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${hlsFileName}`;
        console.log(`[HLS-Playlist] ✅ HLS playlist created: ${hlsPlaylistUrl}`);
      }
    } catch (hlsErr) {
      console.warn("[HLS-Playlist] HLS generation failed (non-fatal):", hlsErr);
    }

    // Build clip data for crossfade fallback
    const clipUrls = orderedClips.map(c => c.video_url);
    const clipData = orderedClips.map((clip, index) => ({
      index,
      shotId: clip.id,
      videoUrl: clip.video_url,
      duration: clip.duration_seconds || 5,
      startTime: orderedClips.slice(0, index).reduce((sum, c) => sum + (c.duration_seconds || 5), 0),
    }));

    // Fetch existing pending_video_tasks to preserve metadata
    const { data: existingProject } = await supabase
      .from('movie_projects')
      .select('pending_video_tasks, status')
      .eq('id', projectId)
      .single();

    const existingTasks = existingProject?.pending_video_tasks as Record<string, unknown> || {};
    const shouldMarkComplete = !isAvatarMode || existingProject?.status === 'completed';

    // Store BOTH hlsPlaylistUrl and mseClipUrls so player can try HLS first, crossfade as fallback
    const updatedTasks = {
      ...existingTasks,
      stage: shouldMarkComplete ? 'complete' : existingTasks.stage,
      progress: shouldMarkComplete ? 100 : existingTasks.progress,
      mode: 'mse_direct',
      // HLS playlist for gapless playback (Safari native, hls.js attempt)
      hlsPlaylistUrl: hlsPlaylistUrl,
      // Clip URLs for crossfade fallback
      mseClipUrls: clipUrls,
      clipCount: orderedClips.length,
      totalDuration,
      mseGeneratedAt: new Date().toISOString(),
      ...(shouldMarkComplete ? { completedAt: new Date().toISOString() } : {}),
    };

    const updatePayload: Record<string, unknown> = {
      pending_video_tasks: updatedTasks,
      updated_at: new Date().toISOString(),
    };

    if (shouldMarkComplete) {
      updatePayload.status = 'completed';
    }

    await supabase
      .from('movie_projects')
      .update(updatePayload)
      .eq('id', projectId);

    console.log(`[HLS-Playlist] ✅ Done - HLS: ${!!hlsPlaylistUrl}, Clips: ${clipUrls.length}, Time: ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        // Return both modes so player can try HLS first, crossfade as fallback
        mode: hlsPlaylistUrl ? 'hls_with_fallback' : 'mse_direct',
        hlsPlaylistUrl: hlsPlaylistUrl || null,
        clipUrls,
        clips: clipData,
        totalDuration,
        masterAudioUrl: masterAudioUrl || null,
        clipsProcessed: orderedClips.length,
        processingTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[HLS-Playlist] Error:", errorMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
