import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Style presets with their visual descriptions
const STYLE_PRESETS = {
  "anime": "anime style, studio ghibli aesthetic, vibrant colors, hand-drawn animation",
  "3d-animation": "3D Pixar-style animation, smooth rendering, cinematic lighting",
  "cyberpunk": "cyberpunk neon aesthetic, futuristic, high contrast, neon lights, rain-soaked streets",
  "oil-painting": "oil painting style, impressionist brushstrokes, rich textures, classical art",
  "watercolor": "watercolor painting, soft edges, flowing colors, dreamy atmosphere",
  "claymation": "claymation stop-motion style, clay figures, handcrafted texture",
  "noir": "black and white film noir, high contrast, dramatic shadows, 1940s aesthetic",
  "vintage-film": "vintage 8mm film grain, warm sepia tones, light leaks, retro aesthetic",
  "comic-book": "comic book style, bold outlines, halftone dots, dynamic panels",
  "fantasy": "fantasy art style, magical glow, ethereal lighting, mythical atmosphere",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      videoUrl, 
      style,
      customStylePrompt,
      strength = 0.7, // How much to apply the style (0-1)
    } = await req.json();

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    // Determine the style prompt
    let stylePrompt = customStylePrompt;
    if (!stylePrompt && style) {
      stylePrompt = STYLE_PRESETS[style as keyof typeof STYLE_PRESETS];
      if (!stylePrompt) {
        throw new Error(`Unknown style preset: ${style}. Available: ${Object.keys(STYLE_PRESETS).join(", ")}`);
      }
    }

    if (!stylePrompt) {
      throw new Error("Either 'style' preset or 'customStylePrompt' is required");
    }

    console.log("[stylize-video] Starting video stylization");
    console.log("[stylize-video] Style:", stylePrompt);
    console.log("[stylize-video] Strength:", strength);

    // Use Replicate's video-to-video model (Stable Video Diffusion with img2img)
    // Or AnimateDiff for style transfer
    const stylizeResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438", // Video style transfer
        input: {
          video_path: videoUrl,
          prompt: stylePrompt,
          negative_prompt: "blurry, distorted, low quality, artifacts, glitches",
          strength: strength,
          guidance_scale: 7.5,
          num_inference_steps: 25,
        },
      }),
    });

    if (!stylizeResponse.ok) {
      const errorText = await stylizeResponse.text();
      console.error("[stylize-video] Style transfer failed:", errorText);
      
      // Fallback to frame-by-frame approach using img2img
      console.log("[stylize-video] Trying fallback approach...");
      
      // Use ControlNet video model as fallback
      const fallbackResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "9ebea41b5e8ae8e53b7e27d04e31b535a4a6b94aa32f2b39c3e77a97e9c0c6e8", // AnimateDiff
          input: {
            video_path: videoUrl,
            prompt: stylePrompt,
            negative_prompt: "blurry, low quality",
            strength: strength,
          },
        }),
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Video stylization failed: ${stylizeResponse.status}`);
      }

      const fallbackPrediction = await fallbackResponse.json();
      return new Response(
        JSON.stringify({
          success: true,
          predictionId: fallbackPrediction.id,
          status: "processing",
          style: style || "custom",
          message: "Video is being stylized. Poll for status.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await stylizeResponse.json();
    console.log("[stylize-video] Prediction created:", prediction.id);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        status: "processing",
        style: style || "custom",
        availableStyles: Object.keys(STYLE_PRESETS),
        message: "Video is being stylized. Poll for status.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[stylize-video] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        availableStyles: Object.keys(STYLE_PRESETS),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
