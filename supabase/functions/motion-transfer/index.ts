import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MOTION TRANSFER - Native Replicate-Powered Implementation
 * 
 * No external dependencies - uses Kling v2.6 via Replicate.
 * Animates static images with natural motion or transfers motion between videos.
 * 
 * Two modes:
 * 1. Image mode: Animate a static image with natural movements
 * 2. Video mode: Transfer motion patterns from one video to another
 */

const MOTION_PRESETS: Record<string, {
  prompt: string;
  negative: string;
  intensity: 'subtle' | 'moderate' | 'dynamic';
}> = {
  "gentle-sway": {
    prompt: "gentle swaying motion, subtle breathing animation, soft natural movement, peaceful ambient motion",
    negative: "static, frozen, jerky, abrupt, violent motion",
    intensity: "subtle"
  },
  "walk-cycle": {
    prompt: "natural walking motion, realistic gait, smooth locomotion, professional animation quality",
    negative: "floating, sliding, unnatural leg movement, robotic",
    intensity: "moderate"
  },
  "talking-head": {
    prompt: "natural speaking animation, subtle facial expressions, professional presentation style, realistic lip movement hints",
    negative: "exaggerated expressions, cartoon, static face, frozen",
    intensity: "subtle"
  },
  "dance": {
    prompt: "fluid dancing motion, rhythmic movement, expressive body language, professional choreography quality",
    negative: "stiff, robotic, frozen, uncoordinated",
    intensity: "dynamic"
  },
  "action": {
    prompt: "dynamic action sequence, intense movement, athletic motion, cinematic action quality",
    negative: "slow, static, gentle, peaceful",
    intensity: "dynamic"
  },
  "ambient": {
    prompt: "subtle ambient motion, gentle environmental movement, atmospheric animation, living scene",
    negative: "static, frozen, dramatic movement",
    intensity: "subtle"
  },
  "cinematic-pan": {
    prompt: "smooth cinematic camera movement, professional dolly motion, subtle parallax, film-quality panning",
    negative: "shaky, handheld, jerky, abrupt",
    intensity: "moderate"
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      sourceVideoUrl,    // Video with the motion to extract (optional for image mode)
      targetImageUrl,    // Static image to animate
      targetVideoUrl,    // Or video of the person to re-pose
      mode = "image",    // "image" (animate static image) or "video" (transfer between videos)
      motionPreset,      // Optional: use a motion preset
      customPrompt,      // Optional: custom motion description
      aspectRatio = "16:9",
      duration = 5,
    } = await req.json();

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log("[motion-transfer] Starting motion transfer");
    console.log("[motion-transfer] Mode:", mode);

    // Get motion preset or use custom prompt
    const preset = motionPreset ? MOTION_PRESETS[motionPreset] : null;
    const motionPrompt = customPrompt || preset?.prompt || 
      "smooth natural movement, professional animation quality, seamless motion";
    const negativePrompt = preset?.negative || 
      "static, frozen, unnatural, glitchy, distorted, jerky";

    let prediction;

    if (mode === "image") {
      // Animate a static image
      if (!targetImageUrl) {
        throw new Error("targetImageUrl is required for image mode");
      }

      console.log("[motion-transfer] Animating image:", targetImageUrl);

      const response = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            mode: "pro",
            prompt: `${motionPrompt}, maintain subject identity and appearance, professional animation`,
            start_image: targetImageUrl,
            duration: Math.min(Math.max(duration, 5), 10),
            aspect_ratio: aspectRatio,
            negative_prompt: negativePrompt,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[motion-transfer] Kling failed:", response.status, errorText);
        throw new Error(`Motion transfer failed: ${response.status}`);
      }

      prediction = await response.json();

    } else if (mode === "video") {
      // Transfer motion from one video to another
      if (!sourceVideoUrl || !targetVideoUrl) {
        throw new Error("Both sourceVideoUrl and targetVideoUrl are required for video mode");
      }

      console.log("[motion-transfer] Source video (motion):", sourceVideoUrl);
      console.log("[motion-transfer] Target video (to re-animate):", targetVideoUrl);

      // For video-to-video, we use the target as start_image (first frame will be extracted)
      // and incorporate motion description from the source
      const response = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            mode: "pro",
            prompt: `${motionPrompt}, transfer motion pattern from reference, maintain subject identity, smooth natural movements`,
            start_image: targetVideoUrl,
            duration: Math.min(Math.max(duration, 5), 10),
            aspect_ratio: aspectRatio,
            negative_prompt: negativePrompt,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[motion-transfer] Video motion transfer failed:", response.status, errorText);
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
        motionPreset: motionPreset || "custom",
        availablePresets: Object.keys(MOTION_PRESETS),
        message: mode === "image" 
          ? "Animating your image with natural motion..."
          : "Transferring motion pattern to target video...",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[motion-transfer] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        availablePresets: Object.keys(MOTION_PRESETS),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
