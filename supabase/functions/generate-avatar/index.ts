import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVATAR GENERATION - Direct Script-to-Talking-Head Pipeline
 * 
 * CRITICAL: The text input IS the final spoken script - no breakdown needed.
 * This function generates a talking head video that speaks the exact text provided.
 * 
 * Pipeline:
 * 1. ElevenLabs TTS - Convert text to high-quality speech audio
 * 2. SadTalker/Wav2Lip - Lip-sync the audio to the avatar image
 * 
 * The result is a single video where the avatar speaks the exact script.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      text,  // The EXACT script to be spoken - no modification
      voiceId = "onwK4e9ZLuTAKqWW03F9", // Daniel - professional male voice
      avatarImageUrl,
      aspectRatio = "16:9"
    } = await req.json();

    if (!text || !avatarImageUrl) {
      throw new Error("Both 'text' (script) and 'avatarImageUrl' are required");
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log("[generate-avatar] Creating talking head video");
    console.log(`[generate-avatar] Script length: ${text.length} chars`);
    console.log(`[generate-avatar] Script preview: "${text.substring(0, 100)}..."`);

    // Step 1: Generate high-quality speech with ElevenLabs
    console.log("[generate-avatar] Step 1: Generating speech with ElevenLabs...");
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text, // Use the EXACT text as provided
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("[generate-avatar] ElevenLabs TTS failed:", errorText);
      throw new Error(`TTS generation failed: ${ttsResponse.status}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log("[generate-avatar] Audio generated, size:", audioBuffer.byteLength);

    // Upload audio to Supabase storage for persistence
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const audioFileName = `avatar-audio-${Date.now()}.mp3`;
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/voice-tracks/${audioFileName}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "audio/mpeg",
        },
        body: audioBuffer,
      }
    );

    if (!uploadResponse.ok) {
      console.error("[generate-avatar] Audio upload failed");
      throw new Error("Failed to upload audio");
    }

    const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/voice-tracks/${audioFileName}`;
    console.log("[generate-avatar] Audio uploaded to:", audioUrl);

    // Step 2: Generate lip-synced talking head with SadTalker
    console.log("[generate-avatar] Step 2: Generating talking head video...");
    
    // SadTalker produces high-quality lip-synced videos
    const lipSyncResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "a519cc0cfebaaeade068b23899165a11ec76aaa1a2869bb9e25e0a5d0bb42da8", // SadTalker
        input: {
          source_image: avatarImageUrl,
          driven_audio: audioUrl,
          preprocess: "crop", // Focus on face
          still_mode: false,  // Allow head movement
          use_enhancer: true, // High quality output
          facerender: "facevid2vid", // Best quality face rendering
          expression_scale: 1.0,
        },
      }),
    });

    if (!lipSyncResponse.ok) {
      const errorText = await lipSyncResponse.text();
      console.error("[generate-avatar] SadTalker initiation failed:", errorText);
      
      // Fallback to Wav2Lip if SadTalker fails
      console.log("[generate-avatar] Trying fallback with Wav2Lip...");
      const fallbackResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "8d65e3f4f4298520e079198b493c25adfc43c058ffec924f2aefc8010ed25eef", // Wav2Lip
          input: {
            face: avatarImageUrl,
            audio: audioUrl,
            pads: "0 10 0 0",
            smooth: true,
            fps: 25,
          },
        }),
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Lip sync failed: ${lipSyncResponse.status}`);
      }

      const fallbackPrediction = await fallbackResponse.json();
      console.log("[generate-avatar] Wav2Lip prediction created:", fallbackPrediction.id);

      return new Response(
        JSON.stringify({
          success: true,
          predictionId: fallbackPrediction.id,
          audioUrl,
          status: "processing",
          message: "Avatar video is being generated. The script will be spoken exactly as written.",
          scriptLength: text.length,
          estimatedDuration: Math.ceil(text.length / 15), // ~15 chars per second
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await lipSyncResponse.json();
    console.log("[generate-avatar] SadTalker prediction created:", prediction.id);

    // Estimate video duration based on text length (~15 characters per second average)
    const estimatedDuration = Math.ceil(text.length / 15);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        audioUrl,
        status: "processing",
        message: "Avatar video is being generated. The script will be spoken exactly as written.",
        scriptLength: text.length,
        estimatedDuration,
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