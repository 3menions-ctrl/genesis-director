import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MULTI-VIEW IDENTITY BIBLE GENERATOR
 * 
 * Implements improvement 1.3:
 * - Generate 5 views (front, side, 3/4, back, silhouette) from reference
 * - Uses AI to analyze and describe character from all angles
 * - Provides comprehensive non-facial anchors for any camera angle
 * 
 * This is CRITICAL for maintaining character consistency at any angle
 */

interface MultiViewRequest {
  referenceImageUrl: string;
  projectId: string;
  userId?: string;
  characterName?: string;
}

interface ViewDescription {
  viewType: 'front' | 'side' | 'three-quarter' | 'back' | 'silhouette';
  description: string;
  keyFeatures: string[];
  consistencyAnchors: string[];
  negativePrompts: string[];
}

interface MultiViewIdentityBible {
  characterName: string;
  
  // Core identity (from reference)
  coreIdentity: {
    description: string;
    facialFeatures: string;
    bodyType: string;
    height: string;
    skinTone: string;
    age: string;
    gender: string;
  };
  
  // 5-view descriptions
  views: {
    front: ViewDescription;
    side: ViewDescription;
    threeQuarter: ViewDescription;
    back: ViewDescription;
    silhouette: ViewDescription;
  };
  
  // Non-facial anchors (critical for back/occluded views)
  nonFacialAnchors: {
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
    hairColorHex: string;
    hairLength: string;
    hairStyle: string;
    hairFromBehind: string;
    hairSilhouette: string;
    accessories: string[];
    accessoryPositions: string;
    backViewMarkers: string;
    overallSilhouette: string;
  };
  
  // Comprehensive consistency prompt
  masterConsistencyPrompt: string;
  
  // Global negatives
  occlusionNegatives: string[];
  
  // Metadata
  extractedAt: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const request: MultiViewRequest = await req.json();
    const { referenceImageUrl, projectId, userId, characterName = 'Character' } = request;

    if (!referenceImageUrl) {
      throw new Error("referenceImageUrl is required");
    }

    console.log(`[MultiViewIdentity] Generating 5-view identity bible for project ${projectId}`);
    console.log(`[MultiViewIdentity] Reference: ${referenceImageUrl.substring(0, 60)}...`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt = `You are an expert character designer and cinematographer creating a comprehensive 5-VIEW IDENTITY BIBLE for AI video generation.

Your task is to analyze a reference image and generate detailed descriptions of the character from ALL ANGLES, even those not visible in the reference image.

You must EXTRAPOLATE what the character would look like from:
1. FRONT VIEW - facing camera
2. SIDE VIEW (PROFILE) - 90 degrees from camera
3. THREE-QUARTER VIEW - 45 degrees from camera
4. BACK VIEW - facing away from camera
5. SILHOUETTE - outline/shape only

For EACH VIEW, provide:
- Detailed visual description
- Key identifying features visible from that angle
- Consistency anchors (must-have elements)
- Negative prompts (what to avoid)

CRITICAL: The NON-FACIAL ANCHORS are essential for maintaining identity when the face is not visible:
- Hair from behind (exact description)
- Clothing from all angles
- Body proportions and posture
- Accessories and their positions
- Overall silhouette shape

RESPOND WITH VALID JSON:
{
  "characterName": "...",
  "coreIdentity": {
    "description": "full character description",
    "facialFeatures": "face shape, eyes, nose, mouth, etc.",
    "bodyType": "build and physique",
    "height": "relative height",
    "skinTone": "exact skin tone description",
    "age": "apparent age",
    "gender": "apparent gender"
  },
  "views": {
    "front": {
      "viewType": "front",
      "description": "detailed front view description",
      "keyFeatures": ["feature1", "feature2"],
      "consistencyAnchors": ["anchor1", "anchor2"],
      "negativePrompts": ["avoid1", "avoid2"]
    },
    "side": { ... },
    "threeQuarter": { ... },
    "back": { ... },
    "silhouette": { ... }
  },
  "nonFacialAnchors": {
    "bodyType": "...",
    "bodyProportions": "...",
    "posture": "...",
    "gait": "...",
    "height": "...",
    "clothingDescription": "full outfit description",
    "clothingColors": ["color1 #HEX", "color2 #HEX"],
    "clothingPatterns": ["pattern1"],
    "clothingTextures": ["texture1"],
    "clothingDistinctive": "unique clothing features",
    "hairColor": "exact hair color",
    "hairColorHex": "#HEXCODE",
    "hairLength": "...",
    "hairStyle": "...",
    "hairFromBehind": "how hair looks from behind",
    "hairSilhouette": "hair shape in silhouette",
    "accessories": ["item1", "item2"],
    "accessoryPositions": "where accessories are worn",
    "backViewMarkers": "identifiable features from behind",
    "overallSilhouette": "body outline shape"
  },
  "masterConsistencyPrompt": "single comprehensive prompt for all views",
  "occlusionNegatives": ["things to avoid when face hidden"],
  "confidence": 0-100
}`;

    const messageContent = [
      {
        type: 'text',
        text: `Analyze this reference image and create a comprehensive 5-VIEW IDENTITY BIBLE for "${characterName}". Extrapolate how this character would look from FRONT, SIDE, THREE-QUARTER, BACK, and SILHOUETTE angles. Pay special attention to NON-FACIAL features for maintaining identity when the face is not visible.`
      },
      {
        type: 'image_url',
        image_url: { url: referenceImageUrl }
      }
    ];

    console.log('[MultiViewIdentity] Calling Lovable AI for multi-view analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageContent }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MultiViewIdentity] Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let identityBible: MultiViewIdentityBible;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawContent;
      identityBible = JSON.parse(jsonStr.trim());
      identityBible.extractedAt = new Date().toISOString();
    } catch (parseError) {
      console.error('[MultiViewIdentity] Failed to parse AI response:', parseError);
      throw new Error('Failed to parse identity bible response');
    }

    // Build enhanced consistency anchors
    const allAnchors: string[] = [];
    Object.values(identityBible.views || {}).forEach((view: any) => {
      if (view?.consistencyAnchors) {
        allAnchors.push(...view.consistencyAnchors);
      }
    });

    // Deduplicate anchors
    const uniqueAnchors = [...new Set(allAnchors)];

    console.log(`[MultiViewIdentity] Generated ${Object.keys(identityBible.views || {}).length} view descriptions`);
    console.log(`[MultiViewIdentity] Extracted ${uniqueAnchors.length} unique consistency anchors`);
    console.log(`[MultiViewIdentity] Non-facial anchors: ${Object.keys(identityBible.nonFacialAnchors || {}).length} fields`);

    // Store in project if projectId provided
    if (projectId) {
      try {
        // Get existing pro_features_data first
        const { data: existingProject } = await supabase
          .from('movie_projects')
          .select('pro_features_data')
          .eq('id', projectId)
          .single();
        
        const existingData = existingProject?.pro_features_data || {};
        const updatedData = { ...existingData, multiViewIdentityBible: identityBible };
        
        await supabase
          .from('movie_projects')
          .update({
            pro_features_data: updatedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
        console.log('[MultiViewIdentity] Stored in project pro_features_data');
      } catch (storeError) {
        console.warn('[MultiViewIdentity] Failed to store in project:', storeError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      identityBible,
      viewCount: Object.keys(identityBible.views || {}).length,
      anchorCount: uniqueAnchors.length,
      processingTimeMs: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[MultiViewIdentity] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      processingTimeMs: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
