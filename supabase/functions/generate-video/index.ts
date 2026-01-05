import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scene consistency context for multi-clip videos (includes reference image analysis)
interface SceneContext {
  clipIndex?: number;
  totalClips?: number;
  sceneTitle?: string;
  // Support both naming conventions from client
  environment?: string;
  globalEnvironment?: string;
  globalCharacters?: string;
  previousClipSummary?: string;
  colorPalette?: string;
  lightingStyle?: string;
  // Extended reference image analysis fields
  lightingDirection?: string;
  timeOfDay?: string;
  dominantColors?: string;
  backgroundElements?: string;
}

// Camera reference patterns to strip from prompts
const CAMERA_PATTERNS = [
  /\bcamera\s+(points?|aims?|focuses?|zooms?|pans?|tilts?|tracks?|dollies?)\s+(at|to|on|toward|towards)\s+(the\s+)?/gi,
  /\b(the\s+)?camera\s+(is\s+)?(on|at|focused\s+on)\s+/gi,
  /\bcamera(man|person|operator)?\b/gi,
  /\b(film\s+)?crew\b/gi,
  /\b(tripod|dolly|crane|steadicam|gimbal)\s+(shot)?\b/gi,
  /\b(lens|viewfinder|aperture)\b/gi,
  /\bphotographer\b/gi,
  /\bcamera\s+(moves?|glides?|sweeps?|rises?|descends?|follows?)\b/gi,
];

// Perspective-based rewrites for body parts
const BODY_PART_PERSPECTIVES: Record<string, string> = {
  'legs': 'low-angle ground-level perspective focusing on the subjects\' lower body',
  'feet': 'extreme low-angle perspective at foot level',
  'hands': 'intimate close perspective on hands and gestures',
  'face': 'intimate portrait-level perspective',
  'eyes': 'extreme close intimate perspective on the eyes',
  'body': 'full-figure perspective capturing the complete form',
};

// Mandatory negative prompt elements
const NEGATIVE_PROMPT_ELEMENTS = [
  'cameraman',
  'camera operator',
  'photographer',
  'tripod',
  'camera equipment',
  'lens visible',
  'film crew',
  'boom mic',
  'lighting rig',
  'behind the scenes',
  'visible equipment',
  'fourth wall break',
];

/**
 * Rewrites camera references to perspective-based language
 */
function rewriteCameraReferences(prompt: string): string {
  let rewritten = prompt;
  
  // Detect body part focus
  const bodyParts = ['legs', 'feet', 'hands', 'face', 'eyes', 'body'];
  let bodyPartFocus: string | null = null;
  
  for (const part of bodyParts) {
    const patterns = [
      new RegExp(`camera\\s+(points?|aims?|focuses?|on)\\s+(at\\s+)?(the\\s+)?${part}`, 'i'),
      new RegExp(`focus(ing)?\\s+on\\s+(the\\s+)?${part}`, 'i'),
      new RegExp(`shot\\s+of\\s+(the\\s+)?${part}`, 'i'),
    ];
    if (patterns.some(p => p.test(prompt.toLowerCase()))) {
      bodyPartFocus = part;
      break;
    }
  }
  
  // Remove camera references
  for (const pattern of CAMERA_PATTERNS) {
    rewritten = rewritten.replace(pattern, '');
  }
  
  // Add perspective language for body part focus
  if (bodyPartFocus && BODY_PART_PERSPECTIVES[bodyPartFocus]) {
    rewritten = `${BODY_PART_PERSPECTIVES[bodyPartFocus]}. ${rewritten}`;
  }
  
  // Rewrite camera movements to perspective language
  const movementRewrites: [RegExp, string][] = [
    [/zoom(s|ing)?\s+in(\s+on)?/gi, 'perspective gradually draws closer to'],
    [/zoom(s|ing)?\s+out/gi, 'perspective expansively widens revealing'],
    [/pan(s|ning)?\s+(to\s+the\s+)?left/gi, 'perspective sweeps leftward'],
    [/pan(s|ning)?\s+(to\s+the\s+)?right/gi, 'perspective sweeps rightward'],
    [/tilt(s|ing)?\s+up/gi, 'perspective rises revealing'],
    [/tilt(s|ing)?\s+down/gi, 'perspective descends toward'],
    [/push\s+in/gi, 'perspective gently approaches'],
    [/pull\s+(back|out)/gi, 'perspective gradually retreats'],
  ];
  
  for (const [pattern, replacement] of movementRewrites) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  
  return rewritten.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Transition hint phrases for seamless shot connections
 */
const TRANSITION_HINTS: Record<string, string> = {
  'continuous': 'with fluid motion that continues seamlessly',
  'match-cut': 'ending with visual elements that mirror the next moment',
  'dissolve': 'gradually transitioning with a soft blend',
  'fade': 'gently fading as the moment concludes',
};

/**
 * Build prompt with minimal processing to preserve user intent
 */
function buildConsistentPrompt(
  basePrompt: string, 
  context?: SceneContext,
  negativePrompt?: string,
  transitionOut?: string
): { prompt: string; negativePrompt: string } {
  // Only do camera reference cleanup - preserve the actual content
  let rewrittenPrompt = rewriteCameraReferences(basePrompt);
  
  // Add minimal consistency hints only for multi-clip projects
  if (context && (context.totalClips || 0) > 1) {
    const hints: string[] = [];
    
    // Support both field names from client
    const environment = context.globalEnvironment || context.environment;
    if (environment) {
      hints.push(`Setting: ${environment}`);
    }
    
    // Character consistency is important
    if (context.globalCharacters) {
      hints.push(`Characters: ${context.globalCharacters}`);
    }
    
    // Color/lighting consistency from reference image analysis
    if (context.dominantColors) {
      hints.push(`Colors: ${context.dominantColors}`);
    } else if (context.colorPalette) {
      hints.push(`Colors: ${context.colorPalette}`);
    }
    
    // Lighting with direction and time of day
    if (context.lightingStyle) {
      let lightingHint = `Lighting: ${context.lightingStyle}`;
      if (context.lightingDirection) {
        lightingHint += `, ${context.lightingDirection}`;
      }
      if (context.timeOfDay) {
        lightingHint += ` (${context.timeOfDay})`;
      }
      hints.push(lightingHint);
    }
    
    // Background elements for scene continuity
    if (context.backgroundElements) {
      hints.push(`Background: ${context.backgroundElements}`);
    }
    
    // Build final prompt: hints first, then the actual description
    if (hints.length > 0) {
      rewrittenPrompt = `[${hints.join(', ')}] ${rewrittenPrompt}`;
    }
  }
  
  // Add transition hint for seamless connections
  if (transitionOut && TRANSITION_HINTS[transitionOut]) {
    rewrittenPrompt = `${rewrittenPrompt}, ${TRANSITION_HINTS[transitionOut]}`;
  }
  
  // Enforce prompt limit
  if (rewrittenPrompt.length > 2000) {
    rewrittenPrompt = rewrittenPrompt.slice(0, 1997) + '...';
  }
  
  // Build negative prompt with anti-jitter elements for smooth transitions
  const allNegatives = [
    ...NEGATIVE_PROMPT_ELEMENTS,
    'jarring cuts',
    'abrupt transitions',
    'visual glitches',
    'frame stuttering',
  ];
  if (negativePrompt) {
    allNegatives.push(...negativePrompt.split(',').map(s => s.trim()));
  }
  
  return {
    prompt: rewrittenPrompt,
    negativePrompt: allNegatives.join(', '),
  };
}

/**
 * Converts a base64 data URL to a public Supabase Storage URL
 * Replicate requires HTTP URLs, not base64 data
 */
async function uploadBase64ToStorage(
  base64DataUrl: string, 
  fileName: string
): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials for storage upload");
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Parse base64 data URL
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid base64 data URL format");
  }
  
  const mimeType = matches[1];
  const base64Data = matches[2];
  
  // Convert base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Determine file extension from mime type
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType] || 'jpg';
  const fullFileName = `${fileName}.${ext}`;
  
  // Upload to Supabase Storage (temp-frames bucket)
  const bucketName = 'temp-frames';
  
  // Check if bucket exists, create if not
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);
  
  if (!bucketExists) {
    console.log(`Creating storage bucket: ${bucketName}`);
    await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });
  }
  
  // Upload the file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fullFileName, bytes, {
      contentType: mimeType,
      upsert: true,
    });
  
  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Failed to upload image to storage: ${uploadError.message}`);
  }
  
  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fullFileName);
  
  console.log("Uploaded base64 to storage:", publicUrlData.publicUrl);
  
  return publicUrlData.publicUrl;
}

/**
 * Ensures an image is a valid HTTP URL (uploads base64 if needed)
 */
async function ensureImageUrl(
  imageInput: string | undefined, 
  prefix: string
): Promise<string | undefined> {
  if (!imageInput) return undefined;
  
  // Trim whitespace
  const trimmedInput = imageInput.trim();
  
  // If already an HTTP URL, return as-is
  if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
    console.log(`[ensureImageUrl] Already an HTTP URL: ${trimmedInput.substring(0, 100)}...`);
    return trimmedInput;
  }
  
  // If base64 data URL, upload to storage
  if (trimmedInput.startsWith('data:')) {
    // Validate the data URL format before attempting decode
    const matches = trimmedInput.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.error(`[ensureImageUrl] Invalid data URL format. Starts with: ${trimmedInput.substring(0, 100)}`);
      return undefined;
    }
    
    const uniqueId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    try {
      return await uploadBase64ToStorage(trimmedInput, uniqueId);
    } catch (uploadError) {
      console.error(`[ensureImageUrl] Failed to upload base64:`, uploadError);
      return undefined;
    }
  }
  
  // Check if it might be raw base64 without the data URL prefix
  // Base64 strings typically only contain A-Z, a-z, 0-9, +, /, =
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (base64Regex.test(trimmedInput.substring(0, 100))) {
    console.warn(`[ensureImageUrl] Detected raw base64 without data URL prefix. This format is not supported.`);
    return undefined;
  }
  
  // Unknown format - log and skip
  console.warn(`[ensureImageUrl] Unknown image format, skipping. First 100 chars: ${trimmedInput.substring(0, 100)}`);
  return undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      prompt, 
      duration = 8, 
      sceneContext, 
      referenceImageUrl,
      startImage, // For frame chaining (first_frame_image)
      subjectReference, // For character consistency (subject_reference uses S2V-01 model)
      negativePrompt: inputNegativePrompt,
      transitionOut, // Transition type for seamless connections
    } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // Enforce max 16 second duration
    const MAX_DURATION = 16;
    const MIN_DURATION = 4;
    const clampedDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));
    
    if (duration > MAX_DURATION) {
      console.log(`Duration ${duration}s exceeds max, clamping to ${MAX_DURATION}s`);
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({ auth: REPLICATE_API_KEY });

    // Build enhanced prompt with camera rewrites, consistency, and transition hints
    const { prompt: enhancedPrompt, negativePrompt } = buildConsistentPrompt(
      prompt, 
      sceneContext,
      inputNegativePrompt,
      transitionOut
    );
    
    // Determine the start image (frame chaining or reference image)
    // IMPORTANT: Convert base64 to URLs - Replicate requires HTTP URLs!
    const rawStartImage = startImage || referenceImageUrl;
    const startImageUrl = await ensureImageUrl(rawStartImage, 'frame');
    
    const isImageToVideo = !!startImageUrl;

    console.log("Generating video with Replicate MiniMax:", {
      mode: isImageToVideo ? "image-to-video" : "text-to-video",
      duration: clampedDuration,
      transitionOut: transitionOut || 'continuous',
      promptLength: enhancedPrompt.length,
      hasStartImage: isImageToVideo,
      startImageUrl: isImageToVideo ? startImageUrl?.substring(0, 80) + '...' : null,
    });

    // MiniMax video-01 input configuration
    // CRITICAL: prompt_optimizer DISABLED to preserve user intent
    const input: Record<string, unknown> = {
      prompt: enhancedPrompt,
      prompt_optimizer: false, // DISABLED: was destroying user's intent
    };

    // Image-to-video mode: use first_frame_image for visual continuity
    // NOTE: We use first_frame_image mode only. subject_reference requires S2V-01 model
    // and a different input format (array of objects), which we're not using here.
    if (isImageToVideo) {
      console.log("Using first_frame_image for visual continuity:", startImageUrl);
      input.first_frame_image = startImageUrl;
    }

    const prediction = await replicate.predictions.create({
      model: "minimax/video-01",
      input,
    });

    console.log("Replicate prediction created:", prediction.id, "status:", prediction.status);

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId: prediction.id,
        status: prediction.status.toUpperCase(),
        mode: isImageToVideo ? "image-to-video" : "text-to-video",
        provider: "replicate",
        promptRewritten: enhancedPrompt !== prompt,
        message: "Video generation started. Poll the status endpoint for updates.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-video function:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle rate limiting
    if (errorMessage.includes("rate limit")) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again in a moment.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
