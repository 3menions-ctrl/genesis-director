import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      text, 
      voiceId = "onwK4e9ZLuTAKqWW03F9", // Daniel - professional male voice
      avatarImageUrl,
      aspectRatio = "16:9"
    } = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log("[generate-avatar] Starting avatar generation for text:", text.substring(0, 50) + "...");

    // Step 1: Generate speech audio with ElevenLabs
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
          text,
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
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer.slice(0, 50000)))); // Limit for encoding
    console.log("[generate-avatar] Audio generated, size:", audioBuffer.byteLength);

    // For now, upload audio to Supabase storage
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

    // Step 2: Use Replicate's Wav2Lip or similar for lip-sync
    // Using SadTalker for high-quality talking head generation
    console.log("[generate-avatar] Step 2: Generating talking head video...");
    
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
          preprocess: "crop",
          still_mode: false,
          use_enhancer: true,
          facerender: "facevid2vid", // High quality face rendering
          expression_scale: 1.0,
        },
      }),
    });

    if (!lipSyncResponse.ok) {
      const errorText = await lipSyncResponse.text();
      console.error("[generate-avatar] Lip sync initiation failed:", errorText);
      throw new Error(`Lip sync failed: ${lipSyncResponse.status}`);
    }

    const prediction = await lipSyncResponse.json();
    console.log("[generate-avatar] Lip sync prediction created:", prediction.id);

    // Return the prediction ID for polling
    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        audioUrl,
        status: "processing",
        message: "Avatar video is being generated. Poll for status.",
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
