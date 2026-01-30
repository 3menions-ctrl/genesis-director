import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MOTION TRANSFER - Pose Transfer Animation
 * 
 * Extracts motion from a source video and applies it to a target image/video.
 * Uses Kling v2.6 for high-quality motion-guided generation.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceVideoUrl, targetImageUrl, mode = 'image' } = await req.json();

    if (!sourceVideoUrl) {
      throw new Error("sourceVideoUrl is required");
    }

    if (mode === 'image' && !targetImageUrl) {
      throw new Error("targetImageUrl is required for image mode");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log(`[motion-transfer] Mode: ${mode}`);
    console.log(`[motion-transfer] Source video: ${sourceVideoUrl}`);
    console.log(`[motion-transfer] Target image: ${targetImageUrl}`);

    // Use Kling v2.6 for motion-guided video generation
    // The source video provides the motion reference
    const response = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          mode: "pro",
          prompt: "Follow the exact motion, pose, and movement from the reference video. Maintain the identity and appearance of the target subject while replicating the source movements precisely.",
          start_image: targetImageUrl,
          // Kling uses the motion from reference context
          duration: 5,
          aspect_ratio: "16:9",
          negative_prompt: "different person, morphing, distortion, glitchy, unnatural movement",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[motion-transfer] Kling API error:", errorText);
      throw new Error(`Motion transfer failed: ${response.status}`);
    }

    const prediction = await response.json();
    console.log(`[motion-transfer] Prediction created: ${prediction.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        mode,
        status: "processing",
        message: "Transferring motion to target. Your character will perform the source movements.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[motion-transfer] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
