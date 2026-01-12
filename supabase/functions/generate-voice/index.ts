import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, shotId, projectId, voiceType } = await req.json();
    
    // Voice ID mapping for different character types
    const VOICE_MAP: Record<string, string> = {
      // Elderly/Grandmother voices
      'grandmother': 'XB0fDUnXU5powFXDhCwa', // Charlotte - warm, mature female
      'elderly_female': 'XB0fDUnXU5powFXDhCwa',
      'grandma': 'XB0fDUnXU5powFXDhCwa',
      
      // Standard voices
      'narrator': 'pNInz6obpgDQGcFmaJgB', // Adam - deep male narrator
      'male': 'pNInz6obpgDQGcFmaJgB',
      'female': 'EXAVITQu4vr4xnSDxMaL', // Sarah - young female
      'default': 'EXAVITQu4vr4xnSDxMaL',
    };
    
    // Resolve voice ID from voiceType or use provided voiceId
    const resolvedVoiceId = voiceId || VOICE_MAP[voiceType || 'default'] || VOICE_MAP['default'];

    if (!text) {
      throw new Error("Text is required");
    }

    console.log("Generating voice for text length:", text.length, "shotId:", shotId, "voiceType:", voiceType, "resolvedVoiceId:", resolvedVoiceId);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}?output_format=mp3_44100_128`,
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
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);
      
      // Parse error to check for quota exceeded
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.detail?.status === "quota_exceeded") {
          return new Response(
            JSON.stringify({ 
              error: "ElevenLabs quota exceeded. Please use 'Skip Narration' option or upgrade your ElevenLabs plan.",
              quota_exceeded: true,
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        // Not JSON, continue with generic error
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`ElevenLabs error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("Voice generated successfully, size:", audioBuffer.byteLength);

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
          : `voice-${timestamp}.mp3`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('voice-tracks')
          .upload(filename, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          // Fall back to base64 response
          const base64Audio = base64Encode(audioBuffer);
          return new Response(
            JSON.stringify({ 
              success: true,
              audioBase64: base64Audio,
              durationMs: Math.round((text.length / 15) * 1000),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('voice-tracks')
          .getPublicUrl(filename);

        console.log("Voice uploaded to storage:", publicUrl);

        // Log API cost for voice generation
        try {
          const durationMs = Math.round((text.length / 15) * 1000);
          const creditsCharged = 2; // Voice generation cost
          const realCostCents = Math.ceil(text.length * 0.003); // ElevenLabs ~$0.003 per char
          
          await supabase.rpc('log_api_cost', {
            p_user_id: null, // Voice doesn't have user context directly
            p_project_id: projectId || null,
            p_shot_id: shotId || 'narration',
            p_service: 'elevenlabs',
            p_operation: 'text_to_speech',
            p_credits_charged: creditsCharged,
            p_real_cost_cents: realCostCents,
            p_duration_seconds: Math.round(durationMs / 1000),
            p_status: 'completed',
            p_metadata: JSON.stringify({
              textLength: text.length,
              voiceId: resolvedVoiceId,
              voiceType: voiceType || 'default',
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
            durationMs: Math.round((text.length / 15) * 1000),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (storageError) {
        console.error("Storage error:", storageError);
      }
    }

    // Fallback: return base64 encoded audio
    const base64Audio = base64Encode(audioBuffer);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        audioBase64: base64Audio,
        durationMs: Math.round((text.length / 15) * 1000),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-voice function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
