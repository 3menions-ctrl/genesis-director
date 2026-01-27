import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CHECK SPECIALIZED STATUS
 * 
 * Polls Replicate prediction status for specialized modes (avatar, motion-transfer, video-to-video)
 * Updates project pipeline_state and video_url when complete
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
  const replicateApiKey = Deno.env.get("REPLICATE_API_TOKEN");
  
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
      .select('mode, pipeline_state, status')
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

    let newState = { ...currentState };
    let newStatus = project.status;
    let videoUrl = null;

    switch (prediction.status) {
      case 'succeeded':
        // Extract video URL from output
        videoUrl = Array.isArray(prediction.output) 
          ? prediction.output[0] 
          : prediction.output;
        
        newState = {
          ...currentState,
          stage: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
          message: 'Video generation complete!',
        };
        newStatus = 'completed';
        
        console.log(`[CheckSpecializedStatus] Success! Video URL: ${videoUrl}`);
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
        const estimatedProgress = prediction.logs 
          ? Math.min(75, 25 + (prediction.logs.length / 10))
          : currentState.progress || 50;
        
        newState = {
          ...currentState,
          stage: 'processing',
          progress: estimatedProgress,
          message: 'AI is generating your video...',
        };
        break;

      case 'starting':
        newState = {
          ...currentState,
          stage: 'starting',
          progress: 10,
          message: 'Initializing AI model...',
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
        videoUrl,
        isComplete: prediction.status === 'succeeded',
        isFailed: prediction.status === 'failed' || prediction.status === 'canceled',
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
