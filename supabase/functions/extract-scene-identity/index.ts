import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * EXTRACT-SCENE-IDENTITY
 * 
 * The "Character-First" engine for image-to-video mode.
 * Runs a deep, multi-pass analysis on the reference image to produce:
 *   1. CHARACTER DNA  — avatar-grade identity bible (face, body, clothing, non-facial anchors)
 *   2. ENVIRONMENT DNA — full scene lock (setting, geometry, props, spatial relationships)
 *   3. LIGHTING PROFILE — exact lighting model with key angles, shadow direction, color temp
 *   4. COLOR SCIENCE   — dominant & accent palette with hex codes, mood, temperature
 *   5. CINEMATIC STYLE — lens feel, depth-of-field, film grain, shot framing
 *   6. NEGATIVE PROMPTS — what to avoid to prevent morphing and drift
 *   7. CONSISTENCY ANCHORS — short, injectable phrases for every prompt in the pipeline
 * 
 * Designed to rival the Avatar pipeline's identity lock system.
 * Charges 5 credits before running.
 */

interface CharacterDNA {
  // Core identity
  description: string;
  facialFeatures: {
    faceShape: string;
    eyes: string;
    nose: string;
    mouth: string;
    jawline: string;
    cheekbones: string;
    skinTone: string;
    skinTexture: string;
    complexion: string;
  };
  hairProfile: {
    color: string;
    texture: string;
    length: string;
    style: string;
    fromBehind: string; // for rear-view continuity
  };
  bodyProfile: {
    build: string;
    height: string;
    posture: string;
    gait: string;
    silhouette: string;
  };
  clothingSignature: {
    topwear: string;
    bottomwear: string;
    footwear: string;
    accessories: string[];
    colors: string[];
    style: string;
    textures: string;
  };
  distinctiveMarkers: string[]; // tattoos, scars, birthmarks, glasses, jewelry
  // Face-lock anchors (injected into every Kling prompt)
  faceLockAnchors: string[];
  // Non-facial anchors (for frames where face isn't visible)
  nonFacialAnchors: string[];
  // Anti-morphing negatives
  morphingNegatives: string[];
  // Concise identity summary for prompt injection
  identitySummary: string;
}

interface EnvironmentDNA {
  // Overall scene
  setting: string;
  sceneType: string; // indoor/outdoor/studio/natural
  // Spatial structure
  geometry: {
    depth: string;
    perspective: string;
    planes: string; // foreground, midground, background elements
    spatialRelationships: string;
  };
  // Key scene elements
  keyProps: Array<{ object: string; position: string; significance: string }>;
  backgroundElements: string[];
  // Architecture/surface details
  surfaces: {
    floor: string;
    walls: string;
    ceiling: string;
    materials: string[];
  };
  // Environmental conditions
  conditions: {
    weather: string;
    timeOfDay: string;
    season: string;
    atmosphere: string; // hazy, clear, foggy, etc.
  };
  // Environment lock for prompt injection
  environmentLock: string;
  // Scene anchors for consistency
  sceneAnchors: string[];
}

interface LightingProfile {
  style: string; // dramatic chiaroscuro, soft ambient, hard noir, etc.
  primarySource: {
    type: string; // sun, window, artificial, practical
    direction: string;
    angle: string; // degrees
    intensity: string;
    color: string;
  };
  fillLight: {
    direction: string;
    intensity: string;
    color: string;
  };
  rimLight: {
    present: boolean;
    direction: string;
    color: string;
  };
  shadows: {
    direction: string;
    hardness: string; // hard/soft/medium
    length: string;
  };
  timeOfDay: string;
  colorTemperature: string; // Kelvin description
  mood: string;
  // Compact prompt for injection
  lightingAnchor: string;
}

interface ColorScience {
  dominant: Array<{ name: string; hex: string; proportion: string }>;
  accent: Array<{ name: string; hex: string }>;
  neutrals: Array<{ name: string; hex: string }>;
  colorRelationships: string; // complementary, analogous, etc.
  mood: string;
  temperature: "warm" | "neutral" | "cool";
  saturation: "high" | "medium" | "low" | "desaturated";
  contrast: "high" | "medium" | "low";
  // Color grading style
  gradingStyle: string; // teal-orange, bleach bypass, natural, etc.
  // For prompt injection
  colorAnchor: string;
}

interface CinematicStyle {
  lensCharacter: string; // wide, normal, telephoto
  depthOfField: string; // shallow, deep, selective
  filmGrain: string; // none, subtle, moderate, heavy
  frameComposition: string; // rule of thirds, centered, dynamic
  cameraAngle: string; // eye-level, low, high, dutch
  motionCharacter: string; // static, handheld, smooth
  productionValue: string; // cinematic descriptor
  cinematicAnchor: string;
}

export interface SceneIdentityResult {
  success: boolean;
  imageUrl: string;
  characterDNA: CharacterDNA;
  environmentDNA: EnvironmentDNA;
  lightingProfile: LightingProfile;
  colorScience: ColorScience;
  cinematicStyle: CinematicStyle;
  // Master consistency prompt (single injectable phrase)
  masterConsistencyPrompt: string;
  // All negative prompts combined
  allNegatives: string[];
  // Per-clip injection anchors (short, modular)
  clipAnchors: {
    character: string;
    environment: string;
    lighting: string;
    color: string;
    cinematic: string;
  };
  creditsCharged: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const {
      imageUrl,
      projectId,
      userId,
      skipCreditCharge = false,
    }: {
      imageUrl: string;
      projectId?: string;
      userId?: string;
      skipCreditCharge?: boolean;
    } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No image URL provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const IDENTITY_EXTRACTION_CREDITS = 5;
    let creditsCharged = 0;

    // === CREDIT CHARGE PHASE ===
    // Charge 5 credits for the deep identity extraction
    if (!skipCreditCharge && userId && projectId) {
      console.log(`[extract-scene-identity] Charging ${IDENTITY_EXTRACTION_CREDITS} credits for identity extraction...`);

      // Check balance first
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .single();

      const balance = profile?.credits_balance ?? 0;
      if (balance < IDENTITY_EXTRACTION_CREDITS) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Insufficient credits for identity extraction. Need ${IDENTITY_EXTRACTION_CREDITS}, have ${balance}.`,
            required: IDENTITY_EXTRACTION_CREDITS,
            available: balance,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deduct credits
      const { error: deductError } = await supabase.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: IDENTITY_EXTRACTION_CREDITS,
        p_description: "Scene Identity Extraction — Character & Environment DNA Analysis",
        p_project_id: projectId || null,
      });

      if (deductError) {
        console.error("[extract-scene-identity] Credit deduction failed:", deductError);
        throw new Error("Failed to charge credits for identity extraction");
      }

      creditsCharged = IDENTITY_EXTRACTION_CREDITS;
      console.log(`[extract-scene-identity] ✓ Charged ${IDENTITY_EXTRACTION_CREDITS} credits`);
    }

    // === DEEP IDENTITY EXTRACTION — PASS 1: CHARACTER DNA ===
    console.log(`[extract-scene-identity] Pass 1: Extracting Character DNA...`);

    const characterSystemPrompt = `You are a world-class cinematographer, casting director, and character bible writer for premium video production.

Your task: Perform EXHAUSTIVE character identity extraction from this reference image.
This data will be used to maintain PERFECT visual consistency across all video clips in a production.
Every detail matters — be precise, specific, and production-ready.

You MUST return valid JSON exactly matching this schema:
{
  "description": "Comprehensive 2-3 sentence character description for AI generation prompts",
  "facialFeatures": {
    "faceShape": "exact face shape (oval, round, square, heart, diamond, etc.)",
    "eyes": "eye shape, color, size, expression, lashes, brows (be very specific)",
    "nose": "nose shape, width, bridge height",
    "mouth": "lip shape, fullness, expression, color",
    "jawline": "jaw definition and shape",
    "cheekbones": "cheekbone prominence and definition",
    "skinTone": "exact skin tone (e.g. warm honey beige, deep mahogany, fair porcelain)",
    "skinTexture": "skin quality (smooth, natural, textured, glowing)",
    "complexion": "overall complexion notes (clear, freckled, moles, etc.)"
  },
  "hairProfile": {
    "color": "exact hair color with highlights/lowlights (e.g. dark chestnut brown with subtle caramel highlights)",
    "texture": "straight, wavy, curly, coily, kinky",
    "length": "precise length (cropped, ear-length, shoulder-length, mid-back, waist-length)",
    "style": "specific style description (e.g. loose waves with side part, neat corporate bun)",
    "fromBehind": "how hair looks from behind for rear-view shots"
  },
  "bodyProfile": {
    "build": "body build (slender, athletic, average, stocky, muscular)",
    "height": "estimated height if determinable from image",
    "posture": "posture description (upright, relaxed, confident, hunched)",
    "gait": "movement quality if determinable (graceful, purposeful, casual)",
    "silhouette": "overall body silhouette for non-face frames"
  },
  "clothingSignature": {
    "topwear": "exact description of top/shirt/jacket/etc.",
    "bottomwear": "pants/skirt/dress description",
    "footwear": "shoes/boots description if visible",
    "accessories": ["list every visible accessory in detail"],
    "colors": ["list all clothing colors with specificity"],
    "style": "overall clothing style (casual, formal, streetwear, professional, etc.)",
    "textures": "fabric textures (cotton, denim, leather, silk, etc.)"
  },
  "distinctiveMarkers": ["tattoos", "scars", "birthmarks", "piercings", "glasses", "prominent jewelry"],
  "faceLockAnchors": [
    "3-5 concise phrases like: 'warm honey beige skin, oval face'",
    "'deep-set almond eyes, dark brows'",
    "'dark chestnut hair, shoulder-length waves'"
  ],
  "nonFacialAnchors": [
    "3-4 phrases for when face isn't visible",
    "'athletic build, white fitted t-shirt'",
    "'dark denim jeans, white sneakers'"
  ],
  "morphingNegatives": [
    "phrases to prevent drift: 'different skin tone'",
    "'different hair color or style'",
    "'different clothing or accessories'"
  ],
  "identitySummary": "One compact sentence for prompt injection, 30 words max"
}`;

    const characterResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: characterSystemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this reference image and extract exhaustive character identity data. Be extremely precise and detailed — this will be used to maintain perfect visual consistency across all video clips.",
              },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.1, // Very low temp for precision
        response_format: { type: "json_object" },
      }),
    });

    if (!characterResponse.ok) {
      const err = await characterResponse.text();
      throw new Error(`Character DNA extraction failed: ${err}`);
    }

    const characterData = await characterResponse.json();
    const characterDNA: CharacterDNA = JSON.parse(
      characterData.choices[0].message.content
    );
    console.log(`[extract-scene-identity] ✓ Character DNA extracted: ${characterDNA.identitySummary?.substring(0, 60)}`);

    // === DEEP IDENTITY EXTRACTION — PASS 2: ENVIRONMENT + LIGHTING + COLOR + CINEMATIC ===
    console.log(`[extract-scene-identity] Pass 2: Extracting Environment, Lighting, Color & Cinematic DNA...`);

    const environmentSystemPrompt = `You are a master cinematographer, production designer, and colorist analyzing a reference image for AI video production.

Your task: Extract EXHAUSTIVE environment, lighting, color science, and cinematic style data.
This data will lock the visual atmosphere across all video clips in a multi-clip production.
Be extremely precise — include spatial coordinates, Kelvin estimates, hex codes, and film production terminology.

Return valid JSON exactly matching this schema:
{
  "environmentDNA": {
    "setting": "Comprehensive setting description (2-3 sentences)",
    "sceneType": "indoor|outdoor|studio|natural|urban|interior",
    "geometry": {
      "depth": "spatial depth description (shallow, deep, layered)",
      "perspective": "camera perspective relative to scene (eye-level, elevated, ground-level)",
      "planes": "foreground: [elements], midground: [elements], background: [elements]",
      "spatialRelationships": "how elements relate to each other in 3D space"
    },
    "keyProps": [
      { "object": "object name", "position": "position in frame", "significance": "visual role" }
    ],
    "backgroundElements": ["list all visible background elements"],
    "surfaces": {
      "floor": "floor type and material",
      "walls": "wall type, texture, color",
      "ceiling": "ceiling type if visible",
      "materials": ["all visible materials in scene"]
    },
    "conditions": {
      "weather": "weather conditions if applicable",
      "timeOfDay": "dawn|morning|midday|afternoon|golden hour|dusk|night|artificial",
      "season": "season if determinable",
      "atmosphere": "atmospheric quality (clear, hazy, foggy, particle-filled)"
    },
    "environmentLock": "Single compact environment description for prompt injection (25 words max)",
    "sceneAnchors": ["3-4 specific visual anchors to maintain across clips"]
  },
  "lightingProfile": {
    "style": "Professional lighting style name (e.g. 'dramatic Rembrandt', 'soft butterfly', 'hard film noir')",
    "primarySource": {
      "type": "sun|window|LED|tungsten|HMI|practical|neon|mixed",
      "direction": "compass + vertical (e.g. 'top-left', 'right side', 'front-top')",
      "angle": "approximate degrees from subject (e.g. '45 degrees top-left')",
      "intensity": "intense|bright|moderate|dim|low-key",
      "color": "light color temperature description"
    },
    "fillLight": {
      "direction": "fill light direction",
      "intensity": "bright|moderate|dim|absent",
      "color": "fill light color"
    },
    "rimLight": {
      "present": true,
      "direction": "rim light direction",
      "color": "rim light color"
    },
    "shadows": {
      "direction": "shadow fall direction",
      "hardness": "hard|medium|soft|diffused",
      "length": "long|medium|short|no shadows"
    },
    "timeOfDay": "time of day descriptor",
    "colorTemperature": "estimated Kelvin range and descriptor (e.g. '3200K warm tungsten')",
    "mood": "emotional/atmospheric mood the lighting creates",
    "lightingAnchor": "Compact lighting description for prompt injection (20 words max)"
  },
  "colorScience": {
    "dominant": [
      { "name": "color name", "hex": "#XXXXXX", "proportion": "percentage of frame" }
    ],
    "accent": [
      { "name": "accent color name", "hex": "#XXXXXX" }
    ],
    "neutrals": [
      { "name": "neutral tone name", "hex": "#XXXXXX" }
    ],
    "colorRelationships": "complementary|analogous|triadic|monochromatic|split-complementary",
    "mood": "emotional mood the colors create",
    "temperature": "warm|neutral|cool",
    "saturation": "high|medium|low|desaturated",
    "contrast": "high|medium|low",
    "gradingStyle": "film grading style (e.g. 'teal-orange', 'bleach bypass', 'natural warm', 'cold steel')",
    "colorAnchor": "Compact color description for prompt injection (15 words max)"
  },
  "cinematicStyle": {
    "lensCharacter": "lens type feel (wide-angle dramatic, normal natural, telephoto compressed)",
    "depthOfField": "shallow bokeh|deep focus|selective focus|rack focus",
    "filmGrain": "none|subtle|moderate|heavy",
    "frameComposition": "rule of thirds|centered|dynamic diagonal|golden ratio",
    "cameraAngle": "eye-level|low angle|high angle|dutch tilt|bird's eye",
    "motionCharacter": "static|subtle handheld|smooth tracking|dynamic",
    "productionValue": "production quality descriptor (e.g. 'premium advertising', 'indie documentary', 'Hollywood blockbuster')",
    "cinematicAnchor": "Compact cinematic style for prompt injection (15 words max)"
  }
}`;

    const environmentResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: environmentSystemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this reference image and extract exhaustive environment, lighting, color science, and cinematic style data. Be extremely precise — this locks the visual atmosphere for the entire video production.",
              },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 3500,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!environmentResponse.ok) {
      const err = await environmentResponse.text();
      throw new Error(`Environment DNA extraction failed: ${err}`);
    }

    const environmentData = await environmentResponse.json();
    const envParsed = JSON.parse(environmentData.choices[0].message.content);
    const environmentDNA: EnvironmentDNA = envParsed.environmentDNA;
    const lightingProfile: LightingProfile = envParsed.lightingProfile;
    const colorScience: ColorScience = envParsed.colorScience;
    const cinematicStyle: CinematicStyle = envParsed.cinematicStyle;

    console.log(`[extract-scene-identity] ✓ Environment DNA: ${environmentDNA.setting?.substring(0, 60)}`);
    console.log(`[extract-scene-identity] ✓ Lighting: ${lightingProfile.style}`);
    console.log(`[extract-scene-identity] ✓ Color: ${colorScience.gradingStyle}`);

    // === BUILD MASTER CONSISTENCY PROMPT ===
    const masterConsistencyPrompt = [
      characterDNA.identitySummary,
      environmentDNA.environmentLock,
      lightingProfile.lightingAnchor,
      colorScience.colorAnchor,
      cinematicStyle.cinematicAnchor,
    ].filter(Boolean).join(". ");

    // === BUILD ALL NEGATIVES ===
    const allNegatives = [
      ...characterDNA.morphingNegatives,
      "face morphing", "character transformation", "different person",
      "clothing change", "hair change", "skin tone change",
      "different environment", "different location",
      "inconsistent lighting", "dramatic lighting change",
    ];

    // === CLIP-LEVEL ANCHORS (short, injectable into every clip prompt) ===
    const clipAnchors = {
      character: `[IDENTITY LOCK: ${characterDNA.identitySummary}. Face: ${characterDNA.faceLockAnchors?.slice(0, 2).join(", ")}.]`,
      environment: `[SCENE LOCK: ${environmentDNA.environmentLock}]`,
      lighting: `[LIGHTING LOCK: ${lightingProfile.lightingAnchor}]`,
      color: `[COLOR LOCK: ${colorScience.colorAnchor}]`,
      cinematic: `[CINEMATIC: ${cinematicStyle.cinematicAnchor}]`,
    };

    // === PERSIST TO DB ===
    if (projectId) {
      try {
        const sceneIdentityPayload = {
          sceneIdentity: {
            characterDNA,
            environmentDNA,
            lightingProfile,
            colorScience,
            cinematicStyle,
            masterConsistencyPrompt,
            allNegatives,
            clipAnchors,
            extractedAt: new Date().toISOString(),
            creditsCharged,
          },
        };

        await supabase
          .from("movie_projects")
          .update({
            pro_features_data: sceneIdentityPayload,
          })
          .eq("id", projectId);

        console.log(`[extract-scene-identity] ✓ Scene identity persisted to project ${projectId}`);
      } catch (saveErr) {
        console.warn(`[extract-scene-identity] DB persist failed (non-fatal):`, saveErr);
      }
    }

    const result: SceneIdentityResult = {
      success: true,
      imageUrl,
      characterDNA,
      environmentDNA,
      lightingProfile,
      colorScience,
      cinematicStyle,
      masterConsistencyPrompt,
      allNegatives,
      clipAnchors,
      creditsCharged,
    };

    console.log(`[extract-scene-identity] ✅ Complete. Master consistency: "${masterConsistencyPrompt.substring(0, 100)}..."`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-scene-identity] Fatal error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Identity extraction failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
