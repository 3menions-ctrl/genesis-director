import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MULTI-FRAME MASTER DNA EXTRACTION
 * 
 * Extracts visual DNA from multiple frames of Clip 1 to create a robust
 * master reference that accounts for variation within the clip.
 * 
 * Improvement #2.4: Multi-Frame Master DNA Extraction
 */

interface ExtractionRequest {
  projectId: string;
  clipUrl: string;
  frameUrls: string[];  // Multiple frames from clip 1
  referenceImageUrl?: string;
  identityBible?: any;
}

interface MasterDNA {
  // Color consistency
  colorPalette: {
    temperature: 'warm' | 'neutral' | 'cool';
    saturation: 'vibrant' | 'natural' | 'muted';
    dominantColors: Array<{ name: string; hex: string; percentage: number }>;
    accentColors: Array<{ name: string; hex: string }>;
  };
  
  // Lighting consistency
  lighting: {
    timeOfDay: string;
    keyLightDirection: string;
    shadowDirection: string;
    shadowIntensity: string;
    ambientLevel: string;
  };
  
  // Character consistency
  character: {
    faceAnchors: string[];
    clothingDescription: string;
    clothingColors: string[];
    hairDescription: string;
    bodyType: string;
    distinctiveFeatures: string[];
  };
  
  // Environment consistency
  environment: {
    type: string;
    keyElements: string[];
    atmosphere: string;
    depthOfField: string;
  };
  
  // Confidence scores
  confidence: {
    overall: number;
    color: number;
    lighting: number;
    character: number;
    environment: number;
  };
  
  // Master prompts
  masterPrompt: string;
  negativePrompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ExtractionRequest = await req.json();
    const { projectId, frameUrls, referenceImageUrl, identityBible } = request;

    console.log(`[MasterDNA] Starting extraction for project ${projectId}`);
    console.log(`[MasterDNA] Analyzing ${frameUrls.length} frames`);

    if (frameUrls.length === 0) {
      throw new Error("No frames provided for analysis");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Analyze each frame
    const frameAnalyses: any[] = [];
    
    for (let i = 0; i < Math.min(frameUrls.length, 3); i++) {
      console.log(`[MasterDNA] Analyzing frame ${i + 1}/${Math.min(frameUrls.length, 3)}`);
      
      const analysis = await analyzeFrame(
        LOVABLE_API_KEY,
        frameUrls[i],
        referenceImageUrl,
        identityBible
      );
      
      if (analysis) {
        frameAnalyses.push(analysis);
      }
    }

    if (frameAnalyses.length === 0) {
      throw new Error("Failed to analyze any frames");
    }

    // Merge analyses into master DNA
    const masterDNA = mergeFrameAnalyses(frameAnalyses, identityBible);
    
    console.log(`[MasterDNA] Extraction complete`);
    console.log(`[MasterDNA] Confidence: ${masterDNA.confidence.overall}%`);
    console.log(`[MasterDNA] Color: ${masterDNA.colorPalette.temperature}, ${masterDNA.colorPalette.dominantColors.length} colors`);
    console.log(`[MasterDNA] Lighting: ${masterDNA.lighting.timeOfDay}, ${masterDNA.lighting.keyLightDirection}`);

    return new Response(
      JSON.stringify({ success: true, masterDNA }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[MasterDNA] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeFrame(
  apiKey: string,
  frameUrl: string,
  referenceUrl?: string,
  identityBible?: any
): Promise<any | null> {
  
  const messages: any[] = [
    {
      role: "system",
      content: `You are a visual DNA extraction specialist. Analyze this video frame and extract precise visual characteristics.

You MUST respond with ONLY a valid JSON object:
{
  "colorPalette": {
    "temperature": "warm|neutral|cool",
    "saturation": "vibrant|natural|muted",
    "dominantColors": [{"name": "string", "hex": "#XXXXXX", "percentage": 0-100}],
    "accentColors": [{"name": "string", "hex": "#XXXXXX"}]
  },
  "lighting": {
    "timeOfDay": "string (e.g., golden hour, midday, dusk)",
    "keyLightDirection": "string (e.g., camera-left 45°)",
    "shadowDirection": "string (e.g., falling right)",
    "shadowIntensity": "strong|medium|soft",
    "ambientLevel": "high|medium|low"
  },
  "character": {
    "faceAnchors": ["list of facial features"],
    "clothingDescription": "detailed clothing description",
    "clothingColors": ["color1", "color2"],
    "hairDescription": "hair style, color, length",
    "bodyType": "description",
    "distinctiveFeatures": ["list of unique markers"]
  },
  "environment": {
    "type": "indoor|outdoor|studio",
    "keyElements": ["list of background elements"],
    "atmosphere": "description",
    "depthOfField": "shallow|medium|deep"
  }
}

Be PRECISE with colors - use actual HEX codes.
Be SPECIFIC with descriptions - these will be used to maintain consistency.`
    }
  ];

  const userContent: any[] = [];
  
  if (frameUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: frameUrl }
    });
  }
  
  if (referenceUrl) {
    userContent.push({
      type: "image_url",
      image_url: { url: referenceUrl }
    });
  }

  let prompt = `Extract visual DNA from this frame.`;
  
  if (referenceUrl) {
    prompt += ` Compare with reference image for character accuracy.`;
  }
  
  if (identityBible?.characterDescription) {
    prompt += `\n\nExpected character: ${identityBible.characterDescription}`;
  }

  userContent.push({ type: "text", text: prompt });
  messages.push({ role: "user", content: userContent });

  try {
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn(`[MasterDNA] AI call failed`);
      return null;
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content?.trim();

    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);

  } catch (err) {
    console.warn(`[MasterDNA] Frame analysis error:`, err);
    return null;
  }
}

function mergeFrameAnalyses(analyses: any[], identityBible?: any): MasterDNA {
  // Use first frame as primary, merge others
  const primary = analyses[0];
  
  // Collect all colors across frames
  const allDominantColors = analyses
    .flatMap(a => a.colorPalette?.dominantColors || [])
    .reduce((acc, color) => {
      const existing = acc.find((c: any) => c.hex === color.hex);
      if (existing) {
        existing.percentage = (existing.percentage + color.percentage) / 2;
      } else {
        acc.push({ ...color });
      }
      return acc;
    }, [] as any[])
    .sort((a: any, b: any) => b.percentage - a.percentage)
    .slice(0, 5);

  // Determine consensus temperature
  const temps = analyses.map(a => a.colorPalette?.temperature).filter(Boolean);
  const tempCounts = temps.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const consensusTemp = Object.entries(tempCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'neutral';

  // Merge character features
  const allFaceAnchors = [...new Set(
    analyses.flatMap(a => a.character?.faceAnchors || [])
  )];
  
  const allDistinctiveFeatures = [...new Set(
    analyses.flatMap(a => a.character?.distinctiveFeatures || [])
  )];

  // Build master DNA
  const masterDNA: MasterDNA = {
    colorPalette: {
      temperature: consensusTemp as 'warm' | 'neutral' | 'cool',
      saturation: primary.colorPalette?.saturation || 'natural',
      dominantColors: allDominantColors,
      accentColors: primary.colorPalette?.accentColors || [],
    },
    lighting: {
      timeOfDay: primary.lighting?.timeOfDay || 'natural',
      keyLightDirection: primary.lighting?.keyLightDirection || 'front',
      shadowDirection: primary.lighting?.shadowDirection || 'natural',
      shadowIntensity: primary.lighting?.shadowIntensity || 'medium',
      ambientLevel: primary.lighting?.ambientLevel || 'medium',
    },
    character: {
      faceAnchors: allFaceAnchors.slice(0, 5),
      clothingDescription: primary.character?.clothingDescription || identityBible?.characterIdentity?.clothing || '',
      clothingColors: primary.character?.clothingColors || [],
      hairDescription: primary.character?.hairDescription || '',
      bodyType: primary.character?.bodyType || identityBible?.characterIdentity?.bodyType || '',
      distinctiveFeatures: allDistinctiveFeatures.slice(0, 5),
    },
    environment: {
      type: primary.environment?.type || 'unknown',
      keyElements: primary.environment?.keyElements || [],
      atmosphere: primary.environment?.atmosphere || '',
      depthOfField: primary.environment?.depthOfField || 'medium',
    },
    confidence: {
      overall: Math.round((analyses.length / 3) * 100),
      color: analyses.every(a => a.colorPalette) ? 90 : 70,
      lighting: analyses.every(a => a.lighting) ? 90 : 70,
      character: analyses.every(a => a.character) ? 90 : 70,
      environment: analyses.every(a => a.environment) ? 85 : 65,
    },
    masterPrompt: '',
    negativePrompt: '',
  };

  // Build master prompt
  const promptParts: string[] = [
    `[MASTER VISUAL DNA - LOCKED FROM CLIP 1]`,
    `COLOR: ${masterDNA.colorPalette.temperature} temperature, ${masterDNA.colorPalette.saturation} saturation`,
  ];
  
  if (masterDNA.colorPalette.dominantColors.length > 0) {
    const colorList = masterDNA.colorPalette.dominantColors
      .slice(0, 3)
      .map(c => `${c.name} (${c.hex})`)
      .join(', ');
    promptParts.push(`PALETTE: ${colorList}`);
  }
  
  promptParts.push(
    `LIGHTING: ${masterDNA.lighting.timeOfDay}, key light ${masterDNA.lighting.keyLightDirection}`,
    `SHADOWS: ${masterDNA.lighting.shadowIntensity} intensity, ${masterDNA.lighting.shadowDirection}`,
  );
  
  if (masterDNA.character.clothingDescription) {
    promptParts.push(`CLOTHING: ${masterDNA.character.clothingDescription}`);
  }
  
  if (masterDNA.character.distinctiveFeatures.length > 0) {
    promptParts.push(`DISTINCTIVE: ${masterDNA.character.distinctiveFeatures.join(', ')}`);
  }
  
  promptParts.push(`[END MASTER DNA]`);
  
  masterDNA.masterPrompt = promptParts.join('\n');

  // Build negative prompt
  const wrongColors = ['red', 'blue', 'green', 'yellow', 'purple']
    .filter(c => !masterDNA.colorPalette.dominantColors.some(dc => dc.name.toLowerCase().includes(c)))
    .slice(0, 3);
  
  const wrongTemps = ['warm', 'cool', 'neutral']
    .filter(t => t !== masterDNA.colorPalette.temperature);
  
  masterDNA.negativePrompt = [
    ...wrongColors.map(c => `${c} color cast`),
    ...wrongTemps.map(t => `${t} temperature`),
    'lighting direction change',
    'shadow reversal',
    'color shift',
    'exposure change',
  ].join(', ');

  return masterDNA;
}
