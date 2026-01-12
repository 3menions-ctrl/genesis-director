import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract First Frame from Video
 * 
 * Uses Lovable AI (Gemini Vision) to analyze the first frame of a video
 * and generates a representative image URL or returns frame data.
 * 
 * This fills a critical gap in the stitching pipeline where we need
 * both first and last frames for accurate transition analysis.
 */

interface FrameExtractionRequest {
  videoUrl: string;
  shotId: string;
  projectId?: string;
  extractionMethod?: 'vision-describe' | 'cloud-run-ffmpeg';
}

interface FrameExtractionResult {
  success: boolean;
  frameUrl?: string;
  frameDescription?: string;
  extractionMethod: string;
  error?: string;
}

// Get Google Cloud access token
async function getAccessToken(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${headerB64}.${claimB64}`;

  const keyData = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(signatureInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Analyze first frame using Gemini Vision
async function analyzeFirstFrame(
  videoUrl: string,
  accessToken: string,
  projectId: string
): Promise<{ description: string; visualFingerprint: any }> {
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;

  const prompt = `Analyze the FIRST FRAME of this video and provide a detailed description for visual continuity purposes.

Focus on:
1. Camera angle and framing
2. Subject position and pose
3. Lighting conditions
4. Background elements
5. Color palette
6. Any text or UI elements visible
7. Motion blur or action indicators

Respond with JSON:
{
  "frameDescription": "Detailed description of what is visible in the first frame",
  "cameraAngle": "low/eye-level/high/aerial",
  "subjectPosition": "left/center/right/full-frame",
  "lightingType": "natural/artificial/dramatic/soft",
  "dominantColors": ["color1", "color2", "color3"],
  "motionIndicators": "static/entering-frame/mid-action/exiting-frame",
  "backgroundType": "indoor/outdoor/abstract/gradient",
  "promptFragment": "A single sentence describing this frame for video generation"
}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: "video/mp4",
              fileUri: videoUrl,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Vision API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse JSON from response
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      description: textContent,
      visualFingerprint: { raw: textContent },
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      description: parsed.frameDescription || textContent,
      visualFingerprint: parsed,
    };
  } catch {
    return {
      description: textContent,
      visualFingerprint: { raw: textContent },
    };
  }
}

// Try Cloud Run FFmpeg extraction
async function extractFrameViaCloudRun(
  videoUrl: string,
  shotId: string
): Promise<{ success: boolean; frameUrl?: string; error?: string }> {
  const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
  
  if (!cloudRunUrl) {
    return { success: false, error: "CLOUD_RUN_STITCHER_URL not configured" };
  }

  const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');
  
  try {
    // Check if Cloud Run has a frame extraction endpoint
    const response = await fetch(`${normalizedUrl}/extract-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl,
        framePosition: 'first', // Extract first frame
        outputFormat: 'jpeg',
        shotId,
      }),
    });

    if (!response.ok) {
      // Endpoint doesn't exist or failed
      return { success: false, error: `Cloud Run returned ${response.status}` };
    }

    const result = await response.json();
    return {
      success: true,
      frameUrl: result.frameUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Cloud Run extraction failed",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: FrameExtractionRequest = await req.json();
    const { videoUrl, shotId, projectId, extractionMethod = 'vision-describe' } = request;

    if (!videoUrl || !shotId) {
      throw new Error("videoUrl and shotId are required");
    }

    console.log(`[ExtractFirstFrame] Processing ${shotId} with method: ${extractionMethod}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: FrameExtractionResult;

    // Try Cloud Run first if available (returns actual image)
    if (extractionMethod === 'cloud-run-ffmpeg') {
      const cloudRunResult = await extractFrameViaCloudRun(videoUrl, shotId);
      
      if (cloudRunResult.success && cloudRunResult.frameUrl) {
        result = {
          success: true,
          frameUrl: cloudRunResult.frameUrl,
          extractionMethod: 'cloud-run-ffmpeg',
        };
      } else {
        // Fall back to vision description
        console.log(`[ExtractFirstFrame] Cloud Run failed, falling back to vision analysis`);
        result = await extractViaVision(videoUrl, shotId, projectId);
      }
    } else {
      // Use Gemini Vision to analyze and describe first frame
      result = await extractViaVision(videoUrl, shotId, projectId);
    }

    // Store the result in video_clips table if we have a description
    if (result.success && result.frameDescription) {
      try {
        // Check if we're querying by UUID or shotId
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shotId);
        
        const query = isUuid 
          ? supabase.from('video_clips').select('id').eq('id', shotId).single()
          : supabase.from('video_clips').select('id').eq('id', shotId).single();
        
        const { data: clipData } = await query;
        
        if (clipData) {
          // Store frame analysis in motion_vectors JSON (reusing existing column)
          const { data: existingClip } = await supabase
            .from('video_clips')
            .select('motion_vectors')
            .eq('id', clipData.id)
            .single();
          
          const existingVectors = (existingClip?.motion_vectors as Record<string, unknown>) || {};
          
          await supabase
            .from('video_clips')
            .update({
              motion_vectors: {
                ...existingVectors,
                firstFrameAnalysis: {
                  description: result.frameDescription,
                  extractedAt: new Date().toISOString(),
                },
              },
            })
            .eq('id', clipData.id);
        }
      } catch (dbError) {
        console.warn(`[ExtractFirstFrame] Failed to store in database:`, dbError);
      }
    }

    console.log(`[ExtractFirstFrame] Completed for ${shotId}: ${result.success ? 'success' : 'failed'}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ExtractFirstFrame] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Frame extraction failed",
        extractionMethod: 'none',
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function for vision-based extraction
async function extractViaVision(
  videoUrl: string,
  shotId: string,
  projectId?: string
): Promise<FrameExtractionResult> {
  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    
    if (!serviceAccountJson) {
      return {
        success: false,
        error: "GOOGLE_VERTEX_SERVICE_ACCOUNT not configured",
        extractionMethod: 'vision-describe',
      };
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);
    const gcpProjectId = serviceAccount.project_id;

    const analysis = await analyzeFirstFrame(videoUrl, accessToken, gcpProjectId);

    return {
      success: true,
      frameUrl: undefined, // Vision doesn't extract actual frame
      frameDescription: analysis.description,
      extractionMethod: 'vision-describe',
    };
  } catch (error) {
    console.error("[ExtractFirstFrame] Vision analysis error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vision analysis failed",
      extractionMethod: 'vision-describe',
    };
  }
}
