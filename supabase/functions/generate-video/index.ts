import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scene consistency context for multi-clip videos
interface SceneContext {
  clipIndex: number;
  totalClips: number;
  sceneTitle?: string;
  globalEnvironment?: string;
  globalCharacters?: string;
  previousClipSummary?: string;
  colorPalette?: string;
  lightingStyle?: string;
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
    [/zoom(s|ing)?\s+in(\s+on)?/gi, 'perspective draws intimately closer to'],
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
 * Build enhanced prompt with scene consistency and camera rewrites
 */
function buildConsistentPrompt(
  basePrompt: string, 
  context?: SceneContext,
  negativePrompt?: string
): { prompt: string; negativePrompt: string } {
  // First, rewrite camera references to perspective language
  let rewrittenPrompt = rewriteCameraReferences(basePrompt);
  
  const consistencyParts: string[] = [];
  
  if (context) {
    if (context.globalEnvironment) {
      consistencyParts.push(`[ENVIRONMENT: ${context.globalEnvironment}]`);
    }
    
    if (context.globalCharacters) {
      consistencyParts.push(`[CHARACTERS - MUST MATCH EXACTLY: ${context.globalCharacters}]`);
    }
    
    if (context.previousClipSummary && context.clipIndex > 0) {
      consistencyParts.push(`[SEAMLESS CONTINUATION FROM: ${context.previousClipSummary}]`);
    }
    
    if (context.colorPalette) {
      consistencyParts.push(`[COLOR PALETTE: ${context.colorPalette}]`);
    }
    if (context.lightingStyle) {
      consistencyParts.push(`[LIGHTING: ${context.lightingStyle}]`);
    }
    
    // Position hints
    let positionHint = '';
    if (context.clipIndex === 0) {
      positionHint = '[OPENING SHOT: Establish setting and tone]';
    } else if (context.clipIndex === context.totalClips - 1) {
      positionHint = '[FINAL SHOT: Conclusive framing, sense of resolution]';
    } else {
      positionHint = `[CLIP ${context.clipIndex + 1}/${context.totalClips}: Seamless continuation]`;
    }
    consistencyParts.push(positionHint);
    consistencyParts.push('[CRITICAL: Maintain exact visual consistency across all clips]');
  }
  
  const consistencyPrefix = consistencyParts.join(' ');
  let combinedPrompt = consistencyPrefix ? `${consistencyPrefix} ${rewrittenPrompt}` : rewrittenPrompt;
  
  // Enforce prompt limit
  if (combinedPrompt.length > 2000) {
    const maxBaseLength = 2000 - consistencyPrefix.length - 10;
    combinedPrompt = `${consistencyPrefix} ${rewrittenPrompt.slice(0, maxBaseLength)}...`;
  }
  
  // Build negative prompt
  const allNegatives = [...NEGATIVE_PROMPT_ELEMENTS];
  if (negativePrompt) {
    allNegatives.push(...negativePrompt.split(',').map(s => s.trim()));
  }
  
  return {
    prompt: combinedPrompt,
    negativePrompt: allNegatives.join(', '),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      prompt, 
      duration = 5, 
      sceneContext, 
      referenceImageUrl,
      startImage, // New: for frame chaining (base64 or URL)
      seed, // New: for consistent generation
      negativePrompt: inputNegativePrompt,
    } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({ auth: REPLICATE_API_KEY });

    // Build enhanced prompt with camera rewrites and consistency
    const { prompt: enhancedPrompt, negativePrompt } = buildConsistentPrompt(
      prompt, 
      sceneContext,
      inputNegativePrompt
    );
    
    // Determine the start image (frame chaining or reference image)
    const startImageUrl = startImage || referenceImageUrl;
    const isImageToVideo = !!startImageUrl;

    console.log("Generating video with Replicate:", {
      mode: isImageToVideo ? "image-to-video (frame-chained)" : "text-to-video",
      promptLength: enhancedPrompt.length,
      hasStartImage: isImageToVideo,
      seed: seed || 'random',
      negativePromptLength: negativePrompt.length,
    });

    let prediction;

    // Always use MiniMax video-01 for both text-to-video and image-to-video
    // MiniMax supports first_frame_image for frame chaining
    const input: Record<string, unknown> = {
      prompt: enhancedPrompt,
      prompt_optimizer: true,
    };

    if (isImageToVideo) {
      // Use first_frame_image for visual continuity
      console.log("Using image-to-video with first_frame_image for visual continuity");
      input.first_frame_image = startImageUrl;
    }

    prediction = await replicate.predictions.create({
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
        seed: seed || null,
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