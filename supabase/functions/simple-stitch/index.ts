import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Simple Stitch Edge Function v3 - QUALITY FIRST
 * 
 * STRATEGY: Always use Cloud Run (Google FFmpeg) for proper stitching
 * 1. Load all completed clips
 * 2. Call Cloud Run for real MP4 stitching (WAIT for result)
 * 3. Only create manifest as FALLBACK if Cloud Run fails
 * 
 * This ensures users get the highest quality stitched video.
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

    console.log(`[SimpleStitch] Starting QUALITY-FIRST stitch for project: ${projectId}`);

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
    const clipData: ClipData[] = clips.map(clip => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 4,
    }));

    const totalDuration = clipData.reduce((sum, c) => sum + c.durationSeconds, 0);

    // Step 2: Try Cloud Run for REAL stitching (quality first)
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (cloudRunUrl) {
      console.log("[SimpleStitch] Step 2: Calling Cloud Run for quality stitching...");
      
      const stitchRequest = {
        projectId,
        projectTitle: project?.title || 'Video',
        clips: clipData.map(c => ({
          shotId: c.shotId,
          videoUrl: c.videoUrl,
          durationSeconds: c.durationSeconds,
          transitionOut: 'fade',
        })),
        audioMixMode: 'mute',
        transitionType: 'fade',
        transitionDuration: 0.3,
        colorGrading: 'cinematic',
        callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
        supabaseUrl: Deno.env.get("EXTERNAL_SUPABASE_URL") || supabaseUrl,
        supabaseServiceKey: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || supabaseKey,
      };

      try {
        // Use a longer timeout for quality - wait for Cloud Run to finish
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
        
        const response = await fetch(`${cloudRunUrl}/stitch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stitchRequest),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          console.log(`[SimpleStitch] Cloud Run response: ${JSON.stringify(result).substring(0, 200)}`);
          
          // Check if we got a real video URL
          if (result.success && result.finalVideoUrl) {
            console.log(`[SimpleStitch] ✅ Cloud Run stitching SUCCESS: ${result.finalVideoUrl}`);
            
            // Update project with the REAL stitched video
            await supabase
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
            
            return new Response(
              JSON.stringify({
                success: true,
                mode: 'cloud_run_stitched',
                finalVideoUrl: result.finalVideoUrl,
                clipsProcessed: clips.length,
                totalDuration,
                processingTimeMs: Date.now() - startTime,
                note: 'High quality stitched MP4 ready',
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn(`[SimpleStitch] Cloud Run returned incomplete result: ${JSON.stringify(result)}`);
          }
        } else {
          const errorText = await response.text();
          console.error(`[SimpleStitch] Cloud Run error (${response.status}): ${errorText.substring(0, 200)}`);
        }
      } catch (cloudRunError) {
        console.error(`[SimpleStitch] Cloud Run failed: ${cloudRunError}`);
      }
    } else {
      console.warn("[SimpleStitch] CLOUD_RUN_STITCHER_URL not configured");
    }

    // Step 3: FALLBACK - Create manifest for client-side playback
    console.log("[SimpleStitch] Step 3: FALLBACK - Creating manifest for client-side playback...");
    
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

    const { error: uploadError } = await supabase.storage
      .from('temp-frames')
      .upload(fileName, manifestBytes, { contentType: 'application/json', upsert: true });
    
    if (uploadError) {
      console.error(`[SimpleStitch] Manifest upload failed: ${uploadError.message}`);
      throw new Error(`Manifest upload failed: ${uploadError.message}`);
    }

    const manifestUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
    console.log(`[SimpleStitch] ✅ Fallback manifest created: ${manifestUrl}`);

    // Update project as completed with manifest (fallback mode)
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
          clipCount: clips.length,
          totalDuration,
          note: 'Cloud Run unavailable - using manifest playback',
          completedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[SimpleStitch] ✅ Project completed with manifest fallback`);

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'manifest_playback',
        finalVideoUrl: manifestUrl,
        clipsProcessed: clips.length,
        totalDuration,
        processingTimeMs: Date.now() - startTime,
        note: 'Manifest fallback - Cloud Run was unavailable',
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
