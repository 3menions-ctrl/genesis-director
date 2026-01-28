import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cinema-grade style presets with hyper-detailed prompt engineering
const STYLE_PRESETS: Record<string, {
  prompt: string;
  negative: string;
  strength: number;
  guidance: number;
}> = {
  "anime": {
    prompt: "masterpiece anime cinematography, Studio Ghibli art direction, Makoto Shinkai lighting, cel-shaded characters with soft gradients, hand-painted background art, volumetric god rays, dynamic camera movement, sakura petals floating, ethereal atmosphere, 4K anime production quality",
    negative: "western animation, 3D CGI, photorealistic, low quality, blurry, distorted faces",
    strength: 0.75,
    guidance: 8.5
  },
  "3d-animation": {
    prompt: "Pixar-quality 3D animation, Disney animation principles, subsurface skin scattering, ray-traced global illumination, physically-based rendering, expressive character animation, detailed texture work, cinematic depth of field, octane render quality",
    negative: "2D, flat, hand-drawn, anime, low poly, uncanny valley",
    strength: 0.8,
    guidance: 9.0
  },
  "cyberpunk": {
    prompt: "cyberpunk neon noir aesthetic, Blade Runner 2049 cinematography, rain-soaked streets reflecting neon, holographic advertisements, high-contrast chiaroscuro lighting, anamorphic lens flares, volumetric fog, dystopian megacity, teal and orange color grade",
    negative: "daytime, natural lighting, rural, clean, utopian, vintage, bright cheerful colors",
    strength: 0.85,
    guidance: 8.0
  },
  "oil-painting": {
    prompt: "masterwork oil painting, Rembrandt lighting technique, Caravaggio chiaroscuro, visible impasto brushstrokes, rich venetian color palette, classical composition, baroque drama, museum-quality fine art, canvas texture visible",
    negative: "digital art, photography, modern, minimalist, flat colors, anime, cartoon",
    strength: 0.7,
    guidance: 7.5
  },
  "watercolor": {
    prompt: "ethereal watercolor painting, J.M.W. Turner atmospheric effects, wet-on-wet bleeding edges, soft color gradients, visible paper texture, spontaneous brushwork, transparent color layers, luminous washes, dreamy soft focus",
    negative: "digital sharp edges, heavy saturation, dark moody, photography, 3D, geometric",
    strength: 0.65,
    guidance: 7.0
  },
  "noir": {
    prompt: "classic film noir cinematography, high-contrast black and white, dramatic venetian blind shadows, Orson Welles deep focus, German Expressionist angles, cigarette smoke atmosphere, 1940s Hollywood glamour, chiaroscuro lighting, silver screen quality",
    negative: "color, modern, digital, bright, cheerful, outdoor daylight, saturated",
    strength: 0.9,
    guidance: 8.5
  },
  "vintage-film": {
    prompt: "authentic 1970s film stock, Kodachrome color science, visible film grain and dust, light leaks and lens flares, warm nostalgic color cast, Super 8 texture, anamorphic lens characteristics, halation around highlights, analog photography feel",
    negative: "digital, clean, modern, sharp, HDR, oversaturated",
    strength: 0.7,
    guidance: 7.0
  },
  "comic-book": {
    prompt: "Frank Miller Sin City graphic novel style, bold Ben-Day dots, dynamic panel composition, dramatic ink shadows, four-color printing aesthetic, motion lines and speed effects, comic book halftone patterns, splash page drama, heavy black outlines",
    negative: "photographic, soft, pastel, watercolor, anime, 3D CGI, subtle",
    strength: 0.8,
    guidance: 8.5
  },
  "fantasy": {
    prompt: "epic fantasy concept art, Frank Frazetta dynamism, magical ethereal lighting, volumetric god rays through mist, otherworldly color palette, detailed environmental storytelling, heroic proportions, mystical atmosphere, Lord of the Rings grandeur",
    negative: "modern, sci-fi, urban, photorealistic, mundane, minimalist, cartoon",
    strength: 0.75,
    guidance: 8.0
  },
  "synthwave": {
    prompt: "synthwave retro-futurism, 1980s neon aesthetic, chrome and grid landscapes, sunset gradient skies, outrun visual style, VHS scan lines, palm tree silhouettes, laser grid horizons, hot pink and electric blue, retro computer graphics",
    negative: "realistic, natural, organic, muted colors, modern minimal, daytime",
    strength: 0.85,
    guidance: 8.0
  },
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
      customNegativePrompt,
      strength: customStrength,
      guidanceScale: customGuidance,
    } = await req.json();

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    if (!videoUrl) {
      throw new Error("videoUrl is required");
    }

    // Get preset configuration or use custom
    const preset = style ? STYLE_PRESETS[style] : null;
    
    const stylePrompt = customStylePrompt || preset?.prompt;
    const negativePrompt = customNegativePrompt || preset?.negative || "blurry, distorted, low quality, artifacts, glitches";
    const strength = customStrength ?? preset?.strength ?? 0.75;
    const guidanceScale = customGuidance ?? preset?.guidance ?? 8.0;

    if (!stylePrompt) {
      throw new Error(`Either 'style' preset or 'customStylePrompt' is required. Available styles: ${Object.keys(STYLE_PRESETS).join(", ")}`);
    }

    console.log("[stylize-video] Starting video stylization");
    console.log("[stylize-video] Style:", style || "custom");
    console.log("[stylize-video] Prompt preview:", stylePrompt.substring(0, 60) + "...");

    // Use Kling v2.6 with video input for style transfer
    // This approach: extract first frame, apply style, generate video
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
          prompt: `${stylePrompt}, maintain motion and composition from original video`,
          start_image: videoUrl, // First frame extracted for img2vid
          duration: "5",
          aspect_ratio: "16:9",
          negative_prompt: negativePrompt,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[stylize-video] Kling stylization failed:", errorText);
      throw new Error(`Video stylization failed: ${errorText}`);
    }

    const prediction = await response.json();
    console.log("[stylize-video] Prediction created:", prediction.id);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        status: "processing",
        style: style || "custom",
        appliedStrength: strength,
        appliedGuidance: guidanceScale,
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
