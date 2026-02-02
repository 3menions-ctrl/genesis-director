import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function v7 - MANIFEST-ONLY MODE
 * 
 * Creates a playback manifest for client-side video concatenation.
 * Uses the browser-based SmartStitcherPlayer for seamless playback.
 * 
 * No external Cloud Run dependency - fully self-contained.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleStitchRequest {
  projectId: string;
  userId?: string;
}

interface ClipData {
  shotId: string;
  videoUrl: string;
  durationSeconds: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId } = await req.json() as SimpleStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[SimpleStitch] Starting manifest creation for project: ${projectId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // IRON-CLAD BEST CLIP SELECTION
    // Step 1: Load ALL completed clips with quality_score
    // Then select the BEST clip per shot_index (highest quality_score)
    // =====================================================
    console.log("[SimpleStitch] Loading completed clips with quality scores...");
    
    const { data: allClips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds, quality_score, created_at')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index')
      .order('quality_score', { ascending: false, nullsFirst: false });

    if (clipsError) {
      throw new Error(`Failed to load clips: ${clipsError.message}`);
    }

    if (!allClips || allClips.length === 0) {
      throw new Error("No completed clips found for this project");
    }

    console.log(`[SimpleStitch] Found ${allClips.length} total completed clip versions`);
    
    // =====================================================
    // BEST CLIP SELECTION ALGORITHM
    // For each shot_index, pick the clip with:
    // 1. Highest quality_score (if available)
    // 2. Most recent (latest created_at) if scores are null/equal
    // =====================================================
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
          console.log(`[SimpleStitch] Shot ${clip.shot_index}: Upgraded to clip ${clip.id.substring(0, 8)} (score: ${newScore} > ${existingScore})`);
        } else if (newScore === existingScore && clip.created_at > existing.created_at) {
          bestClipsMap.set(clip.shot_index, clip);
          console.log(`[SimpleStitch] Shot ${clip.shot_index}: Upgraded to newer clip ${clip.id.substring(0, 8)} (same score: ${newScore})`);
        }
      }
    }
    
    // Convert map to sorted array
    const clips = Array.from(bestClipsMap.values()).sort((a, b) => a.shot_index - b.shot_index);
    
    // Log quality summary
    const MINIMUM_QUALITY_THRESHOLD = 65;
    const lowQualityClips = clips.filter(c => c.quality_score !== null && c.quality_score < MINIMUM_QUALITY_THRESHOLD);
    
    console.log(`[SimpleStitch] Selected ${clips.length} BEST clips from ${allClips.length} total versions`);
    
    if (lowQualityClips.length > 0) {
      console.warn(`[SimpleStitch] ⚠️ WARNING: ${lowQualityClips.length} clip(s) below quality threshold (${MINIMUM_QUALITY_THRESHOLD})`);
    }

    // Get project details
    const { data: project } = await supabase
      .from('movie_projects')
      .select('title, voice_audio_url, music_url, user_id, include_narration, pipeline_state, mode')
      .eq('id', projectId)
      .single();

    // Prepare clip data
    const clipData: ClipData[] = clips.map((clip: { id: string; video_url: string; duration_seconds: number }) => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 6,
    }));

    const totalDuration = clipData.reduce((sum, c) => sum + c.durationSeconds, 0);

    // Create manifest for client-side playback
    console.log("[SimpleStitch] Creating playback manifest...");
    
    const timestamp = Date.now();
    const includeNarration = project?.include_narration === true;
    
    // Check for master audio in pipeline_state (avatar multi-clip projects)
    const pipelineState = project?.pipeline_state as Record<string, unknown> | null;
    const masterAudioUrl = pipelineState?.masterAudioUrl as string | undefined;
    const isAvatarProject = project?.mode === 'avatar' || !!masterAudioUrl;
    
    // For avatar projects with master audio, use that for seamless playback
    // Otherwise fall back to project voice_audio_url
    const voiceAudioUrl = masterAudioUrl || (includeNarration ? (project?.voice_audio_url || null) : null);
    
    console.log(`[SimpleStitch] Audio config: isAvatar=${isAvatarProject}, masterAudio=${!!masterAudioUrl}, voiceUrl=${!!voiceAudioUrl}`);
    
    // =========================================================================
    // GENERATE HLS PLAYLIST FOR iOS SAFARI
    // Creates an M3U8 file with discontinuity markers between clips
    // =========================================================================
    
    let hlsPlaylistUrl: string | null = null;
    try {
      // Calculate max duration for target duration header
      const maxClipDuration = Math.ceil(Math.max(...clipData.map(c => c.durationSeconds)));
      
      let hlsContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${maxClipDuration}
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
`;

      clipData.forEach((clip, index) => {
        if (index > 0) {
          // Discontinuity tag required between different source clips
          hlsContent += `#EXT-X-DISCONTINUITY\n`;
        }
        hlsContent += `#EXTINF:${clip.durationSeconds.toFixed(6)},\n`;
        hlsContent += `${clip.videoUrl}\n`;
      });
      
      hlsContent += `#EXT-X-ENDLIST\n`;
      
      const hlsFileName = `hls_${projectId}_${timestamp}.m3u8`;
      const hlsBytes = new TextEncoder().encode(hlsContent);
      
      await supabase.storage
        .from('temp-frames')
        .upload(hlsFileName, hlsBytes, { 
          contentType: 'application/vnd.apple.mpegurl',
          upsert: true 
        });
      
      hlsPlaylistUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${hlsFileName}`;
      console.log(`[SimpleStitch] ✅ HLS playlist created: ${hlsPlaylistUrl}`);
    } catch (hlsErr) {
      console.warn("[SimpleStitch] HLS generation failed (non-fatal):", hlsErr);
    }
    
    // =========================================================================
    // CREATE JSON MANIFEST
    // =========================================================================
    
    const manifest = {
      version: "2.2",
      projectId,
      mode: "client_side_concat",
      createdAt: new Date().toISOString(),
      // HLS URL for iOS Safari native playback
      hlsPlaylistUrl,
      clips: clipData.map((clip, index) => ({
        index,
        shotId: clip.shotId,
        videoUrl: clip.videoUrl,
        duration: clip.durationSeconds,
        startTime: clipData.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
        transitionOut: 'fade',
      })),
      totalDuration,
      // CRITICAL: Use master audio for seamless playback in avatar projects
      voiceUrl: voiceAudioUrl,
      masterAudioUrl: masterAudioUrl || null,
      isAvatarProject,
      musicUrl: project?.music_url || null,
      audioConfig: {
        includeNarration: includeNarration || isAvatarProject,
        // Avatar projects should mute individual clip audio since we use master track
        muteClipAudio: isAvatarProject && !!masterAudioUrl,
        musicVolume: (includeNarration || isAvatarProject) ? 0.3 : 0.8,
        fadeIn: 1,
        fadeOut: 2,
      },
    };

    const fileName = `manifest_${projectId}_${timestamp}.json`;
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestBytes = new TextEncoder().encode(manifestJson);

    await supabase.storage
      .from('temp-frames')
      .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });

    const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

    // Update project to completed
    await supabase
      .from('movie_projects')
      .update({
        status: 'completed',
        video_url: manifestUrl,
        pending_video_tasks: {
          stage: 'complete',
          progress: 100,
          mode: 'manifest_playback',
          manifestUrl,
          hlsPlaylistUrl,
          clipCount: clips.length,
          totalDuration,
          completedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[SimpleStitch] ✅ Manifest created: ${manifestUrl}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'manifest_playback',
        finalVideoUrl: manifestUrl,
        manifestUrl,
        clipsProcessed: clips.length,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[SimpleStitch] Error:", errorMsg);
    
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
