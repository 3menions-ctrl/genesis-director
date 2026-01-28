import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scene Anchor Extractor - LOVABLE AI POWERED
 * 
 * Uses Lovable AI Gateway (Gemini) for scene analysis instead of direct Google Vertex.
 * No GCP credentials needed - uses LOVABLE_API_KEY automatically.
 * 
 * Analyzes a frame/image to extract environment DNA:
 * - Lighting fingerprint
 * - Color palette
 * - Depth cues
 * - Key objects
 * - Motion signature
 */

interface SceneAnchor {
  id: string;
  shotId: string;
  frameUrl: string;
  extractedAt: number;
  lighting: LightingFingerprint;
  colorPalette: ColorPalette;
  depthCues: DepthCues;
  keyObjects: KeyObjects;
  motionSignature: MotionSignature;
  masterConsistencyPrompt: string;
}

interface LightingFingerprint {
  keyLightDirection: string;
  keyLightIntensity: 'soft' | 'medium' | 'harsh';
  keyLightColor: string;
  fillRatio: number;
  ambientColor: string;
  shadowHardness: 'soft' | 'medium' | 'hard';
  shadowDirection: string;
  timeOfDay: 'golden-hour' | 'midday' | 'blue-hour' | 'night' | 'overcast' | 'indoor';
  promptFragment: string;
}

interface ColorPalette {
  dominant: { hex: string; percentage: number; name: string }[];
  accents: string[];
  temperature: 'warm' | 'neutral' | 'cool';
  saturation: 'muted' | 'natural' | 'vibrant';
  gradeStyle: string;
  promptFragment: string;
}

interface DepthCues {
  dofStyle: 'deep' | 'shallow' | 'rack-focus';
  focalPlane: 'foreground' | 'midground' | 'background';
  bokehQuality: string;
  atmosphericPerspective: boolean;
  fogHaze: 'none' | 'light' | 'medium' | 'heavy';
  foregroundElements: string[];
  midgroundElements: string[];
  backgroundElements: string[];
  perspectiveType: 'one-point' | 'two-point' | 'three-point' | 'isometric';
  vanishingPointLocation: string;
  promptFragment: string;
}

interface KeyObjects {
  objects: {
    id: string;
    name: string;
    description: string;
    position: 'left' | 'center' | 'right';
    depth: 'foreground' | 'midground' | 'background';
    importance: 'hero' | 'supporting' | 'environmental';
  }[];
  environmentType: 'interior' | 'exterior' | 'mixed';
  settingDescription: string;
  architecturalStyle: string;
  promptFragment: string;
}

interface MotionSignature {
  cameraMotionStyle: 'static' | 'subtle' | 'dynamic' | 'chaotic';
  preferredMovements: string[];
  subjectMotionIntensity: 'still' | 'subtle' | 'active' | 'intense';
  pacingTempo: 'slow' | 'medium' | 'fast';
  cutRhythm: string;
  promptFragment: string;
}

// Analyze scene using Lovable AI Gateway (Gemini with vision)
async function analyzeSceneWithLovableAI(imageUrl: string, apiKey: string): Promise<any> {
  const analysisPrompt = `Analyze this image as a film cinematographer. Extract the complete visual DNA for scene consistency.

Return a JSON object with this EXACT structure (no markdown, just JSON):
{
  "lighting": {
    "keyLightDirection": "description of main light source direction",
    "keyLightIntensity": "soft" | "medium" | "harsh",
    "keyLightColor": "color description",
    "fillRatio": 0.0-1.0,
    "ambientColor": "ambient light color",
    "shadowHardness": "soft" | "medium" | "hard",
    "shadowDirection": "where shadows fall",
    "timeOfDay": "golden-hour" | "midday" | "blue-hour" | "night" | "overcast" | "indoor",
    "promptFragment": "Concise lighting description for AI prompt"
  },
  "colorPalette": {
    "dominant": [{"hex": "#HEXCODE", "percentage": 30, "name": "color name"}],
    "accents": ["#HEX1", "#HEX2"],
    "temperature": "warm" | "neutral" | "cool",
    "saturation": "muted" | "natural" | "vibrant",
    "gradeStyle": "color grading style description",
    "promptFragment": "Color palette description for AI prompt"
  },
  "depthCues": {
    "dofStyle": "deep" | "shallow" | "rack-focus",
    "focalPlane": "foreground" | "midground" | "background",
    "bokehQuality": "bokeh description",
    "atmosphericPerspective": true/false,
    "fogHaze": "none" | "light" | "medium" | "heavy",
    "foregroundElements": ["list"],
    "midgroundElements": ["list"],
    "backgroundElements": ["list"],
    "perspectiveType": "one-point" | "two-point" | "three-point" | "isometric",
    "vanishingPointLocation": "location",
    "promptFragment": "Depth description for AI prompt"
  },
  "keyObjects": {
    "objects": [{"id": "id", "name": "name", "description": "desc", "position": "center", "depth": "midground", "importance": "hero"}],
    "environmentType": "interior" | "exterior" | "mixed",
    "settingDescription": "overall setting",
    "architecturalStyle": "style",
    "promptFragment": "Environment description for AI prompt"
  },
  "motionSignature": {
    "cameraMotionStyle": "static" | "subtle" | "dynamic" | "chaotic",
    "preferredMovements": ["movement types"],
    "subjectMotionIntensity": "still" | "subtle" | "active" | "intense",
    "pacingTempo": "slow" | "medium" | "fast",
    "cutRhythm": "rhythm description",
    "promptFragment": "Motion description for AI prompt"
  }
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", // Fast multimodal model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: analysisPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Scene Anchor] Lovable AI error:", response.status, errorText);
    throw new Error(`Lovable AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content || "";
  
  // Extract JSON from response
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  return JSON.parse(jsonStr);
}

// Build master consistency prompt from all components
function buildMasterPrompt(analysis: any): string {
  const fragments = [
    analysis.lighting?.promptFragment,
    analysis.colorPalette?.promptFragment,
    analysis.depthCues?.promptFragment,
    analysis.keyObjects?.promptFragment,
    analysis.motionSignature?.promptFragment,
  ].filter(Boolean);
  
  return fragments.join('. ') + '.';
}

// Retry utility
async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`[${operationName}] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

function getDefaultSceneAnchor(shotId: string, frameUrl: string): SceneAnchor {
  return {
    id: `anchor_fallback_${Date.now()}`,
    shotId,
    frameUrl,
    extractedAt: Date.now(),
    lighting: {
      keyLightDirection: 'natural ambient',
      keyLightIntensity: 'medium',
      keyLightColor: 'neutral daylight',
      fillRatio: 0.5,
      ambientColor: 'neutral',
      shadowHardness: 'soft',
      shadowDirection: 'natural',
      timeOfDay: 'indoor',
      promptFragment: 'natural ambient lighting with soft shadows',
    },
    colorPalette: {
      dominant: [{ hex: '#808080', percentage: 40, name: 'neutral gray' }],
      accents: [],
      temperature: 'neutral',
      saturation: 'natural',
      gradeStyle: 'natural cinematic',
      promptFragment: 'natural color grading with balanced tones',
    },
    depthCues: {
      dofStyle: 'deep',
      focalPlane: 'midground',
      bokehQuality: 'subtle',
      atmosphericPerspective: false,
      fogHaze: 'none',
      foregroundElements: [],
      midgroundElements: [],
      backgroundElements: [],
      perspectiveType: 'one-point',
      vanishingPointLocation: 'center',
      promptFragment: 'deep depth of field with clear focus',
    },
    keyObjects: {
      objects: [],
      environmentType: 'mixed',
      settingDescription: 'general scene',
      architecturalStyle: 'contemporary',
      promptFragment: 'contemporary setting',
    },
    motionSignature: {
      cameraMotionStyle: 'subtle',
      preferredMovements: ['slow pan', 'gentle drift'],
      subjectMotionIntensity: 'subtle',
      pacingTempo: 'medium',
      cutRhythm: 'measured',
      promptFragment: 'subtle camera movement with measured pacing',
    },
    masterConsistencyPrompt: 'natural ambient lighting, balanced color grading, deep focus, contemporary setting, subtle camera movement',
  };
}

function validateAndFixAnchor(analysis: any, shotId: string, frameUrl: string): SceneAnchor {
  const defaultAnchor = getDefaultSceneAnchor(shotId, frameUrl);
  
  const lighting = analysis.lighting || defaultAnchor.lighting;
  if (!lighting.promptFragment) {
    lighting.promptFragment = `${lighting.keyLightIntensity || 'medium'} ${lighting.timeOfDay || 'natural'} lighting`;
  }
  
  const colorPalette = analysis.colorPalette || defaultAnchor.colorPalette;
  if (!colorPalette.promptFragment) {
    colorPalette.promptFragment = `${colorPalette.temperature || 'neutral'} color palette`;
  }
  
  const depthCues = analysis.depthCues || defaultAnchor.depthCues;
  if (!depthCues.promptFragment) {
    depthCues.promptFragment = `${depthCues.dofStyle || 'deep'} depth of field`;
  }
  
  const keyObjects = analysis.keyObjects || defaultAnchor.keyObjects;
  if (!keyObjects.promptFragment) {
    keyObjects.promptFragment = keyObjects.settingDescription || 'general scene';
  }
  
  const motionSignature = analysis.motionSignature || defaultAnchor.motionSignature;
  if (!motionSignature.promptFragment) {
    motionSignature.promptFragment = `${motionSignature.cameraMotionStyle || 'subtle'} camera motion`;
  }
  
  return {
    id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    shotId: shotId || 'unknown',
    frameUrl,
    extractedAt: Date.now(),
    lighting,
    colorPalette,
    depthCues,
    keyObjects,
    motionSignature,
    masterConsistencyPrompt: buildMasterPrompt({ lighting, colorPalette, depthCues, keyObjects, motionSignature }),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestData: any = {};

  try {
    requestData = await req.json();
    const { frameUrl, shotId } = requestData;

    if (!frameUrl) {
      throw new Error("frameUrl is required");
    }

    console.log(`[Scene Anchor] Extracting from frame: ${frameUrl}`);

    // Get Lovable AI key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let sceneAnchor: SceneAnchor;
    let usedFallback = false;

    try {
      console.log("[Scene Anchor] Analyzing scene with Lovable AI (Gemini Vision)...");
      const analysis = await withRetry(
        () => analyzeSceneWithLovableAI(frameUrl, LOVABLE_API_KEY),
        "Scene Analysis"
      );

      sceneAnchor = validateAndFixAnchor(analysis, shotId, frameUrl);
      console.log(`[Scene Anchor] ✓ Extraction successful`);
      
    } catch (extractionError) {
      console.error("[Scene Anchor] Extraction failed, using fallback:", extractionError);
      sceneAnchor = getDefaultSceneAnchor(shotId || 'unknown', frameUrl);
      usedFallback = true;
    }

    const processingTimeMs = Date.now() - startTime;
    
    console.log(`[Scene Anchor] Complete in ${processingTimeMs}ms${usedFallback ? ' (FALLBACK)' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        anchor: sceneAnchor,
        processingTimeMs,
        usedFallback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Scene Anchor] Critical error:", error);
    
    const fallbackAnchor = getDefaultSceneAnchor(
      requestData?.shotId || 'unknown',
      requestData?.frameUrl || ''
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        anchor: fallbackAnchor,
        processingTimeMs: Date.now() - startTime,
        usedFallback: true,
        fallbackReason: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
