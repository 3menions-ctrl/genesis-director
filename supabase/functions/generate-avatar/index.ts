import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVATAR GENERATION - Direct Script-to-Talking-Head Pipeline
 * 
 * Uses OpenAI TTS for audio + Sync Labs Lipsync-2 for lip-sync.
 * 
 * Pipeline:
 * 1. OpenAI TTS - Convert text to high-quality speech audio
 * 2. Upload audio to Supabase storage
 * 3. Create temp video from avatar image (for Lipsync-2 which requires video input)
 * 4. Lipsync-2 - Sync the audio to the avatar video
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    // Initialize Supabase client with service role for storage access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
      throw new Error(`TTS generation failed: ${ttsResponse.status} - ${errorText}`);
    }

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBuffer = new Uint8Array(audioArrayBuffer);
    console.log("[generate-avatar] Audio generated, size:", audioBuffer.length, "bytes");

    // Step 2: Upload audio to Supabase storage using SDK
    const audioFileName = `avatar-audio-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
    console.log("[generate-avatar] Step 2: Uploading audio to storage...");
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-tracks')
      .upload(audioFileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error("[generate-avatar] Audio upload failed:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL for the uploaded audio
    const { data: publicUrlData } = supabase.storage
      .from('voice-tracks')
      .getPublicUrl(audioFileName);

    const audioUrl = publicUrlData.publicUrl;
    console.log("[generate-avatar] Audio uploaded successfully:", audioUrl);

    // Step 3: Create a talking head video using image-to-video with a speaking prompt
    // Then apply lip sync to the generated video
    console.log("[generate-avatar] Step 3: Generating base talking video from image...");
    
    // Use Kling to animate the avatar with speaking motion
    const klingResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kwaivgi/kling-v2.6",
        input: {
          mode: "pro",
          prompt: "The person in the image is speaking naturally, direct eye contact with camera, subtle head movements, professional presentation style, clear articulate speech",
          duration: "5",
          start_image: avatarImageUrl,
          aspect_ratio: aspectRatio,
          negative_prompt: "blurry, distorted, glitchy, unnatural movements, closed mouth",
        },
      }),
    });

    if (!klingResponse.ok) {
      const errorText = await klingResponse.text();
      console.error("[generate-avatar] Kling video generation failed:", errorText);
      
      // Fallback: Use Sync Labs Lipsync-2 directly with the image
      // This may have limitations but provides a fallback
      console.log("[generate-avatar] Trying direct lipsync with Sync Labs...");
      
      const lipsyncResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sync/lipsync-2",
          input: {
            audio: audioUrl,
            video: avatarImageUrl, // Will be processed as single frame
            sync_mode: "loop",
            temperature: 0.5,
            active_speaker: false,
          },
        }),
      });

      if (!lipsyncResponse.ok) {
        const lipError = await lipsyncResponse.text();
        console.error("[generate-avatar] Lipsync-2 also failed:", lipError);
        throw new Error(`Avatar generation failed: Replicate API error - ${lipError}`);
      }

      const lipPrediction = await lipsyncResponse.json();
      console.log("[generate-avatar] Lipsync-2 prediction created:", lipPrediction.id);

      return new Response(
        JSON.stringify({
          success: true,
          predictionId: lipPrediction.id,
          audioUrl,
          status: "processing",
          message: "Avatar video is being generated with OpenAI TTS and Sync Labs.",
          scriptLength: text.length,
          estimatedDuration: Math.ceil(text.length / 15),
          pipeline: "direct-lipsync",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const klingPrediction = await klingResponse.json();
    console.log("[generate-avatar] Kling prediction created:", klingPrediction.id);

    // Store the audio URL and pipeline state for the status checker to continue
    // The status checker will:
    // 1. Poll Kling until video is ready
    // 2. Then call Lipsync-2 with the video + audio
    // 3. Poll Lipsync-2 until final video is ready

    return new Response(
      JSON.stringify({
        success: true,
        predictionId: klingPrediction.id,
        audioUrl,
        status: "processing",
        message: "Avatar video is being generated. First creating base video, then applying lip sync.",
        scriptLength: text.length,
        estimatedDuration: Math.ceil(text.length / 15),
        pipeline: "kling-then-lipsync",
        nextStep: {
          action: "lipsync",
          model: "sync/lipsync-2",
          audioUrl,
        },
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
