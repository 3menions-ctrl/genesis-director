import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVATAR GENERATION - Direct Script-to-Talking-Head Pipeline
 * 
 * Uses OpenAI TTS (fallback from ElevenLabs) + SadTalker/Wav2Lip for lip-sync.
 * 
 * Pipeline:
 * 1. OpenAI TTS - Convert text to high-quality speech audio
 * 2. SadTalker/Wav2Lip - Lip-sync the audio to the avatar image
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      text,
      voiceId = "onyx", // OpenAI voice: alloy, echo, fable, onyx, nova, shimmer
      avatarImageUrl,
      aspectRatio = "16:9"
    } = await req.json();

    if (!text || !avatarImageUrl) {
      throw new Error("Both 'text' (script) and 'avatarImageUrl' are required");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    console.log("[generate-avatar] Creating talking head video with OpenAI TTS");
    console.log(`[generate-avatar] Script length: ${text.length} chars`);
    console.log(`[generate-avatar] Script preview: "${text.substring(0, 100)}..."`);

    // Map ElevenLabs voice IDs to OpenAI voices
    const openaiVoice = mapToOpenAIVoice(voiceId);

    // Step 1: Generate high-quality speech with OpenAI TTS
    console.log(`[generate-avatar] Step 1: Generating speech with OpenAI TTS (voice: ${openaiVoice})...`);
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        voice: openaiVoice,
        input: text,
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("[generate-avatar] OpenAI TTS failed:", errorText);
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
          facerender: "facevid2vid",
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
          message: "Avatar video is being generated with OpenAI TTS.",
          scriptLength: text.length,
          estimatedDuration: Math.ceil(text.length / 15),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await lipSyncResponse.json();
    console.log("[generate-avatar] SadTalker prediction created:", prediction.id);

    const estimatedDuration = Math.ceil(text.length / 15);

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: prediction.id,
        audioUrl,
        status: "processing",
        message: "Avatar video is being generated with OpenAI TTS.",
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

/**
 * Map ElevenLabs voice IDs or names to OpenAI voices
 */
function mapToOpenAIVoice(voiceId: string): string {
  // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
  const voiceMap: Record<string, string> = {
    // ElevenLabs IDs -> OpenAI
    'onwK4e9ZLuTAKqWW03F9': 'onyx',    // Daniel -> onyx (deep male)
    'JBFqnCBsd6RMkjVDRZzb': 'echo',    // George -> echo (warm male)
    'EXAVITQu4vr4xnSDxMaL': 'nova',    // Sarah -> nova (female)
    'pFZP5JQG7iQjIQuC4Bku': 'shimmer', // Lily -> shimmer (female)
    'cjVigY5qzO86Huf0OWal': 'alloy',   // Eric -> alloy (neutral)
    
    // Direct OpenAI voice names
    'alloy': 'alloy',
    'echo': 'echo',
    'fable': 'fable',
    'onyx': 'onyx',
    'nova': 'nova',
    'shimmer': 'shimmer',
  };

  return voiceMap[voiceId] || 'onyx'; // Default to onyx
}
