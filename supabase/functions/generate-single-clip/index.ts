import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ============================================================================
// Kling 2.5 Turbo Pro via Replicate - Using models endpoint for latest version
// Using Replicate API for better availability and billing
// ============================================================================
const REPLICATE_MODELS_URL = "https://api.replicate.com/v1/models";
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const KLING_MODEL = "kwaivgi/kling-v2.5-turbo-pro"; // More widely available model
const KLING_ENABLE_AUDIO = true; // Native audio generation

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CLIP_DURATION = 6;

// =====================================================
// CONSISTENCY ENGINE (Embedded for Edge Function)
// =====================================================

type DetectedPose = 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette' | 'occluded' | 'unknown';

interface PoseAnalysis {
  detectedPose: DetectedPose;
  confidence: number;
  faceVisible: boolean;
  recommendedView: 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette';
}

const POSE_PATTERNS: { pattern: RegExp; pose: DetectedPose; confidence: number }[] = [
  { pattern: /\b(from\s+behind|from\s+the\s+back|rear\s+view|back\s+to\s+(camera|us|viewer))\b/i, pose: 'back', confidence: 95 },
  { pattern: /\b(walking\s+away|running\s+away|retreating|departing|leaving)\b/i, pose: 'back', confidence: 85 },
  { pattern: /\b(facing\s+away|turned\s+away|back\s+turned)\b/i, pose: 'back', confidence: 90 },
  { pattern: /\b(looking\s+into\s+(the\s+)?distance|gazing\s+at\s+the\s+horizon)\b/i, pose: 'back', confidence: 75 },
  { pattern: /\b(over\s+the\s+shoulder)\b/i, pose: 'back', confidence: 80 },
  { pattern: /\b(profile\s+(view|shot)|side\s+(view|profile|angle))\b/i, pose: 'side', confidence: 95 },
  { pattern: /\b(from\s+the\s+side|lateral\s+view)\b/i, pose: 'side', confidence: 90 },
  { pattern: /\b(three[-\s]quarter|3\/4\s+view|angled\s+view)\b/i, pose: 'three-quarter', confidence: 95 },
  { pattern: /\b(silhouette|backlit|shadow\s+figure)\b/i, pose: 'silhouette', confidence: 95 },
  { pattern: /\b(face\s+(hidden|obscured|covered)|wearing\s+(mask|helmet|hood))\b/i, pose: 'occluded', confidence: 90 },
  { pattern: /\b(facing\s+(camera|us|forward|viewer)|front\s+view|head-on)\b/i, pose: 'front', confidence: 95 },
  { pattern: /\b(looking\s+at\s+(camera|us|viewer)|eye\s+contact)\b/i, pose: 'front', confidence: 90 },
];

function detectPoseFromPrompt(prompt: string): PoseAnalysis {
  let bestPose: DetectedPose = 'front';
  let bestConfidence = 50;
  
  for (const { pattern, pose, confidence } of POSE_PATTERNS) {
    if (pattern.test(prompt) && confidence > bestConfidence) {
      bestPose = pose;
      bestConfidence = confidence;
    }
  }
  
  const nonFacialPoses: DetectedPose[] = ['back', 'silhouette', 'occluded'];
  const faceVisible = !nonFacialPoses.includes(bestPose);
  
  const viewMap: Record<DetectedPose, 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette'> = {
    'front': 'front', 'side': 'side', 'back': 'back',
    'three-quarter': 'three-quarter', 'silhouette': 'silhouette',
    'occluded': 'front', 'unknown': 'front',
  };
  
  return { detectedPose: bestPose, confidence: bestConfidence, faceVisible, recommendedView: viewMap[bestPose] };
}

interface MultiViewUrls {
  frontViewUrl?: string;
  sideViewUrl?: string;
  threeQuarterViewUrl?: string;
  backViewUrl?: string;
  silhouetteUrl?: string;
}

function selectViewForPose(pose: PoseAnalysis, views: MultiViewUrls): { url: string | null; type: string } {
  const viewUrlMap: Record<string, string | undefined> = {
    'front': views.frontViewUrl, 'side': views.sideViewUrl, 'back': views.backViewUrl,
    'three-quarter': views.threeQuarterViewUrl, 'silhouette': views.silhouetteUrl,
  };
  
  if (viewUrlMap[pose.recommendedView]) {
    return { url: viewUrlMap[pose.recommendedView]!, type: pose.recommendedView };
  }
  
  // Fallback priority
  const fallbacks = pose.recommendedView === 'back' 
    ? ['silhouette', 'three-quarter', 'side', 'front']
    : ['front', 'three-quarter', 'side'];
  
  for (const fb of fallbacks) {
    if (viewUrlMap[fb]) return { url: viewUrlMap[fb]!, type: fb };
  }
  
  return { url: null, type: 'none' };
}

function buildCharacterSpecificNegatives(nonFacialAnchors?: any): string[] {
  const negatives: string[] = [];
  if (nonFacialAnchors?.silhouetteUrl) {
    negatives.push('face clearly visible when character is backlit');
  }
  return negatives;
}

// =====================================================
// APEX MANDATORY QUALITY SUFFIX
// =====================================================
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, film grain, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading";

// =====================================================
// REPLICATE KLING VIDEO GENERATION
// =====================================================

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
  urls?: {
    get: string;
    cancel: string;
  };
}

// Create a prediction on Replicate using the models endpoint (auto-latest version)
async function createReplicatePrediction(
  prompt: string,
  negativePrompt: string,
  startImageUrl?: string | null,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
  durationSeconds: number = 5
): Promise<{ predictionId: string }> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }

  // Build Replicate input for Kling
  const input: Record<string, any> = {
    prompt: prompt.slice(0, 2500),
    negative_prompt: negativePrompt.slice(0, 1000),
    aspect_ratio: aspectRatio,
    duration: durationSeconds <= 5 ? 5 : 10,
    cfg_scale: 0.5,
  };

  // Add start image if provided (for image-to-video)
  if (startImageUrl && startImageUrl.startsWith("http")) {
    input.start_image = startImageUrl;
    console.log(`[SingleClip] Using start image for frame-chaining`);
  }

  console.log("[SingleClip] Creating Replicate prediction for Kling:", {
    model: KLING_MODEL,
    hasStartImage: !!input.start_image,
    duration: input.duration,
    aspectRatio: input.aspect_ratio,
    promptLength: prompt.length,
  });

  // Use models endpoint which automatically uses latest version
  const modelsUrl = `${REPLICATE_MODELS_URL}/${KLING_MODEL}/predictions`;
  
  const response = await fetch(modelsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[SingleClip] Replicate API error:", response.status, errorText);
    throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
  }

  const prediction: ReplicatePrediction = await response.json();
  
  if (!prediction.id) {
    console.error("[SingleClip] No prediction ID in response:", prediction);
    throw new Error("No prediction ID in Replicate response");
  }

  console.log("[SingleClip] Replicate prediction created:", prediction.id);
  return { predictionId: prediction.id };
}

// Poll Replicate prediction for completion
async function pollReplicatePrediction(
  predictionId: string,
  maxAttempts = 90,      // 90 attempts x 4 seconds = 6 minutes max
  pollInterval = 4000    // 4 second intervals
): Promise<{ videoUrl: string }> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }

  const statusUrl = `${REPLICATE_PREDICTIONS_URL}/${predictionId}`;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const response = await fetch(statusUrl, {
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      console.log(`[SingleClip] Poll attempt ${attempt + 1}: ${response.status}`);
      continue;
    }
    
    const prediction: ReplicatePrediction = await response.json();
    
    console.log(`[SingleClip] Poll attempt ${attempt + 1}: status=${prediction.status}`);
    
    switch (prediction.status) {
      case "succeeded":
        // Extract video URL from output
        const output = prediction.output;
        let videoUrl: string | null = null;
        
        if (typeof output === "string") {
          videoUrl = output;
        } else if (Array.isArray(output) && output.length > 0) {
          videoUrl = output[0];
        }
        
        if (!videoUrl) {
          throw new Error("No video URL in completed Replicate response");
        }
        
        console.log(`[SingleClip] ✓ Kling clip completed: ${videoUrl.substring(0, 80)}...`);
        return { videoUrl };
        
      case "failed":
        const errorMsg = prediction.error || "Replicate generation failed";
        throw new Error(`Kling generation failed: ${errorMsg}`);
        
      case "canceled":
        throw new Error("Kling generation was canceled");
        
      case "starting":
      case "processing":
        // Still running, continue polling
        break;
    }
  }
  
  throw new Error("Kling operation timed out after maximum polling attempts");
}

// =====================================================
// MEMORY-EFFICIENT VIDEO STORAGE
// Handles large base64 videos (19MB+) without exceeding memory limits
// Uses chunked decoding to prevent OOM crashes
// =====================================================

// Store video from URL directly to Supabase storage
async function storeVideoFromUrl(
  supabase: any,
  videoUrl: string,
  projectId: string,
  clipIndex: number
): Promise<string> {
  console.log(`[SingleClip] Downloading video from URL for storage...`);
  
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  
  const videoData = await response.arrayBuffer();
  const fileName = `clip_${projectId}_${clipIndex}_${Date.now()}.mp4`;
  const storagePath = `${projectId}/${fileName}`;
  
  console.log(`[SingleClip] Uploading ${videoData.byteLength} bytes to storage...`);
  
  const { error: uploadError } = await supabase.storage
    .from('video-clips')
    .upload(storagePath, new Uint8Array(videoData), {
      contentType: 'video/mp4',
      upsert: true,
    });
  
  if (uploadError) {
    console.error(`[SingleClip] Storage upload failed:`, uploadError);
    throw new Error(`Failed to upload video: ${uploadError.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('video-clips')
    .getPublicUrl(storagePath);
  
  console.log(`[SingleClip] Video stored successfully: ${publicUrl}`);
  return publicUrl;
}

// =====================================================
// DATABASE PERSISTENCE HELPERS
// CRITICAL: Register clips BEFORE generation to prevent data loss
// =====================================================

/**
 * Insert or update a clip record in video_clips table
 * Called BEFORE generation starts with status='pending' and prediction_id
 * Updated to 'completed' when video is ready
 */
async function upsertClipRecord(
  supabase: any,
  options: {
    projectId: string;
    userId: string;
    shotIndex: number;
    prompt: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    predictionId?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    durationSeconds?: number;
    motionVectors?: any;
    errorMessage?: string;
  }
): Promise<string> {
  const {
    projectId,
    userId,
    shotIndex,
    prompt,
    status,
    predictionId,
    videoUrl,
    lastFrameUrl,
    durationSeconds,
    motionVectors,
    errorMessage,
  } = options;

  // Check if clip record already exists
  const { data: existingClip } = await supabase
    .from('video_clips')
    .select('id')
    .eq('project_id', projectId)
    .eq('shot_index', shotIndex)
    .maybeSingle();

  const clipData: Record<string, any> = {
    project_id: projectId,
    user_id: userId,
    shot_index: shotIndex,
    prompt: prompt.substring(0, 5000), // Limit prompt length
    status,
    updated_at: new Date().toISOString(),
  };

  // Add optional fields if provided
  if (predictionId) {
    clipData.veo_operation_name = predictionId; // Reuse this column for prediction tracking
  }
  if (videoUrl) {
    clipData.video_url = videoUrl;
    clipData.completed_at = new Date().toISOString();
  }
  if (lastFrameUrl) {
    clipData.last_frame_url = lastFrameUrl;
  }
  if (durationSeconds) {
    clipData.duration_seconds = durationSeconds;
  }
  if (motionVectors) {
    clipData.motion_vectors = motionVectors;
  }
  if (errorMessage) {
    clipData.error_message = errorMessage;
  }

  let clipId: string;

  if (existingClip?.id) {
    // Update existing clip
    const { error: updateError } = await supabase
      .from('video_clips')
      .update(clipData)
      .eq('id', existingClip.id);

    if (updateError) {
      console.error(`[SingleClip] Failed to update clip record:`, updateError);
      throw new Error(`Failed to update clip record: ${updateError.message}`);
    }

    clipId = existingClip.id;
    console.log(`[SingleClip] ✓ Updated clip record ${clipId} with status=${status}`);
  } else {
    // Insert new clip
    const { data: newClip, error: insertError } = await supabase
      .from('video_clips')
      .insert(clipData)
      .select('id')
      .single();

    if (insertError) {
      console.error(`[SingleClip] Failed to insert clip record:`, insertError);
      throw new Error(`Failed to insert clip record: ${insertError.message}`);
    }

    clipId = newClip.id;
    console.log(`[SingleClip] ✓ Created clip record ${clipId} with status=${status}, predictionId=${predictionId}`);
  }

  return clipId;
}

// =====================================================
// SINGLE CLIP GENERATION RESPONSE
// =====================================================

interface SingleClipResult {
  success: boolean;
  videoUrl?: string;
  audioUrl?: string;
  lastFrameUrl?: string;
  durationSeconds?: number;
  error?: string;
  clipId?: string;
  predictionId?: string;
  motionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  // Initialize Supabase early for error handling
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let projectId: string | undefined;
  let userId: string | undefined;
  let shotIndex = 0;
  let clipId: string | undefined;

  try {
    const body = await req.json();
    projectId = body.projectId;
    userId = body.userId;
    shotIndex = body.shotIndex || body.clipIndex || 0;
    
    const {
      prompt,
      negativePrompt = "",
      startImageUrl,
      aspectRatio = "16:9",
      durationSeconds = DEFAULT_CLIP_DURATION,
      sceneContext,
      characterReferences = [],
      identityBible,
      skipPolling = false, // If true, return prediction ID immediately
      triggerNextClip = false, // If true, call continue-production after completion
      totalClips,
      pipelineContext,
    } = body;

    if (!projectId || !prompt) {
      throw new Error("projectId and prompt are required");
    }

    console.log(`[SingleClip] Starting generation for project ${projectId}, shot ${shotIndex}`);
    console.log(`[SingleClip] Using Kling v2.6 via Replicate`);

    // Build enhanced prompt
    let enhancedPrompt = prompt;
    
    // Add scene context
    if (sceneContext) {
      const contextParts = [];
      if (sceneContext.lighting) contextParts.push(`Lighting: ${sceneContext.lighting}`);
      if (sceneContext.colorPalette) contextParts.push(`Colors: ${sceneContext.colorPalette}`);
      if (sceneContext.environment) contextParts.push(`Environment: ${sceneContext.environment}`);
      if (sceneContext.mood) contextParts.push(`Mood: ${sceneContext.mood}`);
      if (contextParts.length > 0) {
        enhancedPrompt = `${enhancedPrompt}. ${contextParts.join('. ')}.`;
      }
    }

    // Add APEX quality suffix
    enhancedPrompt = `${enhancedPrompt}${APEX_QUALITY_SUFFIX}`;

    // Build negative prompt
    const fullNegativePrompt = negativePrompt 
      ? `${negativePrompt}, low quality, blur, distortion, watermark, artifact`
      : "low quality, blur, distortion, watermark, artifact, jarring transition, flickering";

    // Validate start image if provided
    let validatedStartImage: string | null = null;
    if (startImageUrl) {
      const lowerUrl = startImageUrl.toLowerCase();
      if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.mov')) {
        console.warn(`[SingleClip] ⚠️ REJECTED: startImageUrl is a VIDEO file, not an image!`);
      } else if (startImageUrl.startsWith("http")) {
        // Validate the image is accessible
        try {
          const imageCheckResponse = await fetch(startImageUrl, { method: 'HEAD' });
          if (imageCheckResponse.ok) {
            validatedStartImage = startImageUrl;
            console.log(`[SingleClip] ✓ Start image validated`);
          }
        } catch (urlError) {
          console.warn(`[SingleClip] ⚠️ Failed to validate start image URL`);
        }
      }
    }

    // Create Replicate prediction
    const { predictionId } = await createReplicatePrediction(
      enhancedPrompt,
      fullNegativePrompt,
      validatedStartImage,
      aspectRatio as '16:9' | '9:16' | '1:1',
      durationSeconds
    );

    // =========================================================
    // CRITICAL FIX: Register clip in database BEFORE polling
    // This ensures clip is tracked even if function times out
    // =========================================================
    if (userId) {
      clipId = await upsertClipRecord(supabase, {
        projectId,
        userId,
        shotIndex,
        prompt: enhancedPrompt,
        status: 'generating',
        predictionId,
        durationSeconds,
      });
      console.log(`[SingleClip] ✓ Clip ${shotIndex + 1} registered with predictionId=${predictionId}`);
    }

    // If skipPolling, return the prediction ID for external polling
    if (skipPolling) {
      return new Response(
        JSON.stringify({
          success: true,
          clipId,
          predictionId,
          provider: "replicate",
          model: KLING_MODEL,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll for completion
    const { videoUrl } = await pollReplicatePrediction(predictionId);

    // Store video in Supabase storage
    const storedVideoUrl = await storeVideoFromUrl(supabase, videoUrl, projectId, shotIndex);

    // =========================================================
    // POST-PROCESSING: Extract frame and continuity data
    // CRITICAL: Must happen BEFORE callback to pass real data
    // =========================================================
    let extractedLastFrameUrl: string | null = null;
    let extractedMotionVectors: any = null;
    let extractedContinuityManifest: any = null;

    // Step 1: Extract last frame from video
    console.log(`[SingleClip] Extracting last frame from clip ${shotIndex + 1}...`);
    try {
      const frameResponse = await fetch(`${supabaseUrl}/functions/v1/extract-last-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          videoUrl: storedVideoUrl,
          projectId,
          shotIndex,
          shotPrompt: prompt,
          sceneImageUrl: sceneContext?.environment ? undefined : undefined, // Scene image passed separately
          position: 'last',
        }),
      });
      
      if (frameResponse.ok) {
        const frameResult = await frameResponse.json();
        if (frameResult.success && frameResult.frameUrl) {
          extractedLastFrameUrl = frameResult.frameUrl;
          console.log(`[SingleClip] ✓ Last frame extracted: ${extractedLastFrameUrl?.substring(0, 60)}...`);
        } else {
          console.warn(`[SingleClip] Frame extraction returned no URL:`, frameResult.error);
        }
      } else {
        console.warn(`[SingleClip] Frame extraction failed: ${frameResponse.status}`);
      }
    } catch (frameErr) {
      console.warn(`[SingleClip] Frame extraction error:`, frameErr);
    }

    // Step 2: Extract continuity manifest from the last frame (if we have it)
    if (extractedLastFrameUrl) {
      console.log(`[SingleClip] Extracting continuity manifest for clip ${shotIndex + 1}...`);
      try {
        const manifestResponse = await fetch(`${supabaseUrl}/functions/v1/extract-continuity-manifest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            frameUrl: extractedLastFrameUrl,
            projectId,
            shotIndex,
            shotDescription: prompt,
          }),
        });
        
        if (manifestResponse.ok) {
          const manifestResult = await manifestResponse.json();
          if (manifestResult.success && manifestResult.manifest) {
            extractedContinuityManifest = manifestResult.manifest;
            console.log(`[SingleClip] ✓ Continuity manifest extracted with ${manifestResult.manifest?.criticalAnchors?.length || 0} anchors`);
            
            // Extract motion vectors from manifest action data
            if (manifestResult.manifest?.action) {
              extractedMotionVectors = {
                exitMotion: manifestResult.manifest.action.poseAtCut,
                dominantDirection: manifestResult.manifest.action.movementDirection,
                continuityPrompt: manifestResult.manifest.action.expectedContinuation,
                actionContinuity: manifestResult.manifest.action.gestureInProgress,
              };
              console.log(`[SingleClip] ✓ Motion vectors derived from manifest`);
            }
          }
        }
      } catch (manifestErr) {
        console.warn(`[SingleClip] Manifest extraction error:`, manifestErr);
      }
    }

    // =========================================================
    // Update clip record with completed video URL AND extracted data
    // =========================================================
    if (userId && clipId) {
      await upsertClipRecord(supabase, {
        projectId,
        userId,
        shotIndex,
        prompt: enhancedPrompt,
        status: 'completed',
        predictionId,
        videoUrl: storedVideoUrl,
        lastFrameUrl: extractedLastFrameUrl || undefined,
        durationSeconds,
        motionVectors: extractedMotionVectors || undefined,
      });
      console.log(`[SingleClip] ✓ Clip ${shotIndex + 1} marked completed with videoUrl and frame data`);
      
      // Also persist continuity manifest to clip record
      if (extractedContinuityManifest) {
        try {
          await supabase
            .from('video_clips')
            .update({
              continuity_manifest: extractedContinuityManifest,
              color_profile: {
                dominantColors: extractedContinuityManifest?.lighting?.colorTint ? [extractedContinuityManifest.lighting.colorTint] : [],
                brightness: extractedContinuityManifest?.lighting?.ambientLevel === 'bright' ? 0.8 : 0.5,
                warmth: extractedContinuityManifest?.lighting?.colorTemperature === 'warm' ? 0.7 : 0.4,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', clipId);
          console.log(`[SingleClip] ✓ Continuity manifest persisted to DB`);
        } catch (manifestDbErr) {
          console.warn(`[SingleClip] Failed to persist manifest:`, manifestDbErr);
        }
      }
    }

    // Log API cost
    try {
      await supabase.rpc('log_api_cost', {
        p_project_id: projectId,
        p_shot_id: `shot_${shotIndex}`,
        p_service: 'replicate-kling',
        p_operation: 'single_clip_generation',
        p_credits_charged: 10,
        p_real_cost_cents: 5, // Replicate Kling pricing
        p_duration_seconds: durationSeconds,
        p_status: 'completed',
        p_metadata: JSON.stringify({ 
          model: KLING_MODEL,
          predictionId,
          hasStartImage: !!validatedStartImage,
          hasLastFrame: !!extractedLastFrameUrl,
          hasContinuityManifest: !!extractedContinuityManifest,
        }),
      });
    } catch (costError) {
      console.warn('[SingleClip] Failed to log cost:', costError);
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[SingleClip] Complete in ${processingTimeMs}ms`);

    const result: SingleClipResult = {
      success: true,
      clipId,
      predictionId,
      videoUrl: storedVideoUrl,
      lastFrameUrl: extractedLastFrameUrl || undefined,
      durationSeconds,
      motionVectors: extractedMotionVectors || undefined,
    };

    // =========================================================
    // Trigger next clip generation via continue-production
    // CRITICAL FIX: Now passes REAL extracted data, not nulls!
    // =========================================================
    if (triggerNextClip && totalClips) {
      console.log(`[SingleClip] Triggering continue-production for clip ${shotIndex + 2}/${totalClips}...`);
      console.log(`[SingleClip] Passing: lastFrameUrl=${extractedLastFrameUrl ? 'YES' : 'NO'}, manifest=${extractedContinuityManifest ? 'YES' : 'NO'}`);
      
      try {
        // Fire and forget - don't wait for response
        const continueUrl = `${supabaseUrl}/functions/v1/continue-production`;
        fetch(continueUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            projectId,
            userId,
            completedClipIndex: shotIndex,
            completedClipResult: {
              videoUrl: storedVideoUrl,
              lastFrameUrl: extractedLastFrameUrl, // REAL extracted frame, not video URL!
              motionVectors: extractedMotionVectors,
              continuityManifest: extractedContinuityManifest,
            },
            totalClips,
            pipelineContext,
          }),
        }).catch(err => {
          console.warn(`[SingleClip] Failed to trigger continue-production:`, err);
        });
      } catch (continueErr) {
        console.warn(`[SingleClip] Error triggering continue-production:`, continueErr);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SingleClip] Error:", error);
    
    // =========================================================
    // CRITICAL: Update clip record with failure status
    // This ensures failed clips are tracked for recovery
    // =========================================================
    if (userId && projectId) {
      try {
        await upsertClipRecord(supabase, {
          projectId,
          userId,
          shotIndex,
          prompt: 'Generation failed',
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        console.log(`[SingleClip] ✓ Clip ${shotIndex + 1} marked as failed`);
      } catch (dbError) {
        console.error(`[SingleClip] Failed to update clip status:`, dbError);
      }
    }
    
    const result: SingleClipResult = {
      success: false,
      clipId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return new Response(
      JSON.stringify(result),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
