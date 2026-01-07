import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scene Anchor Extractor
 * 
 * Analyzes a frame/image to extract environment DNA:
 * - Lighting fingerprint
 * - Color palette
 * - Depth cues
 * - Key objects
 * - Motion signature (if video provided)
 * 
 * Uses Gemini Vision for comprehensive scene analysis.
 */

interface SceneAnchor {
  id: string;
  shotId: string;
  frameUrl: string;
  extractedAt: number;
  lighting: LightingFingerprint;
  colorPalette: ColorPalette;
  depthCues: DepthCues;
  keyObjects: KeyObjects;
  motionSignature: MotionSignature;
  masterConsistencyPrompt: string;
}

interface LightingFingerprint {
  keyLightDirection: string;
  keyLightIntensity: 'soft' | 'medium' | 'harsh';
  keyLightColor: string;
  fillRatio: number;
  ambientColor: string;
  shadowHardness: 'soft' | 'medium' | 'hard';
  shadowDirection: string;
  timeOfDay: 'golden-hour' | 'midday' | 'blue-hour' | 'night' | 'overcast' | 'indoor';
  promptFragment: string;
}

interface ColorPalette {
  dominant: { hex: string; percentage: number; name: string }[];
  accents: string[];
  temperature: 'warm' | 'neutral' | 'cool';
  saturation: 'muted' | 'natural' | 'vibrant';
  gradeStyle: string;
  promptFragment: string;
}

interface DepthCues {
  dofStyle: 'deep' | 'shallow' | 'rack-focus';
  focalPlane: 'foreground' | 'midground' | 'background';
  bokehQuality: string;
  atmosphericPerspective: boolean;
  fogHaze: 'none' | 'light' | 'medium' | 'heavy';
  foregroundElements: string[];
  midgroundElements: string[];
  backgroundElements: string[];
  perspectiveType: 'one-point' | 'two-point' | 'three-point' | 'isometric';
  vanishingPointLocation: string;
  promptFragment: string;
}

interface KeyObjects {
  objects: {
    id: string;
    name: string;
    description: string;
    position: 'left' | 'center' | 'right';
    depth: 'foreground' | 'midground' | 'background';
    importance: 'hero' | 'supporting' | 'environmental';
  }[];
  environmentType: 'interior' | 'exterior' | 'mixed';
  settingDescription: string;
  architecturalStyle: string;
  promptFragment: string;
}

interface MotionSignature {
  cameraMotionStyle: 'static' | 'subtle' | 'dynamic' | 'chaotic';
  preferredMovements: string[];
  subjectMotionIntensity: 'still' | 'subtle' | 'active' | 'intense';
  pacingTempo: 'slow' | 'medium' | 'fast';
  cutRhythm: string;
  promptFragment: string;
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

// Fetch image and convert to base64
async function imageToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// Analyze scene using Gemini Vision
async function analyzeScene(imageBase64: string, accessToken: string, projectId: string): Promise<SceneAnchor> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;
  
  const analysisPrompt = `Analyze this image as a film cinematographer. Extract the complete visual DNA for scene consistency.

Return a JSON object with this EXACT structure (no markdown, just JSON):
{
  "lighting": {
    "keyLightDirection": "description of main light source direction (e.g., 'top-left 45 degrees', 'direct frontal', 'backlit')",
    "keyLightIntensity": "soft" | "medium" | "harsh",
    "keyLightColor": "color description or hex (e.g., 'warm orange #FFA500')",
    "fillRatio": 0.0-1.0 (0 = high contrast dramatic, 1 = flat even lighting),
    "ambientColor": "ambient light color",
    "shadowHardness": "soft" | "medium" | "hard",
    "shadowDirection": "where shadows fall",
    "timeOfDay": "golden-hour" | "midday" | "blue-hour" | "night" | "overcast" | "indoor",
    "promptFragment": "Concise lighting description for AI prompt (e.g., 'dramatic golden hour backlighting with soft fill, warm orange tones')"
  },
  "colorPalette": {
    "dominant": [
      {"hex": "#HEXCODE", "percentage": 30, "name": "descriptive name"},
      {"hex": "#HEXCODE", "percentage": 25, "name": "descriptive name"},
      {"hex": "#HEXCODE", "percentage": 20, "name": "descriptive name"}
    ],
    "accents": ["#HEX1", "#HEX2"],
    "temperature": "warm" | "neutral" | "cool",
    "saturation": "muted" | "natural" | "vibrant",
    "gradeStyle": "color grading style (e.g., 'teal-orange blockbuster', 'desaturated noir', 'high-key commercial')",
    "promptFragment": "Color palette description for AI prompt (e.g., 'teal and orange color grading, warm skin tones, cool shadows')"
  },
  "depthCues": {
    "dofStyle": "deep" | "shallow" | "rack-focus",
    "focalPlane": "foreground" | "midground" | "background",
    "bokehQuality": "bokeh description (e.g., 'smooth circular bokeh', 'anamorphic oval bokeh')",
    "atmosphericPerspective": true/false,
    "fogHaze": "none" | "light" | "medium" | "heavy",
    "foregroundElements": ["list of foreground elements"],
    "midgroundElements": ["list of midground elements"],
    "backgroundElements": ["list of background elements"],
    "perspectiveType": "one-point" | "two-point" | "three-point" | "isometric",
    "vanishingPointLocation": "where perspective lines converge",
    "promptFragment": "Depth description for AI prompt (e.g., 'shallow depth of field, subject isolated, smooth background bokeh')"
  },
  "keyObjects": {
    "objects": [
      {
        "id": "unique_id",
        "name": "object name",
        "description": "detailed description",
        "position": "left" | "center" | "right",
        "depth": "foreground" | "midground" | "background",
        "importance": "hero" | "supporting" | "environmental"
      }
    ],
    "environmentType": "interior" | "exterior" | "mixed",
    "settingDescription": "overall setting description",
    "architecturalStyle": "architectural or environmental style",
    "promptFragment": "Environment description for AI prompt"
  },
  "motionSignature": {
    "cameraMotionStyle": "static" | "subtle" | "dynamic" | "chaotic",
    "preferredMovements": ["list of suggested camera movements that would fit this scene"],
    "subjectMotionIntensity": "still" | "subtle" | "active" | "intense",
    "pacingTempo": "slow" | "medium" | "fast",
    "cutRhythm": "suggested editing rhythm",
    "promptFragment": "Motion description for AI prompt (e.g., 'slow subtle camera drift, static subject')"
  }
}`;

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
              data: imageBase64
            }
          },
          { text: analysisPrompt }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.1 // Low temperature for consistent analysis
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Scene Anchor] Gemini error:", errorText);
    throw new Error(`Gemini analysis failed: ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Extract JSON from response
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  const analysis = JSON.parse(jsonStr);
  return analysis;
}

// Build master consistency prompt from all components
function buildMasterPrompt(analysis: any): string {
  const fragments = [
    analysis.lighting?.promptFragment,
    analysis.colorPalette?.promptFragment,
    analysis.depthCues?.promptFragment,
    analysis.keyObjects?.promptFragment,
    analysis.motionSignature?.promptFragment,
  ].filter(Boolean);
  
  return fragments.join('. ') + '.';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { frameUrl, shotId, projectId: requestProjectId } = await req.json();

    if (!frameUrl) {
      throw new Error("frameUrl is required");
    }

    console.log(`[Scene Anchor] Extracting from frame: ${frameUrl}`);

    // Get service account credentials
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const gcpProjectId = serviceAccount.project_id;

    // Get access token
    console.log("[Scene Anchor] Getting OAuth2 access token...");
    const accessToken = await getAccessToken(serviceAccount);

    // Convert image to base64
    console.log("[Scene Anchor] Fetching and encoding image...");
    const imageBase64 = await imageToBase64(frameUrl);

    // Analyze scene
    console.log("[Scene Anchor] Analyzing scene with Gemini Vision...");
    const analysis = await analyzeScene(imageBase64, accessToken, gcpProjectId);

    // Build master consistency prompt
    const masterPrompt = buildMasterPrompt(analysis);

    // Construct complete scene anchor
    const sceneAnchor: SceneAnchor = {
      id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      shotId: shotId || 'unknown',
      frameUrl,
      extractedAt: Date.now(),
      lighting: analysis.lighting,
      colorPalette: analysis.colorPalette,
      depthCues: analysis.depthCues,
      keyObjects: analysis.keyObjects,
      motionSignature: analysis.motionSignature,
      masterConsistencyPrompt: masterPrompt,
    };

    const processingTimeMs = Date.now() - startTime;
    
    console.log(`[Scene Anchor] Extraction complete in ${processingTimeMs}ms`);
    console.log(`[Scene Anchor] Master prompt: ${masterPrompt.substring(0, 200)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        anchor: sceneAnchor,
        processingTimeMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Scene Anchor] Error:", error);
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
