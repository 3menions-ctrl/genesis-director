import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkContentSafety } from "../_shared/content-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVATAR GENERATION - Kling V3 Native Lip-Sync Pipeline
 * 
 * Pipeline (Kling V3 unified):
 * 1. Kling V3 (kwaivgi/kling-v3-video) with generate_audio=true
 *    - Native lip-sync: dialogue in prompt is auto-synced to mouth movements
 *    - No external TTS or Wav2Lip needed
 *    - 1080p pro mode, 3-15s clips
 * 
 * This replaces the previous Wav2Lip + audio merge approach with
 * Kling V3's native audio generation for 100% audio-visual coherence.
 */

// ═══════════════════════════════════════════════════════════════════
// Kling V3 — unified engine for avatar with native lip-sync audio
// ═══════════════════════════════════════════════════════════════════
const KLING_V3_URL = "https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions";

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

    // ═══════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK - BLOCK NSFW/INAPPROPRIATE CONTENT
    // ═══════════════════════════════════════════════════════════════════
    const textSafety = checkContentSafety(text);
    if (!textSafety.isSafe) {
      console.error(`[generate-avatar] ⛔ CONTENT BLOCKED - ${textSafety.category}`);
      return new Response(
        JSON.stringify({ success: false, error: textSafety.message, blocked: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (sceneDescription) {
      const sceneSafety = checkContentSafety(sceneDescription);
      if (!sceneSafety.isSafe) {
        console.error(`[generate-avatar] ⛔ SCENE BLOCKED - ${sceneSafety.category}`);
        return new Response(
          JSON.stringify({ success: false, error: sceneSafety.message, blocked: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (environmentPrompt) {
      const envSafety = checkContentSafety(environmentPrompt);
      if (!envSafety.isSafe) {
        console.error(`[generate-avatar] ⛔ ENV BLOCKED - ${envSafety.category}`);
        return new Response(
          JSON.stringify({ success: false, error: envSafety.message, blocked: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // ═══════════════════════════════════════════════════════════════════

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log("[generate-avatar] ═══ Kling V3 Native Lip-Sync Pipeline ═══");
    console.log(`[generate-avatar] Script: "${text.substring(0, 100)}..."`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SINGLE STEP: Kling V3 with generate_audio=true (native lip-sync)
    // Dialogue is embedded in the prompt — Kling auto-generates matching audio
    // and lip movements. No external TTS, no Wav2Lip, no audio merge needed.
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Calculate duration from text length (~150 WPM)
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedSeconds = Math.ceil((wordCount / 150) * 60);
    const videoDuration = Math.max(3, Math.min(15, estimatedSeconds || 10)); // Kling V3: 3-15s

    // Build cinematic prompt with dialogue for native lip-sync
    const userScene = sceneDescription || environmentPrompt;
    let videoPrompt = `The person in the image speaks directly to camera with natural expression, saying: "${text}". `;
    videoPrompt += "Natural lip movements matching dialogue perfectly, subtle head movements, engaged warm expression, professional presentation style, direct eye contact with camera";
    
    if (userScene && userScene.trim()) {
      videoPrompt = `Scene: ${userScene.trim()}. ${videoPrompt}`;
    }

    console.log(`[generate-avatar] Kling V3 request: duration=${videoDuration}s, generate_audio=true, hasStartImage=true`);
    console.log(`[generate-avatar] Prompt: ${videoPrompt.substring(0, 200)}...`);

    const klingResponse = await fetch(KLING_V3_URL, {
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
          generate_audio: true, // ✅ Kling V3 native lip-sync audio
          negative_prompt: "blurry, distorted, glitchy, unnatural movements, closed mouth, frozen face, robotic, stiff, static, face morphing, identity change, different person, age change",
        },
      }),
    });

    if (!klingResponse.ok) {
      const errorText = await klingResponse.text();
      console.error("[generate-avatar] Kling V3 prediction failed:", errorText);
      throw new Error(`Avatar generation failed: ${klingResponse.status} - ${errorText}`);
    }

    const klingPrediction = await klingResponse.json();
    console.log(`[generate-avatar] ✅ Kling V3 prediction created: ${klingPrediction.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: klingPrediction.id,
        videoDuration,
        status: "processing",
        message: "Avatar video is being generated with native lip-sync...",
        scriptLength: text.length,
        estimatedDuration: videoDuration,
        pipeline: "kling-v3-native-audio",
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
