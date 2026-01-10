import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * STYLE ANCHOR EXTRACTION
 * 
 * Extracts visual DNA from the first generated clip's frame to ensure
 * scene consistency, character consistency, and story continuity
 * when no reference image is provided.
 * 
 * Returns a "style anchor" object that gets injected into all subsequent prompts.
 */

interface StyleAnchorRequest {
  frameUrl: string;  // URL to first clip's last frame
  videoUrl?: string; // Optional: URL to first clip for deeper analysis
  shotDescription?: string; // The original shot description
  projectId: string;
}

interface StyleAnchor {
  // Color & Lighting
  colorPalette: {
    dominant: string;
    secondary: string[];
    mood: string;
  };
  lighting: {
    type: string;
    direction: string;
    intensity: string;
    quality: string;
  };
  
  // Visual Style
  visualStyle: {
    aesthetic: string;
    texture: string;
    contrast: string;
    saturation: string;
  };
  
  // Environment
  environment: {
    setting: string;
    timeOfDay: string;
    weather: string;
    atmosphere: string;
  };
  
  // Character (if present)
  character?: {
    appearance: string;
    clothing: string;
    distinctiveFeatures: string[];
  };
  
  // Consistency Prompt (the main injection string)
  consistencyPrompt: string;
  
  // Raw anchors for prompt injection
  anchors: string[];
}

async function analyzeFrameWithGemini(frameUrl: string, shotDescription?: string): Promise<StyleAnchor> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const prompt = `You are a professional cinematographer and visual consistency expert. Analyze this frame and extract the visual DNA that must remain consistent across all subsequent video clips.

${shotDescription ? `Original shot description: "${shotDescription}"` : ''}

Analyze the frame and provide a JSON response with the following structure:

{
  "colorPalette": {
    "dominant": "primary color tone (e.g., 'warm amber', 'cool steel blue', 'desaturated earth tones')",
    "secondary": ["2-3 secondary color descriptors"],
    "mood": "color mood description (e.g., 'nostalgic warmth', 'clinical coldness')"
  },
  "lighting": {
    "type": "lighting type (e.g., 'natural daylight', 'golden hour', 'artificial neon', 'diffused overcast')",
    "direction": "light direction (e.g., 'backlit', 'front-lit', 'side-lit', 'top-down')",
    "intensity": "high/medium/low/dramatic",
    "quality": "hard shadows/soft diffused/mixed/rim lighting"
  },
  "visualStyle": {
    "aesthetic": "overall visual aesthetic (e.g., 'cinematic film grain', 'clean digital', 'vintage 8mm', 'hyperreal')",
    "texture": "texture quality (e.g., 'smooth gradients', 'gritty texture', 'sharp details')",
    "contrast": "high/medium/low/crushed blacks",
    "saturation": "vibrant/natural/desaturated/monochromatic hints"
  },
  "environment": {
    "setting": "environment type (e.g., 'urban city', 'natural forest', 'indoor studio', 'abstract space')",
    "timeOfDay": "time of day (e.g., 'golden hour sunset', 'blue hour dawn', 'midday', 'night')",
    "weather": "weather/atmosphere (e.g., 'clear', 'misty', 'rainy', 'dusty')",
    "atmosphere": "atmospheric quality (e.g., 'hazy', 'crystal clear', 'foggy', 'smoky')"
  },
  "character": {
    "appearance": "physical appearance if visible (age, build, skin tone, hair)",
    "clothing": "clothing description if visible",
    "distinctiveFeatures": ["notable features that must stay consistent"]
  },
  "anchors": [
    "5-7 short, specific visual anchor phrases that MUST remain consistent",
    "e.g., 'warm amber color grading'",
    "e.g., 'soft backlit rim lighting'",
    "e.g., 'woman with dark curly hair'"
  ],
  "consistencyPrompt": "A single comprehensive prompt injection (50-80 words) describing ALL visual elements that must remain consistent. This will be prepended to every subsequent shot's prompt."
}

CRITICAL: 
- Be EXTREMELY specific about colors, lighting, and visual style
- Focus on elements that AI video generation can actually control
- The consistency prompt must be concise but comprehensive
- If no character is visible, omit the character field

Respond ONLY with the JSON object, no additional text.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: frameUrl } }
          ]
        }
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse style anchor JSON from Gemini response");
  }
  
  const styleAnchor = JSON.parse(jsonMatch[0]) as StyleAnchor;
  
  // Ensure all required fields exist
  if (!styleAnchor.consistencyPrompt) {
    // Build fallback consistency prompt
    styleAnchor.consistencyPrompt = [
      `[STYLE ANCHOR: ${styleAnchor.visualStyle?.aesthetic || 'cinematic'} aesthetic`,
      styleAnchor.colorPalette?.dominant ? `${styleAnchor.colorPalette.dominant} color palette` : '',
      styleAnchor.lighting?.type ? `${styleAnchor.lighting.type} lighting` : '',
      styleAnchor.environment?.atmosphere ? `${styleAnchor.environment.atmosphere} atmosphere` : '',
      ']'
    ].filter(Boolean).join(', ');
  }
  
  if (!styleAnchor.anchors || styleAnchor.anchors.length === 0) {
    styleAnchor.anchors = [
      styleAnchor.colorPalette?.dominant,
      styleAnchor.lighting?.type,
      styleAnchor.visualStyle?.aesthetic,
    ].filter(Boolean) as string[];
  }
  
  return styleAnchor;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: StyleAnchorRequest = await req.json();
    
    if (!request.frameUrl) {
      throw new Error("frameUrl is required");
    }
    
    console.log(`[StyleAnchor] Extracting visual DNA from frame: ${request.frameUrl.substring(0, 60)}...`);
    
    const styleAnchor = await analyzeFrameWithGemini(request.frameUrl, request.shotDescription);
    
    console.log(`[StyleAnchor] Extracted ${styleAnchor.anchors.length} visual anchors`);
    console.log(`[StyleAnchor] Consistency prompt: ${styleAnchor.consistencyPrompt.substring(0, 80)}...`);
    
    return new Response(
      JSON.stringify({
        success: true,
        styleAnchor,
        summary: {
          dominantColor: styleAnchor.colorPalette?.dominant,
          lightingType: styleAnchor.lighting?.type,
          visualStyle: styleAnchor.visualStyle?.aesthetic,
          anchorCount: styleAnchor.anchors?.length || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[StyleAnchor] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
