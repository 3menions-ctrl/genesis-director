import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferenceImageAnalysis {
  imageUrl: string;
  analysisComplete: boolean;
  characterIdentity: {
    description: string;
    facialFeatures: string;
    clothing: string;
    bodyType: string;
    distinctiveMarkers: string[];
  };
  environment: {
    setting: string;
    geometry: string;
    keyObjects: string[];
    backgroundElements: string[];
  };
  lighting: {
    style: string;
    direction: string;
    quality: string;
    timeOfDay: string;
  };
  colorPalette: {
    dominant: string[];
    accent: string[];
    mood: string;
  };
  consistencyPrompt: string;
}

/**
 * Upload base64 image to Supabase Storage and return public URL
 */
async function uploadToStorage(base64Data: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Convert base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Generate unique filename
  const fileName = `ref_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const bucketName = 'character-references';
  
  // Check if bucket exists, create if not
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);
  
  if (!bucketExists) {
    console.log(`Creating storage bucket: ${bucketName}`);
    await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });
  }
  
  // Upload file
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }
  
  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);
  
  console.log('[analyze-reference-image] Uploaded to storage:', publicUrlData.publicUrl);
  
  return publicUrlData.publicUrl;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, imageBase64 } = await req.json();
    
    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Prepare image content for vision model
    const imageContent = imageBase64 
      ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: 'image_url', image_url: { url: imageUrl } };

    const systemPrompt = `You are a professional cinematographer and visual effects supervisor analyzing a reference image for an AI video production pipeline.

Your task is to extract comprehensive visual features that will be used to maintain strict identity and environmental consistency across multiple AI-generated video clips.

Analyze the image and return a structured JSON response with these categories:

1. CHARACTER IDENTITY (if present):
   - Detailed description of the person/character
   - Specific facial features (face shape, eyes, nose, mouth, skin tone)
   - Clothing and accessories in detail
   - Body type and posture
   - Any distinctive markers (scars, tattoos, jewelry, etc.)

2. ENVIRONMENT:
   - Overall setting description
   - Spatial geometry (depth, perspective, key planes)
   - Key objects and their positions
   - Background elements

3. LIGHTING:
   - Lighting style (e.g., "dramatic chiaroscuro", "soft ambient", "hard noir")
   - Light direction (e.g., "top-left key light", "backlit", "frontal")
   - Quality (e.g., "hard shadows", "diffused", "mixed")
   - Time of day suggestion

4. COLOR PALETTE:
   - Dominant colors (list 3-5)
   - Accent colors (list 2-3)
   - Overall mood (e.g., "warm cinematic teal-orange", "cold dramatic blue")

5. CONSISTENCY PROMPT:
   - Generate a single, detailed prompt that captures all visual elements and can be injected into video generation prompts to maintain consistency.

Return ONLY valid JSON in this exact format:
{
  "characterIdentity": {
    "description": "...",
    "facialFeatures": "...",
    "clothing": "...",
    "bodyType": "...",
    "distinctiveMarkers": ["..."]
  },
  "environment": {
    "setting": "...",
    "geometry": "...",
    "keyObjects": ["..."],
    "backgroundElements": ["..."]
  },
  "lighting": {
    "style": "...",
    "direction": "...",
    "quality": "...",
    "timeOfDay": "..."
  },
  "colorPalette": {
    "dominant": ["..."],
    "accent": ["..."],
    "mood": "..."
  },
  "consistencyPrompt": "..."
}`;

    console.log('[analyze-reference-image] Sending image to vision model for analysis');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: 'Analyze this reference image and extract all visual features for production consistency.' },
              imageContent
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-reference-image] OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid OpenAI API key.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown wrapping)
    let parsedAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('[analyze-reference-image] JSON parse error:', parseErr);
      throw new Error('Failed to parse analysis response');
    }

    // CRITICAL: Upload image to storage to get a proper HTTP URL
    // Replicate and other video services require HTTP URLs, not base64
    let storedImageUrl = imageUrl;
    if (imageBase64 && !imageUrl) {
      console.log('[analyze-reference-image] Uploading base64 image to storage...');
      storedImageUrl = await uploadToStorage(imageBase64);
    }

    const analysis: ReferenceImageAnalysis = {
      imageUrl: storedImageUrl,
      analysisComplete: true,
      characterIdentity: parsedAnalysis.characterIdentity || {
        description: '',
        facialFeatures: '',
        clothing: '',
        bodyType: '',
        distinctiveMarkers: [],
      },
      environment: parsedAnalysis.environment || {
        setting: '',
        geometry: '',
        keyObjects: [],
        backgroundElements: [],
      },
      lighting: parsedAnalysis.lighting || {
        style: '',
        direction: '',
        quality: '',
        timeOfDay: '',
      },
      colorPalette: parsedAnalysis.colorPalette || {
        dominant: [],
        accent: [],
        mood: '',
      },
      consistencyPrompt: parsedAnalysis.consistencyPrompt || '',
    };

    console.log('[analyze-reference-image] Analysis complete:', {
      hasCharacter: !!analysis.characterIdentity.description,
      environment: analysis.environment.setting?.substring(0, 50),
      lightingStyle: analysis.lighting.style,
    });

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-reference-image] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
