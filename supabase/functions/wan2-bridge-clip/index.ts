import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Wan 2.1 Configuration via Replicate
// Model: alibaba-pai/wan2.1-i2v-480p (image-to-video)
// Superior temporal consistency for smooth transitions
// ============================================================================
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// Wan 2.1 model versions
const WAN_MODELS = {
  "480p": "alibaba-pai/wan2.1-i2v-480p",
  "720p": "alibaba-pai/wan2.1-i2v-720p",
} as const;

// APEX mandatory quality suffix for Hollywood-grade output
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, film grain, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, perfect exposure, theatrical color grading";

interface Wan2BridgeRequest {
  projectId: string;
  userId?: string;
  fromClipLastFrame: string;    // URL to last frame of clip A (required)
  toClipFirstFrame?: string;    // URL to first frame of clip B (optional)
  bridgePrompt: string;         // Description of the transition
  durationSeconds?: number;     // 3-5 seconds typical (Wan 2.1 supports variable)
  resolution?: "480p" | "720p"; // Wan 2.1 resolution
  sceneContext?: {
    lighting?: string;
    colorPalette?: string;
    environment?: string;
    mood?: string;
  };
}

interface Wan2BridgeResult {
  success: boolean;
  videoUrl?: string;
  durationSeconds?: number;
  processingTimeMs: number;
  provider: "replicate";
  model: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: Wan2BridgeRequest = await req.json();
    const {
      projectId,
      userId,
      fromClipLastFrame,
      toClipFirstFrame,
      bridgePrompt,
      durationSeconds = 4,
      resolution = "480p",
      sceneContext,
    } = request;

    if (!fromClipLastFrame || !bridgePrompt) {
      throw new Error("fromClipLastFrame and bridgePrompt are required");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log(`[Wan2Bridge] Generating ${durationSeconds}s bridge with Wan 2.1 (${resolution})`);
    console.log(`[Wan2Bridge] Project: ${projectId}`);
    console.log(`[Wan2Bridge] Prompt: ${bridgePrompt.substring(0, 100)}...`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build enhanced prompt with scene context
    let enhancedPrompt = bridgePrompt;
    if (sceneContext) {
      const contextParts = [];
      if (sceneContext.lighting) contextParts.push(`Lighting: ${sceneContext.lighting}`);
      if (sceneContext.colorPalette) contextParts.push(`Colors: ${sceneContext.colorPalette}`);
      if (sceneContext.environment) contextParts.push(`Environment: ${sceneContext.environment}`);
      if (sceneContext.mood) contextParts.push(`Mood: ${sceneContext.mood}`);
      if (contextParts.length > 0) {
        enhancedPrompt = `${bridgePrompt}. ${contextParts.join(". ")}.`;
      }
    }

    // Add transition-specific instructions + APEX quality suffix
    enhancedPrompt = `Smooth cinematic transition: ${enhancedPrompt}. Gradual camera movement, maintaining visual continuity. Professional color grading, no jarring cuts${APEX_QUALITY_SUFFIX}`;

    console.log(`[Wan2Bridge] Enhanced prompt length: ${enhancedPrompt.length}`);

    // ============================================================================
    // Step 1: Create Replicate prediction for Wan 2.1
    // ============================================================================
    const modelName = WAN_MODELS[resolution];
    
    const replicateInput: Record<string, any> = {
      prompt: enhancedPrompt.slice(0, 2000),
      image: fromClipLastFrame,
      negative_prompt: "jarring transition, sudden movement, flickering, glitch, artifact, low quality, blur, inconsistent lighting, jump cut, morphing, face changing, distortion, watermark",
      num_frames: durationSeconds * 16, // Wan 2.1 runs at ~16 fps
      guidance_scale: 5.0,
      num_inference_steps: 30,
    };

    // Add end frame reference if available (for smoother transitions)
    if (toClipFirstFrame) {
      console.log(`[Wan2Bridge] Using destination frame for smooth transition`);
      // Wan 2.1 can use end_image for interpolation
      replicateInput.end_image = toClipFirstFrame;
    }

    console.log(`[Wan2Bridge] Calling Replicate API: ${modelName}`);

    const createResponse = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait", // Wait up to 60s for quick predictions
      },
      body: JSON.stringify({
        model: modelName,
        input: replicateInput,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Wan2Bridge] Replicate API error:", errorText);
      throw new Error(`Replicate API failed: ${createResponse.status}`);
    }

    let prediction = await createResponse.json();
    console.log(`[Wan2Bridge] Prediction created: ${prediction.id}, status: ${prediction.status}`);

    // ============================================================================
    // Step 2: Poll for completion (if not already complete)
    // ============================================================================
    const maxPollTime = 8 * 60 * 1000; // 8 minutes max (Wan 2.1 can take a while)
    const pollInterval = 5000;
    const pollStartTime = Date.now();

    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      if (Date.now() - pollStartTime > maxPollTime) {
        throw new Error("Wan 2.1 generation timed out after 8 minutes");
      }

      await new Promise(r => setTimeout(r, pollInterval));

      const pollResponse = await fetch(`${REPLICATE_API_URL}/${prediction.id}`, {
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        },
      });

      if (!pollResponse.ok) {
        console.warn("[Wan2Bridge] Poll failed, retrying...");
        continue;
      }

      prediction = await pollResponse.json();
      console.log(`[Wan2Bridge] Status: ${prediction.status} (${Math.round((Date.now() - pollStartTime) / 1000)}s)`);
    }

    if (prediction.status === "failed") {
      throw new Error(`Wan 2.1 generation failed: ${prediction.error || "Unknown error"}`);
    }

    // ============================================================================
    // Step 3: Extract video URL from prediction output
    // ============================================================================
    const output = prediction.output;
    let videoUrl: string | null = null;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      videoUrl = output[0];
    } else if (output?.video) {
      videoUrl = output.video;
    }

    if (!videoUrl) {
      console.error("[Wan2Bridge] Unexpected output format:", JSON.stringify(output));
      throw new Error("No video URL in Wan 2.1 output");
    }

    console.log(`[Wan2Bridge] ✓ Bridge clip ready: ${videoUrl}`);

    const processingTimeMs = Date.now() - startTime;

    // ============================================================================
    // Step 4: Log API cost
    // ============================================================================
    if (userId) {
      try {
        await supabase.rpc("log_api_cost", {
          p_project_id: projectId,
          p_shot_id: "wan2_bridge",
          p_service: "replicate",
          p_operation: "wan2_bridge_clip",
          p_credits_charged: 10, // Wan 2.1 bridge clips cost 10 credits
          p_real_cost_cents: 5,  // Replicate cost estimate
          p_duration_seconds: durationSeconds,
          p_status: "completed",
          p_metadata: JSON.stringify({
            model: modelName,
            resolution,
            promptLength: enhancedPrompt.length,
            predictionId: prediction.id,
          }),
        });
      } catch (costError) {
        console.warn("[Wan2Bridge] Failed to log cost:", costError);
      }
    }

    const result: Wan2BridgeResult = {
      success: true,
      videoUrl,
      durationSeconds,
      processingTimeMs,
      provider: "replicate",
      model: modelName,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Wan2Bridge] Error:", error);

    const result: Wan2BridgeResult = {
      success: false,
      processingTimeMs: Date.now() - startTime,
      provider: "replicate",
      model: WAN_MODELS["480p"],
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
