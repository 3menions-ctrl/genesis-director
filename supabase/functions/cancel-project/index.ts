import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CANCEL PROJECT - Comprehensive Project Cancellation
 * 
 * This function performs a FULL cancellation:
 * 1. Marks the project as 'cancelled' 
 * 2. Cancels any running Replicate predictions
 * 3. Updates all pending/generating clips to 'cancelled' status
 * 4. Clears pipeline state
 * 
 * This ensures NO background processes continue consuming resources
 */

interface CancelRequest {
  projectId: string;
  userId: string;
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
    const { projectId, userId }: CancelRequest = await req.json();

    if (!projectId || !userId) {
      return new Response(
        JSON.stringify({ error: "projectId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CancelProject] Starting cancellation for project ${projectId}`);

    // 1. Fetch the project to get current state and prediction IDs
    const { data: project, error: projectError } = await supabase
      .from('movie_projects')
      .select('id, user_id, status, pipeline_state, pending_video_tasks, mode')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Track what we cancelled for the response
    const cancelledItems: string[] = [];

    // 2. Cancel Replicate predictions if any are active
    const pipelineState = typeof project.pipeline_state === 'string' 
      ? JSON.parse(project.pipeline_state) 
      : project.pipeline_state;
    
    const predictionIds: string[] = [];
    
    // Check for prediction ID in pipeline state (specialized modes)
    if (pipelineState?.predictionId) {
      predictionIds.push(pipelineState.predictionId);
    }
    
    // Check pending_video_tasks for prediction IDs
    const pendingTasks = typeof project.pending_video_tasks === 'string'
      ? JSON.parse(project.pending_video_tasks)
      : project.pending_video_tasks;
    
    if (pendingTasks?.predictionId) {
      predictionIds.push(pendingTasks.predictionId);
    }

    // 3. Get all generating clips that might have prediction IDs
    const { data: generatingClips } = await supabase
      .from('video_clips')
      .select('id, shot_index, veo_operation_name')
      .eq('project_id', projectId)
      .in('status', ['pending', 'generating']);

    // Collect any veo operation names (which could be prediction IDs)
    if (generatingClips) {
      for (const clip of generatingClips) {
        if (clip.veo_operation_name) {
          predictionIds.push(clip.veo_operation_name);
        }
      }
    }

    // 4. Cancel all Replicate predictions
    if (replicateApiKey && predictionIds.length > 0) {
      console.log(`[CancelProject] Cancelling ${predictionIds.length} Replicate predictions`);
      
      for (const predictionId of predictionIds) {
        try {
          const cancelResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${replicateApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          
          if (cancelResponse.ok) {
            console.log(`[CancelProject] Cancelled prediction ${predictionId}`);
            cancelledItems.push(`prediction:${predictionId}`);
          } else {
            // Prediction might already be complete or failed, that's OK
            console.log(`[CancelProject] Could not cancel prediction ${predictionId} (might be complete)`);
          }
        } catch (err) {
          console.error(`[CancelProject] Error cancelling prediction ${predictionId}:`, err);
          // Continue with other cancellations
        }
      }
    }

    // 5. Update all pending/generating clips to cancelled
    if (generatingClips && generatingClips.length > 0) {
      const { error: clipsError } = await supabase
        .from('video_clips')
        .update({ 
          status: 'cancelled',
          error_message: 'Cancelled by user',
          updated_at: new Date().toISOString(),
        })
        .eq('project_id', projectId)
        .in('status', ['pending', 'generating']);

      if (!clipsError) {
        cancelledItems.push(`clips:${generatingClips.length}`);
        console.log(`[CancelProject] Marked ${generatingClips.length} clips as cancelled`);
      }
    }

    // 6. Update the project status and clear pipeline state
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({
        status: 'cancelled',
        pipeline_state: {
          stage: 'cancelled',
          progress: 0,
          cancelledAt: new Date().toISOString(),
          cancelledBy: userId,
          message: 'Project cancelled by user',
        },
        pending_video_tasks: {
          stage: 'cancelled',
          cancelledAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to update project: ${updateError.message}`);
    }

    cancelledItems.push('project:status');
    console.log(`[CancelProject] Project ${projectId} fully cancelled`);

    return new Response(
      JSON.stringify({
        success: true,
        projectId,
        message: 'Project cancelled successfully. All background processes have been stopped.',
        cancelledItems,
        details: {
          predictionsCanelled: predictionIds.length,
          clipsCancelled: generatingClips?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CancelProject] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
