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

// Build enhanced prompt with scene consistency
function buildConsistentPrompt(
  basePrompt: string, 
  context?: SceneContext
): string {
  if (!context) return basePrompt;

  const consistencyParts: string[] = [];
  
  if (context.globalEnvironment) {
    consistencyParts.push(`[ENVIRONMENT: ${context.globalEnvironment}]`);
  }
  
  if (context.globalCharacters) {
    consistencyParts.push(`[CHARACTERS - MUST MATCH EXACTLY: ${context.globalCharacters}]`);
  }
  
  if (context.previousClipSummary && context.clipIndex > 0) {
    consistencyParts.push(`[CONTINUATION FROM: ${context.previousClipSummary}]`);
  }
  
  if (context.colorPalette) {
    consistencyParts.push(`[COLOR PALETTE: ${context.colorPalette}]`);
  }
  if (context.lightingStyle) {
    consistencyParts.push(`[LIGHTING: ${context.lightingStyle}]`);
  }
  
  let positionHint = '';
  if (context.clipIndex === 0) {
    positionHint = '[OPENING SHOT: Establish setting and tone]';
  } else if (context.clipIndex === context.totalClips - 1) {
    positionHint = '[FINAL SHOT: Conclusive framing, sense of resolution]';
  } else {
    positionHint = `[CLIP ${context.clipIndex + 1}/${context.totalClips}: Seamless continuation]`;
  }
  consistencyParts.push(positionHint);
  
  consistencyParts.push('[CRITICAL: Maintain exact visual consistency]');
  
  const consistencyPrefix = consistencyParts.join(' ');
  const combinedPrompt = `${consistencyPrefix} ${basePrompt}`;
  
  // Replicate models typically have generous prompt limits
  if (combinedPrompt.length > 2000) {
    const maxBaseLength = 2000 - consistencyPrefix.length - 10;
    return `${consistencyPrefix} ${basePrompt.slice(0, maxBaseLength)}...`;
  }
  
  return combinedPrompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 5, sceneContext, referenceImageUrl } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const replicate = new Replicate({ auth: REPLICATE_API_KEY });

    const enhancedPrompt = buildConsistentPrompt(prompt, sceneContext);
    const isImageToVideo = !!referenceImageUrl;

    console.log("Generating video with Replicate:", {
      mode: isImageToVideo ? "image-to-video" : "text-to-video",
      promptLength: enhancedPrompt.length,
      hasReferenceImage: isImageToVideo,
    });

    let prediction;

    if (isImageToVideo) {
      // Image-to-video using Stable Video Diffusion
      console.log("Using image-to-video with reference:", referenceImageUrl.slice(0, 100) + "...");
      
      prediction = await replicate.predictions.create({
        model: "stability-ai/stable-video-diffusion",
        input: {
          input_image: referenceImageUrl,
          motion_bucket_id: 127, // Higher = more motion
          cond_aug: 0.02,
          decoding_t: 14,
          fps: 6,
        },
      });
    } else {
      // Text-to-video using MiniMax video-01
      prediction = await replicate.predictions.create({
        model: "minimax/video-01",
        input: {
          prompt: enhancedPrompt,
          prompt_optimizer: true,
        },
      });
    }

    console.log("Replicate prediction created:", prediction.id, "status:", prediction.status);

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId: prediction.id,
        status: prediction.status.toUpperCase(),
        mode: isImageToVideo ? "image-to-video" : "text-to-video",
        provider: "replicate",
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
