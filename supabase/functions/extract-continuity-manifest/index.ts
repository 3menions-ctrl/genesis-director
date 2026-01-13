import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CONTINUITY MANIFEST EXTRACTOR
 * 
 * Analyzes a video frame to extract comprehensive continuity data:
 * - Spatial positioning (screen position, depth, facing)
 * - Lighting state (direction, quality, color temp)
 * - Props inventory (what's held, where, state)
 * - Emotional state (expression, body language)
 * - Action momentum (movement direction, pose)
 * - Micro-details (scars, dirt, clothing wear)
 */

interface ExtractContinuityRequest {
  frameUrl: string;
  projectId: string;
  shotIndex: number;
  previousManifest?: any;
  shotDescription?: string;
  characterNames?: string[];
}

async function extractContinuityWithAI(
  frameUrl: string,
  shotDescription?: string,
  characterNames?: string[],
  previousManifest?: any
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const characterContext = characterNames?.length 
    ? `Known characters in this scene: ${characterNames.join(', ')}.` 
    : '';
  
  const previousContext = previousManifest 
    ? `Previous shot had: ${previousManifest.injectionPrompt || 'No previous data'}` 
    : '';

  const prompt = `You are a professional continuity supervisor for film production. Analyze this frame and extract EVERY detail needed to maintain perfect continuity in the next shot.

${shotDescription ? `Scene description: "${shotDescription}"` : ''}
${characterContext}
${previousContext}

Extract and return a JSON object with this EXACT structure:

{
  "spatial": {
    "primaryCharacter": {
      "screenPosition": "left|center|right|left-third|right-third",
      "depth": "foreground|midground|background",
      "verticalPosition": "top|middle|bottom",
      "facingDirection": "left|right|camera|away",
      "bodyAngle": <number 0-360>
    },
    "cameraDistance": "extreme-close|close-up|medium|full-shot|wide|extreme-wide",
    "eyeLineDirection": "<where character is looking>"
  },
  "lighting": {
    "primarySource": {
      "type": "natural|artificial|mixed|practical",
      "direction": "front|back|left|right|top|bottom|rim",
      "quality": "hard|soft|diffused",
      "intensity": "low|medium|high|dramatic"
    },
    "colorTemperature": "warm|neutral|cool|mixed",
    "colorTint": "<specific color description>",
    "shadowDirection": "<where shadows are falling>",
    "ambientLevel": "dark|dim|normal|bright|overexposed",
    "specialLighting": ["<any notable lighting effects>"]
  },
  "props": {
    "characterProps": [
      {
        "characterName": "<name>",
        "props": [
          {
            "propId": "<unique id>",
            "name": "<prop name>",
            "hand": "left|right|both|none",
            "state": "<current state>",
            "position": "<where/how held>",
            "condition": "<any damage/effects>"
          }
        ]
      }
    ],
    "environmentProps": [
      {"name": "<prop>", "position": "<where>", "state": "<condition>"}
    ]
  },
  "emotional": {
    "primaryEmotion": "<emotion name>",
    "intensity": "subtle|moderate|intense|extreme",
    "facialExpression": "<detailed description>",
    "bodyLanguage": "<posture and tension>",
    "breathingState": "calm|heavy|panting|held",
    "physicalIndicators": ["<tears>", "<sweat>", "<etc>"]
  },
  "action": {
    "movementDirection": "left|right|toward-camera|away|stationary|up|down",
    "movementType": "walking|running|fighting|falling|jumping|turning|still",
    "gestureInProgress": "<any mid-action gesture>",
    "poseAtCut": "<exact pose description>",
    "expectedContinuation": "<what should happen next to maintain continuity>"
  },
  "microDetails": {
    "skin": {
      "scars": [{"location": "<where>", "description": "<appearance>"}],
      "wounds": [{"location": "<where>", "freshness": "fresh|healing|old", "description": "<appearance>"}],
      "dirt": [{"areas": ["<body parts>"], "intensity": "light|moderate|heavy"}],
      "sweat": true|false,
      "blood": [{"areas": ["<where>"], "freshness": "<state>"}]
    },
    "clothing": {
      "tears": [{"location": "<where>", "size": "small|medium|large"}],
      "stains": [{"location": "<where>", "type": "<blood|mud|water|etc>", "color": "<if notable>"}],
      "dustLevel": "clean|light-dust|dusty|caked",
      "wetness": [{"areas": ["<where>"], "level": "damp|wet|soaked"}]
    },
    "hair": {
      "style": "<current style>",
      "condition": "neat|slightly-messy|disheveled|wild",
      "wetness": "dry|damp|wet|dripping",
      "debris": ["<any particles in hair>"],
      "windEffect": "<direction if applicable>"
    },
    "persistentMarkers": ["<things that MUST stay consistent>"]
  },
  "environment": {
    "weatherVisible": "<weather effects>",
    "timeOfDay": "<lighting time>",
    "atmospherics": ["<fog>", "<dust>", "<smoke>"],
    "backgroundElements": ["<notable background items>"],
    "surfaceConditions": "<ground/surface state>"
  },
  "criticalAnchors": [
    "<5-7 most critical continuity elements that MUST be maintained>"
  ],
  "injectionPrompt": "<50-80 word comprehensive prompt injection covering ALL critical continuity elements>",
  "negativePrompt": "<elements to avoid that would break continuity>"
}

CRITICAL INSTRUCTIONS:
1. Be EXTREMELY specific about positions, lighting, and micro-details
2. Note EVERY scar, wound, stain, or wear visible
3. Track prop states precisely (sword drawn vs sheathed, etc.)
4. Capture the EXACT emotional expression
5. The injection prompt must be dense with visual anchors
6. If something isn't visible, say "not visible" rather than guessing

Respond ONLY with the JSON object, no additional text.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: frameUrl } }
          ]
        }
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse continuity manifest JSON from AI response");
  }
  
  return JSON.parse(jsonMatch[0]);
}

function buildEnhancedInjectionPrompt(manifest: any): string {
  const parts: string[] = [];
  
  // Spatial
  if (manifest.spatial?.primaryCharacter) {
    const sp = manifest.spatial.primaryCharacter;
    parts.push(
      `[SPATIAL: Character ${sp.screenPosition}, ${sp.depth}, facing ${sp.facingDirection}]`
    );
  }
  
  // Lighting
  if (manifest.lighting) {
    const lt = manifest.lighting;
    parts.push(
      `[LIGHTING: ${lt.primarySource?.type || 'mixed'} ${lt.primarySource?.direction || 'front'} light, ` +
      `${lt.colorTemperature || 'neutral'} temp, ${lt.shadowDirection || 'natural shadows'}]`
    );
  }
  
  // Emotional
  if (manifest.emotional) {
    parts.push(
      `[EMOTION: ${manifest.emotional.intensity || 'moderate'} ${manifest.emotional.primaryEmotion}, ` +
      `${manifest.emotional.facialExpression}]`
    );
  }
  
  // Micro-details
  const microParts: string[] = [];
  if (manifest.microDetails?.skin?.scars?.length > 0) {
    microParts.push(...manifest.microDetails.skin.scars.map((s: any) => `scar ${s.location}`));
  }
  if (manifest.microDetails?.skin?.dirt?.length > 0) {
    manifest.microDetails.skin.dirt.forEach((d: any) => {
      microParts.push(`${d.intensity} dirt on ${d.areas?.join(', ') || 'visible areas'}`);
    });
  }
  if (manifest.microDetails?.clothing?.stains?.length > 0) {
    microParts.push(...manifest.microDetails.clothing.stains.slice(0, 2).map(
      (s: any) => `${s.type} on ${s.location}`
    ));
  }
  if (microParts.length > 0) {
    parts.push(`[DETAILS: ${microParts.slice(0, 5).join(', ')}]`);
  }
  
  // Props
  if (manifest.props?.characterProps?.length > 0) {
    const propList = manifest.props.characterProps
      .flatMap((cp: any) => cp.props?.map((p: any) => `${p.name} ${p.state}`) || [])
      .slice(0, 3);
    if (propList.length > 0) {
      parts.push(`[PROPS: ${propList.join(', ')}]`);
    }
  }
  
  // Critical anchors
  if (manifest.criticalAnchors?.length > 0) {
    parts.push(`[ANCHORS: ${manifest.criticalAnchors.slice(0, 4).join(', ')}]`);
  }
  
  return parts.join(' ');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ExtractContinuityRequest = await req.json();
    
    if (!request.frameUrl) {
      throw new Error("frameUrl is required");
    }
    
    console.log(`[ContinuityManifest] Extracting from shot ${request.shotIndex} for project ${request.projectId}`);
    
    const manifestData = await extractContinuityWithAI(
      request.frameUrl,
      request.shotDescription,
      request.characterNames,
      request.previousManifest
    );
    
    // Enhance the injection prompt if the AI's version is weak
    if (!manifestData.injectionPrompt || manifestData.injectionPrompt.length < 50) {
      manifestData.injectionPrompt = buildEnhancedInjectionPrompt(manifestData);
    }
    
    const manifest = {
      shotIndex: request.shotIndex,
      projectId: request.projectId,
      extractedAt: Date.now(),
      ...manifestData,
    };
    
    console.log(`[ContinuityManifest] Extracted ${manifest.criticalAnchors?.length || 0} critical anchors`);
    console.log(`[ContinuityManifest] Injection prompt: ${manifest.injectionPrompt?.substring(0, 100)}...`);
    
    return new Response(
      JSON.stringify({
        success: true,
        manifest,
        summary: {
          spatialPosition: manifest.spatial?.primaryCharacter?.screenPosition,
          lightingType: manifest.lighting?.primarySource?.type,
          emotion: manifest.emotional?.primaryEmotion,
          propsCount: manifest.props?.characterProps?.reduce(
            (acc: number, cp: any) => acc + (cp.props?.length || 0), 0
          ) || 0,
          microDetailsCount: 
            (manifest.microDetails?.skin?.scars?.length || 0) +
            (manifest.microDetails?.skin?.wounds?.length || 0) +
            (manifest.microDetails?.clothing?.stains?.length || 0),
          criticalAnchorsCount: manifest.criticalAnchors?.length || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[ContinuityManifest] Error:", error);
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
