import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVATAR GENERATION - Direct Script-to-Talking-Head Pipeline
 * 
 * Uses MiniMax TTS for audio + Kling for talking head animation.
 * 
 * Pipeline:
 * 1. MiniMax TTS - Convert text to high-quality speech audio (via generate-voice)
 * 2. Kling v2.6 - Generate talking head video with speech motion
 * 
 * Note: We use Kling's image-to-video with a speaking prompt rather than lipsync,
 * as this provides more natural results and avoids the multi-stage complexity.
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
      sceneDescription, // NEW: User's scene/background request
      environmentPrompt, // Alternative field name for scene
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

    console.log("[generate-avatar] Creating talking head video");
    console.log(`[generate-avatar] Script length: ${text.length} chars`);
    console.log(`[generate-avatar] Script preview: "${text.substring(0, 100)}..."`);

    // Map voice ID to MiniMax voice
    const minimaxVoice = VOICE_MAP[voiceId] || 'onyx';

    // Step 1: Generate high-quality speech with MiniMax TTS via generate-voice
    console.log(`[generate-avatar] Step 1: Generating speech with MiniMax TTS (voice: ${minimaxVoice})...`);
    
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

    // Step 2: Generate talking head video using Kling v2.6
    // We use image-to-video with a speaking prompt for natural motion
    console.log("[generate-avatar] Step 2: Generating talking head video with Kling v2.6...");
    
    // Calculate video duration - round up to nearest 5s increment (Kling supports 5s or 10s)
    const audioDurationSec = Math.ceil(audioDurationMs / 1000);
    const videoDuration = audioDurationSec <= 5 ? 5 : 10;
    
    // Build the video generation prompt
    // CRITICAL: Include user's scene/background request if provided
    const userScene = sceneDescription || environmentPrompt;
    let videoPrompt = "The person in the image is speaking naturally and expressively, direct eye contact with camera, subtle natural head movements, professional presentation style, clear and articulate speech with natural lip movements, engaged expression";
    
    if (userScene && userScene.trim()) {
      // Prepend scene description for visual context
      videoPrompt = `Scene: ${userScene.trim()}. ${videoPrompt}`;
      console.log(`[generate-avatar] Including user scene description: "${userScene.substring(0, 100)}..."`);
    } else {
      // Extract scene hints from the script text itself if no explicit scene provided
      // Look for environmental keywords that suggest a scene change
      const sceneKeywords = text.match(/(?:go to|at the|in the|inside|outside|standing in|walking through|sitting at|at a|in a)\s+([^,.!?]+)/i);
      if (sceneKeywords && sceneKeywords[1]) {
        const extractedScene = sceneKeywords[1].trim();
        videoPrompt = `Scene: ${extractedScene}. ${videoPrompt}`;
        console.log(`[generate-avatar] Extracted scene from script: "${extractedScene}"`);
      }
    }
    
    console.log(`[generate-avatar] Final video prompt: "${videoPrompt.substring(0, 200)}..."`);
    
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
      console.error("[generate-avatar] Kling video generation failed:", errorText);
      throw new Error(`Video generation failed: ${klingResponse.status} - ${errorText}`);
    }

    const klingPrediction = await klingResponse.json();
    console.log("[generate-avatar] Kling prediction created:", klingPrediction.id);

    // Return the prediction info for status polling
    // The check-specialized-status function will poll until completion
    return new Response(
      JSON.stringify({
        success: true,
        predictionId: klingPrediction.id,
        audioUrl,
        audioDurationMs,
        videoDuration,
        status: "processing",
        message: "Avatar video is being generated. Creating natural speaking animation...",
        scriptLength: text.length,
        estimatedDuration: videoDuration,
        pipeline: "kling-avatar",
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
 * Estimate audio duration based on text length (~150 WPM)
 */
function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
