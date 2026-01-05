import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId, provider = "replicate" } = await req.json();

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    console.log("Checking video status for task:", taskId, "provider:", provider);

    // Use Replicate as primary provider
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({ auth: REPLICATE_API_KEY });
    const prediction = await replicate.predictions.get(taskId);

    console.log("Replicate prediction status:", prediction.status);
    
    // Log error details if failed
    if (prediction.status === "failed" && prediction.error) {
      console.error("Replicate prediction failed with error:", prediction.error);
    }

    // Map Replicate status to our format
    let status = prediction.status.toUpperCase();
    if (status === "PROCESSING") status = "RUNNING";
    if (status === "SUCCEEDED") status = "SUCCEEDED";
    if (status === "FAILED") status = "FAILED";

    // Get video URL from output
    let videoUrl = null;
    if (prediction.output) {
      // Different models return output differently
      if (typeof prediction.output === "string") {
        videoUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        videoUrl = prediction.output[0];
      } else if (prediction.output.video) {
        videoUrl = prediction.output.video;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        status: status,
        progress: prediction.status === "succeeded" ? 100 : (prediction.status === "processing" ? 50 : 0),
        videoUrl: videoUrl,
        error: prediction.error || null,
        provider: "replicate",
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
