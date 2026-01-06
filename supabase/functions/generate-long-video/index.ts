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

interface IdentityBible {
  characterIdentity?: {
    description?: string;
    facialFeatures?: string;
    clothing?: string;
    bodyType?: string;
    distinctiveMarkers?: string[];
  };
  consistencyPrompt?: string;
  // Multi-view character references for visual consistency
  multiViewUrls?: {
    frontViewUrl: string;
    sideViewUrl: string;
    threeQuarterViewUrl: string;
  };
  consistencyAnchors?: string[];
}

interface GenerationRequest {
  userId: string;
  projectId: string;
  clips: ClipPrompt[];
  referenceImageUrl?: string;
  colorGrading?: string; // cinematic, warm, cool, neutral, documentary
  identityBible?: IdentityBible; // From Hollywood pipeline (with multi-view URLs)
  // Audio tracks for final assembly (passed from Hollywood pipeline)
  voiceTrackUrl?: string;
  musicTrackUrl?: string;
  // Quality options
  qualityTier?: 'standard' | 'professional'; // professional tier enables visual debugger
  maxRetries?: number; // Shot-level retry count (default: 2)
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

// Poll for operation completion using fetchPredictOperation endpoint
async function pollOperation(
  accessToken: string,
  operationName: string,
  maxAttempts = 120, // 10 minutes max
  pollInterval = 5000 // 5 seconds
): Promise<{ videoUrl: string }> {
  // Extract components from operation name
  // Format: projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{operation_id}
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
      console.log(`[LongVideo] Poll attempt ${attempt + 1}: ${response.status}`);
      continue;
    }
    
    const result = await response.json();
    
    if (result.done) {
      if (result.error) {
        throw new Error(`Veo generation failed: ${result.error.message}`);
      }
      
      // Check for content filter blocking
      if (result.response?.raiMediaFilteredCount > 0) {
        throw new Error("Content filter blocked generation. Prompt needs rephrasing.");
      }
      
      // Extract video URL from various response formats
      let videoUri = result.response?.generatedSamples?.[0]?.video?.uri ||
                     result.response?.videos?.[0]?.gcsUri ||
                     result.response?.videos?.[0]?.uri;
      
      if (!videoUri) {
        // Check for base64 encoded video
        const base64Data = result.response?.videos?.[0]?.bytesBase64Encoded ||
                          result.response?.generatedSamples?.[0]?.video?.bytesBase64Encoded;
        if (base64Data) {
          console.log(`[LongVideo] Video returned as base64 (${base64Data.length} chars)`);
          return { videoUrl: "base64:" + base64Data };
        }
        throw new Error("No video URI in completed response");
      }
      
      // Convert gs:// to HTTPS URL
      const videoUrl = videoUri.startsWith("gs://") 
        ? `https://storage.googleapis.com/${videoUri.slice(5)}`
        : videoUri;
      
      console.log(`[LongVideo] Clip completed: ${videoUrl.substring(0, 80)}...`);
      return { videoUrl };
    }
    
    const progress = result.metadata?.progressPercent || 0;
    console.log(`[LongVideo] Poll attempt ${attempt + 1}: ${progress}% complete`);
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
  const fileName = `long_video_${projectId}_clip_${clipIndex}_${Date.now()}.mp4`;
  let bytes: Uint8Array;
  
  // Handle base64 encoded video from Veo
  if (videoUrl.startsWith("base64:")) {
    const base64Data = videoUrl.slice(7); // Remove "base64:" prefix
    console.log(`[LongVideo] Converting base64 video to storage (${base64Data.length} chars)`);
    bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  } else if (videoUrl.startsWith("data:")) {
    // Handle data URL format
    const matches = videoUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!matches) throw new Error("Invalid data URL format");
    bytes = Uint8Array.from(atob(matches[1]), c => c.charCodeAt(0));
  } else {
    // Regular HTTP URL - download the video
    console.log(`[LongVideo] Downloading video from: ${videoUrl.substring(0, 80)}...`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }
    const videoBuffer = await response.arrayBuffer();
    bytes = new Uint8Array(videoBuffer);
  }
  
  console.log(`[LongVideo] Uploading ${bytes.length} bytes to storage`);
  
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
  console.log(`[LongVideo] Clip ${clipIndex} stored: ${publicUrl}`);
  return publicUrl;
}

// Extract motion vectors from prompt for velocity continuity
function extractMotionVectors(prompt: string, clipIndex: number): ClipResult['motionVectors'] {
  // Parse movement keywords from prompt
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
  
  // Default vectors for continuity
  return {
    endVelocity: 'steady',
    endDirection: 'continuous',
    cameraMomentum: 'smooth transition',
  };
}

// Build velocity-aware prompt for seamless transitions
function injectVelocityContinuity(
  prompt: string,
  previousMotionVectors?: ClipResult['motionVectors']
): string {
  if (!previousMotionVectors) return prompt;
  
  const continuityPrefix = `[MOTION CONTINUITY: Subject maintains ${previousMotionVectors.endVelocity} moving ${previousMotionVectors.endDirection}, camera ${previousMotionVectors.cameraMomentum}]`;
  return `${continuityPrefix} ${prompt}`;
}

// Main sequential generation with frame-chaining, velocity vectoring, and checkpoint recovery
async function generateLongVideo(
  request: GenerationRequest,
  supabase: any,
  accessToken: string,
  gcpProjectId: string,
  stitcherUrl: string
): Promise<{ finalVideoUrl: string; clipResults: ClipResult[]; resumedFrom: number }> {
  const clipResults: ClipResult[] = [];
  let resumedFrom = 0;
  
  console.log(`[LongVideo] Checking for existing checkpoint...`);
  
  // Pre-flight check: Get checkpoint state
  const { data: checkpoint, error: checkpointError } = await supabase
    .rpc('get_generation_checkpoint', { p_project_id: request.projectId });
  
  let previousLastFrameUrl: string | undefined = request.referenceImageUrl;
  let startIndex = 0;
  
  if (!checkpointError && checkpoint && checkpoint.length > 0) {
    const cp = checkpoint[0];
    if (cp.last_completed_index >= 0) {
      startIndex = cp.last_completed_index + 1;
      previousLastFrameUrl = cp.last_frame_url || request.referenceImageUrl;
      resumedFrom = startIndex;
      console.log(`[LongVideo] Resuming from checkpoint: clip ${startIndex + 1}, using frame: ${previousLastFrameUrl?.substring(0, 50)}...`);
      
      // Load existing completed clips
      const { data: existingClips } = await supabase
        .from('video_clips')
        .select('*')
        .eq('project_id', request.projectId)
        .eq('status', 'completed')
        .order('shot_index', { ascending: true });
      
      if (existingClips) {
        for (const clip of existingClips) {
          clipResults.push({
            index: clip.shot_index,
            videoUrl: clip.video_url,
            lastFrameUrl: clip.last_frame_url,
            durationSeconds: clip.duration_seconds || CLIP_DURATION,
            status: 'completed',
          });
        }
        console.log(`[LongVideo] Loaded ${existingClips.length} completed clips from checkpoint`);
      }
    }
  }
  
  console.log(`[LongVideo] Starting sequential generation from clip ${startIndex + 1} to ${TOTAL_CLIPS}`);
  
  // Track previous motion vectors for velocity continuity
  let previousMotionVectors: ClipResult['motionVectors'] | undefined;
  
  for (let i = startIndex; i < request.clips.length && i < TOTAL_CLIPS; i++) {
    const clip = request.clips[i];
    console.log(`[LongVideo] Generating clip ${i + 1}/${TOTAL_CLIPS}: ${clip.prompt.substring(0, 50)}...`);
    
    // IDENTITY BIBLE: Inject character consistency anchors
    let enhancedPrompt = clip.prompt;
    if (request.identityBible?.consistencyPrompt) {
      enhancedPrompt = `[IDENTITY: ${request.identityBible.consistencyPrompt}] ${enhancedPrompt}`;
    }
    
    // Inject consistency anchors (skin tone, hair, eyes, clothing)
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
    
    // Log multi-view URL availability for debugging
    if (request.identityBible?.multiViewUrls && i === 0) {
      console.log(`[LongVideo] Multi-view identity references available:`, {
        front: request.identityBible.multiViewUrls.frontViewUrl?.substring(0, 50),
        side: request.identityBible.multiViewUrls.sideViewUrl?.substring(0, 50),
        threeQuarter: request.identityBible.multiViewUrls.threeQuarterViewUrl?.substring(0, 50),
      });
    }
    
    // VELOCITY VECTORING: Inject motion continuity from previous clip
    const velocityAwarePrompt = injectVelocityContinuity(enhancedPrompt, previousMotionVectors);
    
    // Upsert clip as 'generating' (idempotent)
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: i,
      p_prompt: velocityAwarePrompt,
      p_status: 'generating',
    });
    
    try {
      // Step 1: Generate clip with Veo (using previous frame AND velocity-aware prompt)
      const { operationName } = await generateClip(
        accessToken,
        gcpProjectId,
        velocityAwarePrompt,
        previousLastFrameUrl
      );
      
      console.log(`[LongVideo] Clip ${i + 1} operation started: ${operationName}`);
      
      // Save operation name for potential resume
      await supabase.rpc('upsert_video_clip', {
        p_project_id: request.projectId,
        p_user_id: request.userId,
        p_shot_index: i,
        p_prompt: velocityAwarePrompt,
        p_status: 'generating',
        p_veo_operation_name: operationName,
      });
      
      // Step 2: Poll for completion
      const { videoUrl: rawVideoUrl } = await pollOperation(accessToken, operationName);
      console.log(`[LongVideo] Clip ${i + 1} completed: ${rawVideoUrl}`);
      
      // Step 3: Download to Supabase storage
      const storedUrl = await downloadToStorage(supabase, rawVideoUrl, request.projectId, i);
      console.log(`[LongVideo] Clip ${i + 1} stored: ${storedUrl}`);
      
      // Step 4: Send to stitcher for frame extraction
      const nextPrompt = request.clips[i + 1]?.prompt;
      let stitcherResult = { lastFrameUrl: undefined as string | undefined };
      
      try {
        const response = await fetch(`${stitcherUrl}/extract-frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipUrl: storedUrl,
            clipIndex: i,
            projectId: request.projectId,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          stitcherResult.lastFrameUrl = result.lastFrameUrl;
        }
      } catch (frameError) {
        console.warn(`[LongVideo] Frame extraction failed, continuing without:`, frameError);
      }
      
      // Update last frame for next clip's continuity
      if (stitcherResult.lastFrameUrl) {
        previousLastFrameUrl = stitcherResult.lastFrameUrl;
        console.log(`[LongVideo] Frame chain updated for clip ${i + 2}`);
      }
      
      // VELOCITY VECTORING: Extract motion vectors for next clip
      const motionVectors = extractMotionVectors(clip.prompt, i);
      previousMotionVectors = motionVectors;
      console.log(`[LongVideo] Motion vectors for clip ${i + 1}:`, motionVectors);
      
      // Mark clip as completed in DB with motion vectors
      await supabase.rpc('upsert_video_clip', {
        p_project_id: request.projectId,
        p_user_id: request.userId,
        p_shot_index: i,
        p_prompt: velocityAwarePrompt,
        p_status: 'completed',
        p_video_url: storedUrl,
        p_last_frame_url: stitcherResult.lastFrameUrl,
        p_motion_vectors: JSON.stringify(motionVectors),
      });
      
      // VISUAL DEBUGGER: Run QA check for professional tier
      let qaResult = null;
      if (request.qualityTier === 'professional' && stitcherResult.lastFrameUrl) {
        try {
          console.log(`[LongVideo] Running visual debugger QA for clip ${i + 1}...`);
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          const debugResponse = await fetch(`${supabaseUrl}/functions/v1/visual-debugger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              videoUrl: storedUrl,
              frameUrl: stitcherResult.lastFrameUrl,
              shotDescription: clip.prompt,
              shotId: `clip_${i}`,
              projectType: request.colorGrading || 'cinematic',
              referenceImageUrl: request.referenceImageUrl,
              referenceAnalysis: request.identityBible?.characterIdentity ? {
                characterIdentity: request.identityBible.characterIdentity,
              } : undefined,
            }),
          });
          
          if (debugResponse.ok) {
            qaResult = await debugResponse.json();
            console.log(`[LongVideo] QA result for clip ${i + 1}: ${qaResult.result?.verdict} (Score: ${qaResult.result?.score})`);
            
            // Log issues if any
            if (qaResult.result?.issues?.length > 0) {
              console.log(`[LongVideo] QA issues:`, qaResult.result.issues.map((issue: any) => issue.description).join('; '));
            }
          }
        } catch (qaError) {
          console.warn(`[LongVideo] Visual debugger QA failed (non-blocking):`, qaError);
        }
      }
      
      clipResults.push({
        index: i,
        videoUrl: storedUrl,
        lastFrameUrl: stitcherResult.lastFrameUrl,
        durationSeconds: CLIP_DURATION,
        status: 'completed',
        motionVectors,
        ...(qaResult?.result && { qaResult: qaResult.result }),
      });
      
    } catch (error) {
      console.error(`[LongVideo] Clip ${i + 1} failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const maxRetries = request.maxRetries ?? 2;
      
      // SHOT-LEVEL RETRY: Attempt retry for failed clips
      const { data: existingClip } = await supabase
        .from('video_clips')
        .select('retry_count')
        .eq('project_id', request.projectId)
        .eq('shot_index', i)
        .single();
      
      const currentRetryCount = existingClip?.retry_count || 0;
      
      if (currentRetryCount < maxRetries) {
        console.log(`[LongVideo] Retrying clip ${i + 1} (attempt ${currentRetryCount + 1}/${maxRetries})...`);
        
        // Mark as retrying
        await supabase.rpc('upsert_video_clip', {
          p_project_id: request.projectId,
          p_user_id: request.userId,
          p_shot_index: i,
          p_prompt: velocityAwarePrompt,
          p_status: 'generating',
          p_error_message: `Retry ${currentRetryCount + 1}: ${errorMessage}`,
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Retry the clip generation
        try {
          const { operationName } = await generateClip(
            accessToken,
            gcpProjectId,
            velocityAwarePrompt,
            previousLastFrameUrl
          );
          
          const { videoUrl: rawVideoUrl } = await pollOperation(accessToken, operationName);
          const storedUrl = await downloadToStorage(supabase, rawVideoUrl, request.projectId, i);
          
          console.log(`[LongVideo] Clip ${i + 1} retry succeeded: ${storedUrl}`);
          
          // Mark as completed
          await supabase.rpc('upsert_video_clip', {
            p_project_id: request.projectId,
            p_user_id: request.userId,
            p_shot_index: i,
            p_prompt: velocityAwarePrompt,
            p_status: 'completed',
            p_video_url: storedUrl,
          });
          
          clipResults.push({
            index: i,
            videoUrl: storedUrl,
            durationSeconds: CLIP_DURATION,
            status: 'completed',
          });
          
          continue; // Success on retry, move to next clip
        } catch (retryError) {
          console.error(`[LongVideo] Clip ${i + 1} retry failed:`, retryError);
        }
      }
      
      // Mark clip as failed in DB after all retries exhausted
      await supabase.rpc('upsert_video_clip', {
        p_project_id: request.projectId,
        p_user_id: request.userId,
        p_shot_index: i,
        p_prompt: clip.prompt,
        p_status: 'failed',
        p_error_message: `Failed after ${currentRetryCount + 1} attempts: ${errorMessage}`,
      });
      
      clipResults.push({
        index: i,
        videoUrl: '',
        durationSeconds: CLIP_DURATION,
        status: 'failed',
        error: `Failed after ${currentRetryCount + 1} attempts: ${errorMessage}`,
      });
      // Continue with remaining clips even if one fails
    }
  }
  
  // Step 5: Request final assembly from stitcher
  const completedClips = clipResults.filter(c => c.status === 'completed');
  console.log(`[LongVideo] Requesting final assembly of ${completedClips.length} clips`);
  
  // Include audio tracks if provided (from Hollywood pipeline)
  const hasAudioTracks = request.voiceTrackUrl || request.musicTrackUrl;
  console.log(`[LongVideo] Final assembly with audio: voice=${!!request.voiceTrackUrl}, music=${!!request.musicTrackUrl}`);
  
  const finalAssemblyResponse = await fetch(`${stitcherUrl}/stitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: request.projectId,
      projectTitle: `Long Video - ${request.projectId}`,
      clips: completedClips.map(c => ({
        shotId: `clip_${c.index}`,
        videoUrl: c.videoUrl,
        durationSeconds: c.durationSeconds,
        transitionOut: 'continuous',
        motionVectors: c.motionVectors, // Pass motion vectors for transition optimization
      })),
      audioMixMode: hasAudioTracks ? 'full' : 'mute',
      outputFormat: 'mp4',
      colorGrading: request.colorGrading || 'cinematic', // Use user-selected color grading
      isFinalAssembly: true,
      // Pass audio tracks for mixing in final assembly
      voiceTrackUrl: request.voiceTrackUrl,
      backgroundMusicUrl: request.musicTrackUrl,
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
    resumedFrom,
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

    // Run the sequential generation with checkpoint recovery
    const { finalVideoUrl, clipResults, resumedFrom } = await generateLongVideo(
      request,
      supabase,
      accessToken,
      gcpProjectId,
      stitcherUrl
    );

    const completedClips = clipResults.filter(c => c.status === 'completed').length;
    console.log(`[LongVideo] Generation complete: ${completedClips}/${TOTAL_CLIPS} clips successful${resumedFrom > 0 ? `, resumed from clip ${resumedFrom + 1}` : ''}`);

    // Deduct credits only on success (full completion)
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
        resumedFrom: resumedFrom > 0 ? resumedFrom : undefined,
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
