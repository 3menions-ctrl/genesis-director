import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scene context for consistency
interface SceneContext {
  clipIndex: number;
  totalClips: number;
  environment?: string;
  characters?: string[];
  colorPalette?: string;
  lightingStyle?: string;
  lightingDirection?: string;
  timeOfDay?: string;
  dominantColors?: string;
  backgroundElements?: string[];
  previousClipEndFrame?: string;
  // SMART CAMERA PROPERTIES
  cameraScale?: string;
  cameraAngle?: string;
  movementType?: string;
  previousCameraScale?: string;
  previousCameraAngle?: string;
  // VELOCITY VECTORS for seamless transitions
  previousMotionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
}

// Camera scale perspective mappings
const CAMERA_SCALE_HINTS: Record<string, string> = {
  'extreme-wide': 'vast panoramic view capturing the entire environment',
  'wide': 'expansive wide shot showing full scene context',
  'medium': 'balanced mid-range shot at conversational distance',
  'close-up': 'intimate close shot capturing details and emotions',
  'extreme-close-up': 'extreme intimate shot revealing micro-details',
};

// Camera angle perspective mappings
const CAMERA_ANGLE_HINTS: Record<string, string> = {
  'eye-level': 'natural eye-level perspective',
  'low-angle': 'powerful low-angle perspective looking upward',
  'high-angle': 'commanding high-angle perspective looking down',
  'dutch-angle': 'dynamic tilted perspective creating tension',
  'overhead': 'bird\'s-eye top-down perspective',
  'pov': 'immersive first-person point-of-view',
};

// Movement type hints
const MOVEMENT_HINTS: Record<string, string> = {
  'static': 'steady locked-off shot with no movement',
  'pan': 'smooth horizontal sweeping motion',
  'tilt': 'vertical sweeping motion',
  'dolly': 'smooth gliding movement through space',
  'tracking': 'fluid following movement alongside action',
  'crane': 'elevated sweeping movement',
  'handheld': 'organic naturalistic motion',
};

// Camera pattern rewrites for better prompts
const CAMERA_PATTERNS = [
  /\b(close[- ]?up|closeup)\b/gi,
  /\b(wide[- ]?shot|wide[- ]?angle)\b/gi,
  /\b(medium[- ]?shot)\b/gi,
  /\b(establishing[- ]?shot)\b/gi,
  /\b(tracking[- ]?shot)\b/gi,
  /\b(dolly|pan|tilt|zoom)\b/gi,
  /\b(POV|point[- ]?of[- ]?view)\b/gi,
];

// Transition hints for seamless connections
const TRANSITION_HINTS: Record<string, string> = {
  "fade": "gradual fade transition, smooth brightness change",
  "cut": "clean cut, direct scene change",
  "dissolve": "crossfade dissolve, overlapping transition",
  "wipe": "directional wipe transition",
  "match-cut": "match cut on similar shapes or movements",
  "continuous": "continuous motion, seamless flow",
  "angle-change": "cut to different angle of same subject",
  "motion-carry": "movement continues across cut",
  "whip-pan": "fast camera sweep blur transition",
  "reveal": "camera movement reveals new element",
  "follow-through": "action carries viewer to next scene",
};

// Build enhanced prompt with consistency, SMART CAMERA ANGLES, and VELOCITY VECTORING
function buildConsistentPrompt(
  basePrompt: string,
  sceneContext?: SceneContext,
  inputNegativePrompt?: string,
  transitionOut?: string
): { prompt: string; negativePrompt: string } {
  let prompt = basePrompt;
  
  // VELOCITY VECTORING: Inject motion continuity from previous clip
  if (sceneContext?.previousMotionVectors) {
    const mv = sceneContext.previousMotionVectors;
    const velocityPrefix = `[MOTION CONTINUITY: Maintain ${mv.endVelocity || 'steady'} movement ${mv.endDirection || 'forward'}, camera ${mv.cameraMomentum || 'smooth'}]`;
    prompt = `${velocityPrefix} ${prompt}`;
    console.log('[generate-video] Velocity continuity injected:', velocityPrefix);
  }
  
  // SMART CAMERA PERSPECTIVE: Inject camera hints at the start for strong influence
  if (sceneContext) {
    const cameraParts: string[] = [];
    
    // Add camera scale perspective
    if (sceneContext.cameraScale && CAMERA_SCALE_HINTS[sceneContext.cameraScale]) {
      cameraParts.push(CAMERA_SCALE_HINTS[sceneContext.cameraScale]);
    }
    
    // Add camera angle perspective with transition awareness
    if (sceneContext.cameraAngle && CAMERA_ANGLE_HINTS[sceneContext.cameraAngle]) {
      if (sceneContext.previousCameraAngle && sceneContext.previousCameraAngle !== sceneContext.cameraAngle) {
        cameraParts.push(`transitioning from ${sceneContext.previousCameraAngle} to ${CAMERA_ANGLE_HINTS[sceneContext.cameraAngle]}`);
      } else {
        cameraParts.push(CAMERA_ANGLE_HINTS[sceneContext.cameraAngle]);
      }
    }
    
    // Add movement type
    if (sceneContext.movementType && MOVEMENT_HINTS[sceneContext.movementType]) {
      cameraParts.push(MOVEMENT_HINTS[sceneContext.movementType]);
    }
    
    // Prepend camera perspective for strong influence
    if (cameraParts.length > 0) {
      prompt = `[CAMERA: ${cameraParts.join(', ')}] ${prompt}`;
      console.log('[generate-video] Smart camera perspective injected:', cameraParts.join(', '));
    }
  }

  // Add scene context for consistency
  if (sceneContext) {
    const contextParts: string[] = [];
    
    if (sceneContext.environment) {
      contextParts.push(`Setting: ${sceneContext.environment}`);
    }
    if (sceneContext.lightingStyle) {
      contextParts.push(`Lighting: ${sceneContext.lightingStyle}`);
    }
    if (sceneContext.lightingDirection) {
      contextParts.push(`Light direction: ${sceneContext.lightingDirection}`);
    }
    if (sceneContext.timeOfDay) {
      contextParts.push(`Time: ${sceneContext.timeOfDay}`);
    }
    if (sceneContext.colorPalette) {
      contextParts.push(`Color palette: ${sceneContext.colorPalette}`);
    }
    if (sceneContext.dominantColors) {
      contextParts.push(`Dominant colors: ${sceneContext.dominantColors}`);
    }
    if (sceneContext.characters?.length) {
      contextParts.push(`Characters: ${sceneContext.characters.join(", ")}`);
    }
    
    if (contextParts.length > 0) {
      prompt = `${prompt}. ${contextParts.join(". ")}`;
    }
  }

  // Add transition hint
  if (transitionOut && TRANSITION_HINTS[transitionOut]) {
    prompt = `${prompt}. End with ${TRANSITION_HINTS[transitionOut]}`;
  }

  // Add quality modifiers for Veo 3.1
  prompt = `${prompt}. High quality, cinematic, realistic physics, natural motion, detailed textures.`;

  // Build negative prompt
  const negativePromptParts = [
    "blurry", "low quality", "distorted", "artifacts",
    "watermark", "text overlay", "glitch", "jittery motion"
  ];
  
  if (inputNegativePrompt) {
    negativePromptParts.push(inputNegativePrompt);
  }

  return {
    prompt: prompt.slice(0, 2000), // Vertex AI prompt limit
    negativePrompt: negativePromptParts.join(", ")
  };
}
// Upload base64 image to Supabase storage and return URL
async function uploadBase64ToStorage(base64Data: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract mime type and data
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 data URL");

  const mimeType = matches[1];
  const data = matches[2];
  const extension = mimeType.split("/")[1] || "jpg";
  const fileName = `frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

  // Decode base64
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));

  // Upload to storage
  const { data: uploadData, error } = await supabase.storage
    .from("temp-frames")
    .upload(fileName, bytes, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    // Try creating bucket if it doesn't exist
    await supabase.storage.createBucket("temp-frames", { public: true });
    const { error: retryError } = await supabase.storage
      .from("temp-frames")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });
    if (retryError) throw retryError;
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${fileName}`;
  console.log("Uploaded base64 to storage:", publicUrl);
  return publicUrl;
}

// Ensure image URL is valid (convert base64 if needed)
async function ensureImageUrl(input: string | undefined): Promise<string | null> {
  if (!input) return null;
  
  if (input.startsWith("http://") || input.startsWith("https://")) {
    console.log("[ensureImageUrl] Already an HTTP URL:", input.substring(0, 80) + "...");
    return input;
  }
  
  if (input.startsWith("data:")) {
    console.log("[ensureImageUrl] Converting base64 to URL...");
    return await uploadBase64ToStorage(input);
  }
  
  console.log("[ensureImageUrl] Unknown format, skipping");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      prompt,
      duration = 6,
      sceneContext,
      referenceImageUrl,
      startImage,
      negativePrompt: inputNegativePrompt,
      transitionOut,
      aspectRatio = "16:9",
    } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // Get service account credentials
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

    const projectId = serviceAccount.project_id;
    if (!projectId) {
      throw new Error("project_id not found in service account");
    }

    // Get access token
    console.log("Getting OAuth2 access token...");
    const accessToken = await getAccessToken(serviceAccount);
    console.log("Access token obtained successfully");

    // Build enhanced prompt
    const { prompt: enhancedPrompt, negativePrompt } = buildConsistentPrompt(
      prompt,
      sceneContext,
      inputNegativePrompt,
      transitionOut
    );

    // Prepare image input if provided
    const rawStartImage = startImage || referenceImageUrl;
    const startImageUrl = await ensureImageUrl(rawStartImage);
    const isImageToVideo = !!startImageUrl;

    console.log("Generating video with Google Vertex AI Veo 3.1:", {
      projectId,
      mode: isImageToVideo ? "image-to-video" : "text-to-video",
      duration,
      transitionOut: transitionOut || "continuous",
      promptLength: enhancedPrompt.length,
      hasStartImage: isImageToVideo,
    });

    // Build Vertex AI request
    const location = "us-central1";
    const model = "veo-3.1-generate-001"; // Latest stable Veo 3.1
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

    // Build instances array
    const instance: Record<string, any> = {
      prompt: enhancedPrompt,
    };

    // Add image for image-to-video mode
    if (isImageToVideo && startImageUrl) {
      // For HTTP URLs, we need to fetch and encode as base64
      if (startImageUrl.startsWith("http")) {
        try {
          const imageResponse = await fetch(startImageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const uint8Array = new Uint8Array(imageBuffer);
          
          // Convert to base64 in chunks to avoid stack overflow
          let binary = '';
          const chunkSize = 32768; // 32KB chunks
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64Image = btoa(binary);
          
          // Determine mime type from URL or default to jpeg
          const mimeType = startImageUrl.includes('.png') ? 'image/png' : 
                          startImageUrl.includes('.webp') ? 'image/webp' : 'image/jpeg';
          
          instance.image = {
            bytesBase64Encoded: base64Image,
            mimeType: mimeType
          };
          console.log("Image converted to base64 for Vertex AI, size:", base64Image.length);
        } catch (imgError) {
          console.error("Failed to fetch image for Vertex AI:", imgError);
          // Continue without image - will use text-to-video mode
        }
      }
    }

    // For image-to-video, Veo 3.1 only supports [4, 6, 8] seconds
    // For text-to-video, it supports [5, 6, 7, 8] seconds
    // DEFAULT TO 6 SECONDS for cinematic quality
    let finalDuration = duration;
    if (isImageToVideo) {
      // Snap to nearest valid duration for image-to-video: 4, 6, or 8
      // PREFER 6 SECONDS as default for cinematic quality
      if (duration <= 4) finalDuration = 6; // Changed: was 4, now 6 for better quality
      else if (duration <= 5) finalDuration = 6; // Changed: was 4, now 6
      else if (duration <= 7) finalDuration = 6;
      else finalDuration = 8;
    } else {
      // Text-to-video: clamp to 5-8, prefer 6
      finalDuration = Math.min(Math.max(duration, 6), 8);
    }

    // Validate and use the aspect ratio from request
    const validAspectRatios = ["16:9", "9:16", "1:1"];
    const finalAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "16:9";

    const requestBody = {
      instances: [instance],
      parameters: {
        aspectRatio: finalAspectRatio,
        durationSeconds: finalDuration,
        sampleCount: 1,
        negativePrompt: negativePrompt,
        resolution: "1080p", // Upgraded to 1080p for Avatar-quality
        personGeneration: "allow_adult", // Allow person generation
      }
    };

    console.log("[generate-video] Using aspect ratio:", finalAspectRatio);

    console.log("Sending request to Vertex AI:", endpoint);

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
      console.error("Vertex AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("Vertex AI response:", JSON.stringify(result).substring(0, 500));

    // The response contains an operation name for long-running operation
    const operationName = result.name;
    if (!operationName) {
      throw new Error("No operation name in Vertex AI response");
    }

    console.log("Veo 3.1 operation started:", operationName);

    return new Response(
      JSON.stringify({
        success: true,
        taskId: operationName,
        status: "STARTING",
        mode: isImageToVideo ? "image-to-video" : "text-to-video",
        provider: "vertex-ai",
        model: "veo-3.1-generate-001",
        promptRewritten: enhancedPrompt !== prompt,
        message: "Video generation started with Veo 3.1. Poll the status endpoint for updates.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-video function:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("rate limit")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
