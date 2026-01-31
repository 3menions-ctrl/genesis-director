import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVATAR GENERATION - True Lip-Sync Pipeline
 * 
 * Pipeline:
 * 1. MiniMax TTS - Convert text to high-quality speech audio (via generate-voice)
 * 2. Wav2Lip - Audio-driven lip-sync using the generated audio + avatar face
 * 
 * This replaces the previous Kling-based "speaking animation" approach with
 * true audio-driven lip synchronization for accurate mouth movements.
 */

// Voice mapping for MiniMax (must match generate-voice)
const VOICE_MAP: Record<string, string> = {
  // ElevenLabs IDs mapped to MiniMax voices
  'onwK4e9ZLuTAKqWW03F9': 'onyx',    // Daniel -> onyx (deep male)
  'JBFqnCBsd6RMkjVDRZzb': 'echo',    // George -> echo (warm male)
  'EXAVITQu4vr4xnSDxMaL': 'nova',    // Sarah -> nova (female)
  'pFZP5JQG7iQjIQuC4Bku': 'shimmer', // Lily -> shimmer (female)
  'cjVigY5qzO86Huf0OWal': 'alloy',   // Eric -> alloy (neutral)
  
  // Direct MiniMax voice names
  'onyx': 'onyx',
  'echo': 'echo',
  'fable': 'fable',
  'nova': 'nova',
  'shimmer': 'shimmer',
  'alloy': 'alloy',
  'bella': 'bella',
  'adam': 'adam',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      text,
      voiceId = "onyx",
      avatarImageUrl,
      aspectRatio = "16:9",
      sceneDescription,
      environmentPrompt,
    } = await req.json();

    if (!text || !avatarImageUrl) {
      throw new Error("Both 'text' (script) and 'avatarImageUrl' are required");
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[generate-avatar] Creating lip-synced talking head video");
    console.log(`[generate-avatar] Script: "${text.substring(0, 100)}..."`);

    // Map voice ID to MiniMax voice
    const minimaxVoice = VOICE_MAP[voiceId] || 'onyx';

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Generate high-quality speech with MiniMax TTS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`[generate-avatar] Step 1: Generating speech (voice: ${minimaxVoice})...`);
    
    const voiceResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        text: text,
        voiceId: minimaxVoice,
        speed: 1.0,
      }),
    });

    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text();
      console.error("[generate-avatar] Voice generation failed:", errorText);
      throw new Error(`TTS generation failed: ${voiceResponse.status} - ${errorText}`);
    }

    const voiceResult = await voiceResponse.json();
    
    if (!voiceResult.success || !voiceResult.audioUrl) {
      throw new Error("Voice generation failed - no audio URL returned");
    }

    const audioUrl = voiceResult.audioUrl;
    const audioDurationMs = voiceResult.durationMs || estimateDuration(text);
    console.log("[generate-avatar] Audio generated:", audioUrl);
    console.log(`[generate-avatar] Audio duration: ${Math.round(audioDurationMs / 1000)}s`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Generate lip-synced video using Wav2Lip
    // This provides TRUE audio-driven lip synchronization
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("[generate-avatar] Step 2: Generating lip-synced video with Wav2Lip...");
    
    // Wav2Lip takes the face image + audio and generates a lip-synced video
    // where the mouth movements precisely match the spoken words
    const wav2lipResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait=120", // Wait up to 2 minutes for completion
      },
      body: JSON.stringify({
        version: "8d65e3f4f4298520e079198b493c25adfc43c058ffec924f2aefc8010ed25eef",
        input: {
          face: avatarImageUrl,
          audio: audioUrl,
          fps: 25,
          pads: "0 10 0 0", // Padding: top bottom left right (include chin)
          smooth: true,
          resize_factor: 1,
        },
      }),
    });

    if (!wav2lipResponse.ok) {
      const errorText = await wav2lipResponse.text();
      console.error("[generate-avatar] Wav2Lip generation failed:", errorText);
      
      // Fallback to Kling if Wav2Lip fails
      console.log("[generate-avatar] Falling back to Kling speaking animation...");
      return await fallbackToKling({
        text,
        avatarImageUrl,
        audioUrl,
        audioDurationMs,
        aspectRatio,
        sceneDescription,
        environmentPrompt,
        REPLICATE_API_KEY,
      });
    }

    const wav2lipPrediction = await wav2lipResponse.json();
    console.log("[generate-avatar] Wav2Lip prediction:", wav2lipPrediction.id, "status:", wav2lipPrediction.status);

    // If completed synchronously (due to Prefer: wait), return the video
    if (wav2lipPrediction.status === "succeeded" && wav2lipPrediction.output) {
      console.log("[generate-avatar] Lip-sync video completed:", wav2lipPrediction.output);
      return new Response(
        JSON.stringify({
          success: true,
          predictionId: wav2lipPrediction.id,
          videoUrl: wav2lipPrediction.output,
          audioUrl,
          audioDurationMs,
          videoDuration: Math.ceil(audioDurationMs / 1000),
          status: "completed",
          message: "Lip-synced avatar video generated successfully!",
          scriptLength: text.length,
          pipeline: "wav2lip-lipsync",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If still processing, return prediction ID for polling
    return new Response(
      JSON.stringify({
        success: true,
        predictionId: wav2lipPrediction.id,
        audioUrl,
        audioDurationMs,
        videoDuration: Math.ceil(audioDurationMs / 1000),
        status: "processing",
        message: "Creating lip-synced avatar video. Mouth movements will match your script exactly...",
        scriptLength: text.length,
        estimatedDuration: Math.ceil(audioDurationMs / 1000),
        pipeline: "wav2lip-lipsync",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-avatar] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Fallback to Kling speaking animation if Wav2Lip fails
 */
async function fallbackToKling(params: {
  text: string;
  avatarImageUrl: string;
  audioUrl: string;
  audioDurationMs: number;
  aspectRatio: string;
  sceneDescription?: string;
  environmentPrompt?: string;
  REPLICATE_API_KEY: string;
}): Promise<Response> {
  const {
    text,
    avatarImageUrl,
    audioUrl,
    audioDurationMs,
    aspectRatio,
    sceneDescription,
    environmentPrompt,
    REPLICATE_API_KEY,
  } = params;

  const audioDurationSec = Math.ceil(audioDurationMs / 1000);
  const videoDuration = audioDurationSec < 4 ? 5 : 10;
  
  const userScene = sceneDescription || environmentPrompt;
  let videoPrompt = "The person in the image is speaking naturally and expressively, direct eye contact with camera, subtle natural head movements, professional presentation style, clear and articulate speech with natural lip movements, engaged expression";
  
  if (userScene && userScene.trim()) {
    videoPrompt = `Scene: ${userScene.trim()}. ${videoPrompt}`;
  }
  
  const klingResponse = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.6/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        mode: "pro",
        prompt: videoPrompt,
        duration: videoDuration,
        start_image: avatarImageUrl,
        aspect_ratio: aspectRatio,
        negative_prompt: "blurry, distorted, glitchy, unnatural movements, closed mouth, frozen face, robotic, stiff",
      },
    }),
  });

  if (!klingResponse.ok) {
    const errorText = await klingResponse.text();
    throw new Error(`Fallback video generation failed: ${klingResponse.status} - ${errorText}`);
  }

  const klingPrediction = await klingResponse.json();
  console.log("[generate-avatar] Kling fallback prediction:", klingPrediction.id);

  return new Response(
    JSON.stringify({
      success: true,
      predictionId: klingPrediction.id,
      audioUrl,
      audioDurationMs,
      videoDuration,
      status: "processing",
      message: "Avatar video is being generated (fallback mode)...",
      scriptLength: text.length,
      estimatedDuration: videoDuration,
      pipeline: "kling-avatar-fallback",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Estimate audio duration based on text length (~150 WPM)
 */
function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
