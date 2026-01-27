import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ============================================================================
// Kling 2.5 Turbo Pro via Replicate - Using models endpoint for latest version
// Using Replicate API for better availability and billing
// ============================================================================
const REPLICATE_API_URL = "https://api.replicate.com/v1/models";
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
  const modelsUrl = `${REPLICATE_API_URL}/${KLING_MODEL}/predictions`;
  
  const response = await fetch(modelsUrl, {
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

  const statusUrl = `${REPLICATE_API_URL}/${predictionId}`;
  
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

// Chunked base64 decode - processes in 1MB chunks to avoid memory spikes
function decodeBase64Chunked(base64Data: string): Uint8Array {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for decoding
  const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
  const decodedChunks: Uint8Array[] = [];
  let totalLength = 0;
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min((i + 1) * CHUNK_SIZE, base64Data.length);
    const chunk = base64Data.slice(start, end);
    
    // Decode this chunk
    const decoded = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
    decodedChunks.push(decoded);
    totalLength += decoded.length;
  }
  
  // Combine all chunks
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of decodedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

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
// SINGLE CLIP GENERATION RESPONSE
// =====================================================

interface SingleClipResult {
  success: boolean;
  videoUrl?: string;
  audioUrl?: string;
  lastFrameUrl?: string;
  durationSeconds?: number;
  error?: string;
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

  try {
    const body = await req.json();
    const {
      projectId,
      userId,
      shotIndex = 0,
      prompt,
      negativePrompt = "",
      startImageUrl,
      aspectRatio = "16:9",
      durationSeconds = DEFAULT_CLIP_DURATION,
      sceneContext,
      characterReferences = [],
      identityBible,
      skipPolling = false, // If true, return prediction ID immediately
    } = body;

    if (!projectId || !prompt) {
      throw new Error("projectId and prompt are required");
    }

    console.log(`[SingleClip] Starting generation for project ${projectId}, shot ${shotIndex}`);
    console.log(`[SingleClip] Using Kling v2.6 via Replicate`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // If skipPolling, return the prediction ID for external polling
    if (skipPolling) {
      return new Response(
        JSON.stringify({
          success: true,
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
        }),
      });
    } catch (costError) {
      console.warn('[SingleClip] Failed to log cost:', costError);
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[SingleClip] Complete in ${processingTimeMs}ms`);

    const result: SingleClipResult = {
      success: true,
      videoUrl: storedVideoUrl,
      durationSeconds,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SingleClip] Error:", error);
    const result: SingleClipResult = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return new Response(
      JSON.stringify(result),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
