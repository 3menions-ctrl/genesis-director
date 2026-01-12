import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Multi-Character Identity Bible Generator
 * 
 * Generates a comprehensive identity bible for 2-5 characters:
 * - Extracts characters from script OR uses provided references
 * - Generates 3-point views (front, side, 3/4) for each character
 * - Creates consistency prompts and negative prompts
 * - Maps character presence per shot
 */

interface CharacterIdentity {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'background';
  sourceImageUrl?: string;
  extractedFromScript: boolean;
  views: {
    front?: { viewType: string; imageUrl: string; generatedAt: number };
    side?: { viewType: string; imageUrl: string; generatedAt: number };
    threeQuarter?: { viewType: string; imageUrl: string; generatedAt: number };
  };
  viewsComplete: boolean;
  appearance: any;
  wardrobe: any;
  consistencyPrompt: string;
  negativePrompt: string;
  relationships: any[];
  confidence: number;
  generatedAt: number;
  lastUpdated: number;
}

interface MultiCharacterBible {
  projectId: string;
  characters: CharacterIdentity[];
  maxCharacters: number;
  shotPresence: any[];
  relationshipGraph: any[];
  globalStyle: any;
  status: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
}

// Extract characters from script using Gemini
async function extractCharactersFromScript(
  script: string,
  accessToken: string,
  projectId: string
): Promise<any[]> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;
  
  const prompt = `Analyze this video script and extract ALL distinct characters (up to 5 main characters).

SCRIPT:
${script}

Return a JSON array with this EXACT structure for each character (no markdown, just JSON):
[
  {
    "name": "Character Name",
    "role": "protagonist" | "antagonist" | "supporting" | "background",
    "appearance": {
      "ageRange": "20s, 30s, etc",
      "gender": "male/female/non-binary",
      "bodyType": "slim/athletic/average/heavy",
      "height": "short/average/tall",
      "faceShape": "oval/round/square/heart",
      "eyeColor": "specific color",
      "eyeShape": "almond/round/hooded",
      "noseType": "straight/aquiline/button",
      "lipShape": "full/thin/medium",
      "skinTone": "specific description",
      "hairColor": "specific color",
      "hairLength": "short/medium/long",
      "hairStyle": "specific style",
      "hairTexture": "straight/wavy/curly/coily",
      "facialHair": "none/stubble/beard/mustache",
      "distinctiveFeatures": ["list of unique features"]
    },
    "wardrobe": {
      "primaryOutfit": "detailed description",
      "colors": ["color1", "color2"],
      "accessories": ["item1", "item2"],
      "style": "casual/formal/streetwear/etc"
    },
    "relationships": [
      {"characterName": "Other Character", "relationship": "friend/enemy/lover/sibling/etc"}
    ],
    "dialogueLines": ["sample lines from script"],
    "shotAppearances": ["shot_1", "shot_3"] // which shots they appear in
  }
]

Extract based on descriptions, dialogue, and context. If appearance details aren't specified, infer reasonable defaults that would work for the story.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Multi-Char Bible] Gemini extraction error:", errorText);
    throw new Error(`Character extraction failed: ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  
  // Extract JSON from response
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  return JSON.parse(jsonStr);
}

// Analyze character from reference image
async function analyzeCharacterImage(
  imageUrl: string,
  characterName: string,
  accessToken: string,
  gcpProjectId: string
): Promise<any> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;
  
  // Fetch image and convert to base64
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const uint8Array = new Uint8Array(imageBuffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64Image = btoa(binary);

  const prompt = `Analyze this character image for "${characterName}" and extract detailed appearance information.

Return a JSON object with this EXACT structure (no markdown, just JSON):
{
  "appearance": {
    "ageRange": "specific age range",
    "gender": "male/female/non-binary",
    "ethnicity": "if determinable",
    "bodyType": "slim/athletic/average/heavy",
    "height": "inferred from proportions",
    "faceShape": "oval/round/square/heart/oblong",
    "eyeColor": "specific color",
    "eyeShape": "almond/round/hooded/monolid",
    "noseType": "straight/aquiline/button/roman",
    "lipShape": "full/thin/medium/bow-shaped",
    "skinTone": "specific description with undertones",
    "hairColor": "specific color with highlights if any",
    "hairLength": "short/medium/long/bald",
    "hairStyle": "detailed style description",
    "hairTexture": "straight/wavy/curly/coily",
    "facialHair": "none/stubble/full beard/goatee/mustache",
    "distinctiveFeatures": ["list all unique features like moles, dimples, etc"],
    "scars": ["if any visible"],
    "tattoos": ["if any visible"],
    "birthmarks": ["if any visible"]
  },
  "wardrobe": {
    "primaryOutfit": "detailed clothing description",
    "colors": ["dominant colors in outfit"],
    "accessories": ["jewelry, glasses, hats, etc"],
    "style": "overall fashion style"
  },
  "consistencyPrompt": "A single detailed paragraph that could regenerate this exact character's appearance for AI image generation",
  "negativePrompt": "Things to avoid that would break this character's consistency (wrong features)"
}

Be extremely specific to ensure the character can be consistently regenerated across multiple frames.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Multi-Char Bible] Image analysis error:", errorText);
    throw new Error(`Image analysis failed: ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  return JSON.parse(jsonStr);
}

// Generate 3-point views for a character
async function generate3PointViews(
  character: any,
  accessToken: string,
  gcpProjectId: string,
  supabase: any
): Promise<{ front?: any; side?: any; threeQuarter?: any }> {
  const views: any = {};
  const viewTypes = ['front', 'side', 'three-quarter'] as const;
  
  const viewPrompts = {
    'front': 'front-facing portrait, looking directly at camera, symmetrical composition, neutral expression',
    'side': 'profile view, side-facing portrait, 90-degree angle from front, full side of face visible',
    'three-quarter': 'three-quarter view portrait, 45-degree angle, showing depth and dimension of face'
  };

  for (const viewType of viewTypes) {
    const prompt = `Professional character reference sheet, ${viewPrompts[viewType]}.

CHARACTER: ${character.name}
${character.consistencyPrompt}

WARDROBE: ${character.wardrobe?.primaryOutfit || 'casual clothing'}

STYLE REQUIREMENTS:
- Studio lighting, neutral gray background
- High detail, sharp focus on face
- Consistent with character reference sheet style
- Photorealistic quality
- Same clothing and accessories across all views`;

    try {
      const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

      console.log(`[Multi-Char Bible] Generating ${viewType} view for ${character.name}...`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
            safetyFilterLevel: "block_some",
            personGeneration: "allow_adult"
          }
        })
      });

      if (!response.ok) {
        console.warn(`[Multi-Char Bible] Failed to generate ${viewType} for ${character.name}`);
        continue;
      }

      const data = await response.json();
      const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;
      
      if (!imageBase64) {
        console.warn(`[Multi-Char Bible] No image generated for ${viewType}`);
        continue;
      }

      // Upload to Supabase storage
      const fileName = `multichar_${character.id}_${viewType}_${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      
      const { error: uploadError } = await supabase.storage
        .from('character-references')
        .upload(fileName, bytes, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`[Multi-Char Bible] Upload error for ${viewType}:`, uploadError);
        continue;
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
      
      const viewKey = viewType === 'three-quarter' ? 'threeQuarter' : viewType;
      views[viewKey] = {
        viewType,
        imageUrl: publicUrl,
        generatedAt: Date.now()
      };
      
      console.log(`[Multi-Char Bible] ${viewType} view uploaded: ${publicUrl}`);
      
    } catch (error) {
      console.error(`[Multi-Char Bible] Error generating ${viewType} view:`, error);
    }
  }
  
  return views;
}

// Build per-shot character presence from script
async function buildShotPresence(
  characters: CharacterIdentity[],
  script: string,
  accessToken: string,
  gcpProjectId: string
): Promise<any[]> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;
  
  const characterNames = characters.map(c => c.name).join(', ');
  
  const prompt = `Given this script and these characters (${characterNames}), map which characters appear in each shot.

SCRIPT:
${script}

CHARACTERS:
${characters.map(c => `- ${c.name} (${c.role}): ${c.consistencyPrompt?.substring(0, 100) || 'no description'}`).join('\n')}

Return a JSON array mapping character presence per shot (no markdown, just JSON):
[
  {
    "shotId": "shot_1",
    "characters": [
      {
        "characterId": "char_id",
        "characterName": "Character Name",
        "isVisible": true,
        "screenPosition": "left" | "center" | "right" | "background",
        "screenSize": "full-body" | "medium" | "close-up" | "extreme-close-up",
        "facingDirection": "camera" | "left" | "right" | "away",
        "isSpeaking": true/false,
        "interactingWith": ["other_char_id"],
        "action": "what they're doing",
        "emotion": "their emotional state"
      }
    ]
  }
]

Analyze every shot in the script and determine character visibility, positioning, and actions.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    console.warn("[Multi-Char Bible] Shot presence mapping failed");
    return [];
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      projectId,
      script,
      characterReferences,
      characterDescriptions,
      artStyle,
      generate3PointViews: shouldGenerate3Point = true
    } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    console.log(`[Multi-Char Bible] Starting for project ${projectId}`);

    // Get service account credentials
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const gcpProjectId = serviceAccount.project_id;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get access token
    console.log("[Multi-Char Bible] Getting OAuth2 access token...");
    const accessToken = await getAccessToken(serviceAccount);

    // Initialize bible
    const bible: MultiCharacterBible = {
      projectId,
      characters: [],
      maxCharacters: 5,
      shotPresence: [],
      relationshipGraph: [],
      globalStyle: {
        artStyle: artStyle || 'photorealistic cinematic',
        lightingConsistency: 'natural with dramatic accents',
        colorPalette: []
      },
      status: 'extracting',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Step 1: Extract or process characters
    let rawCharacters: any[] = [];

    if (characterReferences && characterReferences.length > 0) {
      // Process provided reference images
      console.log(`[Multi-Char Bible] Processing ${characterReferences.length} character references...`);
      
      for (const ref of characterReferences.slice(0, 5)) {
        const analysis = await analyzeCharacterImage(ref.imageUrl, ref.name, accessToken, gcpProjectId);
        rawCharacters.push({
          name: ref.name,
          role: ref.role,
          sourceImageUrl: ref.imageUrl,
          ...analysis
        });
      }
    } else if (characterDescriptions && characterDescriptions.length > 0) {
      // Use provided descriptions
      console.log(`[Multi-Char Bible] Using ${characterDescriptions.length} character descriptions...`);
      rawCharacters = characterDescriptions.slice(0, 5).map((desc: any) => ({
        name: desc.name,
        role: desc.role,
        consistencyPrompt: desc.description,
        appearance: {},
        wardrobe: {}
      }));
    } else if (script) {
      // Extract from script
      console.log("[Multi-Char Bible] Extracting characters from script...");
      rawCharacters = await extractCharactersFromScript(script, accessToken, gcpProjectId);
      rawCharacters = rawCharacters.slice(0, 5);
    } else {
      throw new Error("Must provide script, characterReferences, or characterDescriptions");
    }

    bible.progress = 30;
    bible.status = 'generating-views';
    console.log(`[Multi-Char Bible] Extracted ${rawCharacters.length} characters`);

    // Step 2: Build character identities with 3-point views
    for (let i = 0; i < rawCharacters.length; i++) {
      const raw = rawCharacters[i];
      const charId = `char_${Date.now()}_${i}`;
      
      const character: CharacterIdentity = {
        id: charId,
        name: raw.name,
        role: raw.role || 'supporting',
        sourceImageUrl: raw.sourceImageUrl,
        extractedFromScript: !raw.sourceImageUrl,
        views: {},
        viewsComplete: false,
        appearance: raw.appearance || {},
        wardrobe: raw.wardrobe || {},
        consistencyPrompt: raw.consistencyPrompt || buildConsistencyPrompt(raw),
        negativePrompt: raw.negativePrompt || buildNegativePrompt(raw),
        relationships: raw.relationships || [],
        confidence: raw.sourceImageUrl ? 90 : 70,
        generatedAt: Date.now(),
        lastUpdated: Date.now()
      };

      // Generate 3-point views if enabled
      if (shouldGenerate3Point) {
        console.log(`[Multi-Char Bible] Generating 3-point views for ${character.name}...`);
        character.views = await generate3PointViews(character, accessToken, gcpProjectId, supabase);
        character.viewsComplete = !!(character.views.front && character.views.side && character.views.threeQuarter);
      }

      bible.characters.push(character);
      bible.progress = 30 + Math.round((i + 1) / rawCharacters.length * 50);
    }

    // Step 3: Build shot presence mapping
    if (script) {
      console.log("[Multi-Char Bible] Building per-shot character presence...");
      bible.shotPresence = await buildShotPresence(bible.characters, script, accessToken, gcpProjectId);
    }

    // Step 4: Build relationship graph
    bible.relationshipGraph = buildRelationshipGraph(bible.characters);

    bible.status = 'complete';
    bible.progress = 100;
    bible.updatedAt = Date.now();

    const processingTimeMs = Date.now() - startTime;
    
    console.log(`[Multi-Char Bible] Complete in ${processingTimeMs}ms`);
    console.log(`[Multi-Char Bible] ${bible.characters.length} characters, ${bible.shotPresence.length} shot mappings`);

    return new Response(
      JSON.stringify({
        success: true,
        bible,
        processingTimeMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Multi-Char Bible] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to build consistency prompt from raw character data
function buildConsistencyPrompt(raw: any): string {
  const parts: string[] = [];
  
  if (raw.name) parts.push(raw.name);
  
  const app = raw.appearance || {};
  if (app.ageRange) parts.push(`${app.ageRange}`);
  if (app.gender) parts.push(app.gender);
  if (app.bodyType) parts.push(`${app.bodyType} build`);
  if (app.skinTone) parts.push(`${app.skinTone} skin`);
  if (app.hairColor && app.hairStyle) parts.push(`${app.hairColor} ${app.hairStyle} hair`);
  if (app.eyeColor) parts.push(`${app.eyeColor} eyes`);
  if (app.faceShape) parts.push(`${app.faceShape} face`);
  if (app.distinctiveFeatures?.length) parts.push(app.distinctiveFeatures.join(', '));
  
  const ward = raw.wardrobe || {};
  if (ward.primaryOutfit) parts.push(`wearing ${ward.primaryOutfit}`);
  if (ward.accessories?.length) parts.push(`with ${ward.accessories.join(', ')}`);
  
  return parts.join(', ') + '.';
}

// Helper to build negative prompt
function buildNegativePrompt(raw: any): string {
  const negatives: string[] = [];
  
  const app = raw.appearance || {};
  
  // Add opposites of distinctive features
  if (app.hairColor) {
    const wrongColors = ['blonde', 'brown', 'black', 'red', 'gray', 'white']
      .filter(c => !app.hairColor.toLowerCase().includes(c));
    negatives.push(`${wrongColors[0]} hair`);
  }
  
  if (app.eyeColor) {
    const wrongColors = ['blue', 'brown', 'green', 'hazel', 'gray']
      .filter(c => !app.eyeColor.toLowerCase().includes(c));
    negatives.push(`${wrongColors[0]} eyes`);
  }
  
  negatives.push(
    'wrong facial features',
    'inconsistent appearance',
    'morphing features',
    'multiple heads',
    'distorted face'
  );
  
  return negatives.join(', ');
}

// Build relationship graph from character relationships
function buildRelationshipGraph(characters: CharacterIdentity[]): any[] {
  const graph: any[] = [];
  
  for (const char of characters) {
    for (const rel of char.relationships || []) {
      const targetChar = characters.find(c => 
        c.name.toLowerCase() === rel.characterName?.toLowerCase() ||
        c.name.toLowerCase().includes(rel.characterName?.toLowerCase() || '')
      );
      
      if (targetChar) {
        // Avoid duplicates
        const exists = graph.some(g => 
          (g.characterId1 === char.id && g.characterId2 === targetChar.id) ||
          (g.characterId1 === targetChar.id && g.characterId2 === char.id)
        );
        
        if (!exists) {
          graph.push({
            characterId1: char.id,
            characterId2: targetChar.id,
            relationship: rel.relationship,
            interactionStyle: inferInteractionStyle(rel.relationship)
          });
        }
      }
    }
  }
  
  return graph;
}

// Infer interaction style from relationship type
function inferInteractionStyle(relationship: string): string {
  const rel = relationship?.toLowerCase() || '';
  
  if (['enemy', 'rival', 'antagonist'].some(r => rel.includes(r))) {
    return 'hostile';
  }
  if (['friend', 'ally', 'partner'].some(r => rel.includes(r))) {
    return 'friendly';
  }
  if (['lover', 'spouse', 'romantic'].some(r => rel.includes(r))) {
    return 'intimate';
  }
  if (['sibling', 'parent', 'child', 'family'].some(r => rel.includes(r))) {
    return 'familial';
  }
  if (['boss', 'employee', 'colleague'].some(r => rel.includes(r))) {
    return 'professional';
  }
  
  return 'neutral';
}
