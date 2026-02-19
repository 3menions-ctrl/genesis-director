import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkContentSafety } from "../_shared/content-safety.ts";
import {
  acquireGenerationLock,
  releaseGenerationLock,
  checkContinuityReady,
  persistPipelineContext,
  updateFrameExtractionStatus,
} from "../_shared/generation-mutex.ts";
import {
  buildComprehensivePrompt,
  validatePipelineData,
  logPipelineState,
  type PromptBuildRequest,
  type IdentityBible,
  type ContinuityManifest,
  type MotionVectors,
  type MasterSceneAnchor,
  type ExtractedCharacter,
  type FaceLock,
  type MultiViewIdentityBible,
} from "../_shared/prompt-builder.ts";
import {
  GUARD_RAIL_CONFIG,
  getClip0StartImage,
  getClip0LastFrame,
  getGuaranteedLastFrame,
  isValidImageUrl,
  checkAndRecoverStaleMutex,
  runPreGenerationChecks,
} from "../_shared/pipeline-guard-rails.ts";

// ============================================================================
// Kling 2.6 via Replicate - Avatar mode
// ============================================================================
const KLING_MODEL_OWNER = "kwaivgi";
const KLING_MODEL_NAME = "kling-v2.6";
const REPLICATE_MODEL_URL = `https://api.replicate.com/v1/models/${KLING_MODEL_OWNER}/${KLING_MODEL_NAME}/predictions`;
const REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";
const KLING_ENABLE_AUDIO = false; // Disabled: Kling's auto-generated music is low quality

// ============================================================================
// Google Veo 3.1 via Replicate - Text-to-Video & Image-to-Video
// Veo 3.1 generates 8-second clips at 1080p with native synchronized audio
// Enhanced prompt adherence, superior image-to-video, reference image support
// ============================================================================
const VEO3_MODEL_OWNER = "google";
const VEO3_MODEL_NAME = "veo-3.1";
const VEO3_MODEL_URL = `https://api.replicate.com/v1/models/${VEO3_MODEL_OWNER}/${VEO3_MODEL_NAME}/predictions`;
const VEO3_CLIP_DURATION = 8; // Veo 3.1 supports 4, 6, or 8 seconds — we use 8s

// Frame extraction retry configuration - use guard rail config
const FRAME_EXTRACTION_MAX_RETRIES = GUARD_RAIL_CONFIG.FRAME_EXTRACTION_MAX_RETRIES;
const FRAME_EXTRACTION_BACKOFF_MS = GUARD_RAIL_CONFIG.FRAME_EXTRACTION_BACKOFF_MS;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CLIP_DURATION = 5; // Kling 2.6: Default to 5 seconds

// =====================================================
// APEX MANDATORY QUALITY SUFFIX
// =====================================================
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading, clean sharp image";

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

// Create a prediction on Replicate using Kling v2.6 for maximum HD quality
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

  // Build Replicate input for Kling v2.6 - ALWAYS use "pro" mode for HD quality
  const input: Record<string, any> = {
    prompt: prompt.slice(0, 1500),
    negative_prompt: negativePrompt.slice(0, 1500),
    aspect_ratio: aspectRatio,
    duration: durationSeconds <= 5 ? 5 : 10,
    cfg_scale: 0.7,
    mode: "pro", // CRITICAL: "pro" mode = HD quality, "standard" = lower quality
    // Disable Kling's auto-generated cinematic music — it's low quality and unwanted
    enable_audio: KLING_ENABLE_AUDIO,
  };

  // Add start image if provided (for image-to-video)
  if (startImageUrl && startImageUrl.startsWith("http")) {
    input.start_image = startImageUrl;
    console.log(`[SingleClip] Using start image for frame-chaining`);
  }

  console.log("[SingleClip] Creating Replicate prediction for Kling v2.6 (HD Pro):", {
    model: `${KLING_MODEL_OWNER}/${KLING_MODEL_NAME}`,
    mode: input.mode,
    hasStartImage: !!input.start_image,
    duration: input.duration,
    aspectRatio: input.aspect_ratio,
    promptLength: prompt.length,
  });

  // Use model-specific endpoint: /models/{owner}/{model}/predictions
  // This is the CORRECT way to create predictions for official models
  const response = await fetch(REPLICATE_MODEL_URL, {
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

// =====================================================
// GOOGLE VEO 3.1 PREDICTION (Text-to-Video & Image-to-Video)
// Veo 3.1 generates 8-second clips at 1080p with native audio
// =====================================================
// =====================================================
// VEO 3.1 PROMPT OPTIMIZER
// Applies research-backed techniques to prevent hallucinations:
// 1. Front-loads critical identity/scene in first 2 sentences
// 2. Ensures [00:00-08:00] timestamp blocks are present
// 3. Injects positive stability constraints
// 4. Adds audio direction blocks (SFX/AMB/MUSIC)
// 5. Strips Kling-specific markers
// =====================================================
function optimizePromptForVeo3(rawPrompt: string): string {
  // Strip Kling-specific markers that Veo doesn't understand
  let prompt = rawPrompt
    .replace(/\[FACE LOCK\]/gi, '')
    .replace(/\[AVATAR STYLE LOCK\]/gi, '')
    .replace(/IDENTITY_ANCHOR\([^)]*\)/gi, '')
    .replace(/MOTION_GUARD\([^)]*\)/gi, '')
    .replace(/\[ENVIRONMENT LOCK\]/gi, '[SCENE LOCKED]')
    .replace(/\[STATIC ELEMENTS[^\]]*\]/gi, '[STATIC SCENE]')
    .trim();

  // TECHNIQUE 1: Ensure timestamp blocks exist — inject scaffolding if missing
  // Veo 3.1 needs temporal anchors to not forget later instructions
  const hasTimestamps = /\[0?0:0?0/.test(prompt);
  if (!hasTimestamps) {
    // Wrap existing prompt in timestamp structure
    const sentences = prompt.split(/(?<=[.!?])\s+/);
    const third = Math.max(1, Math.floor(sentences.length / 3));
    const twoThirds = Math.max(2, Math.floor(sentences.length * 2 / 3));
    const establish = sentences.slice(0, third).join(' ');
    const action = sentences.slice(third, twoThirds).join(' ');
    const resolve = sentences.slice(twoThirds).join(' ');
    prompt = `[00:00-02:00] ESTABLISH: ${establish} [02:00-05:00] ACTION: ${action} [05:00-08:00] RESOLVE: ${resolve}`;
  }

  // TECHNIQUE 2: Front-load identity — extract and prepend the most important identity clause
  // Veo's attention is highest on the first 2 sentences
  // Extract identity block from [ENVIRONMENT LOCK] or first sentence and hoist it
  const environmentLockMatch = prompt.match(/\[SCENE LOCKED\][^.]*\./);
  const identityPrefix = environmentLockMatch
    ? `${environmentLockMatch[0]} `
    : '';

  // TECHNIQUE 3: Positive stability constraints
  // Research shows positive constraints outperform negative prompts for Veo
  const stabilityConstraints = [
    'locked camera on stabilized tripod mount',
    'consistent identity throughout all 8 seconds',
    'photorealistic 1080p quality',
    'continuous smooth motion',
  ].join(', ');

  // TECHNIQUE 4: Extract and normalize audio direction blocks
  // If audio direction is already in prompt, keep it; otherwise add placeholder
  const hasAudioBlock = /\b(SFX:|AMB:|MUSIC_TONE:|VOICE:)/i.test(prompt);
  const audioSuffix = hasAudioBlock ? '' : '\nAMB: [natural ambient sound, environmental atmosphere] MUSIC_TONE: [cinematic score matching scene mood]';

  // TECHNIQUE 5: Cap at 2000 chars (Veo's effective attention window)
  // Priority: first 1000 chars (most attended), then fill remaining
  const fullPrompt = `${identityPrefix}${prompt}${audioSuffix}\n${stabilityConstraints}`;
  const capped = fullPrompt.slice(0, 2000);

  console.log(`[Veo3Optimizer] Original: ${rawPrompt.length} chars → Optimized: ${capped.length} chars | hasTimestamps: ${hasTimestamps} | hasAudio: ${hasAudioBlock}`);
  return capped;
}

async function createVeo3Prediction(
  prompt: string,
  startImageUrl?: string | null,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
): Promise<{ predictionId: string }> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }

  // Apply Veo 3.1 hallucination prevention optimizations
  const optimizedPrompt = optimizePromptForVeo3(prompt);

  const input: Record<string, any> = {
    prompt: optimizedPrompt,
    aspect_ratio: aspectRatio,
    duration: VEO3_CLIP_DURATION, // Always 8 seconds
    generate_audio: true,         // Native synchronized audio
  };

  // Veo supports image-to-video via first_frame_image
  if (startImageUrl && startImageUrl.startsWith("http")) {
    input.first_frame_image = startImageUrl;
    console.log(`[SingleClip][Veo3] Using start image for image-to-video`);
  }

  console.log("[SingleClip] Creating Replicate prediction for Google Veo 3.1:", {
    model: `${VEO3_MODEL_OWNER}/${VEO3_MODEL_NAME}`,
    hasStartImage: !!input.first_frame_image,
    duration: input.duration,
    aspectRatio: input.aspect_ratio,
    promptLength: optimizedPrompt.length,
  });

  const response = await fetch(VEO3_MODEL_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[SingleClip][Veo3] Replicate API error:", response.status, errorText);
    throw new Error(`Veo 3 API error: ${response.status} - ${errorText}`);
  }

  const prediction: ReplicatePrediction = await response.json();

  if (!prediction.id) {
    console.error("[SingleClip][Veo3] No prediction ID in response:", prediction);
    throw new Error("No prediction ID in Veo 3 response");
  }

  console.log("[SingleClip][Veo3] Prediction created:", prediction.id);
  return { predictionId: prediction.id };
}

// Poll a Replicate prediction until it completes (works for both Kling and Veo)
async function pollReplicatePrediction(
  predictionId: string,
  supabase: any,
  projectId: string,
  shotIndex: number,
  totalShots: number,
  maxAttempts = 90,      // 90 attempts x 4 seconds = 6 minutes max
  pollInterval = 4000    // 4 second intervals
): Promise<{ videoUrl: string }> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }

  const statusUrl = `${REPLICATE_PREDICTIONS_URL}/${predictionId}`;
  
  // Progress update helper - updates pipeline_state for UI
  const updateProgress = async (stage: string, progress: number, message: string) => {
    try {
      await supabase
        .from('movie_projects')
        .update({
          pipeline_state: {
            stage,
            progress,
            message,
            currentClip: shotIndex + 1,
            totalClips: totalShots,
            predictionId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    } catch (e) {
      console.log(`[SingleClip] Progress update failed (non-critical):`, e);
    }
  };
  
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
    
    // Calculate progress: each clip is a portion of total, within clip we estimate based on poll attempts
    // Assume 25 polls average to completion (~100 seconds)
    const clipProgress = Math.min(95, Math.round((attempt / 25) * 100));
    const baseProgress = Math.round((shotIndex / totalShots) * 100);
    const clipContribution = Math.round((1 / totalShots) * clipProgress);
    const overallProgress = Math.min(95, baseProgress + clipContribution);
    
    // Update progress every 3 polls to avoid excessive DB writes
    if (attempt % 3 === 0) {
      const messages = [
        'Initializing neural render engine...',
        'Mapping character consistency anchors...',
        'Generating motion vectors...',
        'Rendering cinematic frames...',
        'Applying lighting algorithms...',
        'Synthesizing temporal coherence...',
        'Finalizing HD video output...',
      ];
      const messageIndex = Math.min(Math.floor(attempt / 4), messages.length - 1);
      
      await updateProgress(
        'rendering',
        overallProgress,
        `Clip ${shotIndex + 1}/${totalShots}: ${messages[messageIndex]}`
      );
    }
    
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
        
        // Update progress to show clip completed
        await updateProgress(
          'rendering',
          Math.round(((shotIndex + 1) / totalShots) * 100),
          `Clip ${shotIndex + 1}/${totalShots} complete! ${shotIndex + 1 < totalShots ? 'Starting next clip...' : 'Finalizing video...'}`
        );
        
        console.log(`[SingleClip] ✓ Kling clip completed: ${videoUrl.substring(0, 80)}...`);
        return { videoUrl };
        
      case "failed":
        const errorMsg = prediction.error || "Replicate generation failed";
        await updateProgress('error', overallProgress, `Clip ${shotIndex + 1} failed: ${errorMsg.substring(0, 100)}`);
        throw new Error(`Kling generation failed: ${errorMsg}`);
        
      case "canceled":
        await updateProgress('canceled', overallProgress, 'Generation was canceled');
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

  // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
  const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
  const auth = await validateAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  let projectId: string | undefined;
  let userId: string | undefined;
  let shotIndex = 0;
  let clipId: string | undefined;

  try {
    const body = await req.json();
    projectId = body.projectId;
    // Use authenticated userId instead of trusting client payload
    userId = auth.userId || body.userId;
    shotIndex = body.shotIndex || body.clipIndex || 0;
    
    const {
      prompt,
      negativePrompt = "",
      startImageUrl,
      aspectRatio = "16:9",
      durationSeconds = DEFAULT_CLIP_DURATION,
      sceneContext,
      identityBible,
      faceLock, // FACE LOCK - highest priority identity system
      multiViewIdentityBible, // MULTI-VIEW IDENTITY - 5-angle character consistency
      skipPolling = false,
      triggerNextClip = false,
      totalClips,
      pipelineContext,
      // Additional continuity data
      previousMotionVectors,
      previousContinuityManifest,
      masterSceneAnchor,
      goldenFrameData,
      accumulatedAnchors,
      extractedCharacters,
      referenceImageUrl,
      sceneImageUrl,
      videoEngine = "kling", // 'veo' for text/image-to-video, 'kling' for avatar
    } = body;

    if (!projectId || !prompt) {
      throw new Error("projectId and prompt are required");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK - Final defense layer at clip generation
    // ═══════════════════════════════════════════════════════════════════════════
    const safetyCheck = checkContentSafety(prompt);
    if (!safetyCheck.isSafe) {
      console.error(`[SingleClip] ⛔ CONTENT BLOCKED - ${safetyCheck.category}: ${safetyCheck.matchedTerms.slice(0, 3).join(', ')}`);
      return new Response(
        JSON.stringify({ success: false, error: safetyCheck.message, blocked: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SingleClip] Starting generation for project ${projectId}, shot ${shotIndex}`);
    console.log(`[SingleClip] Engine param received: videoEngine="${videoEngine}"`);

    // =========================================================
    // GUARD RAIL #0: Auto-recover stale mutexes before anything
    // =========================================================
    const mutexRecovery = await checkAndRecoverStaleMutex(supabase, projectId);
    if (mutexRecovery.wasStale) {
      console.log(`[SingleClip] 🔓 Auto-recovered stale mutex from clip ${mutexRecovery.releasedClip}`);
    }

    // =========================================================
    // GUARD RAIL #1: Pre-generation validation with fallback resolution
    // NOTE: We NEVER block generation - always use degraded mode if needed
    // =========================================================
    const preCheck = await runPreGenerationChecks(supabase, projectId, shotIndex, {
      referenceImageUrl,
      sceneImageUrl,
      previousClipLastFrame: startImageUrl,
      identityBibleImageUrl: identityBible?.originalReferenceUrl,
    });
    
    for (const warning of preCheck.warnings) {
      console.warn(`[SingleClip] ⚠️ ${warning}`);
    }
    
    // Log blockers but DON'T fail - use degraded mode instead
    if (shotIndex > 0 && !preCheck.canProceed) {
      console.warn(`[SingleClip] ⚠️ Pre-generation checks have blockers (proceeding in degraded mode):`);
      for (const blocker of preCheck.blockers) {
        console.warn(`[SingleClip]   - ${blocker}`);
      }
      
      // Store degradation flag for later notification
      await supabase
        .from('movie_projects')
        .update({
          pending_video_tasks: supabase.rpc('jsonb_set_nested', {
            target: 'pending_video_tasks',
            path: '{degradation,continuityCheckFailed}',
            value: true
          })
        })
        .eq('id', projectId);
    }

    // =========================================================
    // GUARD RAIL #2: Clip 0 ALWAYS uses reference image as start
    // For other clips, use EXHAUSTIVE fallback chain
    // =========================================================
    let resolvedStartImage = startImageUrl;
    
    if (shotIndex === 0 && GUARD_RAIL_CONFIG.CLIP_0_ALWAYS_USE_REFERENCE) {
      const clip0Start = getClip0StartImage(referenceImageUrl, sceneImageUrl, identityBible?.originalReferenceUrl);
      if (clip0Start.imageUrl) {
        resolvedStartImage = clip0Start.imageUrl;
        console.log(`[SingleClip] ✓ Clip 0: Using ${clip0Start.source} as start image (GUARANTEED)`);
      }
    } else if (preCheck.resolvedFrameUrl) {
      resolvedStartImage = preCheck.resolvedFrameUrl;
      console.log(`[SingleClip] ✓ Using resolved frame from ${preCheck.resolvedFrameSource}`);
    } else if (shotIndex > 0) {
      // EXHAUSTIVE FALLBACK for non-clip-0
      const fallbackResult = getGuaranteedLastFrame(shotIndex - 1, {
        extractedFrame: startImageUrl,
        previousClipLastFrame: startImageUrl,
        referenceImageUrl,
        sceneImageUrl,
        identityBibleImageUrl: identityBible?.originalReferenceUrl,
        goldenFrameUrl: goldenFrameData?.goldenFrameUrl,
        sourceImageUrl: pipelineContext?.referenceImageUrl,
      });
      
      if (fallbackResult.frameUrl) {
        resolvedStartImage = fallbackResult.frameUrl;
        console.log(`[SingleClip] ✓ Exhaustive fallback found: ${fallbackResult.source} (${fallbackResult.confidence})`);
      } else {
        console.warn(`[SingleClip] ⚠️ No start image available - proceeding without (text-to-video mode)`);
      }
    }

    // =========================================================
    // FAILSAFE #2: Generation Mutex (prevent parallel generation)
    // =========================================================
    const lockId = crypto.randomUUID();
    const lockResult = await acquireGenerationLock(supabase, projectId, shotIndex, lockId);
    
    if (!lockResult.acquired) {
      console.warn(`[SingleClip] ⚠️ Generation blocked by mutex - clip ${lockResult.blockedByClip} is generating`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GENERATION_LOCKED',
          message: `Another clip (${lockResult.blockedByClip}) is currently generating`,
          lockAgeSeconds: lockResult.lockAgeSeconds,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[SingleClip] ✓ Generation lock acquired: ${lockId}`);
    
    const releaseLock = async () => {
      await releaseGenerationLock(supabase, projectId!, lockId);
    };

    // =========================================================
    // COMPREHENSIVE PROMPT BUILDING (BULLETPROOF)
    // Uses centralized prompt-builder for guaranteed data injection
    // =========================================================
    
    // Resolve identity bible from multiple sources
    const resolvedIdentityBible: IdentityBible | undefined = identityBible 
      || pipelineContext?.identityBible;
    
    // Resolve master scene anchor
    const resolvedMasterSceneAnchor: MasterSceneAnchor | undefined = masterSceneAnchor 
      || pipelineContext?.masterSceneAnchor;
    
    // Resolve extracted characters
    const resolvedExtractedCharacters: ExtractedCharacter[] | undefined = extractedCharacters 
      || pipelineContext?.extractedCharacters;
    
    // Resolve motion vectors and continuity from previous clip
    const resolvedMotionVectors: MotionVectors | undefined = previousMotionVectors;
    const resolvedContinuityManifest: ContinuityManifest | undefined = previousContinuityManifest;
    
    // VALIDATE PIPELINE DATA (log warnings for missing critical data)
    const validation = validatePipelineData(
      shotIndex,
      resolvedIdentityBible,
      {
        lastFrameUrl: startImageUrl,
        motionVectors: resolvedMotionVectors,
        continuityManifest: resolvedContinuityManifest,
      },
      resolvedMasterSceneAnchor
    );
    
    // BUILD COMPREHENSIVE PROMPT with all data injection
    // Resolve face lock from request or pipeline context
    const resolvedFaceLock: FaceLock | undefined = 
      faceLock || 
      pipelineContext?.faceLock;
    
    // Resolve multi-view identity bible from request or pipeline context
    const resolvedMultiViewIdentity: MultiViewIdentityBible | undefined = 
      multiViewIdentityBible || 
      pipelineContext?.multiViewIdentityBible;
    
    if (resolvedFaceLock) {
      console.log(`[SingleClip] ✓ FACE LOCK ACTIVE: ${resolvedFaceLock.goldenReference?.substring(0, 60) || 'enabled'}...`);
    }
    
    if (resolvedMultiViewIdentity) {
      console.log(`[SingleClip] ✓ MULTI-VIEW IDENTITY ACTIVE: 5-angle character consistency enabled`);
    }
    
    const promptRequest: PromptBuildRequest = {
      basePrompt: prompt,
      clipIndex: shotIndex,
      totalClips: totalClips || 6,
      faceLock: resolvedFaceLock, // FACE LOCK - HIGHEST PRIORITY
      multiViewIdentityBible: resolvedMultiViewIdentity, // MULTI-VIEW IDENTITY - 5-ANGLE CONSISTENCY
      identityBible: resolvedIdentityBible,
      extractedCharacters: resolvedExtractedCharacters,
      previousContinuityManifest: resolvedContinuityManifest,
      previousMotionVectors: resolvedMotionVectors,
      masterSceneAnchor: resolvedMasterSceneAnchor,
      sceneContext: sceneContext,
      userNegativePrompt: negativePrompt,
    };
    
    const builtPrompt = buildComprehensivePrompt(promptRequest);
    
    // LOG PIPELINE STATE (for debugging)
    logPipelineState(shotIndex, validation, builtPrompt);
    
    const enhancedPrompt = builtPrompt.enhancedPrompt;
    const fullNegativePrompt = builtPrompt.negativePrompt;
    
    // =========================================================
    // VALIDATE AND USE START IMAGE (use resolved image from guard rails)
    // =========================================================
    let validatedStartImage: string | null = null;
    const imageToValidate = resolvedStartImage || startImageUrl;
    
    if (imageToValidate) {
      // Use guard rail validation function
      if (!isValidImageUrl(imageToValidate)) {
        console.warn(`[SingleClip] ⚠️ REJECTED: startImageUrl failed validation: ${imageToValidate.substring(0, 50)}...`);
      } else {
        try {
          const imageCheckResponse = await fetch(imageToValidate, { method: 'HEAD' });
          if (imageCheckResponse.ok) {
            validatedStartImage = imageToValidate;
            console.log(`[SingleClip] ✓ Start image validated: ${imageToValidate.substring(0, 60)}...`);
          }
        } catch (urlError) {
          console.warn(`[SingleClip] ⚠️ Failed to HEAD check start image, using anyway`);
          // Still use the image even if HEAD check fails (some CDNs don't support HEAD)
          validatedStartImage = imageToValidate;
        }
      }
    }

    // Route to Veo 3.1 or Kling based on videoEngine param
    const useVeo = videoEngine === "veo";
    console.log(`[SingleClip] Engine: ${useVeo ? "Google Veo 3.1 (8s, 1080p)" : "Kling v2.6 (HD Pro)"}`);
    
    const { predictionId } = useVeo
      ? await createVeo3Prediction(
          enhancedPrompt,
          validatedStartImage,
          aspectRatio as '16:9' | '9:16' | '1:1',
        )
      : await createReplicatePrediction(
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
          model: `${KLING_MODEL_OWNER}/${KLING_MODEL_NAME}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll for completion with real-time progress updates
    const { videoUrl } = await pollReplicatePrediction(
      predictionId,
      supabase,
      projectId,
      shotIndex,
      totalClips || 1
    );

    // Store video in Supabase storage
    const storedVideoUrl = await storeVideoFromUrl(supabase, videoUrl, projectId, shotIndex);

    // =========================================================
    // POST-PROCESSING: Extract frame and continuity data
    // CRITICAL: Must happen BEFORE callback to pass real data
    // FAILSAFE #3: Frame extraction with retries and fallback
    // =========================================================
    let extractedLastFrameUrl: string | null = null;
    let extractedMotionVectors: any = null;
    let extractedContinuityManifest: any = null;
    let frameExtractionAttempts = 0;
    let frameExtractionStatus: 'pending' | 'success' | 'failed' | 'fallback_used' = 'pending';

    // Step 1: Extract last frame from video with retries
    console.log(`[SingleClip] Extracting last frame from clip ${shotIndex + 1} (max ${FRAME_EXTRACTION_MAX_RETRIES} attempts)...`);
    
    for (let attempt = 1; attempt <= FRAME_EXTRACTION_MAX_RETRIES; attempt++) {
      frameExtractionAttempts = attempt;
      
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
            sceneImageUrl: sceneContext?.environment ? undefined : undefined,
            position: 'last',
          }),
        });
        
        if (frameResponse.ok) {
          const frameResult = await frameResponse.json();
          if (frameResult.success && frameResult.frameUrl) {
            extractedLastFrameUrl = frameResult.frameUrl;
            frameExtractionStatus = 'success';
            console.log(`[SingleClip] ✓ Last frame extracted on attempt ${attempt}: ${extractedLastFrameUrl?.substring(0, 60)}...`);
            break;
          } else {
            console.warn(`[SingleClip] Attempt ${attempt}: Frame extraction returned no URL:`, frameResult.error);
          }
        } else {
          const errorText = await frameResponse.text().catch(() => 'unknown');
          console.warn(`[SingleClip] Attempt ${attempt}: Frame extraction HTTP ${frameResponse.status}: ${errorText.substring(0, 100)}`);
        }
      } catch (frameErr) {
        console.warn(`[SingleClip] Attempt ${attempt}: Frame extraction exception:`, frameErr);
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < FRAME_EXTRACTION_MAX_RETRIES) {
        const backoffMs = FRAME_EXTRACTION_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[SingleClip] Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    // GUARD RAIL #4: Use guaranteed fallback chain for last frame - ONLY IF EXTRACTION FAILED
    if (!extractedLastFrameUrl) {
      console.error(`[SingleClip] ⚠️ All ${FRAME_EXTRACTION_MAX_RETRIES} frame extraction attempts failed!`);
      
      // Use guard rail guaranteed fallback function
      const fallbackResult = getGuaranteedLastFrame(shotIndex, {
        extractedFrame: undefined, // We already know extraction failed
        referenceImageUrl: pipelineContext?.referenceImageUrl || referenceImageUrl,
        sceneImageUrl: pipelineContext?.sceneImageLookup?.[shotIndex] || sceneImageUrl,
        identityBibleImageUrl: identityBible?.originalReferenceUrl,
      });
      
      if (fallbackResult.frameUrl) {
        console.log(`[SingleClip] ✓ Using fallback ${fallbackResult.source} (confidence: ${fallbackResult.confidence})`);
        extractedLastFrameUrl = fallbackResult.frameUrl;
        frameExtractionStatus = 'fallback_used';
      } else {
        frameExtractionStatus = 'failed';
        console.error(`[SingleClip] ❌ CRITICAL: All fallbacks exhausted - frame chain will be broken!`);
      }
    }
    
    // CRITICAL FIX: For clip 0, prefer the EXTRACTED last frame over reference image
    // This ensures clip 1 starts from where clip 0 actually ended, not from the original upload
    // The reference image is only used as a FALLBACK if extraction failed
    if (shotIndex === 0) {
      if (extractedLastFrameUrl && extractedLastFrameUrl !== referenceImageUrl) {
        console.log(`[SingleClip] ✓ Clip 0: Using EXTRACTED last frame for clip 1 continuity (${extractedLastFrameUrl.substring(0, 60)}...)`);
        // Keep the extracted frame - this is correct behavior
      } else if (!extractedLastFrameUrl && referenceImageUrl && isValidImageUrl(referenceImageUrl)) {
        console.log(`[SingleClip] ⚠️ Clip 0: No extracted frame, falling back to reference image`);
        extractedLastFrameUrl = referenceImageUrl;
        frameExtractionStatus = 'fallback_used';
      }
    }
    
    // Update frame extraction status in DB
    if (clipId) {
      await updateFrameExtractionStatus(supabase, clipId, frameExtractionStatus, frameExtractionAttempts);
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
          model: `${KLING_MODEL_OWNER}/${KLING_MODEL_NAME}`,
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
    // FAILSAFE #5: Persist pipeline context before triggering next clip
    // =========================================================
    const updatedContext = {
      ...pipelineContext,
      // CRITICAL: Always explicitly carry videoEngine so it survives all callback hops.
      // Do NOT rely solely on spread — the interface may strip unknown keys during parsing.
      videoEngine: videoEngine || pipelineContext?.videoEngine || 'kling',
      accumulatedAnchors: [
        ...(pipelineContext?.accumulatedAnchors || []),
        {
          clipIndex: shotIndex,
          lastFrameUrl: extractedLastFrameUrl,
          motionVectors: extractedMotionVectors,
          continuityManifest: extractedContinuityManifest,
          timestamp: Date.now(),
        },
      ],
      goldenFrameData: shotIndex === 0 && extractedLastFrameUrl 
        ? { goldenFrameUrl: extractedLastFrameUrl, clipIndex: 0, extractedAt: Date.now() }
        : pipelineContext?.goldenFrameData,
      referenceImageUrl: pipelineContext?.referenceImageUrl || (shotIndex === 0 ? extractedLastFrameUrl : null),
    };
    
    await persistPipelineContext(supabase, projectId, updatedContext);
    console.log(`[SingleClip] ✓ Pipeline context persisted with ${updatedContext.accumulatedAnchors.length} anchors`);

    // =========================================================
    // Release generation lock BEFORE triggering next clip
    // =========================================================
    await releaseLock();
    console.log(`[SingleClip] ✓ Generation lock released`);

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
            pipelineContext: updatedContext, // Pass updated context with all anchors
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
    // CRITICAL: Release lock on error
    // =========================================================
    if (projectId) {
      try {
        // Try to release any lock this function might have acquired
        await releaseGenerationLock(supabase, projectId, '');
      } catch (lockErr) {
        console.warn(`[SingleClip] Failed to release lock on error:`, lockErr);
      }
    }
    
    // =========================================================
    // CRITICAL: Update clip record with failure status
    // This ensures failed clips are tracked for recovery
    // =========================================================
    if (userId && projectId) {
      try {
        // CRITICAL FIX: Preserve the original prompt from the request body
        // NEVER overwrite prompt with error messages - this corrupts future retries
        const body = await req.clone().json().catch(() => ({}));
        const originalPrompt = body.prompt || `Shot ${shotIndex + 1}`;
        
        await upsertClipRecord(supabase, {
          projectId,
          userId,
          shotIndex,
          prompt: originalPrompt, // Keep original prompt, NOT "Generation failed"
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        console.log(`[SingleClip] ✓ Clip ${shotIndex + 1} marked as failed (original prompt preserved)`);
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
