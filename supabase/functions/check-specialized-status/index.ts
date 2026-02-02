import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { persistVideoToStorage, persistAudioToStorage } from "../_shared/video-persistence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CHECK SPECIALIZED STATUS v2.0
 * 
 * Polls Replicate prediction status for specialized modes (avatar, motion-transfer, video-to-video)
 * 
 * CRITICAL FIX: For multi-clip avatar projects (type: 'avatar_async'), this function:
 * 1. Updates individual prediction status in pending_video_tasks
 * 2. Does NOT mark project as completed - that's the watchdog's job
 * 3. Lets watchdog handle final completion after ALL clips finish
 */

interface StatusRequest {
  projectId: string;
  predictionId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const replicateApiKey = Deno.env.get("REPLICATE_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { projectId, predictionId }: StatusRequest = await req.json();

    if (!projectId || !predictionId) {
      return new Response(
        JSON.stringify({ error: "projectId and predictionId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CheckSpecializedStatus] Checking prediction ${predictionId} for project ${projectId}`);

    // Fetch current project state
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('mode, pipeline_state, status, voice_audio_url, pending_video_tasks')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }

    // Check Replicate prediction status
    const predictionResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Bearer ${replicateApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!predictionResponse.ok) {
      throw new Error(`Replicate API error: ${predictionResponse.status}`);
    }

    const prediction = await predictionResponse.json();
    console.log(`[CheckSpecializedStatus] Prediction status: ${prediction.status}`);

    const currentState = typeof project.pipeline_state === 'string' 
      ? JSON.parse(project.pipeline_state) 
      : project.pipeline_state || {};
    
    const pendingTasks = project.pending_video_tasks as Record<string, unknown> || {};

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-CLIP AVATAR HANDLING (avatar_async type)
    // For multi-clip projects, update individual prediction status only
    // DO NOT mark project as completed - let watchdog handle that
    // ═══════════════════════════════════════════════════════════════════════════
    if (pendingTasks.type === 'avatar_async' && Array.isArray(pendingTasks.predictions)) {
      console.log(`[CheckSpecializedStatus] MULTI-CLIP AVATAR detected (${(pendingTasks.predictions as unknown[]).length} clips)`);
      
      const predictions = pendingTasks.predictions as Array<{
        predictionId: string;
        clipIndex: number;
        status: string;
        videoUrl?: string;
        audioUrl?: string;
      }>;
      
      // Find the prediction we're checking
      const targetPred = predictions.find(p => p.predictionId === predictionId);
      if (!targetPred) {
        console.warn(`[CheckSpecializedStatus] Prediction ${predictionId} not found in pending_video_tasks`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: prediction.status,
            message: 'Prediction not tracked in this project',
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let videoUrl: string | null = null;
      
      if (prediction.status === 'succeeded') {
        const rawVideoUrl = Array.isArray(prediction.output) 
          ? prediction.output[0] 
          : prediction.output;
        
        // Persist to permanent storage
        videoUrl = await persistVideoToStorage(
          supabase,
          rawVideoUrl,
          projectId,
          { prefix: `avatar_clip${targetPred.clipIndex}` }
        ) || rawVideoUrl;
        
        targetPred.status = 'completed';
        targetPred.videoUrl = videoUrl || undefined;
        console.log(`[CheckSpecializedStatus] ✅ Clip ${targetPred.clipIndex + 1} SUCCEEDED: ${videoUrl?.substring(0, 60)}...`);
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        targetPred.status = 'failed';
        console.log(`[CheckSpecializedStatus] ❌ Clip ${targetPred.clipIndex + 1} FAILED: ${prediction.error}`);
      } else {
        // Still processing - update status but don't complete
        targetPred.status = prediction.status;
      }
      
      // Count completed vs total
      const completedCount = predictions.filter(p => p.status === 'completed').length;
      const failedCount = predictions.filter(p => p.status === 'failed').length;
      const totalCount = predictions.length;
      const allDone = completedCount + failedCount === totalCount;
      
      console.log(`[CheckSpecializedStatus] Progress: ${completedCount}/${totalCount} completed, ${failedCount} failed`);
      
      // Calculate progress
      const progress = allDone ? 95 : 25 + (completedCount / totalCount) * 65;
      
      // Update pending_video_tasks with latest prediction status
      const updateData: Record<string, unknown> = {
        pending_video_tasks: pendingTasks,
        pipeline_state: {
          ...currentState,
          stage: allDone ? 'finalizing' : 'async_video_generation',
          progress,
          message: allDone 
            ? 'Finalizing video...' 
            : `Generating clips (${completedCount}/${totalCount})...`,
          totalClips: totalCount,
          completedClips: completedCount,
        },
        updated_at: new Date().toISOString(),
      };
      
      // CRITICAL: Do NOT set status to 'completed' here!
      // The watchdog will handle final completion and stitching
      // Only mark completed if this is the LAST clip AND all succeeded
      if (allDone && completedCount === totalCount && failedCount === 0) {
        console.log(`[CheckSpecializedStatus] 🎉 ALL CLIPS COMPLETE - Triggering watchdog completion`);
        
        // Build video_clips array from completed predictions
        const sortedClips = predictions
          .filter(p => p.status === 'completed' && p.videoUrl)
          .sort((a, b) => a.clipIndex - b.clipIndex);
        
        const videoClipsArray = sortedClips.map(p => p.videoUrl);
        const primaryVideoUrl = videoClipsArray[0];
        
        updateData.status = 'completed';
        updateData.video_url = primaryVideoUrl;
        updateData.video_clips = videoClipsArray;
        updateData.pipeline_state = {
          ...currentState,
          stage: 'completed',
          progress: 100,
          message: 'Video generation complete!',
          completedAt: new Date().toISOString(),
          totalClips: totalCount,
          completedClips: completedCount,
        };
        
        console.log(`[CheckSpecializedStatus] ✅ Project COMPLETED with ${videoClipsArray.length} clips`);
      }
      
      const { error: updateError } = await supabase
        .from('movie_projects')
        .update(updateData)
        .eq('id', projectId);
      
      if (updateError) {
        console.error('[CheckSpecializedStatus] Update error:', updateError);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          projectId,
          predictionId,
          status: prediction.status,
          progress,
          stage: allDone ? 'finalizing' : 'async_video_generation',
          message: allDone 
            ? 'Finalizing video...' 
            : `Generating clips (${completedCount}/${totalCount})...`,
          videoUrl: targetPred.videoUrl || null,
          clipIndex: targetPred.clipIndex,
          isComplete: prediction.status === 'succeeded',
          isFailed: prediction.status === 'failed' || prediction.status === 'canceled',
          allClipsComplete: allDone && completedCount === totalCount,
          error: prediction.status === 'failed' ? prediction.error : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SINGLE-CLIP SPECIALIZED MODES (motion-transfer, video-to-video, single avatar)
    // Original behavior for single-prediction projects
    // ═══════════════════════════════════════════════════════════════════════════
    let newState = { ...currentState };
    let newStatus = project.status;
    let videoUrl = null;

    switch (prediction.status) {
      case 'succeeded':
        // Extract video URL from output
        let rawVideoUrl = Array.isArray(prediction.output) 
          ? prediction.output[0] 
          : prediction.output;
        
        console.log(`[CheckSpecializedStatus] Raw video URL: ${rawVideoUrl}`);
        
        // CRITICAL: Persist video to permanent Supabase storage
        const permanentUrl = await persistVideoToStorage(
          supabase,
          rawVideoUrl,
          projectId,
          { prefix: project.mode || 'specialized' }
        );
        
        // Use permanent URL if persistence succeeded, otherwise keep original
        videoUrl = permanentUrl || rawVideoUrl;
        
        // Also persist audio if available
        if (currentState.audioUrl) {
          const permanentAudioUrl = await persistAudioToStorage(
            supabase,
            currentState.audioUrl,
            projectId
          );
          if (permanentAudioUrl) {
            newState.audioUrl = permanentAudioUrl;
          }
        }
        
        newState = {
          ...newState,
          stage: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
          message: 'Video generation complete!',
        };
        newStatus = 'completed';
        
        console.log(`[CheckSpecializedStatus] ✅ Success! Permanent URL: ${videoUrl}`);
        break;

      case 'failed':
      case 'canceled':
        newState = {
          ...currentState,
          stage: 'failed',
          progress: 0,
          error: prediction.error || 'Generation failed',
          message: prediction.error || 'Video generation failed',
        };
        newStatus = 'failed';
        
        console.log(`[CheckSpecializedStatus] Failed: ${prediction.error}`);
        break;

      case 'processing':
        // Estimate progress based on logs if available
        const logLength = prediction.logs?.length || 0;
        const estimatedProgress = Math.min(85, 30 + Math.floor(logLength / 50));
        
        newState = {
          ...currentState,
          stage: 'processing',
          progress: estimatedProgress,
          message: getProcessingMessage(project.mode, estimatedProgress),
        };
        break;

      case 'starting':
        newState = {
          ...currentState,
          stage: 'starting',
          progress: 15,
          message: 'AI model is warming up...',
        };
        break;

      default:
        // Keep current state
        break;
    }

    // Update project
    const updateData: Record<string, unknown> = {
      pipeline_state: newState,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (videoUrl) {
      updateData.video_url = videoUrl;
    }

    const { error: updateError } = await supabase
      .from('movie_projects')
      .update(updateData)
      .eq('id', projectId);

    if (updateError) {
      console.error('[CheckSpecializedStatus] Update error:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        predictionId,
        status: prediction.status,
        progress: newState.progress,
        stage: newState.stage,
        message: newState.message,
        videoUrl,
        audioUrl: currentState.audioUrl || project.voice_audio_url,
        isComplete: prediction.status === 'succeeded',
        isFailed: prediction.status === 'failed' || prediction.status === 'canceled',
        error: prediction.status === 'failed' ? prediction.error : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CheckSpecializedStatus] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Get contextual processing message based on mode and progress
 */
function getProcessingMessage(mode: string, progress: number): string {
  if (mode === 'avatar') {
    if (progress < 30) return 'Analyzing facial features...';
    if (progress < 50) return 'Synchronizing lip movements to audio...';
    if (progress < 70) return 'Rendering lip-synced frames...';
    if (progress < 85) return 'Matching mouth to speech...';
    return 'Finalizing lip-synced avatar...';
  }
  
  if (mode === 'video-to-video') {
    if (progress < 40) return 'Analyzing visual style patterns...';
    if (progress < 60) return 'Applying artistic transformation...';
    if (progress < 80) return 'Rendering stylized frames...';
    return 'Encoding final video...';
  }
  
  if (mode === 'motion-transfer') {
    if (progress < 40) return 'Extracting motion vectors...';
    if (progress < 60) return 'Mapping pose to target...';
    if (progress < 80) return 'Rendering motion animation...';
    return 'Finalizing transfer...';
  }
  
  return 'AI is generating your video...';
}
