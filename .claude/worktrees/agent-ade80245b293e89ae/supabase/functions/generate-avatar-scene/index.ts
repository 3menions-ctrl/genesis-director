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
    // ═══ AUTH GUARD: Prevent unauthorized API credit consumption ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

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
 * Build a WORLD-CLASS scene prompt for character-in-environment generation
 * Optimized for ultra-high quality, cinematic backgrounds
 */
/**
 * Build a WORLD-CLASS scene prompt for character-in-environment generation
 * CRITICAL: Enforces "ALREADY IN POSITION" semantics - avatar starts IN the scene, not entering it
 */
function buildScenePrompt(
  sceneDescription: string,
  characterDescription?: string,
  placement: string = "center"
): string {
  const positionText = 
    placement === "left" ? "ALREADY positioned on the left third of the frame, fully settled and grounded" :
    placement === "right" ? "ALREADY positioned on the right third of the frame, fully settled and grounded" :
    "ALREADY positioned centrally in the frame, fully settled and grounded";

  // CRITICAL: "Already in position" enforcement - no entering, walking in, or arriving
  const alreadyInSceneEnforcement = [
    "The person is ALREADY fully present in the environment",
    "NOT entering or arriving",
    "NOT walking into frame",
    "The scene captures them mid-moment, fully situated",
    "They have been here - this is their natural position",
  ].join(". ");

  const characterText = characterDescription 
    ? `The person from the reference image, ${characterDescription}, is ${positionText}. ${alreadyInSceneEnforcement}`
    : `The person from the reference image is ${positionText}. ${alreadyInSceneEnforcement}`;

  // Build a VIBRANT, HIGH-ENERGY scene description
  const qualityModifiers = [
    "masterpiece quality",
    "award-winning cinematography", 
    "shot on ARRI Alexa 65",
    "8K ultra high resolution",
    "exceptional dynamic range",
    "photorealistic rendering",
    "vibrant professional color grading",
    "bright natural lighting with soft light rays",
    "cinema-grade depth of field",
    "clear atmospheric perspective",
  ].join(", ");

  const lightingModifiers = [
    "bright warm natural lighting",
    "three-point professional lighting setup",
    "soft bright key light illuminating the face",
    "subtle rim lighting for subject separation",
    "warm ambient fill light matching environment",
  ].join(", ");

  const technicalModifiers = [
    "sharp focus on subject",
    "naturally blurred background with pleasing bokeh",
    "rich vibrant saturated colors",
    "clean crisp image quality",
    "no artifacts or distortions",
    "clean professional composition",
    "bright and inviting atmosphere",
  ].join(", ");

  // CRITICAL: Final prompt reinforces static, already-positioned state with POSITIVE energy
  return `A breathtaking vibrant cinematic still frame, ${qualityModifiers}. ${characterText}, completely immersed in ${sceneDescription}. The environment is rendered with extraordinary detail, depth, and a bright inviting atmosphere. ${lightingModifiers}. The person maintains perfect eye contact with the camera, exuding confidence, warmth, and positive energy, ready to speak directly to the viewer. They are STATIONARY and GROUNDED - no motion blur, no movement artifacts. ${technicalModifiers}. The overall aesthetic is bright, polished, and uplifting with Hollywood production values.`;
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
  console.log("[AvatarScene] Attempting FLUX Kontext Pro (max quality) generation...");

  // Use FLUX Kontext Pro for maximum quality
  const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
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
        output_format: "png",        // PNG for lossless quality
        output_quality: 100,          // Maximum quality
        safety_tolerance: 5,
        guidance_scale: 4.5,          // Balanced guidance for quality
        num_inference_steps: 50,      // More steps = higher quality
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Fallback to dev version if pro unavailable
    if (response.status === 404 || response.status === 422) {
      console.log("[AvatarScene] Pro not available, falling back to Kontext dev...");
      return generateWithFluxKontextDev(referenceImageUrl, prompt, aspectRatio, apiKey);
    }
    throw new Error(`FLUX Kontext Pro API error: ${response.status} - ${errorText}`);
  }

  const prediction = await response.json();
  
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  // Poll for result with extended timeout for higher quality
  const result = await pollForImageResult(prediction.id, apiKey, 180);
  if (!result) {
    throw new Error("FLUX Kontext Pro generation timed out");
  }
  
  return result;
}

/**
 * Fallback to FLUX Kontext Dev with maximum quality settings
 */
async function generateWithFluxKontextDev(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Using FLUX Kontext Dev with max quality settings...");

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
        output_format: "png",
        output_quality: 100,
        safety_tolerance: 5,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FLUX Kontext Dev API error: ${response.status} - ${errorText}`);
  }

  const prediction = await response.json();
  
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  const result = await pollForImageResult(prediction.id, apiKey, 150);
  if (!result) {
    throw new Error("FLUX Kontext Dev generation timed out");
  }
  
  return result;
}

/**
 * Generate scene using FLUX Redux (character reference mode) with maximum quality
 */
async function generateWithFluxRedux(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Attempting FLUX Redux generation with max quality...");

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
        output_format: "png",          // Lossless
        output_quality: 100,            // Maximum
        redux_strength: 0.85,           // Strong character preservation
        num_inference_steps: 40,        // More steps for quality
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

  const result = await pollForImageResult(prediction.id, apiKey, 150);
  if (!result) {
    throw new Error("FLUX Redux generation timed out");
  }
  
  return result;
}

/**
 * Generate scene using FLUX 1.1 Pro Ultra with image reference
 * This is the fallback method with maximum quality settings
 */
async function generateWithFluxReference(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Attempting FLUX 1.1 Pro Ultra with max quality...");

  // Use FLUX 1.1 Pro Ultra for best possible fallback quality
  const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro-ultra/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        image_prompt: referenceImageUrl,
        aspect_ratio: aspectRatio,
        output_format: "png",
        output_quality: 100,
        prompt_upsampling: true,
        safety_tolerance: 5,
        raw: false,                     // Processed for best quality
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Fallback to standard 1.1 Pro if Ultra unavailable
    if (response.status === 404 || response.status === 422) {
      console.log("[AvatarScene] Ultra not available, using standard 1.1 Pro...");
      return generateWithFluxProStandard(referenceImageUrl, prompt, aspectRatio, apiKey);
    }
    throw new Error(`FLUX 1.1 Pro Ultra API error: ${response.status} - ${errorText}`);
  }

  const prediction = await response.json();
  
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  const result = await pollForImageResult(prediction.id, apiKey, 180);
  if (!result) {
    throw new Error("FLUX 1.1 Pro Ultra generation timed out");
  }
  
  return result;
}

/**
 * Standard FLUX 1.1 Pro fallback
 */
async function generateWithFluxProStandard(
  referenceImageUrl: string,
  prompt: string,
  aspectRatio: string,
  apiKey: string
): Promise<string> {
  console.log("[AvatarScene] Using standard FLUX 1.1 Pro...");

  const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        image_prompt: referenceImageUrl,
        aspect_ratio: aspectRatio,
        output_format: "png",
        output_quality: 100,
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

  const result = await pollForImageResult(prediction.id, apiKey, 150);
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
