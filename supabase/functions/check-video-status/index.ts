import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kling 2.6 via Replicate configuration
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const KLING_MODEL = "kwaivgi/kling-v2.6";

// Log API calls for cost tracking
async function logApiCall(
  supabase: any,
  operation: string,
  service: string,
  status: string,
  projectId?: string,
  taskId?: string,
  userId?: string
) {
  try {
    const POLL_COST_CENTS = 0.01;
    
    await supabase.rpc('log_api_cost', {
      p_service: service,
      p_operation: operation,
      p_real_cost_cents: Math.round(POLL_COST_CENTS * 100) / 100,
      p_credits_charged: 0,
      p_status: status,
      p_project_id: projectId || null,
      p_shot_id: taskId || 'status-poll',
      p_user_id: userId || null,
      p_metadata: { timestamp: new Date().toISOString() }
    });
  } catch (err) {
    console.warn('[Cost Log] Failed to log API call:', err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for logging
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { taskId, provider = "replicate", projectId: reqProjectId, userId } = await req.json();

    if (!taskId) {
      throw new Error("Task ID (prediction ID) is required");
    }

    console.log("Checking video status for prediction:", taskId, "provider:", provider);

    // Handle Replicate API (Kling via Replicate)
    if (provider === "replicate" || provider === "kling") {
      try {
        const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
        if (!REPLICATE_API_KEY) {
          throw new Error("REPLICATE_API_KEY is not configured");
        }

        const statusUrl = `${REPLICATE_PREDICTIONS_URL}/${taskId}`;
        
        console.log("Polling Replicate prediction:", statusUrl);
        
        const response = await fetch(statusUrl, {
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Replicate API error:", response.status, errorText);
          throw new Error(`Replicate API error: ${response.status}`);
        }

        const prediction = await response.json();
        
        console.log("Replicate prediction status:", {
          id: prediction.id,
          status: prediction.status,
        });

        // Map Replicate status to our standard status
        // Replicate statuses: starting, processing, succeeded, failed, canceled
        let status = "RUNNING";
        let progress = 0;
        let videoUrl = null;
        let error = null;

        switch (prediction.status) {
          case "starting":
            status = "STARTING";
            progress = 10;
            break;
          case "processing":
            status = "RUNNING";
            progress = 50;
            break;
          case "succeeded":
            status = "SUCCEEDED";
            progress = 100;
            // Extract video URL from output
            const output = prediction.output;
            if (typeof output === "string") {
              videoUrl = output;
            } else if (Array.isArray(output) && output.length > 0) {
              videoUrl = output[0];
            }
            break;
          case "failed":
            status = "FAILED";
            progress = 0;
            error = prediction.error || "Replicate generation failed";
            break;
          case "canceled":
            status = "FAILED";
            progress = 0;
            error = "Generation was canceled";
            break;
          default:
            status = "RUNNING";
            progress = 25;
        }

        await logApiCall(supabase, "status-poll", "replicate-kling", status, reqProjectId, taskId, userId);

        return new Response(
          JSON.stringify({
            success: true,
            status: status,
            progress: progress,
            videoUrl: videoUrl,
            audioIncluded: true, // Kling 2.6 includes native audio
            error: error,
            provider: "replicate",
            model: KLING_MODEL,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (replicateError) {
        console.error("Replicate status check error:", replicateError);
        return new Response(
          JSON.stringify({
            success: false,
            status: "FAILED",
            progress: 0,
            videoUrl: null,
            error: replicateError instanceof Error ? replicateError.message : "Replicate status check failed",
            provider: "replicate",
            model: KLING_MODEL,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Unknown provider - return error
    console.log("Unknown provider:", provider);
    return new Response(
      JSON.stringify({
        success: false,
        status: "FAILED",
        progress: 0,
        videoUrl: null,
        error: `Unsupported provider. This system uses Kling v2.6 via Replicate.`,
        provider: provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in check-video-status function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
