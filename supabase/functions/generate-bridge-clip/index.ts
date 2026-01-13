import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAccessToken } from "../_shared/gcp-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// APEX MANDATORY QUALITY SUFFIX - Always appended to ALL prompts
// Ensures every clip is Hollywood-grade regardless of user input
// ============================================================================
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, film grain, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading";

/**
 * Generate Bridge Clip - Veed-Level Transition Filler
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

// Fetch image and convert to base64
async function imageToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
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

    console.log(`[BridgeClip] Generating ${durationSeconds}s bridge clip for project ${projectId}`);
    console.log(`[BridgeClip] Prompt: ${bridgePrompt.substring(0, 100)}...`);

    // Get service account credentials
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const gcpProjectId = serviceAccount.project_id;

    // Get access token
    const accessToken = await getAccessToken(serviceAccount);

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

    // Convert starting frame to base64
    const imageBase64 = await imageToBase64(fromClipLastFrame);

    // Generate video using Veo 3.1 with image-to-video
    const model = "veo-3.1-generate-001"; // Latest stable Veo 3.1
    const veoEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/${model}:predictLongRunning`;
    
    // For image-to-video, Veo 3.1 supports [4, 6, 8] seconds - prefer 6 for quality
    const validDuration = durationSeconds <= 4 ? 6 : (durationSeconds <= 7 ? 6 : 8);
    
    const veoResponse = await fetch(veoEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{
          prompt: enhancedPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: "image/jpeg"
          }
        }],
        parameters: {
          aspectRatio: "16:9",
          sampleCount: 1,
          durationSeconds: validDuration,
          resolution: "1080p",
          personGeneration: "allow_adult",
          negativePrompt: "jarring transition, sudden movement, flickering, glitch, artifact, low quality, blur, inconsistent lighting, jump cut"
        }
      })
    });

    if (!veoResponse.ok) {
      const errorText = await veoResponse.text();
      console.error('[BridgeClip] Veo API error:', errorText);
      throw new Error(`Veo API failed: ${veoResponse.status}`);
    }

    const veoData = await veoResponse.json();
    const operationName = veoData.name;
    
    if (!operationName) {
      throw new Error('No operation name returned from Veo');
    }

    console.log(`[BridgeClip] Veo operation started: ${operationName}`);

    // Poll for completion (max 5 minutes)
    const maxPollTime = 5 * 60 * 1000;
    const pollInterval = 10000;
    const pollStartTime = Date.now();
    
    let videoUrl: string | null = null;

    while (Date.now() - pollStartTime < maxPollTime) {
      const pollResponse = await fetch(
        `https://us-central1-aiplatform.googleapis.com/v1/${operationName}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!pollResponse.ok) {
        console.warn('[BridgeClip] Poll request failed, retrying...');
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const pollData = await pollResponse.json();

      if (pollData.done) {
        if (pollData.error) {
          throw new Error(`Veo generation failed: ${pollData.error.message}`);
        }

        // Extract video from response
        const predictions = pollData.response?.predictions || [];
        if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
          // Upload to Supabase storage
          const videoBuffer = Uint8Array.from(atob(predictions[0].bytesBase64Encoded), c => c.charCodeAt(0));
          const fileName = `bridge_${projectId}_${Date.now()}.mp4`;
          
          const { error: uploadError } = await supabase.storage
            .from('video-clips')
            .upload(fileName, videoBuffer, {
              contentType: 'video/mp4',
              upsert: true
            });

          if (uploadError) {
            throw new Error(`Failed to upload bridge clip: ${uploadError.message}`);
          }

          videoUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${fileName}`;
          console.log(`[BridgeClip] Bridge clip uploaded: ${videoUrl}`);
        }
        break;
      }

      console.log(`[BridgeClip] Still generating... (${Math.round((Date.now() - pollStartTime) / 1000)}s)`);
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
          p_user_id: userId,
          p_project_id: projectId,
          p_shot_id: 'bridge_clip',
          p_service: 'veo',
          p_operation: 'bridge_clip_generation',
          p_credits_charged: 10, // Bridge clips cost 10 credits
          p_real_cost_cents: 50, // Approximate Veo cost
          p_duration_seconds: durationSeconds,
          p_status: 'completed',
          p_metadata: JSON.stringify({ bridgePrompt: bridgePrompt.substring(0, 200) }),
        });
      } catch (costError) {
        console.warn('[BridgeClip] Failed to log cost:', costError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        durationSeconds,
        processingTimeMs,
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
