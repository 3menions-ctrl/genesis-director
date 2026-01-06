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
 * Uses Vertex AI Imagen for consistent character generation.
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

// Get OAuth2 access token from service account
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

// Analyze image to extract character description using Gemini
async function analyzeCharacter(imageUrl: string, accessToken: string, projectId: string): Promise<string> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;
  
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
          {
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
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    console.error("Gemini analysis error:", await response.text());
    throw new Error("Failed to analyze character");
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Generate a character view using Imagen
async function generateCharacterView(
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

  console.log(`[Identity Bible] Generating ${viewType} view...`);

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

  if (uploadError) {
    console.error(`[Identity Bible] Upload error for ${viewType}:`, uploadError);
    throw uploadError;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/character-references/${fileName}`;
  
  console.log(`[Identity Bible] ${viewType} view uploaded:`, publicUrl);
  return publicUrl;
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

    // Get service account credentials
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get access token
    console.log("[Identity Bible] Getting OAuth2 access token...");
    const accessToken = await getAccessToken(serviceAccount);

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

    // Step 1: Analyze the character
    console.log("[Identity Bible] Analyzing character from reference image...");
    const characterDescription = await analyzeCharacter(originalImageUrl, accessToken, projectId);
    console.log("[Identity Bible] Character description:", characterDescription.substring(0, 200) + "...");

    // Step 2: Generate all three views in parallel
    console.log("[Identity Bible] Generating 3-point identity views...");
    const [frontViewUrl, sideViewUrl, threeQuarterViewUrl] = await Promise.all([
      generateCharacterView(characterDescription, 'front', accessToken, projectId, supabase),
      generateCharacterView(characterDescription, 'side', accessToken, projectId, supabase),
      generateCharacterView(characterDescription, 'three-quarter', accessToken, projectId, supabase),
    ]);

    // Extract key consistency anchors
    const consistencyAnchors = [
      characterDescription.match(/(?:skin tone|complexion)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:hair|hairstyle)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:eyes?|eye color)[^,.]*/i)?.[0] || '',
      characterDescription.match(/(?:wearing|dressed|clothing)[^,.]*/i)?.[0] || '',
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
