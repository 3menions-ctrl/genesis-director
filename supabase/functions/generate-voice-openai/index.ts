import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OpenAI TTS voices - good for different character types
const VOICE_OPTIONS = {
  grandma: "shimmer",  // Warm, friendly female voice - perfect for Grandma Edith
  narrator: "nova",    // Clear, professional female
  male: "onyx",        // Deep, authoritative male
  young: "alloy",      // Neutral, versatile
  friendly: "echo",    // Warm male
  storyteller: "fable" // Expressive, dramatic
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = "shimmer", projectId, shotId, speed = 1.0 } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    console.log("[OpenAI-TTS] Generating voice for text length:", text.length, "voice:", voice);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Call OpenAI TTS API
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",  // High quality TTS
        input: text,
        voice: voice,
        response_format: "mp3",
        speed: speed,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OpenAI-TTS] API error:", response.status, errorText);
      throw new Error(`OpenAI TTS error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("[OpenAI-TTS] Voice generated successfully, size:", audioBuffer.byteLength);

    // Initialize Supabase client for storage upload
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Create a unique filename
        const timestamp = Date.now();
        const filename = shotId 
          ? `voice-openai-${projectId || 'unknown'}-${shotId}-${timestamp}.mp3`
          : `voice-openai-${projectId || 'unknown'}-${timestamp}.mp3`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('voice-tracks')
          .upload(filename, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error("[OpenAI-TTS] Storage upload error:", uploadError);
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

        console.log("[OpenAI-TTS] Voice uploaded to storage:", publicUrl);

        // Update project with voice URL if projectId provided
        if (projectId) {
          const { error: updateError } = await supabase
            .from('movie_projects')
            .update({ voice_audio_url: publicUrl })
            .eq('id', projectId);
          
          if (updateError) {
            console.warn("[OpenAI-TTS] Failed to update project voice URL:", updateError);
          } else {
            console.log("[OpenAI-TTS] Project voice_audio_url updated");
          }
        }

        // Log API cost
        try {
          const durationMs = estimateDuration(text);
          const creditsCharged = 2;
          const realCostCents = Math.ceil(text.length * 0.0015); // OpenAI TTS ~$0.015 per 1k chars
          
          await supabase.rpc('log_api_cost', {
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
              voice,
              model: 'tts-1-hd',
            }),
          });
          console.log(`[OpenAI-TTS] API cost logged: ${creditsCharged} credits, ${realCostCents}¢ real cost`);
        } catch (costError) {
          console.warn("[OpenAI-TTS] Failed to log API cost:", costError);
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
        console.error("[OpenAI-TTS] Storage error:", storageError);
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
    console.error("[OpenAI-TTS] Error:", error);
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
