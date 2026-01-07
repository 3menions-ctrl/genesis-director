import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Identity Bible Generator
 * 
 * Takes a single reference image and generates a 3-point character identity bible:
 * - Front view
 * - Side view (profile)
 * - 3/4 view (angled)
 * 
 * Uses OpenAI gpt-image-1 for consistent character generation (more reliable than Imagen).
 * Falls back to Vertex AI Imagen if OpenAI is unavailable.
 */

interface IdentityBibleResult {
  success: boolean;
  originalImageUrl: string;
  frontViewUrl: string;
  sideViewUrl: string;
  threeQuarterViewUrl: string;
  characterDescription: string;
  consistencyAnchors: string[];
}

// Analyze image to extract character description using Gemini via Lovable Gateway
async function analyzeCharacter(imageUrl: string): Promise<string> {
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
            text: `Analyze this character image and provide a detailed, consistent description that can be used to regenerate this exact character from different angles.

Include:
1. PHYSICAL FEATURES: Exact face shape, eye color/shape, nose type, lip shape, skin tone (use specific descriptors)
2. HAIR: Color, length, style, texture, any distinctive features
3. BODY TYPE: Build, height impression, posture
4. CLOTHING: Detailed description of all visible clothing, colors, patterns, accessories
5. DISTINCTIVE MARKERS: Scars, tattoos, jewelry, unique features

Format as a single, detailed paragraph that could be used as a prompt to generate this same character. Be extremely specific to ensure consistency across multiple generations.`
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
  return data.choices?.[0]?.message?.content || "";
}

// Generate a character view using OpenAI gpt-image-1
async function generateCharacterViewOpenAI(
  characterDescription: string,
  viewType: 'front' | 'side' | 'three-quarter',
  supabase: any
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const viewPrompts = {
    'front': 'front-facing portrait view, looking directly at camera, symmetrical face, centered composition',
    'side': 'profile view, side-facing portrait, 90-degree angle showing full side of face, clean silhouette',
    'three-quarter': 'three-quarter view portrait, 45-degree angle, showing both eyes with depth and dimension'
  };

  const prompt = `Professional character reference sheet, ${viewPrompts[viewType]}.

CHARACTER (MUST MATCH EXACTLY):
${characterDescription}

STYLE REQUIREMENTS:
- Studio lighting with soft shadows
- Neutral gray gradient background
- High detail, sharp focus on facial features
- Professional reference sheet style for character consistency
- Same person, same clothing, same accessories as described
- Photorealistic quality, no stylization`;

  console.log(`[Identity Bible] Generating ${viewType} view with OpenAI gpt-image-1...`);

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
    console.error(`[Identity Bible] OpenAI error for ${viewType}:`, errorText);
    throw new Error(`Failed to generate ${viewType} view: ${errorText}`);
  }

  const data = await response.json();
  const imageBase64 = data.data?.[0]?.b64_json;
  
  if (!imageBase64) {
    // Try URL if base64 not available
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      // Download and upload to our storage
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

  // Upload base64 to Supabase storage
  const fileName = `identity_${viewType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
  
  const { error: uploadError } = await supabase.storage
    .from('character-references')
    .upload(fileName, bytes, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    console.error(`[Identity Bible] Upload error for ${viewType}:`, uploadError);
    throw uploadError;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
  
  console.log(`[Identity Bible] ${viewType} view uploaded:`, publicUrl);
  return publicUrl;
}

// Fallback: Generate using Vertex AI Imagen
async function generateCharacterViewImagen(
  characterDescription: string,
  viewType: 'front' | 'side' | 'three-quarter',
  accessToken: string,
  projectId: string,
  supabase: any
): Promise<string> {
  const viewPrompts = {
    'front': 'front-facing portrait view, looking directly at viewer, symmetrical composition',
    'side': 'profile view, side-facing portrait, 90-degree angle from front',
    'three-quarter': 'three-quarter view portrait, 45-degree angle, showing depth and dimension'
  };

  const prompt = `Professional character reference sheet, ${viewPrompts[viewType]}.

CHARACTER DETAILS:
${characterDescription}

STYLE REQUIREMENTS:
- Studio lighting, neutral background
- High detail, sharp focus
- Consistent with character reference sheet style
- Same clothing and accessories across all views
- Photorealistic quality`;

  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

  console.log(`[Identity Bible] Generating ${viewType} view with Imagen (fallback)...`);

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
    const errorText = await response.text();
    console.error(`[Identity Bible] Imagen error for ${viewType}:`, errorText);
    throw new Error(`Failed to generate ${viewType} view: ${errorText}`);
  }

  const data = await response.json();
  const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;
  
  if (!imageBase64) {
    throw new Error(`No image generated for ${viewType} view`);
  }

  // Upload to Supabase storage
  const fileName = `identity_${viewType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
  
  const { error: uploadError } = await supabase.storage
    .from('character-references')
    .upload(fileName, bytes, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (uploadError) throw uploadError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
}

// Get OAuth2 access token from service account (for Imagen fallback)
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  };

  const base64UrlEncode = (obj: any) => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${await tokenResponse.text()}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, imageBase64 } = await req.json();

    if (!imageUrl && !imageBase64) {
      throw new Error("No image provided");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If base64 provided, upload it first
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

    // Step 1: Analyze the character using Gemini
    console.log("[Identity Bible] Analyzing character from reference image...");
    const characterDescription = await analyzeCharacter(originalImageUrl);
    console.log("[Identity Bible] Character description:", characterDescription.substring(0, 200) + "...");

    // Step 2: Generate all three views - try OpenAI first, fallback to Imagen
    console.log("[Identity Bible] Generating 3-point identity views...");
    
    let frontViewUrl: string;
    let sideViewUrl: string;
    let threeQuarterViewUrl: string;
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (OPENAI_API_KEY) {
      // Use OpenAI gpt-image-1 (more reliable for character consistency)
      try {
        [frontViewUrl, sideViewUrl, threeQuarterViewUrl] = await Promise.all([
          generateCharacterViewOpenAI(characterDescription, 'front', supabase),
          generateCharacterViewOpenAI(characterDescription, 'side', supabase),
          generateCharacterViewOpenAI(characterDescription, 'three-quarter', supabase),
        ]);
      } catch (openaiError) {
        console.warn("[Identity Bible] OpenAI failed, trying Imagen fallback:", openaiError);
        throw openaiError; // Let it fall through to Imagen
      }
    } else {
      // Fallback to Vertex AI Imagen
      const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
      if (!serviceAccountJson) {
        throw new Error("Neither OPENAI_API_KEY nor GOOGLE_VERTEX_SERVICE_ACCOUNT is configured");
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      const projectId = serviceAccount.project_id;
      const accessToken = await getAccessToken(serviceAccount);

      [frontViewUrl, sideViewUrl, threeQuarterViewUrl] = await Promise.all([
        generateCharacterViewImagen(characterDescription, 'front', accessToken, projectId, supabase),
        generateCharacterViewImagen(characterDescription, 'side', accessToken, projectId, supabase),
        generateCharacterViewImagen(characterDescription, 'three-quarter', accessToken, projectId, supabase),
      ]);
    }

    // Extract key consistency anchors
    const consistencyAnchors = [
      characterDescription.match(/(?:skin tone|complexion)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:hair|hairstyle)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:eyes?|eye color)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:wearing|dressed|clothing)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:face|facial)[^,.]*/i)?.[0] || '',
    ].filter(Boolean);

    const result: IdentityBibleResult = {
      success: true,
      originalImageUrl,
      frontViewUrl,
      sideViewUrl,
      threeQuarterViewUrl,
      characterDescription,
      consistencyAnchors,
    };

    console.log("[Identity Bible] Generation complete:", {
      frontView: frontViewUrl,
      sideView: sideViewUrl,
      threeQuarterView: threeQuarterViewUrl,
      anchorsCount: consistencyAnchors.length,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Identity Bible] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
