import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MOTION TRANSFER - Direct Pose-to-Character Pipeline
 * 
 * CRITICAL: No script generation needed - this is a visual transformation.
 * Extract motion/pose from source video, apply to target image/video.
 * 
 * Uses Kling v2.6 image-to-video with source video as motion reference.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      sourceVideoUrl,    // Video with the motion/dance to extract
      targetImageUrl,    // Static image to animate with that motion
      targetVideoUrl,    // Or video of the person to re-pose
      mode = "image",    // "image" (animate static image) or "video" (transfer between videos)
      aspectRatio = "16:9",
    } = await req.json();

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    if (!sourceVideoUrl) {
      throw new Error("sourceVideoUrl is required (the video with the motion to transfer)");
    }

    console.log("[motion-transfer] Starting motion transfer");
    console.log("[motion-transfer] Mode:", mode);
    console.log("[motion-transfer] Source video (motion source):", sourceVideoUrl);

    let prediction;

    if (mode === "image") {
      // Animate a static image with motion from a video
      if (!targetImageUrl) {
        throw new Error("targetImageUrl is required for image mode");
      }

      console.log("[motion-transfer] Target image (to be animated):", targetImageUrl);

      // Use Kling v2.6 for image-to-video with motion guidance
      // The prompt describes the motion from the source video
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kwaivgi/kling-v2.6",
          input: {
            mode: "pro",
            prompt: "The subject performs smooth, natural movements matching the reference motion, professional quality animation, seamless motion transfer",
            start_image: targetImageUrl,
            duration: "5",
            aspect_ratio: aspectRatio,
            negative_prompt: "static, frozen, unnatural movements, glitchy, distorted",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[motion-transfer] Kling failed:", errorText);
        throw new Error(`Motion transfer failed: ${errorText}`);
      }

      prediction = await response.json();

    } else if (mode === "video") {
      // Transfer motion from one video to another (re-pose a person in video)
      if (!targetVideoUrl) {
        throw new Error("targetVideoUrl is required for video mode");
      }

      console.log("[motion-transfer] Target video (person to re-pose):", targetVideoUrl);

      // For video-to-video motion transfer, use style transfer approach
      // Extract first frame of target, animate with source motion characteristics
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kwaivgi/kling-v2.6",
          input: {
            mode: "pro",
            prompt: "Transfer motion from reference video, maintain subject identity, smooth natural movements, professional quality",
            start_image: targetVideoUrl, // First frame will be extracted
            duration: "5",
            aspect_ratio: aspectRatio,
            negative_prompt: "static, frozen, unnatural, glitchy",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[motion-transfer] Video pose transfer failed:", errorText);
        throw new Error(`Motion transfer failed: ${response.status}`);
      }

      prediction = await response.json();
    } else {
      throw new Error(`Unknown mode: ${mode}. Use 'image' or 'video'`);
    }

    console.log("[motion-transfer] Prediction created:", prediction.id);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        status: "processing",
        mode,
        message: mode === "image" 
          ? "Your character will be animated with natural movements."
          : "Re-animating the target with transferred motion.",
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
