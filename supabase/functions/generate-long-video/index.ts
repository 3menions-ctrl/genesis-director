import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIP_DURATION = 4; // seconds per clip
const TOTAL_CLIPS = 6; // 6 clips = 24 seconds total
const CREDITS_COST = 300; // Credits for 24-second video

interface ClipPrompt {
  index: number;
  prompt: string;
  sceneContext?: Record<string, any>;
}

interface GenerationRequest {
  userId: string;
  projectId: string;
  clips: ClipPrompt[];
  referenceImageUrl?: string;
}

interface ClipResult {
  index: number;
  videoUrl: string;
  lastFrameUrl?: string;
  durationSeconds: number;
  status: 'completed' | 'failed';
  error?: string;
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

// Generate a single 4-second clip with Veo API
async function generateClip(
  accessToken: string,
  projectId: string,
  prompt: string,
  startImageUrl?: string
): Promise<{ operationName: string }> {
  const location = "us-central1";
  const model = "veo-3.1-generate-001";
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

  const instance: Record<string, any> = {
    prompt: `${prompt}. High quality, cinematic, realistic physics, natural motion, detailed textures.`,
  };

  // Add start image for frame-chaining (image-to-video)
  if (startImageUrl) {
    try {
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
      console.log(`[LongVideo] Added start image for frame-chaining`);
    } catch (imgError) {
      console.error("[LongVideo] Failed to fetch start image:", imgError);
    }
  }

  const requestBody = {
    instances: [instance],
    parameters: {
      aspectRatio: "16:9",
      durationSeconds: CLIP_DURATION,
      sampleCount: 1,
      negativePrompt: "blurry, low quality, distorted, artifacts, watermark, text overlay, glitch, jittery motion",
      resolution: "720p",
      personGeneration: "allow_adult",
    }
  };

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
  maxAttempts = 120, // 10 minutes max
  pollInterval = 5000 // 5 seconds
): Promise<{ videoUrl: string }> {
  const operationUrl = `https://us-central1-aiplatform.googleapis.com/v1/${operationName}`;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const response = await fetch(operationUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      console.log(`[LongVideo] Poll attempt ${attempt + 1}: ${response.status}`);
      continue;
    }
    
    const result = await response.json();
    
    if (result.done) {
      if (result.error) {
        throw new Error(`Veo generation failed: ${result.error.message}`);
      }
      
      const videoUri = result.response?.generatedSamples?.[0]?.video?.uri ||
                       result.response?.predictions?.[0]?.video?.uri;
      
      if (!videoUri) {
        throw new Error("No video URI in completed response");
      }
      
      // Convert gs:// to HTTPS URL
      const videoUrl = videoUri.startsWith("gs://") 
        ? `https://storage.googleapis.com/${videoUri.slice(5)}`
        : videoUri;
      
      return { videoUrl };
    }
    
    console.log(`[LongVideo] Poll attempt ${attempt + 1}: still processing...`);
  }
  
  throw new Error("Operation timed out after maximum polling attempts");
}

// Download video to Supabase storage and return public URL
async function downloadToStorage(
  supabase: any,
  videoUrl: string,
  projectId: string,
  clipIndex: number
): Promise<string> {
  const response = await fetch(videoUrl);
  const videoBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(videoBuffer);
  
  const fileName = `long_video_${projectId}_clip_${clipIndex}_${Date.now()}.mp4`;
  
  const { error } = await supabase.storage
    .from('voice-tracks') // Reuse existing bucket for video clips
    .upload(fileName, bytes, {
      contentType: 'video/mp4',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload clip to storage: ${error.message}`);
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/storage/v1/object/public/voice-tracks/${fileName}`;
}

// Send clip to stitcher for frame-chaining
async function sendToStitcher(
  stitcherUrl: string,
  clipUrl: string,
  clipIndex: number,
  nextPrompt?: string,
  projectId?: string
): Promise<{ lastFrameUrl?: string; stitchedUrl?: string }> {
  console.log(`[LongVideo] Sending clip ${clipIndex} to stitcher for frame extraction`);
  
  const response = await fetch(`${stitcherUrl}/stitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: projectId,
      clipUrl: clipUrl,
      clipIndex: clipIndex,
      nextPrompt: nextPrompt,
      extractLastFrame: true, // Request last frame for next clip
      isFinalClip: clipIndex === TOTAL_CLIPS - 1,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stitcher error: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  return {
    lastFrameUrl: result.lastFrameUrl,
    stitchedUrl: result.stitchedVideoUrl,
  };
}

// Main sequential generation with frame-chaining
async function generateLongVideo(
  request: GenerationRequest,
  supabase: any,
  accessToken: string,
  gcpProjectId: string,
  stitcherUrl: string
): Promise<{ finalVideoUrl: string; clipResults: ClipResult[] }> {
  const clipResults: ClipResult[] = [];
  let previousLastFrameUrl: string | undefined = request.referenceImageUrl;
  
  console.log(`[LongVideo] Starting sequential generation of ${TOTAL_CLIPS} clips`);
  
  for (let i = 0; i < request.clips.length && i < TOTAL_CLIPS; i++) {
    const clip = request.clips[i];
    console.log(`[LongVideo] Generating clip ${i + 1}/${TOTAL_CLIPS}: ${clip.prompt.substring(0, 50)}...`);
    
    try {
      // Step 1: Generate clip with Veo (using previous frame for continuity)
      const { operationName } = await generateClip(
        accessToken,
        gcpProjectId,
        clip.prompt,
        previousLastFrameUrl
      );
      
      console.log(`[LongVideo] Clip ${i + 1} operation started: ${operationName}`);
      
      // Step 2: Poll for completion
      const { videoUrl: rawVideoUrl } = await pollOperation(accessToken, operationName);
      console.log(`[LongVideo] Clip ${i + 1} completed: ${rawVideoUrl}`);
      
      // Step 3: Download to Supabase storage
      const storedUrl = await downloadToStorage(supabase, rawVideoUrl, request.projectId, i);
      console.log(`[LongVideo] Clip ${i + 1} stored: ${storedUrl}`);
      
      // Step 4: Send to stitcher for frame-chaining
      const nextPrompt = request.clips[i + 1]?.prompt;
      const stitcherResult = await sendToStitcher(
        stitcherUrl,
        storedUrl,
        i,
        nextPrompt,
        request.projectId
      );
      
      // Update last frame for next clip's continuity
      if (stitcherResult.lastFrameUrl) {
        previousLastFrameUrl = stitcherResult.lastFrameUrl;
        console.log(`[LongVideo] Frame chain updated for clip ${i + 2}`);
      }
      
      clipResults.push({
        index: i,
        videoUrl: storedUrl,
        lastFrameUrl: stitcherResult.lastFrameUrl,
        durationSeconds: CLIP_DURATION,
        status: 'completed',
      });
      
    } catch (error) {
      console.error(`[LongVideo] Clip ${i + 1} failed:`, error);
      clipResults.push({
        index: i,
        videoUrl: '',
        durationSeconds: CLIP_DURATION,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with remaining clips even if one fails
    }
  }
  
  // Step 5: Request final assembly from stitcher
  console.log(`[LongVideo] Requesting final assembly of ${clipResults.filter(c => c.status === 'completed').length} clips`);
  
  const finalAssemblyResponse = await fetch(`${stitcherUrl}/stitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: request.projectId,
      projectTitle: `Long Video - ${request.projectId}`,
      clips: clipResults
        .filter(c => c.status === 'completed')
        .map(c => ({
          shotId: `clip_${c.index}`,
          videoUrl: c.videoUrl,
          durationSeconds: c.durationSeconds,
          transitionOut: 'continuous',
        })),
      audioMixMode: 'full',
      outputFormat: 'mp4',
      isFinalAssembly: true,
    }),
  });
  
  if (!finalAssemblyResponse.ok) {
    const error = await finalAssemblyResponse.text();
    throw new Error(`Final assembly failed: ${error}`);
  }
  
  const finalResult = await finalAssemblyResponse.json();
  
  if (!finalResult.success || !finalResult.finalVideoUrl) {
    throw new Error(finalResult.error || "Final assembly returned no video URL");
  }
  
  return {
    finalVideoUrl: finalResult.finalVideoUrl,
    clipResults,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: GenerationRequest = await req.json();
    
    if (!request.userId || !request.projectId) {
      throw new Error("userId and projectId are required");
    }
    
    if (!request.clips || request.clips.length < TOTAL_CLIPS) {
      throw new Error(`Exactly ${TOTAL_CLIPS} clip prompts are required for 24-second video`);
    }

    // Check for required secrets
    const stitcherUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    if (!stitcherUrl) {
      throw new Error("CLOUD_RUN_STITCHER_URL is not configured");
    }

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

    // Pre-check credits before starting (300 credits required)
    console.log(`[LongVideo] Checking credits for user ${request.userId}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_balance')
      .eq('id', request.userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Failed to fetch user profile");
    }

    if (profile.credits_balance < CREDITS_COST) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient credits. Required: ${CREDITS_COST}, Available: ${profile.credits_balance}`,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[LongVideo] Starting long video generation for project ${request.projectId}`);
    console.log(`[LongVideo] User ${request.userId} has ${profile.credits_balance} credits`);

    // Get OAuth access token
    const accessToken = await getAccessToken(serviceAccount);
    console.log("[LongVideo] OAuth access token obtained");

    // Run the sequential generation
    const { finalVideoUrl, clipResults } = await generateLongVideo(
      request,
      supabase,
      accessToken,
      gcpProjectId,
      stitcherUrl
    );

    const completedClips = clipResults.filter(c => c.status === 'completed').length;
    console.log(`[LongVideo] Generation complete: ${completedClips}/${TOTAL_CLIPS} clips successful`);

    // Deduct credits only on success
    if (completedClips === TOTAL_CLIPS) {
      console.log(`[LongVideo] Deducting ${CREDITS_COST} credits from user ${request.userId}`);
      
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: request.userId,
        p_amount: CREDITS_COST,
        p_description: `24-second video generation (${TOTAL_CLIPS} clips)`,
        p_project_id: request.projectId,
        p_clip_duration: 24,
      });

      if (deductError) {
        console.error("[LongVideo] Credit deduction failed:", deductError);
        // Don't fail the response - video was generated successfully
      } else {
        console.log(`[LongVideo] Credits deducted successfully`);
      }
    }

    // Update project with final video URL
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({
        video_url: finalVideoUrl,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.projectId);

    if (updateError) {
      console.error("[LongVideo] Failed to update project:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        finalVideoUrl,
        durationSeconds: completedClips * CLIP_DURATION,
        clipsGenerated: completedClips,
        totalClips: TOTAL_CLIPS,
        creditsCharged: completedClips === TOTAL_CLIPS ? CREDITS_COST : 0,
        clipResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[LongVideo] Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
