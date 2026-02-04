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
    
    if (!clips || clips.length === 0) {
      // Fetch project to check for avatar-style videos
      const { data: projectData, error: projectError } = await supabase
        .from('movie_projects')
        .select('pending_video_tasks, video_url')
        .eq('id', projectId)
        .single();
      
      if (!projectError && projectData?.pending_video_tasks) {
        const tasks = projectData.pending_video_tasks as Record<string, unknown>;
        const predictions = tasks.predictions as Array<{ videoUrl?: string; status?: string; clipIndex?: number }> | undefined;
        
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
          
          console.log(`[HLS-Playlist] Found ${avatarClips.length} avatar clips in pending_video_tasks`);
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

    const pipelineState = project?.pipeline_state as Record<string, unknown> | null;
    // Check both pipeline_state and voice_audio_url for master audio
    // Avatar mode stores master audio in voice_audio_url column
    const masterAudioUrl = (pipelineState?.masterAudioUrl as string) || project?.voice_audio_url || undefined;

    // Calculate total duration
    const totalDuration = orderedClips.reduce((sum, c) => sum + (c.duration_seconds || 5), 0);

    // Generate HLS playlist content
    // Using #EXT-X-DISCONTINUITY between each clip since they're from different sources
    let playlistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...orderedClips.map(c => c.duration_seconds || 5)))}
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
`;

    // Add each clip with discontinuity marker
    orderedClips.forEach((clip, index) => {
      const duration = clip.duration_seconds || 5;
      
      if (index > 0) {
        // Discontinuity tag for clip boundaries
        playlistContent += `#EXT-X-DISCONTINUITY\n`;
      }
      
      playlistContent += `#EXTINF:${duration.toFixed(6)},\n`;
      playlistContent += `${clip.video_url}\n`;
    });

    playlistContent += `#EXT-X-ENDLIST\n`;

    // Upload playlist to storage
    const timestamp = Date.now();
    const playlistFileName = `hls_${projectId}_${timestamp}.m3u8`;
    const playlistBytes = new TextEncoder().encode(playlistContent);

    await supabase.storage
      .from('temp-frames')
      .upload(playlistFileName, playlistBytes, { 
        contentType: 'application/vnd.apple.mpegurl',
        upsert: true 
      });

    const hlsUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${playlistFileName}`;

    // Create comprehensive manifest with both HLS and raw clip data
    const manifestData = {
      version: "3.0",
      projectId,
      createdAt: new Date().toISOString(),
      mode: "hls_native",
      hlsPlaylistUrl: hlsUrl,
      clips: orderedClips.map((clip, index) => ({
        index,
        shotId: clip.id,
        videoUrl: clip.video_url,
        duration: clip.duration_seconds || 5,
        startTime: orderedClips.slice(0, index).reduce((sum, c) => sum + (c.duration_seconds || 5), 0),
      })),
      totalDuration,
      masterAudioUrl: masterAudioUrl || null,
      voiceUrl: masterAudioUrl || project?.voice_audio_url || null,
      musicUrl: project?.music_url || null,
      audioConfig: {
        muteClipAudio: !!masterAudioUrl,
        musicVolume: project?.include_narration ? 0.3 : 0.8,
      },
    };

    // Save manifest
    const manifestFileName = `manifest_hls_${projectId}_${timestamp}.json`;
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestData, null, 2));

    await supabase.storage
      .from('temp-frames')
      .upload(manifestFileName, manifestBytes, { 
        contentType: 'application/json',
        upsert: true 
      });

    const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${manifestFileName}`;

    // Update project with HLS playlist URL
    await supabase
      .from('movie_projects')
      .update({
        status: 'completed',
        video_url: manifestUrl,
        pending_video_tasks: {
          stage: 'complete',
          progress: 100,
          mode: 'hls_native',
          manifestUrl,
          hlsPlaylistUrl: hlsUrl,
          clipCount: orderedClips.length,
          totalDuration,
          completedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[HLS-Playlist] ✅ Generated HLS playlist: ${hlsUrl}`);
    console.log(`[HLS-Playlist] ✅ Processing time: ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'hls_native',
        hlsPlaylistUrl: hlsUrl,
        manifestUrl,
        clipsProcessed: orderedClips.length,
        totalDuration,
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
