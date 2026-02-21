import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * RESUME-AVATAR-PIPELINE
 * 
 * Resumes stalled avatar video generation from the last checkpoint.
 * 
 * Kling V3 native audio pipeline — no separate audio merge needed.
 * Recovery paths:
 * - video_rendering: Check if Kling V3 prediction completed, otherwise restart
 * - lip_sync: Check if Kling lip-sync completed, otherwise use video as-is
 * - audio_merge (legacy): Use video-only since Kling V3 bakes audio natively
 * - failed/unknown: Restart via generate-avatar-direct
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kling V3 — unified engine
const KLING_V3_URL = "https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions";
const KLING_LIP_SYNC_URL = "https://api.replicate.com/v1/models/kwaivgi/kling-lip-sync/predictions";

interface ResumeRequest {
  projectId: string;
  forceRestart?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ AUTH GUARD ═══
  const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
  const auth = await validateAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

  if (!REPLICATE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "REPLICATE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { projectId, forceRestart = false }: ResumeRequest = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[ResumePipeline] ═══════════════════════════════════════════════════════════`);
    console.log(`[ResumePipeline] Resuming avatar pipeline for project: ${projectId}`);
    console.log(`[ResumePipeline] Force restart: ${forceRestart}`);
    console.log(`[ResumePipeline] Engine: Kling V3 (kwaivgi/kling-v3-video)`);
    console.log(`[ResumePipeline] ═══════════════════════════════════════════════════════════`);

    // Fetch project state
    const { data: project, error: fetchError } = await supabase
      .from('movie_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (project.mode !== 'avatar') {
      throw new Error(`Project ${projectId} is not an avatar project (mode: ${project.mode})`);
    }

    const pipelineState = (project.pipeline_state || {}) as Record<string, unknown>;
    const stage = pipelineState.stage as string;
    const videoUrl = pipelineState.videoUrl as string | undefined;
    const audioUrl = pipelineState.audioUrl as string | undefined;

    console.log(`[ResumePipeline] Current stage: ${stage}`);
    console.log(`[ResumePipeline] Has video: ${!!videoUrl}`);
    console.log(`[ResumePipeline] Has audio: ${!!audioUrl}`);

    // If force restart or no checkpoint, start from beginning with Kling V3
    if (forceRestart || !stage || stage === 'failed') {
      console.log(`[ResumePipeline] Starting fresh Kling V3 avatar generation...`);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          script: project.generated_script || project.script_content || 'Hello, welcome!',
          avatarImageUrl: project.source_image_url,
          voiceId: project.avatar_voice_id || 'bella',
          sceneDescription: project.setting || '',
          projectId: project.id,
          userId: project.user_id,
          aspectRatio: project.aspect_ratio || '16:9',
        }),
      });

      const result = await response.json();
      
      return new Response(
        JSON.stringify({ success: result.success, action: 'restarted', result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RESUME FROM CHECKPOINT
    let finalVideoUrl: string | null = null;
    let action = 'unknown';

    if (stage === 'video_rendering') {
      // Check if Kling V3 prediction completed
      const predictionId = pipelineState.predictionId as string;
      
      if (predictionId) {
        console.log(`[ResumePipeline] Checking Kling V3 prediction ${predictionId}...`);
        
        const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
        });
        const prediction = await statusRes.json();
        
        if (prediction.status === "succeeded" && prediction.output) {
          finalVideoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          action = 'prediction_recovered';
          console.log(`[ResumePipeline] ✅ Kling V3 prediction completed (native audio baked in)`);
        } else if (prediction.status === "failed") {
          console.log(`[ResumePipeline] Prediction failed, restarting with Kling V3...`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Video prediction failed - requires full restart',
              action: 'needs_restart',
              suggestion: 'Call with forceRestart: true',
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log(`[ResumePipeline] Prediction still processing: ${prediction.status}`);
          return new Response(
            JSON.stringify({
              success: true,
              action: 'still_processing',
              predictionStatus: prediction.status,
              message: 'Kling V3 video is still generating, no action needed',
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        throw new Error('No prediction ID found for video_rendering stage');
      }
    } else if (stage === 'lip_sync') {
      // Kling lip-sync stage — check if lip-sync prediction completed
      const lipSyncPredictionId = pipelineState.lipSyncPredictionId as string;
      if (lipSyncPredictionId) {
        console.log(`[ResumePipeline] Checking Kling lip-sync prediction ${lipSyncPredictionId}...`);
        const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${lipSyncPredictionId}`, {
          headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
        });
        const prediction = await statusRes.json();
        if (prediction.status === "succeeded" && prediction.output) {
          finalVideoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          action = 'lip_sync_recovered';
        } else {
          // Lip-sync failed/pending — use the base video (Kling V3 already has native audio)
          finalVideoUrl = videoUrl || null;
          action = 'lip_sync_fallback_to_native';
          console.log(`[ResumePipeline] Lip-sync not ready, using Kling V3 native audio video`);
        }
      } else if (videoUrl) {
        finalVideoUrl = videoUrl;
        action = 'lip_sync_skipped';
      }
    } else if (stage === 'audio_merge' && videoUrl) {
      // LEGACY: audio_merge stage from old pipeline
      // Kling V3 native audio means we can skip the merge — just use video
      console.log(`[ResumePipeline] Legacy audio_merge stage — using video as-is (Kling V3 native audio)`);
      finalVideoUrl = videoUrl;
      action = 'legacy_audio_merge_skipped';
    } else if (stage === 'completed') {
      return new Response(
        JSON.stringify({ success: true, action: 'already_completed', videoUrl: project.video_url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error(`Cannot resume from stage: ${stage}`);
    }

    // Update project to completed — copy to permanent storage if needed
    if (finalVideoUrl) {
      let permanentVideoUrl = finalVideoUrl;
      
      if (finalVideoUrl.includes('replicate.delivery')) {
        console.log(`[ResumePipeline] Copying video to permanent storage...`);
        
        try {
          const videoResponse = await fetch(finalVideoUrl);
          if (videoResponse.ok) {
            const videoBlob = await videoResponse.blob();
            const videoArrayBuffer = await videoBlob.arrayBuffer();
            const videoBytes = new Uint8Array(videoArrayBuffer);
            
            const fileName = `avatar_${projectId}_${Date.now()}.mp4`;
            const storagePath = `avatar-videos/${projectId}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('video-clips')
              .upload(storagePath, videoBytes, {
                contentType: 'video/mp4',
                upsert: true,
              });
            
            if (!uploadError) {
              permanentVideoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${storagePath}`;
              console.log(`[ResumePipeline] ✅ Video copied to permanent storage`);
            } else {
              console.warn(`[ResumePipeline] Storage upload failed, using original URL:`, uploadError.message);
            }
          }
        } catch (storageError) {
          console.warn(`[ResumePipeline] Failed to copy to permanent storage:`, storageError);
        }
      }
      
      const { error: updateError } = await supabase.from('movie_projects').update({
        status: 'completed',
        video_url: permanentVideoUrl,
        voice_audio_url: audioUrl || null,
        pipeline_state: {
          ...pipelineState,
          stage: 'completed',
          progress: 100,
          videoUrl: permanentVideoUrl,
          originalReplicateUrl: finalVideoUrl !== permanentVideoUrl ? finalVideoUrl : undefined,
          message: 'Video generation complete!',
          completedAt: new Date().toISOString(),
          recoveredBy: 'resume-avatar-pipeline',
          recoveryAction: action,
          engine: 'kwaivgi/kling-v3-video',
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);

      if (updateError) {
        console.error(`[ResumePipeline] Failed to update project:`, updateError);
        throw new Error(`Failed to update project: ${updateError.message}`);
      }

      console.log(`[ResumePipeline] ✅ Pipeline resumed: action=${action}, video=${permanentVideoUrl.substring(0, 60)}...`);

      return new Response(
        JSON.stringify({
          success: true,
          action,
          videoUrl: permanentVideoUrl,
          audioUrl,
          message: 'Avatar video recovered successfully!',
          engine: 'kling-v3',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error('Failed to recover video - no output produced');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ResumePipeline] Error:", errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
