import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * FACE LOCK GENERATOR
 * 
 * Creates a persistent face identity lock that is injected into every
 * video generation to prevent character morphing/drift.
 * 
 * This extracts:
 * 1. Ultra-detailed face description (eyes, nose, mouth, skin, structure)
 * 2. Distinguishing facial features that MUST persist
 * 3. Face-specific negative prompts
 * 4. A "golden reference" description for injection
 */

interface FaceLockRequest {
  referenceImageUrl: string;
  projectId: string;
  characterName?: string;
}

interface FaceLock {
  // Core face identity
  faceShape: string;
  eyeDescription: string;
  noseDescription: string;
  mouthDescription: string;
  skinTone: string;
  skinTexture: string;
  facialHair: string;
  
  // Distinguishing features (CRITICAL for identity)
  distinguishingFeatures: string[];
  
  // Age and expression baseline
  apparentAge: string;
  restingExpression: string;
  
  // Hair framing the face
  hairlineDescription: string;
  hairColorExact: string;
  
  // Full description for injection
  fullFaceDescription: string;
  
  // Golden reference - single sentence identity lock
  goldenReference: string;
  
  // Face-specific negatives
  faceNegatives: string[];
  
  // Metadata
  lockedAt: string;
  confidence: number;
  sourceImageUrl: string;
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

    const request: FaceLockRequest = await req.json();
    const { referenceImageUrl, projectId, characterName = 'Character' } = request;

    if (!referenceImageUrl) {
      throw new Error("referenceImageUrl is required");
    }

    console.log(`[FaceLock] Generating face lock for project ${projectId}`);
    console.log(`[FaceLock] Reference: ${referenceImageUrl.substring(0, 60)}...`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt = `You are an expert facial analysis AI creating a FACE LOCK for AI video generation.

Your task is to analyze the face in this image with EXTREME PRECISION and create a detailed identity lock that will be injected into every video frame to prevent the AI from changing the face.

ANALYZE AND EXTRACT:

1. FACE SHAPE: Oval, round, square, heart, oblong, diamond - be specific about proportions

2. EYES (CRITICAL):
   - Exact eye color with variations (e.g., "deep brown with amber flecks near the iris")
   - Eye shape (almond, round, hooded, monolid, etc.)
   - Eye size relative to face
   - Eyebrow shape, thickness, arch position
   - Distance between eyes
   - Any distinguishing features (long lashes, crease depth, etc.)

3. NOSE:
   - Bridge height and width
   - Nostril shape
   - Tip shape (rounded, pointed, upturned, etc.)
   - Overall nose size relative to face

4. MOUTH & LIPS:
   - Lip fullness (thin, medium, full)
   - Lip shape (bow-shaped, straight, etc.)
   - Lip color
   - Mouth width relative to face
   - Any distinguishing features

5. SKIN:
   - Exact skin tone (use specific descriptors like "warm olive undertone" or "cool porcelain")
   - Skin texture (smooth, freckled, etc.)
   - Any visible marks, moles, or beauty marks (CRITICAL for identity)

6. FACIAL STRUCTURE:
   - Cheekbone prominence
   - Jaw definition
   - Chin shape
   - Forehead size

7. FACIAL HAIR (if any):
   - Beard/stubble description
   - Mustache presence

8. HAIR FRAMING FACE:
   - Hairline shape
   - Hair color (exact, including any highlights or variations)
   - How hair frames the face

9. DISTINGUISHING FEATURES:
   - List 3-5 UNIQUE features that make this face identifiable
   - These should be the features that MUST NOT change

10. GOLDEN REFERENCE:
    - Create a single, powerful sentence that captures the entire face identity
    - This will be injected at the start of every prompt

RESPOND WITH VALID JSON:
{
  "faceShape": "specific face shape description",
  "eyeDescription": "complete eye description including color, shape, brows",
  "noseDescription": "detailed nose description",
  "mouthDescription": "detailed mouth and lip description",
  "skinTone": "exact skin tone with undertones",
  "skinTexture": "skin texture and any marks",
  "facialHair": "facial hair description or 'none'",
  "distinguishingFeatures": ["feature1", "feature2", "feature3"],
  "apparentAge": "age range",
  "restingExpression": "neutral expression description",
  "hairlineDescription": "hairline shape and how it frames face",
  "hairColorExact": "exact hair color",
  "fullFaceDescription": "complete 2-3 sentence face description",
  "goldenReference": "single powerful identity sentence",
  "faceNegatives": ["things that would change this face identity"],
  "confidence": 0-100
}`;

    const messageContent = [
      {
        type: 'text',
        text: `Analyze this reference image of "${characterName}" and create a comprehensive FACE LOCK. Extract every facial detail with extreme precision. The goal is to create an identity lock so strong that the AI video generator cannot morph or change this face.`
      },
      {
        type: 'image_url',
        image_url: { url: referenceImageUrl }
      }
    ];

    console.log('[FaceLock] Calling Lovable AI for face analysis...');

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
      console.error('[FaceLock] Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let faceLock: FaceLock;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawContent;
      const parsed = JSON.parse(jsonStr.trim());
      
      faceLock = {
        ...parsed,
        lockedAt: new Date().toISOString(),
        sourceImageUrl: referenceImageUrl,
        // Add default face negatives if not provided
        faceNegatives: parsed.faceNegatives || [
          'different face',
          'changed eyes',
          'different eye color',
          'different nose',
          'different lips',
          'different skin tone',
          'aged face',
          'younger face',
          'different facial structure',
          'morphed features',
          'face swap',
          'different person',
          'altered appearance',
          'changed bone structure',
          'different ethnicity',
        ],
      };
    } catch (parseError) {
      console.error('[FaceLock] Failed to parse AI response:', parseError);
      throw new Error('Failed to parse face lock response');
    }

    console.log(`[FaceLock] Face lock generated with ${faceLock.distinguishingFeatures?.length || 0} distinguishing features`);
    console.log(`[FaceLock] Golden reference: ${faceLock.goldenReference?.substring(0, 80)}...`);

    // Store in project
    if (projectId) {
      try {
        const { data: existingProject } = await supabase
          .from('movie_projects')
          .select('pro_features_data')
          .eq('id', projectId)
          .single();
        
        const existingData = existingProject?.pro_features_data || {};
        const updatedData = { 
          ...existingData, 
          faceLock,
          faceLockEnabled: true,
        };
        
        await supabase
          .from('movie_projects')
          .update({
            pro_features_data: updatedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
        console.log('[FaceLock] Stored in project pro_features_data');
      } catch (storeError) {
        console.warn('[FaceLock] Failed to store in project:', storeError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      faceLock,
      processingTimeMs: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[FaceLock] Error:", error);
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
