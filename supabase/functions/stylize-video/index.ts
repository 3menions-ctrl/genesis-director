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
    prompt: "masterpiece anime cinematography, Studio Ghibli art direction, Makoto Shinkai lighting, cel-shaded characters with soft gradients, hand-painted background art, volumetric god rays, dynamic camera movement, sakura petals floating, ethereal atmosphere, 4K anime production quality, Hayao Miyazaki storytelling, dramatic sky gradients, detailed environmental storytelling",
    negative: "western animation, 3D CGI, photorealistic, low quality, blurry, distorted faces, bad anatomy",
    strength: 0.75,
    guidance: 8.5
  },
  "3d-animation": {
    prompt: "Pixar-quality 3D animation, Disney animation principles, subsurface skin scattering, ray-traced global illumination, physically-based rendering, expressive character animation, Dreamworks comedic timing, detailed texture work, cinematic depth of field, octane render quality, soft rim lighting, emotional storytelling, premium CGI production",
    negative: "2D, flat, hand-drawn, anime, low poly, uncanny valley, plastic looking, lifeless eyes",
    strength: 0.8,
    guidance: 9.0
  },
  "cyberpunk": {
    prompt: "cyberpunk neon noir aesthetic, Blade Runner 2049 cinematography, rain-soaked streets reflecting neon, holographic advertisements, high-contrast chiaroscuro lighting, anamorphic lens flares, volumetric fog, dystopian megacity, chrome and glass architecture, Ghost in the Shell atmosphere, teal and orange color grade, cinematic widescreen, gritty futuristic realism",
    negative: "daytime, natural lighting, rural, clean, utopian, vintage, pastoral, bright cheerful colors",
    strength: 0.85,
    guidance: 8.0
  },
  "oil-painting": {
    prompt: "masterwork oil painting, Rembrandt lighting technique, Caravaggio chiaroscuro, visible impasto brushstrokes, rich venetian color palette, classical composition, baroque drama, museum-quality fine art, canvas texture visible, golden hour warmth, old master technique, sfumato blending, Renaissance perspective",
    negative: "digital art, photography, modern, minimalist, flat colors, anime, cartoon, vector art",
    strength: 0.7,
    guidance: 7.5
  },
  "watercolor": {
    prompt: "ethereal watercolor painting, J.M.W. Turner atmospheric effects, wet-on-wet bleeding edges, soft color gradients, visible paper texture, spontaneous brushwork, transparent color layers, luminous washes, contemporary watercolor illustration, delicate linework, organic flowing forms, dreamy soft focus, botanical illustration quality",
    negative: "digital sharp edges, heavy saturation, dark moody, photography, 3D, geometric, harsh lighting",
    strength: 0.65,
    guidance: 7.0
  },
  "claymation": {
    prompt: "Laika Studios stop-motion quality, Aardman Animations charm, handcrafted clay textures, visible fingerprint impressions, miniature set design, practical lighting on clay, subtle motion blur between frames, Wallace and Gromit warmth, Coraline aesthetic, tactile material quality, frame-by-frame animation feel, whimsical character design",
    negative: "smooth CGI, photorealistic, digital, 2D animation, weightless motion, perfect surfaces",
    strength: 0.75,
    guidance: 8.0
  },
  "noir": {
    prompt: "classic film noir cinematography, high-contrast black and white, dramatic venetian blind shadows, Orson Welles deep focus, German Expressionist angles, cigarette smoke atmosphere, 1940s Hollywood glamour, chiaroscuro lighting, rain on windows, fedora silhouettes, hardboiled detective aesthetic, deep blacks and bright highlights, silver screen quality",
    negative: "color, modern, digital, bright, cheerful, outdoor daylight, saturated, contemporary",
    strength: 0.9,
    guidance: 8.5
  },
  "vintage-film": {
    prompt: "authentic 1970s film stock, Kodachrome color science, visible film grain and dust, light leaks and lens flares, warm nostalgic color cast, Super 8 texture, anamorphic lens characteristics, halation around highlights, faded color palette, vintage camera imperfections, golden hour warmth, New Hollywood aesthetic, analog photography feel",
    negative: "digital, clean, modern, sharp, HDR, oversaturated, contemporary styling",
    strength: 0.7,
    guidance: 7.0
  },
  "comic-book": {
    prompt: "Frank Miller Sin City graphic novel style, Alex Ross hyperrealistic comic art, bold Ben-Day dots, dynamic panel composition, dramatic ink shadows, four-color printing aesthetic, motion lines and speed effects, expressive exaggeration, comic book halftone patterns, splash page drama, sequential art storytelling, heavy black outlines",
    negative: "photographic, soft, pastel, watercolor, anime, 3D CGI, subtle, muted colors",
    strength: 0.8,
    guidance: 8.5
  },
  "fantasy": {
    prompt: "epic fantasy concept art, Frank Frazetta dynamism, magical ethereal lighting, volumetric god rays through mist, otherworldly color palette, detailed environmental storytelling, heroic proportions, mystical atmosphere, dragon-scale textures, enchanted forest depth, WETA Workshop quality, Lord of the Rings grandeur, mythological wonder",
    negative: "modern, sci-fi, urban, photorealistic, mundane, minimalist, cartoon, chibi",
    strength: 0.75,
    guidance: 8.0
  },
  "hyperreal": {
    prompt: "hyperrealistic rendering, 8K ultra-detailed, photorealistic perfection beyond photography, microscopic skin pore detail, individual hair strand rendering, ray-traced reflections, physically accurate materials, studio photography lighting, medium format camera quality, extreme depth of field, cinematic color science",
    negative: "stylized, cartoon, anime, painting, illustration, low resolution, blurry, artifacts",
    strength: 0.6,
    guidance: 9.0
  },
  "surrealist": {
    prompt: "Salvador Dalí surrealist painting, René Magritte impossible compositions, melting reality, dreamscape landscapes, impossible architecture, hyperreal textures in surreal contexts, symbolic imagery, subconscious visualization, metaphysical lighting, floating objects, distorted perspectives, fine art museum quality",
    negative: "realistic, mundane, conventional, photography, normal proportions, logical",
    strength: 0.75,
    guidance: 8.0
  },
  "ukiyo-e": {
    prompt: "traditional Japanese ukiyo-e woodblock print, Katsushika Hokusai waves, Hiroshige landscape composition, bold outline work, flat color planes, traditional Japanese color palette, wave patterns, Mount Fuji atmosphere, Edo period aesthetic, handmade paper texture, limited color registration, cultural authenticity",
    negative: "western art, photorealistic, 3D, modern, digital effects, gradients, shadows",
    strength: 0.8,
    guidance: 8.0
  },
  "art-deco": {
    prompt: "Art Deco geometric elegance, 1920s golden age glamour, Tamara de Lempicka portraiture, bold geometric patterns, metallic gold and silver accents, symmetrical compositions, streamlined forms, Chrysler Building aesthetic, jazz age luxury, sunburst motifs, zigzag patterns, Erté fashion illustration",
    negative: "organic, rustic, natural, minimalist, modern, grunge, distressed",
    strength: 0.75,
    guidance: 7.5
  },
  "gothic": {
    prompt: "Tim Burton gothic aesthetic, Victorian dark romanticism, elaborate gothic architecture, dramatic candlelight, fog-shrouded graveyards, ornate ironwork, dark fairy tale atmosphere, expressionist shadows, haunted mansion interiors, Edgar Allan Poe mood, ravens and dark florals, theatrical drama",
    negative: "bright, cheerful, modern, minimalist, sunny, pastel, cartoon comedy",
    strength: 0.8,
    guidance: 8.5
  },
  "solarpunk": {
    prompt: "solarpunk utopian aesthetic, sustainable futurism, organic architecture with living plants, bioluminescent technology, vertical gardens on buildings, renewable energy integration, Art Nouveau nature fusion, optimistic future vision, community-focused design, natural materials and high technology harmony, golden hour lighting",
    negative: "dystopian, dark, industrial, pollution, decay, cyberpunk grime, pessimistic",
    strength: 0.75,
    guidance: 7.5
  },
  "baroque": {
    prompt: "Baroque master painting, Caravaggio dramatic tenebrism, Rubens dynamic compositions, rich velvet textures, dramatic diagonal compositions, theatrical lighting, opulent fabric rendering, cherubs and clouds, religious ecstasy, museum masterpiece quality, gold leaf accents, chiaroscuro mastery",
    negative: "modern, minimalist, flat, digital, bright even lighting, simple composition",
    strength: 0.75,
    guidance: 8.0
  },
  "synthwave": {
    prompt: "synthwave retro-futurism, 1980s neon aesthetic, chrome and grid landscapes, sunset gradient skies, outrun visual style, VHS scan lines, palm tree silhouettes, DeLorean aesthetic, laser grid horizons, hot pink and electric blue, retro computer graphics, analog synthesizer visualization",
    negative: "realistic, natural, organic, muted colors, modern minimal, daytime",
    strength: 0.85,
    guidance: 8.0
  },
  "impressionist": {
    prompt: "French Impressionist painting, Claude Monet light studies, Van Gogh expressive brushwork, visible oil paint texture, en plein air atmosphere, dappled sunlight through leaves, water lily reflections, loose gestural strokes, Renoir color warmth, fleeting moment captured, museum-quality fine art",
    negative: "photorealistic, digital, sharp lines, dark moody, modern, geometric",
    strength: 0.7,
    guidance: 7.0
  },
  "cel-shaded": {
    prompt: "stylized cel-shaded rendering, Spider-Verse animation quality, Borderlands thick outlines, flat color planes with sharp shadows, comic book line art, halftone dot patterns, dynamic pose exaggeration, graphic novel panel feel, bold color blocking, motion blur streaks, action lines, paper texture overlay",
    negative: "photorealistic, soft gradients, 3D CGI smooth, realistic lighting, subtle shading",
    strength: 0.8,
    guidance: 8.5
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

    console.log("[stylize-video] Starting advanced video stylization");
    console.log("[stylize-video] Style:", style || "custom");
    console.log("[stylize-video] Prompt:", stylePrompt.substring(0, 100) + "...");
    console.log("[stylize-video] Strength:", strength);
    console.log("[stylize-video] Guidance:", guidanceScale);

    // Use Replicate's video-to-video model with advanced parameters
    const stylizeResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
        input: {
          video_path: videoUrl,
          prompt: stylePrompt,
          negative_prompt: negativePrompt,
          strength: strength,
          guidance_scale: guidanceScale,
          num_inference_steps: 30, // Higher for quality
        },
      }),
    });

    if (!stylizeResponse.ok) {
      const errorText = await stylizeResponse.text();
      console.error("[stylize-video] Primary model failed:", errorText);
      
      // Fallback to AnimateDiff with ControlNet
      console.log("[stylize-video] Trying AnimateDiff fallback...");
      
      const fallbackResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "9ebea41b5e8ae8e53b7e27d04e31b535a4a6b94aa32f2b39c3e77a97e9c0c6e8",
          input: {
            video_path: videoUrl,
            prompt: stylePrompt,
            negative_prompt: negativePrompt,
            strength: strength,
            guidance_scale: guidanceScale,
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
          appliedStrength: strength,
          appliedGuidance: guidanceScale,
          message: "Video is being stylized with advanced parameters. Poll for status.",
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
        appliedStrength: strength,
        appliedGuidance: guidanceScale,
        availableStyles: Object.keys(STYLE_PRESETS),
        message: "Video is being stylized with cinema-grade parameters. Poll for status.",
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
