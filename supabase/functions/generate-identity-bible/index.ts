import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ENHANCED Identity Bible Generator (v2.0)
 * 
 * 5-View Character Reference System:
 * - Front view
 * - Side view (profile)
 * - 3/4 view (angled)
 * - Back view (NEW)
 * - Silhouette/outline (NEW)
 * 
 * Plus Non-Facial Anchors for occlusion handling
 */

type ViewType = 'front' | 'side' | 'three-quarter' | 'back' | 'silhouette';

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

interface EnhancedIdentityBibleResult {
  success: boolean;
  version: '2.0';
  originalImageUrl: string;
  
  // 5-View System
  views: {
    front?: { imageUrl: string; generatedAt: number };
    side?: { imageUrl: string; generatedAt: number };
    threeQuarter?: { imageUrl: string; generatedAt: number };
    back?: { imageUrl: string; generatedAt: number };
    silhouette?: { imageUrl: string; generatedAt: number };
  };
  viewsComplete: boolean;
  viewCount: number;
  
  // Character description
  characterDescription: string;
  
  // Non-facial anchors (CRITICAL for occlusion handling)
  nonFacialAnchors: NonFacialAnchors;
  
  // Backward compatible
  consistencyAnchors: string[];
  frontViewUrl: string;
  sideViewUrl: string;
  threeQuarterViewUrl: string;
  
  // Enhanced prompts
  enhancedConsistencyPrompt: string;
  antiMorphingPrompts: string[];
  occlusionNegatives: string[];
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
      model: 'google/gemini-2.5-flash',
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
  "description": "Complete paragraph describing the character for regeneration prompts",
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

// Generate a character view using OpenAI gpt-image-1 (ENHANCED for 5 views)
async function generateCharacterView(
  characterDescription: string,
  nonFacialAnchors: NonFacialAnchors,
  viewType: ViewType,
  supabase: any
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const viewPrompts: Record<ViewType, string> = {
    'front': 'front-facing portrait view, looking directly at camera, symmetrical face, centered composition',
    'side': 'profile view, side-facing portrait, 90-degree angle showing full side of face, clean silhouette',
    'three-quarter': 'three-quarter view portrait, 45-degree angle, showing both eyes with depth and dimension',
    'back': 'back view, character facing away from camera, showing full back of head and body, clear view of hair from behind and clothing from back',
    'silhouette': 'dramatic silhouette view, character as dark outline against bright background, showing distinctive body shape and hair outline'
  };

  // Build enhanced prompt with non-facial anchors for back/silhouette views
  let characterDetails = characterDescription;
  
  if (viewType === 'back' || viewType === 'silhouette') {
    characterDetails = `${characterDescription}

CRITICAL NON-FACIAL DETAILS (must be visible):
- Body: ${nonFacialAnchors.bodyType}, ${nonFacialAnchors.bodyProportions}
- Clothing: ${nonFacialAnchors.clothingDescription}
- Clothing colors: ${nonFacialAnchors.clothingColors.join(', ')}
- Hair from behind: ${nonFacialAnchors.hairFromBehind || nonFacialAnchors.hairColor + ' ' + nonFacialAnchors.hairLength}
- Silhouette: ${nonFacialAnchors.overallSilhouette}
${nonFacialAnchors.backViewMarkers ? `- Back markers: ${nonFacialAnchors.backViewMarkers}` : ''}
${nonFacialAnchors.accessories.length > 0 ? `- Accessories: ${nonFacialAnchors.accessories.join(', ')}` : ''}`;
  }

  const prompt = `Professional character reference sheet, ${viewPrompts[viewType]}.

CHARACTER (MUST MATCH EXACTLY):
${characterDetails}

STYLE REQUIREMENTS:
- Studio lighting with soft shadows
- Neutral gray gradient background
- High detail, sharp focus
- Professional reference sheet style for character consistency
- Same person, same clothing, same accessories as described
- Photorealistic quality, no stylization
${viewType === 'silhouette' ? '- Strong backlight creating clear silhouette outline' : ''}`;

  console.log(`[Identity Bible v2] Generating ${viewType} view with OpenAI gpt-image-1...`);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Identity Bible v2] OpenAI error for ${viewType}:`, errorText);
    throw new Error(`Failed to generate ${viewType} view: ${errorText}`);
  }

  const data = await response.json();
  const imageBase64 = data.data?.[0]?.b64_json;
  
  if (!imageBase64) {
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const bytes = new Uint8Array(imageBuffer);
      
      const fileName = `identity_${viewType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('character-references')
        .upload(fileName, bytes, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      return `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
    }
    throw new Error(`No image generated for ${viewType} view`);
  }

  const fileName = `identity_${viewType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
  
  const { error: uploadError } = await supabase.storage
    .from('character-references')
    .upload(fileName, bytes, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    console.error(`[Identity Bible v2] Upload error for ${viewType}:`, uploadError);
    throw uploadError;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
  
  console.log(`[Identity Bible v2] ${viewType} view uploaded:`, publicUrl);
  return publicUrl;
}

// Build enhanced consistency prompt
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

// Get anti-morphing prompts
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
    const { imageUrl, imageBase64, generateBackView = true, generateSilhouette = true } = await req.json();

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
    console.log("[Identity Bible v2] Analyzing character with enhanced extraction...");
    const { description: characterDescription, nonFacialAnchors } = await analyzeCharacterEnhanced(originalImageUrl);
    console.log("[Identity Bible v2] Character description:", characterDescription.substring(0, 150) + "...");
    console.log("[Identity Bible v2] Non-facial anchors extracted:", {
      bodyType: nonFacialAnchors.bodyType,
      clothingColors: nonFacialAnchors.clothingColors,
      hairColor: nonFacialAnchors.hairColor,
    });

    // Step 2: Generate 5-view system (parallel where possible)
    console.log("[Identity Bible v2] Generating 5-view reference system...");
    
    const viewsToGenerate: ViewType[] = ['front', 'side', 'three-quarter'];
    if (generateBackView) viewsToGenerate.push('back');
    if (generateSilhouette) viewsToGenerate.push('silhouette');
    
    const viewResults = await Promise.allSettled(
      viewsToGenerate.map(viewType => 
        generateCharacterView(characterDescription, nonFacialAnchors, viewType, supabase)
          .then(imageUrl => ({ viewType, imageUrl, success: true }))
          .catch(error => ({ viewType, error: error.message, success: false }))
      )
    );
    
    // Build views object
    const views: EnhancedIdentityBibleResult['views'] = {};
    let successCount = 0;
    
    for (const result of viewResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        const { viewType, imageUrl } = result.value as { viewType: ViewType; imageUrl: string; success: true };
        const key = viewType === 'three-quarter' ? 'threeQuarter' : viewType;
        views[key as keyof typeof views] = {
          imageUrl,
          generatedAt: Date.now(),
        };
        successCount++;
      } else if (result.status === 'fulfilled') {
        console.warn(`[Identity Bible v2] Failed to generate ${(result.value as any).viewType}:`, (result.value as any).error);
      }
    }
    
    // Extract consistency anchors (backward compatible)
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

    const result: EnhancedIdentityBibleResult = {
      success: true,
      version: '2.0',
      originalImageUrl,
      
      // 5-View System
      views,
      viewsComplete: successCount >= 3, // At least front, side, three-quarter
      viewCount: successCount,
      
      // Character description
      characterDescription,
      
      // Non-facial anchors
      nonFacialAnchors,
      
      // Backward compatible fields
      consistencyAnchors,
      frontViewUrl: views.front?.imageUrl || '',
      sideViewUrl: views.side?.imageUrl || '',
      threeQuarterViewUrl: views.threeQuarter?.imageUrl || '',
      
      // Enhanced prompts
      enhancedConsistencyPrompt: buildEnhancedConsistencyPrompt(characterDescription, nonFacialAnchors),
      antiMorphingPrompts: getAntiMorphingPrompts(),
      occlusionNegatives: getOcclusionNegatives(),
    };

    const processingTimeMs = Date.now() - startTime;
    console.log(`[Identity Bible v2] Complete in ${processingTimeMs}ms:`, {
      viewsGenerated: successCount,
      hasBackView: !!views.back,
      hasSilhouette: !!views.silhouette,
    });

    return new Response(
      JSON.stringify({ ...result, processingTimeMs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Identity Bible v2] Error:", error);
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
