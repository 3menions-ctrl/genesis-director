import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GENERATE-AVATAR-SCENE - Scene-First Avatar Compositing
 * 
 * This is the WORLD-CLASS solution for placing avatars in custom backgrounds.
 * 
 * Pipeline:
 * 1. Use FLUX Kontext (character-consistent generation) to place avatar in scene
 * 2. Output: High-quality still of avatar IN the requested environment
 * 3. This image is then used as start_image for Kling animation
 * 
 * The key insight: Generate the scene FIRST as a still image,
 * then animate. This ensures the background is exactly what the user wants.
 */

interface AvatarSceneRequest {
  // Avatar face/reference image URL
  avatarImageUrl: string;
  
  // Scene description (e.g., "a witch's house in a dark forest")
  sceneDescription: string;
  
  // Optional: Character description for better consistency
  characterDescription?: string;
  
  // Output configuration
  aspectRatio?: string;
  
  // Optional: Placement in scene
  placement?: 'center' | 'left' | 'right';
}

interface AvatarSceneResponse {
  success: boolean;
  sceneImageUrl?: string;
  method?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY not configured");
    }

    const request: AvatarSceneRequest = await req.json();
    const {
      avatarImageUrl,
      sceneDescription,
      characterDescription,
      aspectRatio = "16:9",
      placement = "center",
    } = request;

    if (!avatarImageUrl || !sceneDescription) {
      throw new Error("Both avatarImageUrl and sceneDescription are required");
    }

    console.log("[AvatarScene] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarScene] Scene-First Compositing Pipeline");
    console.log(`[AvatarScene] Scene: "${sceneDescription}"`);
    console.log(`[AvatarScene] Placement: ${placement}, Aspect: ${aspectRatio}`);
    console.log("[AvatarScene] ═══════════════════════════════════════════════════════════");

    // Build the scene generation prompt
    const scenePrompt = buildScenePrompt(sceneDescription, characterDescription, placement);
    console.log(`[AvatarScene] Scene prompt: "${scenePrompt.substring(0, 150)}..."`);

    // Try FLUX Kontext first (best for character consistency)
    let sceneImageUrl: string | null = null;
    let method = "flux_kontext";

    try {
      sceneImageUrl = await generateWithFluxKontext(
        avatarImageUrl,
        scenePrompt,
        aspectRatio,
        REPLICATE_API_KEY
      );
      console.log(`[AvatarScene] ✅ FLUX Kontext succeeded: ${sceneImageUrl?.substring(0, 60)}...`);
    } catch (kontextError) {
      console.warn("[AvatarScene] FLUX Kontext failed, trying FLUX Redux...", kontextError);
      
      // Fallback to FLUX Redux (character reference)
      try {
        sceneImageUrl = await generateWithFluxRedux(
          avatarImageUrl,
          scenePrompt,
          aspectRatio,
          REPLICATE_API_KEY
        );
        method = "flux_redux";
        console.log(`[AvatarScene] ✅ FLUX Redux succeeded: ${sceneImageUrl?.substring(0, 60)}...`);
      } catch (reduxError) {
        console.warn("[AvatarScene] FLUX Redux failed, trying FLUX with reference...", reduxError);
        
        // Final fallback: Standard FLUX with image reference
        sceneImageUrl = await generateWithFluxReference(
          avatarImageUrl,
          scenePrompt,
          aspectRatio,
          REPLICATE_API_KEY
        );
        method = "flux_reference";
        console.log(`[AvatarScene] ✅ FLUX Reference succeeded: ${sceneImageUrl?.substring(0, 60)}...`);
      }
    }

    if (!sceneImageUrl) {
      throw new Error("All scene generation methods failed");
    }

    console.log("[AvatarScene] ═══════════════════════════════════════════════════════════");
    console.log("[AvatarScene] ✅ SCENE-FIRST COMPOSITING COMPLETE");
    console.log(`[AvatarScene] Method: ${method}`);
    console.log(`[AvatarScene] Output: ${sceneImageUrl}`);
    console.log("[AvatarScene] ═══════════════════════════════════════════════════════════");

    const response: AvatarSceneResponse = {
      success: true,
      sceneImageUrl,
      method,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AvatarScene] Error:", error);
    
    const response: AvatarSceneResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Build a detailed scene prompt for character-in-environment generation
 */
function buildScenePrompt(
  sceneDescription: string,
  characterDescription?: string,
  placement: string = "center"
): string {
  const positionText = 
    placement === "left" ? "on the left side of the frame" :
    placement === "right" ? "on the right side of the frame" :
    "in the center of the frame";

  const characterText = characterDescription 
    ? `The person from the reference image, ${characterDescription}, is standing ${positionText}`
    : `The person from the reference image is standing ${positionText}`;

  // Build a cinematic scene description
  return `A cinematic still frame. ${characterText}, in ${sceneDescription}. The person is facing the camera with a confident, professional expression, ready to speak. The lighting is natural and matches the environment. High quality, photorealistic, 8K resolution, professional cinematography.`;
}

/**
 * Generate scene using FLUX Kontext (best character consistency)
 * Kontext is specifically designed for maintaining character identity while changing context
 */
async function generateWithFluxKontext(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Attempting FLUX Kontext generation...");

  const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        input_image: referenceImageUrl,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        output_quality: 95,
        safety_tolerance: 5,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FLUX Kontext API error: ${response.status} - ${errorText}`);
  }

  const prediction = await response.json();
  
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  // Poll for result
  const result = await pollForImageResult(prediction.id, apiKey, 120);
  if (!result) {
    throw new Error("FLUX Kontext generation timed out");
  }
  
  return result;
}

/**
 * Generate scene using FLUX Redux (character reference mode)
 */
async function generateWithFluxRedux(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Attempting FLUX Redux generation...");

  const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        redux_image: referenceImageUrl,
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        output_quality: 95,
        redux_strength: 0.8, // Strong character influence
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FLUX Redux API error: ${response.status} - ${errorText}`);
  }

  const prediction = await response.json();
  
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  const result = await pollForImageResult(prediction.id, apiKey, 120);
  if (!result) {
    throw new Error("FLUX Redux generation timed out");
  }
  
  return result;
}

/**
 * Generate scene using FLUX 1.1 Pro with image reference
 * This is the fallback method if Kontext/Redux unavailable
 */
async function generateWithFluxReference(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Attempting FLUX 1.1 Pro with reference...");

  // First, try using image_prompt (IP-Adapter style)
  const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        image_prompt: referenceImageUrl, // Character reference
        aspect_ratio: aspectRatio,
        output_format: "jpg",
        output_quality: 95,
        prompt_upsampling: true,
        safety_tolerance: 5,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FLUX 1.1 Pro API error: ${response.status} - ${errorText}`);
  }

  const prediction = await response.json();
  
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  const result = await pollForImageResult(prediction.id, apiKey, 120);
  if (!result) {
    throw new Error("FLUX 1.1 Pro generation timed out");
  }
  
  return result;
}

/**
 * Poll for image generation result
 */
async function pollForImageResult(
  predictionId: string,
  apiKey: string,
  maxSeconds: number
): Promise<string | null> {
  for (let i = 0; i < maxSeconds; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    
    const status = await response.json();
    
    if (status.status === "succeeded") {
      return Array.isArray(status.output) ? status.output[0] : status.output;
    }
    
    if (status.status === "failed") {
      console.error(`[AvatarScene] Prediction ${predictionId} failed:`, status.error);
      throw new Error(`Image generation failed: ${status.error}`);
    }
    
    if (i % 10 === 0) {
      console.log(`[AvatarScene] Polling ${predictionId}... (${i}s, status: ${status.status})`);
    }
  }
  
  return null;
}
