import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GENERATE CHARACTER FOR SCENE - Dynamic Avatar Creation for Multi-Character Scenes
 * 
 * When the Scene Character Analyzer determines a new avatar is needed (no suitable match
 * in the library), this function generates a world-class character on-demand.
 * 
 * Features:
 * - AI-powered character design based on scene requirements
 * - High-quality FLUX image generation via Lovable API
 * - Automatic voice assignment based on character traits
 * - Character bible creation for visual consistency
 * - Immediate storage in avatar_templates for reuse
 */

interface CharacterGenerationRequest {
  sceneContext: {
    setting: string;
    mood: string;
    primaryAction: string;
  };
  characterSpec: {
    name: string;
    gender: string;
    ageRange: string;
    style: string;
    personality: string;
    appearance: string;
  };
  role: string;
  dialogueRole: 'speaking' | 'silent' | 'reacting';
  projectId?: string;
  saveToLibrary?: boolean; // Whether to save as reusable avatar
}

// Voice mapping based on character traits
const VOICE_PERSONALITY_MAP: Record<string, Record<string, string>> = {
  male: {
    authoritative: 'onyx',
    warm: 'fable',
    energetic: 'echo',
    professional: 'adam',
    deep: 'george',
    youthful: 'marcus',
    default: 'echo',
  },
  female: {
    confident: 'nova',
    warm: 'bella',
    energetic: 'jessica',
    professional: 'rachel',
    elegant: 'shimmer',
    youthful: 'mia',
    default: 'bella',
  },
  neutral: {
    default: 'alloy',
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: CharacterGenerationRequest = await req.json();
    const { sceneContext, characterSpec, role, dialogueRole, projectId, saveToLibrary = true } = request;

    console.log("[GenerateCharacter] ═══════════════════════════════════════════════════════");
    console.log(`[GenerateCharacter] Creating character: ${characterSpec.name}`);
    console.log(`[GenerateCharacter] Role: ${role}, Gender: ${characterSpec.gender}`);
    console.log(`[GenerateCharacter] Scene: ${sceneContext.setting}`);
    console.log("[GenerateCharacter] ═══════════════════════════════════════════════════════");

    // Step 1: Generate detailed character prompt using AI
    const characterPrompt = await generateCharacterPrompt(
      characterSpec,
      sceneContext,
      LOVABLE_API_KEY
    );
    
    console.log(`[GenerateCharacter] Generated prompt: "${characterPrompt.substring(0, 150)}..."`);

    // Step 2: Generate the character image using FLUX via Lovable API
    const imageUrl = await generateCharacterImage(characterPrompt, LOVABLE_API_KEY);
    
    if (!imageUrl) {
      throw new Error("Failed to generate character image");
    }
    
    console.log(`[GenerateCharacter] ✓ Image generated: ${imageUrl.substring(0, 60)}...`);

    // Step 3: Upload to permanent storage
    let permanentImageUrl = imageUrl;
    try {
      // Download the generated image
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob();
        const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
        
        const fileName = `generated-${characterSpec.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.png`;
        const storagePath = `avatars/generated/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(storagePath, imageBytes, {
            contentType: 'image/png',
            upsert: true,
          });
        
        if (!uploadError) {
          permanentImageUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${storagePath}`;
          console.log(`[GenerateCharacter] ✓ Saved to permanent storage`);
        }
      }
    } catch (storageError) {
      console.warn("[GenerateCharacter] Storage upload failed (using original URL):", storageError);
    }

    // Step 4: Determine voice based on character traits
    const voiceId = selectVoiceForCharacter(characterSpec);
    console.log(`[GenerateCharacter] ✓ Voice assigned: ${voiceId}`);

    // Step 5: Build character bible
    const characterBible = {
      front_view: characterPrompt,
      clothing_description: extractClothing(characterSpec.appearance),
      body_type: extractBodyType(characterSpec.appearance),
      distinguishing_features: extractDistinguishingFeatures(characterSpec.personality),
      negative_prompts: getStyleNegatives(characterSpec.style),
    };

    // Step 6: Save to avatar_templates if requested
    let avatarTemplateId: string | null = null;
    
    if (saveToLibrary) {
      const { data: insertedAvatar, error: insertError } = await supabase
        .from('avatar_templates')
        .insert({
          name: characterSpec.name,
          description: `${characterSpec.personality}. Generated for scene: ${sceneContext.setting}`,
          personality: characterSpec.personality,
          gender: characterSpec.gender,
          age_range: characterSpec.ageRange,
          style: characterSpec.style,
          avatar_type: 'realistic',
          face_image_url: permanentImageUrl,
          thumbnail_url: permanentImageUrl,
          front_image_url: permanentImageUrl,
          character_bible: characterBible,
          voice_id: voiceId,
          voice_provider: 'openai',
          voice_name: voiceId.charAt(0).toUpperCase() + voiceId.slice(1),
          is_active: true,
          is_premium: false,
          tags: [role, characterSpec.style, characterSpec.ageRange, 'generated'],
        })
        .select('id')
        .single();

      if (insertError) {
        console.warn("[GenerateCharacter] Failed to save to library:", insertError);
      } else {
        avatarTemplateId = insertedAvatar?.id;
        console.log(`[GenerateCharacter] ✓ Saved to avatar library: ${avatarTemplateId}`);
      }
    }

    console.log("[GenerateCharacter] ═══════════════════════════════════════════════════════");
    console.log(`[GenerateCharacter] CHARACTER CREATED SUCCESSFULLY`);
    console.log(`[GenerateCharacter]   Name: ${characterSpec.name}`);
    console.log(`[GenerateCharacter]   Voice: ${voiceId}`);
    console.log(`[GenerateCharacter]   Library ID: ${avatarTemplateId || 'not saved'}`);
    console.log("[GenerateCharacter] ═══════════════════════════════════════════════════════");

    return new Response(
      JSON.stringify({
        success: true,
        character: {
          id: avatarTemplateId || `temp_${Date.now()}`,
          name: characterSpec.name,
          imageUrl: permanentImageUrl,
          voiceId,
          voiceProvider: 'openai',
          characterBible,
          role,
          gender: characterSpec.gender,
          ageRange: characterSpec.ageRange,
          style: characterSpec.style,
          savedToLibrary: !!avatarTemplateId,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GenerateCharacter] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Character generation failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Use AI to generate a world-class character image prompt
 */
async function generateCharacterPrompt(
  characterSpec: CharacterGenerationRequest['characterSpec'],
  sceneContext: CharacterGenerationRequest['sceneContext'],
  apiKey: string
): Promise<string> {
  
  const promptRequest = `Create a WORLD-CLASS image generation prompt for this character:

CHARACTER:
- Name: ${characterSpec.name}
- Gender: ${characterSpec.gender}
- Age Range: ${characterSpec.ageRange}
- Style: ${characterSpec.style}
- Personality: ${characterSpec.personality}
- Appearance notes: ${characterSpec.appearance}

SCENE CONTEXT:
- Setting: ${sceneContext.setting}
- Mood: ${sceneContext.mood}
- Action: ${sceneContext.primaryAction}

Create a detailed, cinematic image generation prompt that will produce a photorealistic, full-body character portrait. The prompt should:
1. Describe the person from head to toe
2. Specify professional studio lighting
3. Include clothing appropriate to the style and scene
4. Capture their personality in their expression and pose
5. Use technical photography terms for quality (8K, Canon EOS R5, etc.)
6. Be optimized for FLUX image generation

Output ONLY the prompt, nothing else. Maximum 200 words.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: promptRequest }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    // Fallback to template-based prompt
    return buildFallbackPrompt(characterSpec, sceneContext);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || buildFallbackPrompt(characterSpec, sceneContext);
}

/**
 * Fallback prompt builder if AI fails
 */
function buildFallbackPrompt(
  characterSpec: CharacterGenerationRequest['characterSpec'],
  sceneContext: CharacterGenerationRequest['sceneContext']
): string {
  const genderText = characterSpec.gender === 'male' ? 'man' : characterSpec.gender === 'female' ? 'woman' : 'person';
  const ageText = characterSpec.ageRange || 'adult';
  
  return `Ultra-realistic professional photograph of ${characterSpec.name}, a ${ageText} ${genderText}. ${characterSpec.personality}. Full body from head to toe, facing camera with confident expression. ${characterSpec.style} style clothing appropriate for ${sceneContext.setting}. Professional studio lighting, Canon EOS R5, 85mm lens, 8K resolution, clean neutral background. Indistinguishable from real photograph. Ultra high resolution.`;
}

/**
 * Generate image using Lovable API (FLUX)
 */
async function generateCharacterImage(prompt: string, apiKey: string): Promise<string | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    console.error(`[GenerateCharacter] Image generation failed: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

/**
 * Select appropriate voice based on character personality
 */
function selectVoiceForCharacter(characterSpec: CharacterGenerationRequest['characterSpec']): string {
  const gender = characterSpec.gender?.toLowerCase() || 'neutral';
  const personality = characterSpec.personality?.toLowerCase() || '';
  
  const voiceMap = VOICE_PERSONALITY_MAP[gender] || VOICE_PERSONALITY_MAP.neutral;
  
  // Check for personality keywords
  for (const [trait, voice] of Object.entries(voiceMap)) {
    if (trait !== 'default' && personality.includes(trait)) {
      return voice;
    }
  }
  
  // Check for age-based selection
  const ageRange = characterSpec.ageRange?.toLowerCase() || '';
  if (ageRange.includes('young') || ageRange.includes('teen')) {
    return voiceMap.youthful || voiceMap.default;
  }
  if (ageRange.includes('senior') || ageRange.includes('elder')) {
    return voiceMap.authoritative || voiceMap.deep || voiceMap.default;
  }
  
  return voiceMap.default;
}

/**
 * Extract clothing description from appearance text
 */
function extractClothing(appearance: string): string {
  const clothingKeywords = ['wearing', 'dressed in', 'outfit', 'suit', 'dress', 'shirt', 'jacket', 'pants', 'clothes'];
  
  for (const keyword of clothingKeywords) {
    const index = appearance.toLowerCase().indexOf(keyword);
    if (index !== -1) {
      // Extract phrase after keyword
      const start = index + keyword.length;
      const end = appearance.indexOf('.', start);
      return appearance.substring(start, end > start ? end : undefined).trim();
    }
  }
  
  return 'professional attire appropriate to the scene';
}

/**
 * Extract body type from appearance text
 */
function extractBodyType(appearance: string): string {
  const bodyKeywords = ['tall', 'short', 'athletic', 'slim', 'muscular', 'average build', 'petite'];
  
  for (const keyword of bodyKeywords) {
    if (appearance.toLowerCase().includes(keyword)) {
      return keyword;
    }
  }
  
  return 'average build';
}

/**
 * Extract distinguishing features from personality
 */
function extractDistinguishingFeatures(personality: string): string[] {
  const features: string[] = [];
  
  const traitKeywords = [
    'confident', 'friendly', 'professional', 'warm', 'energetic', 
    'calm', 'authoritative', 'approachable', 'elegant', 'casual'
  ];
  
  for (const trait of traitKeywords) {
    if (personality.toLowerCase().includes(trait)) {
      features.push(`${trait} demeanor`);
    }
  }
  
  return features.length > 0 ? features : ['natural presence'];
}

/**
 * Get negative prompts based on style
 */
function getStyleNegatives(style: string): string[] {
  const baseNegatives = ['cartoon', 'anime', 'illustration', 'drawing', 'painting', 'sketch'];
  
  if (style === 'corporate' || style === 'professional') {
    return [...baseNegatives, 'casual', 'sloppy', 'disheveled'];
  }
  if (style === 'casual') {
    return [...baseNegatives, 'formal', 'stiff'];
  }
  if (style === 'luxury') {
    return [...baseNegatives, 'cheap', 'plain', 'basic'];
  }
  
  return baseNegatives;
}
