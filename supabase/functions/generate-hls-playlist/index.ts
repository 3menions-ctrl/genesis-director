import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Generate HLS Playlist Edge Function
 * 
 * Creates an HLS master playlist (m3u8) that references video clips in sequence.
 * This enables seamless playback on iOS Safari which cannot use MSE properly.
 * 
 * Strategy:
 * - Generate #EXT-X-DISCONTINUITY tags between clips (required for different sources)
 * - Calculate accurate durations from video_clips table
 * - Store playlist in Supabase storage for persistence
 * 
 * CRITICAL: This is the key to seamless iOS Safari playback.
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
    // ═══ AUTH GUARD: Prevent unauthorized access ═══
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

    // Check if we have clips, if not check for avatar-style videos in pending_video_tasks
    let avatarClips: Array<{ id: string; shot_index: number; video_url: string; duration_seconds: number; quality_score: number | null }> = [];
    let expectedClipCount = 0;
    let isAvatarMode = false;
    
    if (!clips || clips.length === 0) {
      // Fetch project to check for avatar-style videos
      const { data: projectData, error: projectError } = await supabase
        .from('movie_projects')
        .select('pending_video_tasks, video_url, mode')
        .eq('id', projectId)
        .single();
      
      isAvatarMode = projectData?.mode === 'avatar';
      
      if (!projectError && projectData?.pending_video_tasks) {
        const tasks = projectData.pending_video_tasks as Record<string, unknown>;
        const predictions = tasks.predictions as Array<{ videoUrl?: string; status?: string; clipIndex?: number }> | undefined;
        
        // CRITICAL: Track expected clip count to prevent premature completion
        expectedClipCount = predictions?.length || 0;
        
        if (predictions && Array.isArray(predictions)) {
          avatarClips = predictions
            .filter(p => p.videoUrl && p.status === 'completed')
            .map((p, idx) => ({
              id: `avatar-clip-${idx}`,
              shot_index: p.clipIndex ?? idx,
              video_url: p.videoUrl as string,
              duration_seconds: 10, // Avatar clips are typically 10s
              quality_score: 1,
            }));
          
          console.log(`[HLS-Playlist] Found ${avatarClips.length}/${expectedClipCount} avatar clips in pending_video_tasks`);
          
          // CRITICAL FIX: Block HLS generation if not all clips are complete
          if (isAvatarMode && expectedClipCount > 0 && avatarClips.length < expectedClipCount) {
            console.log(`[HLS-Playlist] ⏸️ BLOCKING: Only ${avatarClips.length}/${expectedClipCount} clips ready - waiting for all clips`);
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
        
        // Also check for single video_url on project
        if (avatarClips.length === 0 && projectData.video_url && typeof projectData.video_url === 'string') {
          const videoUrl = projectData.video_url;
          if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.includes('/video-clips/')) {
            avatarClips = [{
              id: 'avatar-single-clip',
              shot_index: 0,
              video_url: videoUrl,
              duration_seconds: 10,
              quality_score: 1,
            }];
            console.log(`[HLS-Playlist] Using project video_url as single clip`);
          }
        }
      }
    }

    const allClips = (clips && clips.length > 0) ? clips : avatarClips;

    if (allClips.length === 0) {
      // Return graceful response instead of error - project may be a draft
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

    // Ensure isAvatarMode is set correctly (may not have been set if clips came from video_clips table)
    if (project?.mode === 'avatar') {
      isAvatarMode = true;
    }

    const pipelineState = project?.pipeline_state as Record<string, unknown> | null;
    // Check both pipeline_state and voice_audio_url for master audio
    // Avatar mode stores master audio in voice_audio_url column
    const masterAudioUrl = (pipelineState?.masterAudioUrl as string) || project?.voice_audio_url || undefined;

    // Calculate total duration
    const totalDuration = orderedClips.reduce((sum, c) => sum + (c.duration_seconds || 5), 0);

    /**
     * CRITICAL ARCHITECTURE NOTE:
     * We do NOT generate an HLS m3u8 playlist here anymore.
     * 
     * Veo/Kling MP4 outputs are standard (non-fragmented) MP4 containers.
     * hls.js requires either MPEG-TS or fragmented MP4 (fMP4) as HLS segments.
     * Using raw MP4 URLs in an m3u8 causes a hard MEDIA_ERROR in hls.js on every browser.
     * 
     * Instead, we return clip URLs directly for MSE crossfade playback in the browser.
     * This is the correct, reliable approach for multi-clip Veo/Kling projects.
     */

    const clipUrls = orderedClips.map(c => c.video_url);
    const clipData = orderedClips.map((clip, index) => ({
      index,
      shotId: clip.id,
      videoUrl: clip.video_url,
      duration: clip.duration_seconds || 5,
      startTime: orderedClips.slice(0, index).reduce((sum, c) => sum + (c.duration_seconds || 5), 0),
    }));

    // Fetch existing pending_video_tasks to preserve watchdog metadata
    const { data: existingProject } = await supabase
      .from('movie_projects')
      .select('pending_video_tasks, status')
      .eq('id', projectId)
      .single();

    const existingTasks = existingProject?.pending_video_tasks as Record<string, unknown> || {};
    const shouldMarkComplete = !isAvatarMode || existingProject?.status === 'completed';

    // Store clip URLs in pending_video_tasks so the player can use them directly
    const updatedTasks = {
      ...existingTasks,
      stage: shouldMarkComplete ? 'complete' : existingTasks.stage,
      progress: shouldMarkComplete ? 100 : existingTasks.progress,
      mode: 'mse_direct',
      // CRITICAL: Store clip URLs so UniversalVideoPlayer can play without HLS
      mseClipUrls: clipUrls,
      clipCount: orderedClips.length,
      totalDuration,
      // Remove any stale hlsPlaylistUrl to prevent player from attempting broken HLS
      hlsPlaylistUrl: null,
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

    console.log(`[HLS-Playlist] ✅ MSE direct mode - returning ${clipUrls.length} clip URLs`);
    console.log(`[HLS-Playlist] ✅ Processing time: ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        // Return mse_direct mode — player will use these URLs for crossfade playback
        mode: 'mse_direct',
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
