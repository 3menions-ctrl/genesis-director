import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Kling 2.6 Configuration - Primary and ONLY video provider
// ============================================================================
const KLING_API_BASE = "https://api.klingai.com/v1";
const KLING_MODEL = "kling-v2-6-master";
const KLING_ENABLE_AUDIO = true; // Native audio generation

// Generate Kling JWT token
async function generateKlingJWT(): Promise<string> {
  const accessKey = Deno.env.get("KLING_ACCESS_KEY");
  const secretKey = Deno.env.get("KLING_SECRET_KEY");
  
  if (!accessKey || !secretKey) {
    throw new Error("KLING_ACCESS_KEY or KLING_SECRET_KEY is not configured");
  }

  // Kling uses HMAC-SHA256 JWT
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const message = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${message}.${signatureB64}`;
}

// ============================================================================
// APEX MANDATORY QUALITY SUFFIX - Always appended to ALL prompts
// Ensures every clip is Hollywood-grade regardless of user input
// ============================================================================
const APEX_QUALITY_SUFFIX = ", cinematic lighting, 8K resolution, ultra high definition, highly detailed, professional cinematography, film grain, masterful composition, award-winning cinematographer, ARRI Alexa camera quality, anamorphic lens flares, perfect exposure, theatrical color grading";

/**
 * Generate Bridge Clip - Transition Filler using Kling 2.6
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
    console.log(`[BridgeClip] Using Kling 2.6 (${KLING_MODEL})`);
    console.log(`[BridgeClip] Prompt: ${bridgePrompt.substring(0, 100)}...`);

    // Generate Kling JWT
    const jwtToken = await generateKlingJWT();

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

    // Kling 2.6 duration: "5" or "10" seconds
    const klingDuration = durationSeconds <= 6 ? "5" : "10";

    // Build Kling request body for image-to-video
    const requestBody: Record<string, any> = {
      model_name: KLING_MODEL,
      prompt: enhancedPrompt.slice(0, 2500),
      negative_prompt: "jarring transition, sudden movement, flickering, glitch, artifact, low quality, blur, inconsistent lighting, jump cut, character morphing, face changing",
      aspect_ratio: "16:9",
      duration: klingDuration,
      mode: "std",
      cfg_scale: 0.5,
      generate_audio: KLING_ENABLE_AUDIO,
    };

    // Add starting frame as image URL
    if (fromClipLastFrame.startsWith("http")) {
      requestBody.image_url = fromClipLastFrame;
    }

    // If we have a destination frame, use it as second reference for smooth transition
    if (toClipFirstFrame && toClipFirstFrame.startsWith("http")) {
      requestBody.image_urls = [fromClipLastFrame, toClipFirstFrame];
      console.log(`[BridgeClip] Using 2-point reference for smooth transition`);
    }

    // Generate video using Kling 2.6 image-to-video
    const endpoint = `${KLING_API_BASE}/videos/image2video`;
    
    console.log(`[BridgeClip] Calling Kling API: ${endpoint}`);
    
    const klingResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!klingResponse.ok) {
      const errorText = await klingResponse.text();
      console.error('[BridgeClip] Kling API error:', errorText);
      throw new Error(`Kling API failed: ${klingResponse.status}`);
    }

    const klingData = await klingResponse.json();
    const taskId = klingData.data?.task_id;
    
    if (!taskId) {
      console.error('[BridgeClip] Kling response:', JSON.stringify(klingData));
      throw new Error('No task_id returned from Kling');
    }

    console.log(`[BridgeClip] Kling task started: ${taskId}`);

    // Poll for completion (max 5 minutes)
    const maxPollTime = 5 * 60 * 1000;
    const pollInterval = 5000; // Kling is faster, poll every 5s
    const pollStartTime = Date.now();
    
    let videoUrl: string | null = null;

    while (Date.now() - pollStartTime < maxPollTime) {
      const pollResponse = await fetch(
        `${KLING_API_BASE}/videos/tasks/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!pollResponse.ok) {
        console.warn('[BridgeClip] Poll request failed, retrying...');
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const pollData = await pollResponse.json();
      const taskData = pollData.data || pollData;
      const status = taskData.task_status;

      if (status === 'succeed') {
        // Extract video URL from Kling response
        const videos = taskData.task_result?.videos || [];
        if (videos.length > 0 && videos[0].url) {
          videoUrl = videos[0].url;
          console.log(`[BridgeClip] Bridge clip ready: ${videoUrl}`);
        }
        break;
      } else if (status === 'failed') {
        throw new Error(`Kling generation failed: ${taskData.task_status_msg || 'Unknown error'}`);
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
          p_service: 'kling',
          p_operation: 'bridge_clip_generation',
          p_credits_charged: 8, // Bridge clips cost 8 credits
          p_real_cost_cents: 4, // Kling is more cost-effective
          p_duration_seconds: parseInt(klingDuration),
          p_status: 'completed',
          p_metadata: JSON.stringify({ 
            bridgePrompt: bridgePrompt.substring(0, 200),
            model: KLING_MODEL,
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
        durationSeconds: parseInt(klingDuration),
        processingTimeMs,
        provider: 'kling',
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
