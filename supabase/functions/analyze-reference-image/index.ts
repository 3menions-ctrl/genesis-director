import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageOrientation {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  veoAspectRatio: '16:9' | '9:16' | '1:1';
}

interface ReferenceImageAnalysis {
  imageUrl: string;
  analysisComplete: boolean;
  imageOrientation: ImageOrientation;
  characterIdentity: {
    description: string;
    facialFeatures: string;
    clothing: string;
    bodyType: string;
    distinctiveMarkers: string[];
    hairColor?: string;  // NEW: Exact hair color for consistency
    skinTone?: string;   // NEW: Skin tone for consistency
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
    shadowDirection?: string;   // NEW: Shadow direction lock
    keyLightAngle?: string;     // NEW: Key light angle for precision
  };
  colorPalette: {
    dominant: string[];  // Now includes HEX codes: "color name #HEXCODE"
    accent: string[];    // Now includes HEX codes: "color name #HEXCODE"
    mood: string;
    temperature?: 'warm' | 'neutral' | 'cool';  // NEW: Color temperature lock
  };
  consistencyPrompt: string;
}

/**
 * Detect image orientation from base64 data by decoding image headers
 * This is a lightweight approach that doesn't require full image decode
 */
function detectImageOrientation(base64Data: string): ImageOrientation {
  try {
    // Decode base64 to get image bytes
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    let width = 0;
    let height = 0;
    
    // Check for JPEG (FFD8FF)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      // Parse JPEG markers to find SOF (Start of Frame)
      let offset = 2;
      while (offset < bytes.length - 8) {
        if (bytes[offset] !== 0xFF) break;
        const marker = bytes[offset + 1];
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        
        // SOF0, SOF1, SOF2 markers contain dimensions
        if (marker >= 0xC0 && marker <= 0xC3) {
          height = (bytes[offset + 5] << 8) | bytes[offset + 6];
          width = (bytes[offset + 7] << 8) | bytes[offset + 8];
          break;
        }
        
        offset += 2 + length;
      }
    }
    // Check for PNG (89504E47)
    else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      // PNG IHDR chunk starts at byte 16, dimensions at bytes 16-23
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    }
    // Check for WebP (RIFF....WEBP)
    else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      // WebP VP8 chunk - dimensions are at specific offsets depending on format
      // For simplicity, assume 16:9 for WebP - full parsing would be complex
      console.log('[detectImageOrientation] WebP detected, using default dimensions');
      width = 1920;
      height = 1080;
    }
    
    if (width === 0 || height === 0) {
      console.log('[detectImageOrientation] Could not parse dimensions, defaulting to 16:9');
      width = 1920;
      height = 1080;
    }
    
    const aspectRatio = width / height;
    
    // Determine orientation
    let orientation: 'landscape' | 'portrait' | 'square';
    let veoAspectRatio: '16:9' | '9:16' | '1:1';
    
    if (aspectRatio > 1.2) {
      orientation = 'landscape';
      veoAspectRatio = '16:9';
    } else if (aspectRatio < 0.8) {
      orientation = 'portrait';
      veoAspectRatio = '9:16';
    } else {
      orientation = 'square';
      veoAspectRatio = '1:1';
    }
    
    console.log(`[detectImageOrientation] Detected: ${width}x${height}, ratio=${aspectRatio.toFixed(2)}, orientation=${orientation}, veoAspectRatio=${veoAspectRatio}`);
    
    return {
      width,
      height,
      aspectRatio,
      orientation,
      veoAspectRatio,
    };
  } catch (err) {
    console.error('[detectImageOrientation] Error parsing image:', err);
    // Default to landscape 16:9 on error
    return {
      width: 1920,
      height: 1080,
      aspectRatio: 1.78,
      orientation: 'landscape',
      veoAspectRatio: '16:9',
    };
  }
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

/**
 * Expand image to target aspect ratio using AI outpainting
 */
async function expandImageToAspectRatio(
  imageUrl: string,
  currentOrientation: ImageOrientation,
  targetAspectRatio: '16:9' | '9:16' | '1:1',
  environmentPrompt: string
): Promise<{ expanded: boolean; imageUrl: string }> {
  // Check if expansion is needed
  if (currentOrientation.veoAspectRatio === targetAspectRatio) {
    console.log('[analyze-reference-image] No aspect ratio expansion needed');
    return { expanded: false, imageUrl };
  }
  
  console.log(`[analyze-reference-image] Expanding image from ${currentOrientation.veoAspectRatio} to ${targetAspectRatio}`);
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  
  try {
    // Call the expand-image-aspect-ratio edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/expand-image-aspect-ratio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        imageUrl,
        targetAspectRatio,
        environmentPrompt,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-reference-image] Expansion failed:', errorText);
      // Fall back to original image
      return { expanded: false, imageUrl };
    }
    
    const result = await response.json();
    
    if (result.expanded && result.imageUrl) {
      console.log('[analyze-reference-image] Image successfully expanded:', result.imageUrl);
      return { expanded: true, imageUrl: result.imageUrl };
    }
    
    return { expanded: false, imageUrl };
  } catch (err) {
    console.error('[analyze-reference-image] Expansion error:', err);
    // Fall back to original image on error
    return { expanded: false, imageUrl };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, imageBase64, targetAspectRatio } = await req.json();
    
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

4. COLOR PALETTE (CRITICAL FOR CONSISTENCY):
   - Dominant colors with HEX codes (list 3-5, format: "color name #HEXCODE")
   - Accent colors with HEX codes (list 2-3, format: "color name #HEXCODE")
   - Overall mood (e.g., "warm cinematic teal-orange", "cold dramatic blue")
   - Color temperature: "warm", "neutral", or "cool"

5. CONSISTENCY PROMPT:
   - Generate a single, detailed prompt that captures all visual elements and can be injected into video generation prompts to maintain consistency.

Return ONLY valid JSON in this exact format:
{
  "characterIdentity": {
    "description": "...",
    "facialFeatures": "...",
    "clothing": "...",
    "bodyType": "...",
    "distinctiveMarkers": ["..."],
    "hairColor": "exact hair color",
    "skinTone": "exact skin tone description"
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
    "timeOfDay": "...",
    "shadowDirection": "where shadows fall (e.g., 'bottom-right', 'directly below')",
    "keyLightAngle": "approximate angle in degrees (e.g., '45 degrees top-left')"
  },
  "colorPalette": {
    "dominant": ["color name #HEXCODE", "..."],
    "accent": ["color name #HEXCODE", "..."],
    "mood": "...",
    "temperature": "warm|neutral|cool"
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

    // CRITICAL: Detect image orientation for correct Veo API aspect ratio
    const imageOrientation = imageBase64 
      ? detectImageOrientation(imageBase64)
      : { width: 1920, height: 1080, aspectRatio: 1.78, orientation: 'landscape' as const, veoAspectRatio: '16:9' as const };
    
    console.log('[analyze-reference-image] Image orientation detected:', imageOrientation);

    // NEW: Expand image to target aspect ratio if needed
    let finalImageUrl = storedImageUrl;
    let wasExpanded = false;
    const validTargetRatio = targetAspectRatio as '16:9' | '9:16' | '1:1' | undefined;
    
    if (validTargetRatio && validTargetRatio !== imageOrientation.veoAspectRatio) {
      console.log(`[analyze-reference-image] Aspect ratio mismatch detected: image is ${imageOrientation.veoAspectRatio}, target is ${validTargetRatio}`);
      
      // Build environment prompt from analysis for seamless outpainting
      const environmentPrompt = [
        parsedAnalysis.environment?.setting,
        parsedAnalysis.lighting?.style,
        parsedAnalysis.colorPalette?.mood,
        parsedAnalysis.consistencyPrompt
      ].filter(Boolean).join(', ');
      
      const expansionResult = await expandImageToAspectRatio(
        storedImageUrl,
        imageOrientation,
        validTargetRatio,
        environmentPrompt
      );
      
      if (expansionResult.expanded) {
        finalImageUrl = expansionResult.imageUrl;
        wasExpanded = true;
        console.log('[analyze-reference-image] Image expanded to target aspect ratio');
      }
    }

    // Update orientation to reflect target if expanded
    const finalOrientation = wasExpanded && validTargetRatio
      ? {
          ...imageOrientation,
          veoAspectRatio: validTargetRatio,
          orientation: validTargetRatio === '16:9' ? 'landscape' as const 
            : validTargetRatio === '9:16' ? 'portrait' as const 
            : 'square' as const,
        }
      : imageOrientation;

    const analysis: ReferenceImageAnalysis = {
      imageUrl: finalImageUrl,
      analysisComplete: true,
      imageOrientation: finalOrientation,
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
      orientation: analysis.imageOrientation.orientation,
      veoAspectRatio: analysis.imageOrientation.veoAspectRatio,
      wasExpanded,
    });

    return new Response(
      JSON.stringify({ 
        analysis,
        wasExpanded,
        originalAspectRatio: imageOrientation.veoAspectRatio,
        targetAspectRatio: validTargetRatio,
      }),
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
