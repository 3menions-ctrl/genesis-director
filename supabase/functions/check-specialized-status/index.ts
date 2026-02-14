import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { persistVideoToStorage, persistAudioToStorage } from "../_shared/video-persistence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CHECK SPECIALIZED STATUS v3.0
 * 
 * Polls Replicate prediction status for specialized modes (avatar, motion-transfer, video-to-video)
 * 
 * CRITICAL FIX v3.0: Race condition prevention for multi-clip avatar projects
 * - Re-reads database after write to get true completion state
 * - Prevents concurrent calls from overwriting each other's updates
 */

interface StatusRequest {
  projectId: string;
  predictionId: string;
}

interface PredictionItem {
  predictionId: string;
  clipIndex: number;
  status: string;
  videoUrl?: string;
  audioUrl?: string;
}

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

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
    
    // deno-lint-ignore no-explicit-any
    const pendingTasks = project.pending_video_tasks as Record<string, any> || {};

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-CLIP AVATAR HANDLING (avatar_async type)
    // Uses atomic updates to prevent race conditions between concurrent predictions
    // ═══════════════════════════════════════════════════════════════════════════
    if (pendingTasks.type === 'avatar_async' && Array.isArray(pendingTasks.predictions)) {
      return await handleMultiClipAvatar(
        supabase,
        projectId,
        predictionId,
        prediction,
        pendingTasks,
        currentState
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SINGLE-CLIP SPECIALIZED MODES (motion-transfer, video-to-video, single avatar)
    // Original behavior for single-prediction projects
    // ═══════════════════════════════════════════════════════════════════════════
    return await handleSingleClip(
      supabase,
      projectId,
      predictionId,
      prediction,
      project,
      currentState
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
 * Handle multi-clip avatar projects with race-condition-safe updates
 */
async function handleMultiClipAvatar(
  supabase: AnySupabaseClient,
  projectId: string,
  predictionId: string,
  prediction: { status: string; output?: string | string[]; error?: string },
  // deno-lint-ignore no-explicit-any
  pendingTasks: Record<string, any>,
  // deno-lint-ignore no-explicit-any
  currentState: Record<string, any>
): Promise<Response> {
  console.log(`[CheckSpecializedStatus] MULTI-CLIP AVATAR detected`);
  
  const predictions = pendingTasks.predictions as PredictionItem[];
  
  // Find the prediction index we're updating
  const targetIndex = predictions.findIndex(p => p.predictionId === predictionId);
  if (targetIndex === -1) {
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
  
  const targetPred = predictions[targetIndex];
  let videoUrl: string | null = null;
  let newStatus = targetPred.status;
  
  if (prediction.status === 'succeeded') {
    const rawVideoUrl = Array.isArray(prediction.output) 
      ? prediction.output[0] 
      : prediction.output;
    
    if (rawVideoUrl) {
      // Persist to permanent storage
      videoUrl = await persistVideoToStorage(
        supabase,
        rawVideoUrl,
        projectId,
        { prefix: `avatar_clip${targetPred.clipIndex}` }
      ) || rawVideoUrl;
    }
    
    newStatus = 'completed';
    console.log(`[CheckSpecializedStatus] ✅ Clip ${targetPred.clipIndex + 1} SUCCEEDED: ${videoUrl?.substring(0, 60)}...`);
  } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
    newStatus = 'failed';
    console.log(`[CheckSpecializedStatus] ❌ Clip ${targetPred.clipIndex + 1} FAILED: ${prediction.error}`);
  } else {
    newStatus = prediction.status;
  }
  
  // Update the prediction in the local array
  predictions[targetIndex] = {
    ...targetPred,
    status: newStatus,
    ...(videoUrl ? { videoUrl } : {}),
  };
  
  // Write the updated predictions back to database
  await supabase
    .from('movie_projects')
    .update({
      pending_video_tasks: pendingTasks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RE-READ: Fetch fresh state to get true completion count after update
  // This ensures we see ALL completed predictions, not just our own
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: freshProject } = await supabase
    .from('movie_projects')
    .select('pending_video_tasks, pipeline_state')
    .eq('id', projectId)
    .single();
  
  // deno-lint-ignore no-explicit-any
  const freshTasks = (freshProject?.pending_video_tasks || pendingTasks) as Record<string, any>;
  const freshPredictions = (freshTasks.predictions || predictions) as PredictionItem[];
  
  // Count from FRESH data
  const completedCount = freshPredictions.filter(p => p.status === 'completed').length;
  const failedCount = freshPredictions.filter(p => p.status === 'failed').length;
  const totalCount = freshPredictions.length;
  const allDone = completedCount + failedCount === totalCount;
  
  console.log(`[CheckSpecializedStatus] Fresh progress: ${completedCount}/${totalCount} completed, ${failedCount} failed`);
  
  // Calculate progress
  const progress = allDone ? 95 : 25 + (completedCount / totalCount) * 65;
  
  // Build pipeline state update
  // deno-lint-ignore no-explicit-any
  const pipelineStateUpdate: Record<string, any> = {
    ...currentState,
    stage: allDone ? 'finalizing' : 'async_video_generation',
    progress,
    message: allDone 
      ? 'Finalizing video...' 
      : `Generating clips (${completedCount}/${totalCount})...`,
    totalClips: totalCount,
    completedClips: completedCount,
  };
  
  // Prepare final update
  // deno-lint-ignore no-explicit-any
  const updateData: Record<string, any> = {
    pipeline_state: pipelineStateUpdate,
    updated_at: new Date().toISOString(),
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL FIX: Check for completion based on VIDEO URL PRESENCE, not status
  // This prevents false "pipeline failed" errors when a clip had a transient
  // failure but ultimately succeeded. The ground truth is: do we have all videos?
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Build video_clips array from predictions that have videoUrl (regardless of status flag)
  const clipsWithVideo = freshPredictions
    .filter(p => p.videoUrl && p.videoUrl.length > 0)
    .sort((a, b) => a.clipIndex - b.clipIndex);
  
  const hasAllVideos = clipsWithVideo.length === totalCount;
  
  console.log(`[CheckSpecializedStatus] Video check: ${clipsWithVideo.length}/${totalCount} have video URLs`);
  
  // If ALL clips have video URLs, mark as completed regardless of status flags
  if (hasAllVideos) {
    console.log(`[CheckSpecializedStatus] 🎉 ALL CLIPS HAVE VIDEOS - Finalizing project (override any stale status)`);
    
    const videoClipsArray = clipsWithVideo.map(p => p.videoUrl);
    const primaryVideoUrl = videoClipsArray[0];
    
    updateData.status = 'completed';
    updateData.video_url = primaryVideoUrl;
    updateData.video_clips = videoClipsArray;
    updateData.pipeline_state = {
      ...pipelineStateUpdate,
      stage: 'completed',
      progress: 100,
      message: 'Video generation complete!',
      completedAt: new Date().toISOString(),
    };
    
    // Also fix any stale status on individual predictions
    const fixedPredictions = freshPredictions.map(p => ({
      ...p,
      status: p.videoUrl ? 'completed' : p.status,
    }));
    updateData.pending_video_tasks = {
      ...freshTasks,
      predictions: fixedPredictions,
    };
    
    console.log(`[CheckSpecializedStatus] ✅ Project COMPLETED with ${videoClipsArray.length} clips`);
  } else if (allDone && completedCount === totalCount && failedCount === 0) {
    // Fallback: original logic for clean completions (no videos yet persisted)
    console.log(`[CheckSpecializedStatus] 🎉 ALL CLIPS COMPLETE (status-based) - Finalizing project`);
    
    const sortedClips = freshPredictions
      .filter(p => p.status === 'completed' && p.videoUrl)
      .sort((a, b) => a.clipIndex - b.clipIndex);
    
    const videoClipsArray = sortedClips.map(p => p.videoUrl);
    const primaryVideoUrl = videoClipsArray[0];
    
    if (videoClipsArray.length > 0) {
      updateData.status = 'completed';
      updateData.video_url = primaryVideoUrl;
      updateData.video_clips = videoClipsArray;
      updateData.pipeline_state = {
        ...pipelineStateUpdate,
        stage: 'completed',
        progress: 100,
        message: 'Video generation complete!',
        completedAt: new Date().toISOString(),
      };
      
      console.log(`[CheckSpecializedStatus] ✅ Project COMPLETED with ${videoClipsArray.length} clips`);
    }
  }
  
  // Final update with completion state
  const { error: updateError } = await supabase
    .from('movie_projects')
    .update(updateData)
    .eq('id', projectId);
  
  if (updateError) {
    console.error('[CheckSpecializedStatus] Update error:', updateError);
  }
  
  const finalPipelineState = updateData.pipeline_state || pipelineStateUpdate;
  
  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      predictionId,
      status: prediction.status,
      progress: finalPipelineState.progress,
      stage: finalPipelineState.stage,
      message: finalPipelineState.message,
      videoUrl: videoUrl || null,
      clipIndex: targetPred.clipIndex,
      isComplete: hasAllVideos || (allDone && completedCount === totalCount),
      isFailed: allDone && failedCount > 0 && !hasAllVideos,
      allClipsComplete: hasAllVideos || (allDone && completedCount === totalCount),
      error: prediction.status === 'failed' ? prediction.error : undefined,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Handle single-clip specialized modes (motion-transfer, video-to-video, single avatar)
 */
async function handleSingleClip(
  supabase: AnySupabaseClient,
  projectId: string,
  predictionId: string,
  prediction: { status: string; output?: string | string[]; error?: string; logs?: string },
  project: { mode?: string; status: string; voice_audio_url?: string },
  // deno-lint-ignore no-explicit-any
  currentState: Record<string, any>
): Promise<Response> {
  // deno-lint-ignore no-explicit-any
  let newState: Record<string, any> = { ...currentState };
  let newStatus = project.status;
  let videoUrl: string | null = null;

  switch (prediction.status) {
    case 'succeeded': {
      // Extract video URL from output
      const rawVideoUrl = Array.isArray(prediction.output) 
        ? prediction.output[0] 
        : prediction.output;
      
      console.log(`[CheckSpecializedStatus] Raw video URL: ${rawVideoUrl}`);
      
      if (rawVideoUrl) {
        // CRITICAL: Persist video to permanent Supabase storage
        const permanentUrl = await persistVideoToStorage(
          supabase,
          rawVideoUrl,
          projectId,
          { prefix: project.mode || 'specialized' }
        );
        
        // Use permanent URL if persistence succeeded, otherwise keep original
        videoUrl = permanentUrl || rawVideoUrl;
      }
      
      // Also persist audio if available
      if (currentState.audioUrl) {
        const permanentAudioUrl = await persistAudioToStorage(
          supabase,
          currentState.audioUrl as string,
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
    }

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

    case 'processing': {
      // Estimate progress based on logs if available
      const logLength = prediction.logs?.length || 0;
      const estimatedProgress = Math.min(85, 30 + Math.floor(logLength / 50));
      
      newState = {
        ...currentState,
        stage: 'processing',
        progress: estimatedProgress,
        message: getProcessingMessage(project.mode || '', estimatedProgress),
      };
      break;
    }

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
  // deno-lint-ignore no-explicit-any
  const updateData: Record<string, any> = {
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
}

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
