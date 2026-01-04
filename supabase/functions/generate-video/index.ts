import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  
  if (combinedPrompt.length > 1000) {
    const maxBaseLength = 1000 - consistencyPrefix.length - 10;
    return `${consistencyPrefix} ${basePrompt.slice(0, maxBaseLength)}...`;
  }
  
  return combinedPrompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 8, sceneContext, referenceImageUrl } = await req.json();
    const validDuration = [4, 6, 8].includes(Number(duration)) ? Number(duration) : 8;

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const enhancedPrompt = buildConsistentPrompt(prompt, sceneContext);
    const isImageToVideo = !!referenceImageUrl;

    console.log("Generating video:", {
      mode: isImageToVideo ? "image-to-video" : "text-to-video",
      promptLength: enhancedPrompt.length,
      duration: validDuration,
      hasReferenceImage: isImageToVideo,
    });

    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
    if (!RUNWAY_API_KEY) {
      throw new Error("RUNWAY_API_KEY is not configured");
    }

    let requestBody: Record<string, unknown>;
    let endpoint: string;

    if (isImageToVideo) {
      // Image-to-video mode: use reference image as first frame
      endpoint = "https://api.dev.runwayml.com/v1/image_to_video";
      requestBody = {
        model: "gen4_turbo",
        promptImage: referenceImageUrl,
        promptText: enhancedPrompt.slice(0, 512), // Shorter prompt for image-to-video
        duration: validDuration,
        ratio: "1920:1080",
      };
      console.log("Using image-to-video with reference:", referenceImageUrl.slice(0, 100) + "...");
    } else {
      // Text-to-video mode
      endpoint = "https://api.dev.runwayml.com/v1/text_to_video";
      requestBody = {
        model: "veo3.1_fast",
        promptText: enhancedPrompt,
        duration: validDuration,
        ratio: "1920:1080",
      };
    }

    const createResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Runway create error:", createResponse.status, errorText);
      
      // Parse error to get specific message
      let errorMessage = "Video generation failed";
      let dailyLimitReached = false;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.includes("daily task limit")) {
          errorMessage = "Runway daily task limit reached. Your limit resets at midnight UTC. Please try again tomorrow.";
          dailyLimitReached = true;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Not JSON, use generic message
      }
      
      if (createResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            daily_limit_reached: dailyLimitReached,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (createResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits. Please add credits to your Runway account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Runway error: ${createResponse.status} - ${errorText}`);
    }

    const taskData = await createResponse.json();
    const taskId = taskData.id;
    
    console.log("Video task created:", taskId, "mode:", isImageToVideo ? "image-to-video" : "text-to-video");

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId,
        status: "PENDING",
        mode: isImageToVideo ? "image-to-video" : "text-to-video",
        message: "Video generation started. Poll the status endpoint for updates.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-video function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
