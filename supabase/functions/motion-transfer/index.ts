import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    console.log("[motion-transfer] Source video:", sourceVideoUrl);

    let prediction;

    if (mode === "image") {
      // Animate a static image with motion from a video
      if (!targetImageUrl) {
        throw new Error("targetImageUrl is required for image mode");
      }

      console.log("[motion-transfer] Target image:", targetImageUrl);

      // Use MagicAnimate or similar for motion transfer to image
      const response = await fetch("https://api.replicate.com/v1/predictions", {
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
            seed: -1, // Random
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[motion-transfer] MagicAnimate failed:", errorText);
        
        // Try DWPose + AnimateDiff as fallback
        console.log("[motion-transfer] Trying fallback approach with pose extraction...");
        
        const fallbackResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "cd2b59f8b5b0688c8c532cec2d3ec8a97c7ba52acf3d29a3c77a4cd22e9c8064", // Animate Anyone
            input: {
              ref_image: targetImageUrl,
              pose_video: sourceVideoUrl,
              steps: 25,
              guidance_scale: 3.5,
            },
          }),
        });

        if (!fallbackResponse.ok) {
          throw new Error(`Motion transfer failed: ${response.status}`);
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

      console.log("[motion-transfer] Target video:", targetVideoUrl);

      // Use video-to-video pose transfer
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "8d4e3b8e06e8a8b5f9a5e5f8a7e6d5c4b3a2f1e0", // Pose transfer model
          input: {
            source_video: sourceVideoUrl,
            target_video: targetVideoUrl,
            preserve_face: true,
            smooth_motion: true,
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
        message: "Motion transfer is being processed. Poll for status.",
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
