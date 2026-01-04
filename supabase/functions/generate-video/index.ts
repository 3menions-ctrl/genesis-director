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
  globalEnvironment?: string; // Consistent environment description across all clips
  globalCharacters?: string; // Character descriptions to maintain across clips
  previousClipSummary?: string; // Brief description of previous clip for continuity
  colorPalette?: string; // Consistent color grading
  lightingStyle?: string; // Consistent lighting
}

// Build enhanced prompt with scene consistency
function buildConsistentPrompt(
  basePrompt: string, 
  context?: SceneContext
): string {
  if (!context) return basePrompt;

  const consistencyParts: string[] = [];
  
  // Add global environment context for continuity
  if (context.globalEnvironment) {
    consistencyParts.push(`[ENVIRONMENT: ${context.globalEnvironment}]`);
  }
  
  // Add character consistency requirements
  if (context.globalCharacters) {
    consistencyParts.push(`[CHARACTERS - MUST MATCH EXACTLY: ${context.globalCharacters}]`);
  }
  
  // Add previous clip context for seamless transitions
  if (context.previousClipSummary && context.clipIndex > 0) {
    consistencyParts.push(`[CONTINUATION FROM: ${context.previousClipSummary}]`);
  }
  
  // Add color and lighting consistency
  if (context.colorPalette) {
    consistencyParts.push(`[COLOR PALETTE: ${context.colorPalette}]`);
  }
  if (context.lightingStyle) {
    consistencyParts.push(`[LIGHTING: ${context.lightingStyle}]`);
  }
  
  // Add clip position context for proper pacing
  let positionHint = '';
  if (context.clipIndex === 0) {
    positionHint = '[OPENING SHOT: Establish setting and tone, fade in from black]';
  } else if (context.clipIndex === context.totalClips - 1) {
    positionHint = '[FINAL SHOT: Conclusive framing, sense of resolution]';
  } else {
    positionHint = `[CLIP ${context.clipIndex + 1}/${context.totalClips}: Seamless continuation, match previous lighting/color]`;
  }
  consistencyParts.push(positionHint);
  
  // Add universal consistency instructions
  consistencyParts.push('[CRITICAL: Maintain exact visual consistency - same characters, same environment, same lighting direction, same color temperature]');
  
  // Combine context with base prompt
  const consistencyPrefix = consistencyParts.join(' ');
  const combinedPrompt = `${consistencyPrefix} ${basePrompt}`;
  
  // Runway has 1000 char limit - prioritize consistency context over long descriptions
  if (combinedPrompt.length > 1000) {
    // Truncate base prompt to fit, keeping consistency context intact
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
    const { prompt, duration = 8, sceneContext } = await req.json();
    // Duration must be exactly 4, 6, or 8
    const validDuration = [4, 6, 8].includes(Number(duration)) ? Number(duration) : 8;

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // Build enhanced prompt with scene consistency
    const enhancedPrompt = buildConsistentPrompt(prompt, sceneContext);

    console.log("Generating video for prompt:", enhancedPrompt);
    console.log("Scene context:", sceneContext ? JSON.stringify(sceneContext) : "none");

    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
    if (!RUNWAY_API_KEY) {
      throw new Error("RUNWAY_API_KEY is not configured");
    }

    // Start video generation task
    const createResponse = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "veo3.1_fast",
        promptText: enhancedPrompt,
        duration: validDuration,
        ratio: "1920:1080",
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Runway create error:", createResponse.status, errorText);
      
      if (createResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
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
    
    console.log("Video task created:", taskId);

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId,
        status: "PENDING",
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
