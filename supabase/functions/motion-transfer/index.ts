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
 * Two modes:
 * 1. Image mode: Animate a static image with motion from a video (e.g., make a photo dance)
 * 2. Video mode: Re-pose a person in a video to match another video's motion
 * 
 * Uses MagicAnimate/AnimateAnyone for high-quality pose transfer.
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

      // Try AnimateAnyone first - best for human motion transfer
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "cd2b59f8b5b0688c8c532cec2d3ec8a97c7ba52acf3d29a3c77a4cd22e9c8064", // AnimateAnyone
          input: {
            ref_image: targetImageUrl,
            pose_video: sourceVideoUrl,
            steps: 25,
            guidance_scale: 3.5,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("[motion-transfer] AnimateAnyone failed:", errorText);
        
        // Fallback to MagicAnimate
        console.log("[motion-transfer] Trying MagicAnimate fallback...");
        const fallbackResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "16c28b00ad558c52a24fdc0c2be0a79a5c56c53e1eb3a2dae01d7c7b56e14e99", // MagicAnimate
            input: {
              source_image: targetImageUrl,
              motion_sequence: sourceVideoUrl,
              num_inference_steps: 25,
              guidance_scale: 7.5,
              seed: -1,
            },
          }),
        });

        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text();
          console.error("[motion-transfer] MagicAnimate also failed:", fallbackError);
          throw new Error(`Motion transfer failed: Both AnimateAnyone and MagicAnimate unavailable`);
        }

        prediction = await fallbackResponse.json();
      } else {
        prediction = await response.json();
      }

    } else if (mode === "video") {
      // Transfer motion from one video to another (re-pose a person in video)
      if (!targetVideoUrl) {
        throw new Error("targetVideoUrl is required for video mode");
      }

      console.log("[motion-transfer] Target video (person to re-pose):", targetVideoUrl);

      // Video-to-video pose transfer
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "cd2b59f8b5b0688c8c532cec2d3ec8a97c7ba52acf3d29a3c77a4cd22e9c8064", // AnimateAnyone
          input: {
            ref_image: targetVideoUrl, // First frame will be extracted
            pose_video: sourceVideoUrl,
            steps: 25,
            guidance_scale: 3.5,
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
          ? "Your character will perform the exact movements from the source video."
          : "Re-posing the target video with the source motion sequence.",
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