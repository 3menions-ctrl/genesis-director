import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function v4 - BACKGROUND CLOUD RUN
 * 
 * STRATEGY: Use background task so Cloud Run can take as long as needed
 * 1. Load all completed clips
 * 2. Return immediately with "processing" status
 * 3. Cloud Run processes in background via waitUntil
 * 4. Cloud Run calls finalize-stitch callback when done
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleStitchRequest {
  projectId: string;
  userId?: string;
  forceManifest?: boolean; // Skip Cloud Run and use manifest playback directly
}

interface ClipData {
  shotId: string;
  videoUrl: string;
  durationSeconds: number;
}

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId, forceManifest } = await req.json() as SimpleStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[SimpleStitch] Starting background Cloud Run stitch for project: ${projectId}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Load all completed clips
    console.log("[SimpleStitch] Step 1: Loading completed clips...");
    
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index');

    if (clipsError) {
      throw new Error(`Failed to load clips: ${clipsError.message}`);
    }

    if (!clips || clips.length === 0) {
      throw new Error("No completed clips found for this project");
    }

    console.log(`[SimpleStitch] Found ${clips.length} completed clips`);

    // Get project details
    const { data: project } = await supabase
      .from('movie_projects')
      .select('title, voice_audio_url, music_url')
      .eq('id', projectId)
      .single();

    // Prepare clip data
    const clipData: ClipData[] = clips.map((clip: { id: string; video_url: string; duration_seconds: number }) => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 6,
    }));

    const totalDuration = clipData.reduce((sum, c) => sum + c.durationSeconds, 0);

    // Check for Cloud Run - or use forceManifest to skip it
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (forceManifest) {
      console.log("[SimpleStitch] forceManifest=true - skipping Cloud Run, using manifest");
      return await createManifestFallback(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration, startTime);
    }
    
    if (!cloudRunUrl) {
      console.warn("[SimpleStitch] CLOUD_RUN_STITCHER_URL not configured - using manifest fallback");
      return await createManifestFallback(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration, startTime);
    }

    // Update project status to stitching
    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching',
        pending_video_tasks: {
          stage: 'stitching',
          progress: 50,
          mode: 'cloud_run_background',
          clipCount: clips.length,
          totalDuration,
          stitchingStarted: new Date().toISOString(),
          expectedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Step 2: Start Cloud Run in BACKGROUND
    console.log("[SimpleStitch] Step 2: Starting Cloud Run in background...");
    
    // Determine audio mode based on available tracks
    const hasVoice = !!project?.voice_audio_url;
    const hasMusic = !!project?.music_url;
    const audioMixMode = hasVoice ? 'voice_over' : (hasMusic ? 'background_music' : 'mute');
    
    console.log(`[SimpleStitch] Audio config: voice=${hasVoice}, music=${hasMusic}, mode=${audioMixMode}`);
    if (hasVoice) console.log(`[SimpleStitch] Voice URL: ${project?.voice_audio_url}`);
    if (hasMusic) console.log(`[SimpleStitch] Music URL: ${project?.music_url}`);

    const stitchRequest = {
      projectId,
      projectTitle: project?.title || 'Video',
      clips: clipData.map(c => ({
        shotId: c.shotId,
        videoUrl: c.videoUrl,
        durationSeconds: c.durationSeconds,
        transitionOut: 'fade',
      })),
      // Audio configuration - use project's audio tracks
      audioMixMode,
      voiceAudioUrl: project?.voice_audio_url || null,
      musicAudioUrl: project?.music_url || null,
      voiceVolume: 1.0,
      musicVolume: hasVoice ? 0.3 : 0.8, // Lower music if voice present
      transitionType: 'fade',
      transitionDuration: 0.3,
      colorGrading: 'cinematic',
      callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
      supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
      supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
    };

    // Background task - will continue after response is sent
    const backgroundProcess = async () => {
      const bgSupabase = createClient(supabaseUrl, supabaseKey);
      
      try {
        console.log("[SimpleStitch-BG] Calling Cloud Run with 120s timeout...");
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
        
        const response = await fetch(`${cloudRunUrl}/stitch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stitchRequest),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          console.log(`[SimpleStitch-BG] Cloud Run success: ${JSON.stringify(result).substring(0, 300)}`);
          
          if (result.success && result.finalVideoUrl) {
            // Update project with final video
            await bgSupabase
              .from('movie_projects')
              .update({
                status: 'completed',
                video_url: result.finalVideoUrl,
                pending_video_tasks: {
                  stage: 'complete',
                  progress: 100,
                  mode: 'cloud_run_stitched',
                  finalVideoUrl: result.finalVideoUrl,
                  clipCount: clips.length,
                  totalDuration,
                  stitchedAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', projectId);
            
            console.log(`[SimpleStitch-BG] ✅ Project ${projectId} completed with Cloud Run video`);
          } else {
            console.warn(`[SimpleStitch-BG] Cloud Run incomplete result, using fallback`);
            await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
          }
        } else {
          const errorText = await response.text();
          console.error(`[SimpleStitch-BG] Cloud Run error (${response.status}): ${errorText.substring(0, 200)}`);
          await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
        console.error(`[SimpleStitch-BG] ${isTimeout ? 'Cloud Run timeout' : 'Background process error'}:`, errorMessage);
        await fallbackToManifest(supabaseUrl, supabaseKey, projectId, project, clipData, clips.length, totalDuration);
      }
    };

    // Use waitUntil for background processing
    EdgeRuntime.waitUntil(backgroundProcess());

    console.log("[SimpleStitch] Returning immediately - Cloud Run processing in background");

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'cloud_run_background',
        status: 'stitching',
        message: 'Cloud Run stitching started in background',
        clipsProcessed: clips.length,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
        note: 'Video will be ready in ~2-5 minutes',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SimpleStitch] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Simple stitch failed",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback function to create manifest
async function fallbackToManifest(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  project: { title?: string; voice_audio_url?: string; music_url?: string } | null,
  clipData: ClipData[],
  clipCount: number,
  totalDuration: number
) {
  console.log("[SimpleStitch-BG] Creating manifest fallback...");
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
    clips: clipData.map((clip, index) => ({
      index,
      shotId: clip.shotId,
      videoUrl: clip.videoUrl,
      duration: clip.durationSeconds,
      startTime: clipData.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
    })),
    totalDuration,
    voiceUrl: project?.voice_audio_url || null,
    musicUrl: project?.music_url || null,
  };

  const fileName = `manifest_${projectId}_${Date.now()}.json`;
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  await supabase.storage
    .from('temp-frames')
    .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });

  const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

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
        clipCount,
        totalDuration,
        note: 'Cloud Run failed - using manifest playback',
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[SimpleStitch-BG] ✅ Fallback manifest created: ${manifestUrl}`);
}

// Helper for immediate manifest creation (when Cloud Run not configured)
async function createManifestFallback(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  project: { title?: string; voice_audio_url?: string; music_url?: string } | null,
  clipData: ClipData[],
  clipCount: number,
  totalDuration: number,
  startTime: number
) {
  console.log("[SimpleStitch] Creating manifest (no Cloud Run configured)...");
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const manifest = {
    version: "1.0",
    projectId,
    mode: "client_side_concat",
    createdAt: new Date().toISOString(),
    clips: clipData.map((clip, index) => ({
      index,
      shotId: clip.shotId,
      videoUrl: clip.videoUrl,
      duration: clip.durationSeconds,
      startTime: clipData.slice(0, index).reduce((sum, c) => sum + c.durationSeconds, 0),
    })),
    totalDuration,
    voiceUrl: project?.voice_audio_url || null,
    musicUrl: project?.music_url || null,
  };

  const fileName = `manifest_${projectId}_${Date.now()}.json`;
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  await supabase.storage
    .from('temp-frames')
    .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });

  const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;

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
        clipCount,
        totalDuration,
        completedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  return new Response(
    JSON.stringify({
      success: true,
      mode: 'manifest_playback',
      finalVideoUrl: manifestUrl,
      clipsProcessed: clipCount,
      totalDuration,
      processingTimeMs: Date.now() - startTime,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
