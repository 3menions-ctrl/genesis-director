import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * RESUME-AVATAR-PIPELINE
 * 
 * Resumes stalled avatar video generation from the last checkpoint.
 * Handles recovery for:
 * - audio_merge: Retry merging TTS audio with video
 * - video_rendering: Check if prediction completed, otherwise restart
 * - scene_compositing: Restart from avatar image
 * 
 * Call this manually or from zombie-cleanup for recovery.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResumeRequest {
  projectId: string;
  forceRestart?: boolean; // Restart from beginning instead of resume
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // If force restart or no checkpoint, start from beginning
    if (forceRestart || !stage || stage === 'failed') {
      console.log(`[ResumePipeline] Starting fresh avatar generation...`);
      
      // Call generate-avatar-direct to restart
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
        JSON.stringify({
          success: result.success,
          action: 'restarted',
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RESUME FROM CHECKPOINT
    let finalVideoUrl: string | null = null;
    let action = 'unknown';

    if (stage === 'audio_merge' && videoUrl && audioUrl) {
      // Resume audio merge
      console.log(`[ResumePipeline] Resuming audio merge...`);
      action = 'audio_merge_retry';

      await supabase.from('movie_projects').update({
        pipeline_state: {
          ...pipelineState,
          message: 'Retrying audio synchronization...',
          resumedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);

      try {
        const mergeResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "wait=120",
          },
          body: JSON.stringify({
            version: "684cc0e6bff2f0d3b748d7c386ab8a6fb7c5f6d2095a3a38d68d9d6a3a2cb2f6",
            input: {
              video: videoUrl,
              audio: audioUrl,
              audio_volume: 1.0,
              video_volume: 0.0,
            },
          }),
        });

        if (mergeResponse.ok) {
          const prediction = await mergeResponse.json();
          
          if (prediction.status === "succeeded" && prediction.output) {
            finalVideoUrl = prediction.output;
          } else if (prediction.id) {
            // Poll for result
            finalVideoUrl = await pollForResult(prediction.id, REPLICATE_API_KEY, 120);
          }
        }
      } catch (mergeError) {
        console.warn(`[ResumePipeline] Merge failed, using video as-is:`, mergeError);
      }

      // Fallback to video without merged audio
      if (!finalVideoUrl) {
        finalVideoUrl = videoUrl;
        action = 'audio_merge_fallback';
      }
    } else if (stage === 'video_rendering') {
      // Check if prediction completed
      const predictionId = pipelineState.predictionId as string;
      
      if (predictionId) {
        console.log(`[ResumePipeline] Checking prediction ${predictionId}...`);
        
        const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
        });
        const prediction = await statusRes.json();
        
        if (prediction.status === "succeeded" && prediction.output) {
          finalVideoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          action = 'prediction_recovered';
          console.log(`[ResumePipeline] ✅ Found completed prediction`);
          
          // Now merge audio if available
          if (audioUrl && finalVideoUrl) {
            try {
              const mergeResponse = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${REPLICATE_API_KEY}`,
                  "Content-Type": "application/json",
                  "Prefer": "wait=120",
                },
                body: JSON.stringify({
                  version: "684cc0e6bff2f0d3b748d7c386ab8a6fb7c5f6d2095a3a38d68d9d6a3a2cb2f6",
                  input: {
                    video: finalVideoUrl,
                    audio: audioUrl,
                    audio_volume: 1.0,
                    video_volume: 0.0,
                  },
                }),
              });

              if (mergeResponse.ok) {
                const mergePrediction = await mergeResponse.json();
                if (mergePrediction.status === "succeeded" && mergePrediction.output) {
                  finalVideoUrl = mergePrediction.output;
                  action = 'prediction_recovered_with_audio';
                }
              }
            } catch {
              console.warn(`[ResumePipeline] Audio merge after recovery failed`);
            }
          }
        } else if (prediction.status === "failed") {
          // Need to restart video generation
          console.log(`[ResumePipeline] Prediction failed, restarting...`);
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
          // Still processing - just wait
          console.log(`[ResumePipeline] Prediction still processing: ${prediction.status}`);
          return new Response(
            JSON.stringify({
              success: true,
              action: 'still_processing',
              predictionStatus: prediction.status,
              message: 'Video is still generating, no action needed',
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        throw new Error('No prediction ID found for video_rendering stage');
      }
    } else if (stage === 'completed') {
      // Already completed
      return new Response(
        JSON.stringify({
          success: true,
          action: 'already_completed',
          videoUrl: project.video_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Unknown stage - need restart
      throw new Error(`Cannot resume from stage: ${stage}`);
    }

    // Update project to completed
    if (finalVideoUrl) {
      const { error: updateError } = await supabase.from('movie_projects').update({
        status: 'completed',
        video_url: finalVideoUrl,
        voice_audio_url: audioUrl || null,
        pipeline_state: {
          ...pipelineState,
          stage: 'completed',
          progress: 100,
          videoUrl: finalVideoUrl,
          message: 'Video generation complete!',
          completedAt: new Date().toISOString(),
          recoveredBy: 'resume-avatar-pipeline',
          recoveryAction: action,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);

      if (updateError) {
        console.error(`[ResumePipeline] Failed to update project:`, updateError);
        throw new Error(`Failed to update project: ${updateError.message}`);
      }

      console.log(`[ResumePipeline] ═══════════════════════════════════════════════════════════`);
      console.log(`[ResumePipeline] ✅ Pipeline resumed successfully`);
      console.log(`[ResumePipeline] Action: ${action}`);
      console.log(`[ResumePipeline] Final video: ${finalVideoUrl}`);
      console.log(`[ResumePipeline] ═══════════════════════════════════════════════════════════`);

      return new Response(
        JSON.stringify({
          success: true,
          action,
          videoUrl: finalVideoUrl,
          audioUrl,
          message: 'Avatar video recovered successfully!',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error('Failed to recover video - no output produced');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ResumePipeline] Error:", errorMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Poll Replicate for prediction result
 */
async function pollForResult(predictionId: string, apiKey: string, maxSeconds: number): Promise<string | null> {
  const maxAttempts = maxSeconds;
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    
    const status = await response.json();
    
    if (status.status === "succeeded") {
      return Array.isArray(status.output) ? status.output[0] : status.output;
    }
    
    if (status.status === "failed") {
      console.error(`[ResumePipeline] Prediction ${predictionId} failed:`, status.error);
      return null;
    }
    
    if (i % 10 === 0) {
      console.log(`[ResumePipeline] Polling ${predictionId}... (${i}s, status: ${status.status})`);
    }
  }
  
  console.error(`[ResumePipeline] Polling timeout for ${predictionId}`);
  return null;
}
