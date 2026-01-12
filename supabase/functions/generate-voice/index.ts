import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Voice Generation using OpenAI TTS (Primary)
 * 
 * Uses OpenAI's tts-1-hd model for reliable, high-quality voice generation.
 * ElevenLabs was removed due to frequent quota/rate limit issues.
 */

// OpenAI TTS voice mapping for different character types
const VOICE_MAP: Record<string, { voice: string; speed: number }> = {
  // Elderly/Grandmother voices - slower, warmer
  grandmother: { voice: 'shimmer', speed: 0.85 },
  elderly_female: { voice: 'shimmer', speed: 0.85 },
  grandma: { voice: 'shimmer', speed: 0.85 },
  
  // Standard narrator voices
  narrator: { voice: 'nova', speed: 1.0 },
  storyteller: { voice: 'fable', speed: 0.95 },
  
  // Male voices
  male: { voice: 'onyx', speed: 1.0 },
  male_deep: { voice: 'onyx', speed: 0.9 },
  friendly_male: { voice: 'echo', speed: 1.0 },
  
  // Female voices
  female: { voice: 'nova', speed: 1.0 },
  young_female: { voice: 'alloy', speed: 1.0 },
  
  // Default
  default: { voice: 'nova', speed: 1.0 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, shotId, projectId, voiceType, speed } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Resolve voice configuration from voiceType
    const voiceConfig = VOICE_MAP[voiceType || 'default'] || VOICE_MAP['default'];
    
    // Allow override of speed if provided
    const finalSpeed = speed || voiceConfig.speed;

    console.log(`[Voice] Generating for text length: ${text.length}, voiceType: ${voiceType || 'default'}, voice: ${voiceConfig.voice}, speed: ${finalSpeed}`);

    // Call OpenAI TTS API
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: text,
        voice: voiceConfig.voice,
        response_format: "mp3",
        speed: finalSpeed,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Voice] OpenAI TTS error:", response.status, errorText);
      throw new Error(`OpenAI TTS error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[Voice] Generated successfully, size: ${audioBuffer.byteLength} bytes`);

    // Initialize Supabase client for storage upload
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Create a unique filename
        const timestamp = Date.now();
        const filename = shotId 
          ? `voice-${projectId || 'unknown'}-${shotId}-${timestamp}.mp3`
          : `voice-${projectId || 'unknown'}-${timestamp}.mp3`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('voice-tracks')
          .upload(filename, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error("[Voice] Storage upload error:", uploadError);
          // Fall back to base64 response
          const base64Audio = base64Encode(audioBuffer);
          return new Response(
            JSON.stringify({ 
              success: true,
              audioBase64: base64Audio,
              durationMs: estimateDuration(text),
              provider: "openai",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('voice-tracks')
          .getPublicUrl(filename);

        console.log("[Voice] Uploaded to storage:", publicUrl);

        // Update project with voice URL if projectId provided
        if (projectId) {
          const { error: updateError } = await supabase
            .from('movie_projects')
            .update({ voice_audio_url: publicUrl })
            .eq('id', projectId);
          
          if (updateError) {
            console.warn("[Voice] Failed to update project voice URL:", updateError);
          } else {
            console.log("[Voice] Project voice_audio_url updated");
          }
        }

        // Log API cost for voice generation
        try {
          const durationMs = estimateDuration(text);
          const creditsCharged = 2;
          const realCostCents = Math.ceil(text.length * 0.0015); // OpenAI TTS ~$0.015 per 1k chars
          
          await supabase.rpc('log_api_cost', {
            p_user_id: null,
            p_project_id: projectId || null,
            p_shot_id: shotId || 'narration',
            p_service: 'openai-tts',
            p_operation: 'text_to_speech',
            p_credits_charged: creditsCharged,
            p_real_cost_cents: realCostCents,
            p_duration_seconds: Math.round(durationMs / 1000),
            p_status: 'completed',
            p_metadata: JSON.stringify({
              textLength: text.length,
              voice: voiceConfig.voice,
              voiceType: voiceType || 'default',
              speed: finalSpeed,
            }),
          });
          console.log(`[Voice] API cost logged: ${creditsCharged} credits, ${realCostCents}¢ real cost`);
        } catch (costError) {
          console.warn("[Voice] Failed to log API cost:", costError);
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            audioUrl: publicUrl,
            durationMs: estimateDuration(text),
            provider: "openai",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (storageError) {
        console.error("[Voice] Storage error:", storageError);
      }
    }

    // Fallback: return base64 encoded audio
    const base64Audio = base64Encode(audioBuffer);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        audioBase64: base64Audio,
        durationMs: estimateDuration(text),
        provider: "openai",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Voice] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Estimate audio duration based on text length
// Average speaking rate: ~150 words per minute, ~5 chars per word
function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000); // Return in milliseconds
}
