import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CLIP_DURATION = 4;

interface GenerateSingleClipRequest {
  userId: string;
  projectId: string;
  clipIndex: number;
  prompt: string;
  totalClips: number;
  startImageUrl?: string;
  previousMotionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
  identityBible?: {
    characterIdentity?: {
      description?: string;
      facialFeatures?: string;
      clothing?: string;
      bodyType?: string;
      distinctiveMarkers?: string[];
    };
    consistencyPrompt?: string;
    consistencyAnchors?: string[];
  };
  colorGrading?: string;
  qualityTier?: 'standard' | 'professional';
  referenceImageUrl?: string;
  // NEW: Aspect ratio from reference image orientation
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

interface ClipResult {
  index: number;
  videoUrl: string;
  lastFrameUrl?: string;
  durationSeconds: number;
  status: 'completed' | 'failed';
  error?: string;
  motionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
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
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Generate a single clip with Veo API
async function generateClip(
  accessToken: string,
  projectId: string,
  prompt: string,
  startImageUrl?: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9'
): Promise<{ operationName: string }> {
  const location = "us-central1";
  const model = "veo-3.1-generate-001";
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

  const instance: Record<string, any> = {
    prompt: `${prompt}. High quality, cinematic, realistic physics, natural motion, detailed textures.`,
  };

  if (startImageUrl) {
    try {
      console.log(`[SingleClip] Fetching start image for frame-chaining...`);
      const imageResponse = await fetch(startImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const uint8Array = new Uint8Array(imageBuffer);
      
      let binary = '';
      const chunkSize = 32768;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Image = btoa(binary);
      
      const mimeType = startImageUrl.includes('.png') ? 'image/png' : 
                      startImageUrl.includes('.webp') ? 'image/webp' : 'image/jpeg';
      
      instance.image = {
        bytesBase64Encoded: base64Image,
        mimeType: mimeType
      };
      console.log(`[SingleClip] Added start image for frame-chaining`);
    } catch (imgError) {
      console.error("[SingleClip] Failed to fetch start image:", imgError);
    }
  }

  const requestBody = {
    instances: [instance],
    parameters: {
      aspectRatio: aspectRatio, // Dynamic based on reference image orientation
      durationSeconds: DEFAULT_CLIP_DURATION,
      sampleCount: 1,
      negativePrompt: "blurry, low quality, distorted, artifacts, watermark, text overlay, glitch, jittery motion",
      resolution: "720p",
      personGeneration: "allow_adult",
    }
  };
  
  console.log(`[SingleClip] Using aspect ratio: ${aspectRatio}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Veo API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const operationName = result.name;
  
  if (!operationName) {
    throw new Error("No operation name in Veo response");
  }

  return { operationName };
}

// Poll for operation completion
async function pollOperation(
  accessToken: string,
  operationName: string,
  maxAttempts = 120,
  pollInterval = 5000
): Promise<{ videoUrl: string }> {
  const match = operationName.match(/projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/);
  if (!match) {
    throw new Error(`Invalid operation name format: ${operationName}`);
  }
  
  const [, projectId, location, modelId] = match;
  const fetchOperationUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const response = await fetch(fetchOperationUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationName }),
    });
    
    if (!response.ok) {
      console.log(`[SingleClip] Poll attempt ${attempt + 1}: ${response.status}`);
      continue;
    }
    
    const result = await response.json();
    
    if (result.done) {
      if (result.error) {
        throw new Error(`Veo generation failed: ${result.error.message}`);
      }
      
      if (result.response?.raiMediaFilteredCount > 0) {
        throw new Error("Content filter blocked generation. Prompt needs rephrasing.");
      }
      
      let videoUri = result.response?.generatedSamples?.[0]?.video?.uri ||
                     result.response?.videos?.[0]?.gcsUri ||
                     result.response?.videos?.[0]?.uri;
      
      if (!videoUri) {
        const base64Data = result.response?.videos?.[0]?.bytesBase64Encoded ||
                          result.response?.generatedSamples?.[0]?.video?.bytesBase64Encoded;
        if (base64Data) {
          console.log(`[SingleClip] Video returned as base64 (${base64Data.length} chars)`);
          return { videoUrl: "base64:" + base64Data };
        }
        throw new Error("No video URI in completed response");
      }
      
      const videoUrl = videoUri.startsWith("gs://") 
        ? `https://storage.googleapis.com/${videoUri.slice(5)}`
        : videoUri;
      
      console.log(`[SingleClip] Clip completed: ${videoUrl.substring(0, 80)}...`);
      return { videoUrl };
    }
    
    const progress = result.metadata?.progressPercent || 0;
    console.log(`[SingleClip] Poll attempt ${attempt + 1}: ${progress}% complete`);
  }
  
  throw new Error("Operation timed out after maximum polling attempts");
}

// Download video to Supabase storage
async function downloadToStorage(
  supabase: any,
  videoUrl: string,
  projectId: string,
  clipIndex: number
): Promise<string> {
  const fileName = `clip_${projectId}_${clipIndex}_${Date.now()}.mp4`;
  let bytes: Uint8Array;
  
  if (videoUrl.startsWith("base64:")) {
    const base64Data = videoUrl.slice(7);
    console.log(`[SingleClip] Converting base64 video to storage (${base64Data.length} chars)`);
    bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  } else if (videoUrl.startsWith("data:")) {
    const matches = videoUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!matches) throw new Error("Invalid data URL format");
    bytes = Uint8Array.from(atob(matches[1]), c => c.charCodeAt(0));
  } else {
    console.log(`[SingleClip] Downloading video from: ${videoUrl.substring(0, 80)}...`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }
    const videoBuffer = await response.arrayBuffer();
    bytes = new Uint8Array(videoBuffer);
  }
  
  console.log(`[SingleClip] Uploading ${bytes.length} bytes to storage`);
  
  const { error } = await supabase.storage
    .from('video-clips')
    .upload(fileName, bytes, {
      contentType: 'video/mp4',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload clip to storage: ${error.message}`);
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${fileName}`;
  console.log(`[SingleClip] Clip stored: ${publicUrl}`);
  return publicUrl;
}

// Extract motion vectors from prompt
function extractMotionVectors(prompt: string): ClipResult['motionVectors'] {
  type MovementVectors = { velocity: string; direction: string; camera?: string };
  const movements: Record<string, MovementVectors> = {
    walk: { velocity: 'moderate walking pace', direction: 'forward' },
    run: { velocity: 'rapid sprint', direction: 'forward' },
    pan: { velocity: 'slow', direction: 'lateral', camera: 'panning' },
    dolly: { velocity: 'smooth glide', direction: 'forward', camera: 'dolly' },
    static: { velocity: 'stationary', direction: 'none', camera: 'locked' },
    fly: { velocity: 'soaring', direction: 'upward' },
    chase: { velocity: 'rapid pursuit', direction: 'forward' },
  };
  
  const promptLower = prompt.toLowerCase();
  
  for (const [key, vectors] of Object.entries(movements)) {
    if (promptLower.includes(key)) {
      return {
        endVelocity: vectors.velocity,
        endDirection: vectors.direction,
        cameraMomentum: vectors.camera || 'following',
      };
    }
  }
  
  return {
    endVelocity: 'steady',
    endDirection: 'continuous',
    cameraMomentum: 'smooth transition',
  };
}

// Build velocity-aware prompt
function injectVelocityContinuity(
  prompt: string,
  previousMotionVectors?: ClipResult['motionVectors']
): string {
  if (!previousMotionVectors) return prompt;
  
  const continuityPrefix = `[MOTION CONTINUITY: Subject maintains ${previousMotionVectors.endVelocity} moving ${previousMotionVectors.endDirection}, camera ${previousMotionVectors.cameraMomentum}]`;
  return `${continuityPrefix} ${prompt}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: GenerateSingleClipRequest = await req.json();
    
    console.log(`[SingleClip] Generating clip ${request.clipIndex + 1}/${request.totalClips} for project ${request.projectId}`);
    
    if (!request.userId || !request.projectId) {
      throw new Error("userId and projectId are required");
    }
    
    if (request.clipIndex === undefined || !request.prompt) {
      throw new Error("clipIndex and prompt are required");
    }

    // Get service account
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error("Invalid GOOGLE_VERTEX_SERVICE_ACCOUNT JSON format");
    }

    const gcpProjectId = serviceAccount.project_id;
    if (!gcpProjectId) {
      throw new Error("project_id not found in service account");
    }

    // Build enhanced prompt with identity and motion continuity
    let enhancedPrompt = request.prompt;
    
    if (request.identityBible?.consistencyPrompt) {
      enhancedPrompt = `[IDENTITY: ${request.identityBible.consistencyPrompt}] ${enhancedPrompt}`;
    }
    
    if (request.identityBible?.consistencyAnchors?.length) {
      enhancedPrompt = `[ANCHORS: ${request.identityBible.consistencyAnchors.join(', ')}] ${enhancedPrompt}`;
    }
    
    if (request.identityBible?.characterIdentity) {
      const ci = request.identityBible.characterIdentity;
      const identityParts = [
        ci.description,
        ci.clothing,
        ci.distinctiveMarkers?.join(', ')
      ].filter(Boolean).join('. ');
      if (identityParts) {
        enhancedPrompt = `${enhancedPrompt}. [CHARACTER: ${identityParts}]`;
      }
    }
    
    // Inject velocity continuity from previous clip
    const velocityAwarePrompt = injectVelocityContinuity(enhancedPrompt, request.previousMotionVectors);
    
    console.log(`[SingleClip] Enhanced prompt: ${velocityAwarePrompt.substring(0, 100)}...`);

    // Mark clip as generating
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'generating',
    });

    // Get OAuth access token
    const accessToken = await getAccessToken(serviceAccount);
    console.log("[SingleClip] OAuth access token obtained");

    // Generate clip with Veo - use aspect ratio from request or default to 16:9
    const aspectRatio = request.aspectRatio || '16:9';
    console.log(`[SingleClip] Using aspect ratio from request: ${aspectRatio}`);
    
    const { operationName } = await generateClip(
      accessToken,
      gcpProjectId,
      velocityAwarePrompt,
      request.startImageUrl,
      aspectRatio
    );
    
    console.log(`[SingleClip] Operation started: ${operationName}`);
    
    // Save operation name
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'generating',
      p_veo_operation_name: operationName,
    });

    // Poll for completion
    const { videoUrl: rawVideoUrl } = await pollOperation(accessToken, operationName);
    console.log(`[SingleClip] Clip completed: ${rawVideoUrl.substring(0, 80)}...`);
    
    // Download to storage
    const storedUrl = await downloadToStorage(supabase, rawVideoUrl, request.projectId, request.clipIndex);
    console.log(`[SingleClip] Clip stored: ${storedUrl}`);
    
    // Extract last frame for next clip's continuity
    let lastFrameUrl: string | undefined;
    const stitcherUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    if (stitcherUrl) {
      try {
        const response = await fetch(`${stitcherUrl}/extract-frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: storedUrl,
            clipIndex: request.clipIndex,
            projectId: request.projectId,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          lastFrameUrl = result.lastFrameUrl;
          console.log(`[SingleClip] Frame extracted for chaining`);
        }
      } catch (frameError) {
        console.warn(`[SingleClip] Frame extraction failed:`, frameError);
      }
    }
    
    // Extract motion vectors for next clip
    const motionVectors = extractMotionVectors(request.prompt);
    console.log(`[SingleClip] Motion vectors:`, motionVectors);
    
    // Mark clip as completed
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'completed',
      p_video_url: storedUrl,
      p_last_frame_url: lastFrameUrl,
      p_motion_vectors: JSON.stringify(motionVectors),
    });

    const clipResult: ClipResult = {
      index: request.clipIndex,
      videoUrl: storedUrl,
      lastFrameUrl,
      durationSeconds: DEFAULT_CLIP_DURATION,
      status: 'completed',
      motionVectors,
    };

    console.log(`[SingleClip] Clip ${request.clipIndex + 1} completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        clipResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SingleClip] Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
