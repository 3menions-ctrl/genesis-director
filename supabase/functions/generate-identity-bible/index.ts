import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SIMPLIFIED Identity Bible Generator (v3.0)
 * 
 * Removed multi-view image generation - relies on:
 * 1. Original uploaded reference image (source of truth)
 * 2. Detailed character description prompts
 * 3. Non-facial anchors for consistency
 * 
 * This is more reliable than AI-generated multi-views which often drift.
 */

interface NonFacialAnchors {
  bodyType: string;
  bodyProportions: string;
  posture: string;
  gait: string;
  height: string;
  clothingDescription: string;
  clothingColors: string[];
  clothingPatterns: string[];
  clothingTextures: string[];
  clothingDistinctive: string;
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  hairFromBehind: string;
  hairSilhouette: string;
  accessories: string[];
  accessoryPositions: string;
  backViewMarkers: string;
  overallSilhouette: string;
}

interface IdentityBibleResult {
  success: boolean;
  version: '3.0';
  originalImageUrl: string;
  
  // Character description (the core identity)
  characterDescription: string;
  
  // Non-facial anchors (CRITICAL for occlusion handling)
  nonFacialAnchors: NonFacialAnchors;
  
  // Consistency anchors (key features list)
  consistencyAnchors: string[];
  
  // Enhanced prompts
  enhancedConsistencyPrompt: string;
  antiMorphingPrompts: string[];
  occlusionNegatives: string[];
  
  // Processing info
  analysisTimeMs: number;
}

// Analyze image to extract ENHANCED character description with non-facial anchors
async function analyzeCharacterEnhanced(imageUrl: string): Promise<{
  description: string;
  nonFacialAnchors: NonFacialAnchors;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.2',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          },
          {
            type: 'text',
            text: `Analyze this character for AI video generation consistency. I need BOTH facial and NON-FACIAL details.

Return ONLY valid JSON with this exact structure:
{
  "description": "Complete paragraph describing the character for regeneration prompts - include face shape, skin tone, hair, eyes, expression, clothing, pose, and any distinctive features",
  "nonFacialAnchors": {
    "bodyType": "athletic build / slim / stocky / etc",
    "bodyProportions": "tall with broad shoulders / petite frame / etc",
    "posture": "confident upright stance / relaxed posture / etc",
    "gait": "purposeful stride / casual walk / etc (infer from posture)",
    "height": "approximately tall/average/short",
    "clothingDescription": "Complete outfit description with all items",
    "clothingColors": ["primary color", "secondary color", "accent"],
    "clothingPatterns": ["solid", "striped", "plaid", etc],
    "clothingTextures": ["denim", "leather", "cotton", etc],
    "clothingDistinctive": "Most unique/memorable clothing element",
    "hairColor": "exact hair color",
    "hairLength": "short/medium/long/etc",
    "hairStyle": "style description",
    "hairFromBehind": "How hair would look from behind",
    "hairSilhouette": "Hair outline/shape for silhouette matching",
    "accessories": ["list of visible accessories"],
    "accessoryPositions": "where each accessory is positioned",
    "backViewMarkers": "Any markers visible from behind (tattoos, bags, etc)",
    "overallSilhouette": "Body outline description for silhouette matching"
  }
}

Be extremely specific - these anchors will be used to maintain identity when face is NOT visible.`
          }
        ]
      }],
    }),
  });

  if (!response.ok) {
    console.error("Gemini analysis error:", await response.text());
    throw new Error("Failed to analyze character");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON in response:", content);
    throw new Error("Failed to parse character analysis");
  }
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      description: parsed.description || content,
      nonFacialAnchors: parsed.nonFacialAnchors || getDefaultNonFacialAnchors(),
    };
  } catch (e) {
    console.warn("JSON parse failed, using text as description");
    return {
      description: content,
      nonFacialAnchors: getDefaultNonFacialAnchors(),
    };
  }
}

function getDefaultNonFacialAnchors(): NonFacialAnchors {
  return {
    bodyType: 'average build',
    bodyProportions: 'standard proportions',
    posture: 'natural standing posture',
    gait: 'normal walking pace',
    height: 'average height',
    clothingDescription: 'casual clothing',
    clothingColors: ['neutral'],
    clothingPatterns: ['solid'],
    clothingTextures: ['cotton'],
    clothingDistinctive: '',
    hairColor: '',
    hairLength: 'medium',
    hairStyle: '',
    hairFromBehind: '',
    hairSilhouette: '',
    accessories: [],
    accessoryPositions: '',
    backViewMarkers: '',
    overallSilhouette: '',
  };
}

// Build enhanced consistency prompt from description and anchors
function buildEnhancedConsistencyPrompt(
  description: string,
  nonFacialAnchors: NonFacialAnchors
): string {
  const parts: string[] = [];
  
  parts.push(description);
  parts.push(`\nNON-FACIAL IDENTITY ANCHORS:`);
  parts.push(`Body: ${nonFacialAnchors.bodyType}, ${nonFacialAnchors.bodyProportions}`);
  parts.push(`Clothing: ${nonFacialAnchors.clothingDescription}`);
  parts.push(`Clothing Colors: ${nonFacialAnchors.clothingColors.join(', ')}`);
  if (nonFacialAnchors.clothingDistinctive) {
    parts.push(`Distinctive: ${nonFacialAnchors.clothingDistinctive}`);
  }
  parts.push(`Hair: ${nonFacialAnchors.hairColor} ${nonFacialAnchors.hairLength} ${nonFacialAnchors.hairStyle}`);
  if (nonFacialAnchors.accessories.length > 0) {
    parts.push(`Accessories: ${nonFacialAnchors.accessories.join(', ')}`);
  }
  
  return parts.join('\n');
}

// Get anti-morphing prompts (negative prompts to prevent character drift)
function getAntiMorphingPrompts(): string[] {
  return [
    'character morphing',
    'face changing',
    'body transformation',
    'clothing change',
    'identity shift',
    'different person',
    'inconsistent appearance',
    'character replacement',
    'face swap',
    'body swap',
    'outfit change',
    'hair transformation',
    'wardrobe malfunction',
    'shapeshifting',
  ];
}

// Get occlusion-specific negatives
function getOcclusionNegatives(): string[] {
  return [
    'different person when turning around',
    'changed appearance after face hidden',
    'different clothes after camera angle change',
    'hair color change',
    'different body type',
    'clothing transformation',
    'character swap mid-scene',
    'costume change',
    'different hairstyle when turning back',
    'altered physique',
    'different accessories',
    'changed outfit colors',
    'body proportions changing',
    'height change',
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { imageUrl, imageBase64 } = await req.json();
    // Note: generateBackView and generateSilhouette params are now ignored (deprecated)

    if (!imageUrl && !imageBase64) {
      throw new Error("No image provided");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload base64 if provided
    let originalImageUrl = imageUrl;
    if (imageBase64 && !imageUrl) {
      const fileName = `original_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      
      await supabase.storage
        .from('character-references')
        .upload(fileName, bytes, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      originalImageUrl = `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
    }

    // Step 1: ENHANCED character analysis with non-facial anchors
    console.log("[Identity Bible v3] Analyzing character (no multi-view generation)...");
    const { description: characterDescription, nonFacialAnchors } = await analyzeCharacterEnhanced(originalImageUrl);
    console.log("[Identity Bible v3] Character description:", characterDescription.substring(0, 150) + "...");
    console.log("[Identity Bible v3] Non-facial anchors extracted:", {
      bodyType: nonFacialAnchors.bodyType,
      clothingColors: nonFacialAnchors.clothingColors,
      hairColor: nonFacialAnchors.hairColor,
    });
    
    // Extract consistency anchors (key features for quick reference)
    const consistencyAnchors = [
      characterDescription.match(/(?:skin tone|complexion)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:hair|hairstyle)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:eyes?|eye color)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:wearing|dressed|clothing)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:face|facial)[^,.]*/i)?.[0] || '',
      // Add non-facial anchors
      nonFacialAnchors.bodyType,
      nonFacialAnchors.clothingDistinctive,
      nonFacialAnchors.overallSilhouette,
    ].filter(Boolean);

    const analysisTimeMs = Date.now() - startTime;

    const result: IdentityBibleResult = {
      success: true,
      version: '3.0',
      originalImageUrl,
      
      // Character description
      characterDescription,
      
      // Non-facial anchors
      nonFacialAnchors,
      
      // Consistency anchors
      consistencyAnchors,
      
      // Enhanced prompts
      enhancedConsistencyPrompt: buildEnhancedConsistencyPrompt(characterDescription, nonFacialAnchors),
      antiMorphingPrompts: getAntiMorphingPrompts(),
      occlusionNegatives: getOcclusionNegatives(),
      
      // Processing info
      analysisTimeMs,
    };

    console.log(`[Identity Bible v3] Complete in ${analysisTimeMs}ms (analysis only, no image generation)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Identity Bible v3] Error:", error);
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
