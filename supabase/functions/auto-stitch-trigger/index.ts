import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * AUTO-STITCH TRIGGER
 * 
 * Lightweight function that:
 * 1. Checks if ALL clips for a project are completed
 * 2. If yes, immediately triggers Cloud Run stitching
 * 3. Updates project status appropriately
 * 
 * Called automatically when clips complete or manually from UI.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutoStitchRequest {
  projectId: string;
  userId?: string;
  forceStitch?: boolean; // Skip clip count validation
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { projectId, userId, forceStitch = false } = await req.json() as AutoStitchRequest;

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[AutoStitch] Checking project: ${projectId}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get project details
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, voice_audio_url, music_url')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message || 'Unknown'}`);
    }

    // Skip if already stitching or completed
    if (['stitching', 'completed'].includes(project.status) && !forceStitch) {
      console.log(`[AutoStitch] Project already ${project.status}, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: `Project already ${project.status}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get expected clip count from pending_video_tasks
    const tasks = project.pending_video_tasks as Record<string, unknown> | null;
    const expectedClipCount = (tasks?.clipCount as number) || 6;
    
    console.log(`[AutoStitch] Expected clip count: ${expectedClipCount}`);

    // Step 3: Count completed clips
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, video_url, duration_seconds, status')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index');

    if (clipsError) {
      throw new Error(`Failed to fetch clips: ${clipsError.message}`);
    }

    const completedCount = clips?.length || 0;
    console.log(`[AutoStitch] Completed clips: ${completedCount}/${expectedClipCount}`);

    // Step 4: Check if all clips are complete
    if (!forceStitch && completedCount < expectedClipCount) {
      console.log(`[AutoStitch] Not all clips complete yet (${completedCount}/${expectedClipCount})`);
      return new Response(
        JSON.stringify({
          success: true,
          readyToStitch: false,
          completedClips: completedCount,
          expectedClips: expectedClipCount,
          remaining: expectedClipCount - completedCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: All clips complete! Trigger stitching
    console.log(`[AutoStitch] ✅ All ${completedCount} clips complete - triggering stitch!`);

    // Update project status to stitching
    await supabase
      .from('movie_projects')
      .update({
        status: 'stitching',
        pending_video_tasks: {
          ...(tasks || {}),
          stage: 'stitching',
          progress: 85,
          autoStitchTriggered: true,
          triggeredAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Step 6: Call Cloud Run stitcher directly
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (!cloudRunUrl) {
      // Fallback to simple-stitch edge function
      console.log("[AutoStitch] No Cloud Run URL, calling simple-stitch...");
      
      const { data: stitchResult, error: stitchError } = await supabase.functions.invoke('simple-stitch', {
        body: { projectId, userId },
      });
      
      if (stitchError) {
        throw new Error(`Simple stitch failed: ${stitchError.message}`);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          readyToStitch: true,
          stitchMode: 'simple-stitch',
          stitchResult,
          completedClips: completedCount,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 7: Health check Cloud Run
    let cloudRunHealthy = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const healthResponse = await fetch(cloudRunUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        cloudRunHealthy = healthData.status === 'healthy';
        console.log(`[AutoStitch] Cloud Run health: ${cloudRunHealthy ? 'OK' : 'UNHEALTHY'}`);
      }
    } catch (err) {
      console.warn(`[AutoStitch] Cloud Run health check failed: ${err}`);
    }

    if (!cloudRunHealthy) {
      // Fallback to simple-stitch
      console.log("[AutoStitch] Cloud Run unhealthy, calling simple-stitch...");
      
      const { data: stitchResult, error: stitchError } = await supabase.functions.invoke('simple-stitch', {
        body: { projectId, userId },
      });
      
      if (stitchError) {
        throw new Error(`Simple stitch fallback failed: ${stitchError.message}`);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          readyToStitch: true,
          stitchMode: 'simple-stitch-fallback',
          reason: 'Cloud Run unavailable',
          stitchResult,
          completedClips: completedCount,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 8: Dispatch to Cloud Run
    console.log("[AutoStitch] Dispatching to Cloud Run...");
    
    const clipData = clips!.map(clip => ({
      shotId: clip.id,
      videoUrl: clip.video_url,
      durationSeconds: clip.duration_seconds || 4,
      transitionOut: 'fade',
    }));

    const stitchRequest = {
      projectId,
      projectTitle: project.title || 'Video',
      clips: clipData,
      voiceTrackUrl: project.voice_audio_url,
      backgroundMusicUrl: project.music_url,
      audioMixMode: (project.voice_audio_url || project.music_url) ? 'full' : 'mute',
      outputFormat: 'mp4',
      colorGrading: 'cinematic',
      isFinalAssembly: true,
      callbackUrl: `${supabaseUrl}/functions/v1/finalize-stitch`,
      supabaseUrl: supabaseUrl,
      supabaseServiceKey: supabaseKey,
    };

    // Use fire-and-forget pattern with background processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout

    try {
      const stitchResponse = await fetch(`${cloudRunUrl}/stitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stitchRequest),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!stitchResponse.ok) {
        const errorText = await stitchResponse.text();
        throw new Error(`Cloud Run returned ${stitchResponse.status}: ${errorText}`);
      }
      
      const stitchResult = await stitchResponse.json();
      console.log("[AutoStitch] Cloud Run response:", stitchResult);
      
      // If Cloud Run returned immediately with a video URL
      if (stitchResult.success && stitchResult.finalVideoUrl) {
        await supabase
          .from('movie_projects')
          .update({
            status: 'completed',
            video_url: stitchResult.finalVideoUrl,
            pending_video_tasks: {
              ...(tasks || {}),
              stage: 'complete',
              progress: 100,
              finalVideoUrl: stitchResult.finalVideoUrl,
              completedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          readyToStitch: true,
          stitchMode: 'cloud-run',
          stitchResult,
          completedClips: completedCount,
          processingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error(`[AutoStitch] Cloud Run request failed: ${errorMsg}`);
      
      // If it was a timeout, Cloud Run might still complete via callback
      if (errorMsg.includes('abort')) {
        return new Response(
          JSON.stringify({
            success: true,
            readyToStitch: true,
            stitchMode: 'cloud-run-async',
            message: 'Request timed out but Cloud Run may complete via callback',
            completedClips: completedCount,
            processingTimeMs: Date.now() - startTime,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error("[AutoStitch] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Auto-stitch failed",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
