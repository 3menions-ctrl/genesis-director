import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * STYLE TRANSFER - Video-to-Video Style Transformation
 * 
 * Uses Kling v2.6 native style transfer capabilities for 
 * high-quality video stylization.
 */

// Style presets with their prompt configurations
const STYLE_PRESETS: Record<string, { prompt: string; negativePrompt: string }> = {
  'anime': {
    prompt: 'anime style, Studio Ghibli aesthetic, hand-drawn animation look, vibrant colors, cel shading, clean lines',
    negativePrompt: 'photorealistic, live action, 3D render, CGI',
  },
  'oil-painting': {
    prompt: 'oil painting style, thick brushstrokes, impressionist aesthetic, rich textures, artistic masterpiece',
    negativePrompt: 'photorealistic, digital art, clean lines, flat colors',
  },
  'watercolor': {
    prompt: 'watercolor painting style, soft edges, flowing colors, artistic, dreamy aesthetic',
    negativePrompt: 'photorealistic, sharp edges, digital art',
  },
  'cyberpunk': {
    prompt: 'cyberpunk style, neon lights, futuristic, high tech, dark atmosphere, blade runner aesthetic',
    negativePrompt: 'natural, organic, vintage, retro',
  },
  'noir': {
    prompt: 'film noir style, black and white, high contrast, dramatic shadows, 1940s detective movie aesthetic',
    negativePrompt: 'colorful, bright, cheerful',
  },
  'vintage': {
    prompt: 'vintage film style, 1970s aesthetic, film grain, warm tones, nostalgic, retro',
    negativePrompt: 'modern, digital, clean, sharp',
  },
  'comic-book': {
    prompt: 'comic book style, bold outlines, halftone dots, pop art colors, graphic novel aesthetic',
    negativePrompt: 'photorealistic, soft, gradient',
  },
  'pixel-art': {
    prompt: 'pixel art style, 8-bit aesthetic, retro gaming look, blocky, nostalgic',
    negativePrompt: 'high resolution, smooth, realistic',
  },
  'cinematic': {
    prompt: 'cinematic style, Hollywood movie aesthetic, dramatic lighting, film color grading, 2.35:1 aspect feel',
    negativePrompt: 'amateur, flat lighting, home video',
  },
  'fantasy': {
    prompt: 'fantasy art style, magical, ethereal glow, enchanted atmosphere, Lord of the Rings aesthetic',
    negativePrompt: 'realistic, mundane, modern',
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, style } = await req.json();

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    if (!style) {
      throw new Error("style is required");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const styleConfig = STYLE_PRESETS[style] || STYLE_PRESETS['cinematic'];
    
    console.log(`[stylize-video] Applying ${style} style to video`);
    console.log(`[stylize-video] Prompt: ${styleConfig.prompt}`);

    // Use Kling v2.6 for video-to-video style transfer
    const response = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          mode: "pro",
          prompt: styleConfig.prompt,
          start_video: videoUrl,
          duration: 5, // Default duration, will match source
          negative_prompt: styleConfig.negativePrompt,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[stylize-video] Kling API error:", errorText);
      throw new Error(`Style transfer failed: ${response.status}`);
    }

    const prediction = await response.json();
    console.log(`[stylize-video] Prediction created: ${prediction.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        style,
        status: "processing",
        message: `Applying ${style} style transformation...`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[stylize-video] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
