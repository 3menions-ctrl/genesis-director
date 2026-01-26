import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Kling 2.6 via Replicate - Latest Model
// ============================================================================
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const KLING_MODEL = "kwaivgi/kling-v2.6";
const KLING_ENABLE_AUDIO = true; // Native audio generation

// ============================================================================
// APEX MANDATORY QUALITY SUFFIX - Always appended to ALL prompts
// Ensures every clip is Hollywood-grade regardless of user input
// ============================================================================
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, film grain, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading";

/**
 * Generate Bridge Clip - Transition Filler using Kling 2.6 via Replicate
 * 
 * Creates a short transition clip that bridges two incompatible scenes.
 * Uses the last frame of clip A as a starting point and generates a
 * smooth transition towards clip B.
 */

interface BridgeClipRequest {
  projectId: string;
  userId?: string;
  fromClipLastFrame: string;  // URL to last frame of clip A
  toClipFirstFrame?: string;  // Optional: URL to first frame of clip B
  bridgePrompt: string;       // Description of the bridge clip
  durationSeconds: number;    // 2-4 seconds typical
  sceneContext?: {
    lighting?: string;
    colorPalette?: string;
    environment?: string;
    mood?: string;
  };
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: BridgeClipRequest = await req.json();
    const { 
      projectId, 
      userId,
      fromClipLastFrame, 
      toClipFirstFrame,
      bridgePrompt, 
      durationSeconds = 3,
      sceneContext 
    } = request;

    if (!fromClipLastFrame || !bridgePrompt) {
      throw new Error("fromClipLastFrame and bridgePrompt are required");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log(`[BridgeClip] Generating ${durationSeconds}s bridge clip for project ${projectId}`);
    console.log(`[BridgeClip] Using Kling v2.6 via Replicate`);
    console.log(`[BridgeClip] Prompt: ${bridgePrompt.substring(0, 100)}...`);

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
        enhancedPrompt = `${bridgePrompt}. ${contextParts.join('. ')}.`;
      }
    }

    // Add cinematic transition instructions + APEX QUALITY SUFFIX
    enhancedPrompt = `Cinematic transition shot: ${enhancedPrompt}. Smooth, gradual camera movement. Professional color grading. Maintain visual continuity with surrounding scenes. No jarring cuts or sudden changes${APEX_QUALITY_SUFFIX}`;

    console.log(`[BridgeClip] 🎬 APEX Quality Suffix appended`);
    console.log(`[BridgeClip] Enhanced prompt: ${enhancedPrompt.substring(0, 150)}...`);

    // Kling duration: 5 or 10 seconds
    const klingDuration = durationSeconds <= 6 ? 5 : 10;

    // Build Replicate input for Kling v2.6
    const replicateInput: Record<string, any> = {
      prompt: enhancedPrompt.slice(0, 2500),
      negative_prompt: "jarring transition, sudden movement, flickering, glitch, artifact, low quality, blur, inconsistent lighting, jump cut, character morphing, face changing",
      aspect_ratio: "16:9",
      duration: klingDuration,
      cfg_scale: 0.5,
    };

    // Add starting frame as image (for image-to-video)
    if (fromClipLastFrame.startsWith("http")) {
      replicateInput.start_image = fromClipLastFrame;
      console.log(`[BridgeClip] Using start frame for image-to-video`);
    }

    // Create Replicate prediction
    console.log(`[BridgeClip] Creating Replicate prediction for Kling v2.6`);
    
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: KLING_MODEL,
        input: replicateInput,
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[BridgeClip] Replicate API error:', errorText);
      throw new Error(`Replicate API failed: ${createResponse.status}`);
    }

    const prediction: ReplicatePrediction = await createResponse.json();
    const predictionId = prediction.id;
    
    if (!predictionId) {
      console.error('[BridgeClip] Replicate response:', JSON.stringify(prediction));
      throw new Error('No prediction ID returned from Replicate');
    }

    console.log(`[BridgeClip] Replicate prediction started: ${predictionId}`);

    // Poll for completion (max 6 minutes)
    const maxPollTime = 6 * 60 * 1000;
    const pollInterval = 4000; // 4 second intervals
    const pollStartTime = Date.now();
    
    let videoUrl: string | null = null;

    while (Date.now() - pollStartTime < maxPollTime) {
      const pollResponse = await fetch(
        `${REPLICATE_API_URL}/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          }
        }
      );

      if (!pollResponse.ok) {
        console.warn('[BridgeClip] Poll request failed, retrying...');
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const pollData: ReplicatePrediction = await pollResponse.json();
      const status = pollData.status;

      if (status === 'succeeded') {
        // Extract video URL from output
        const output = pollData.output;
        if (typeof output === "string") {
          videoUrl = output;
        } else if (Array.isArray(output) && output.length > 0) {
          videoUrl = output[0];
        }
        
        if (videoUrl) {
          console.log(`[BridgeClip] Bridge clip ready: ${videoUrl}`);
        }
        break;
      } else if (status === 'failed') {
        throw new Error(`Replicate generation failed: ${pollData.error || 'Unknown error'}`);
      } else if (status === 'canceled') {
        throw new Error('Replicate generation was canceled');
      }

      console.log(`[BridgeClip] Status: ${status} (${Math.round((Date.now() - pollStartTime) / 1000)}s)`);
      await new Promise(r => setTimeout(r, pollInterval));
    }

    if (!videoUrl) {
      throw new Error('Bridge clip generation timed out or failed');
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[BridgeClip] Complete in ${processingTimeMs}ms`);

    // Log API cost
    if (userId) {
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId,
          p_shot_id: 'bridge_clip',
          p_service: 'replicate-kling',
          p_operation: 'bridge_clip_generation',
          p_credits_charged: 8, // Bridge clips cost 8 credits
          p_real_cost_cents: 4, // Replicate Kling pricing
          p_duration_seconds: klingDuration,
          p_status: 'completed',
          p_metadata: JSON.stringify({ 
            bridgePrompt: bridgePrompt.substring(0, 200),
            model: KLING_MODEL,
            predictionId,
            audioEnabled: KLING_ENABLE_AUDIO
          }),
        });
      } catch (costError) {
        console.warn('[BridgeClip] Failed to log cost:', costError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        durationSeconds: klingDuration,
        processingTimeMs,
        provider: 'replicate',
        model: KLING_MODEL,
        audioIncluded: KLING_ENABLE_AUDIO,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[BridgeClip] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
