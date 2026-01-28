import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Voice Generation using Replicate Kokoro-82M
 * 
 * Kokoro is a fast, high-quality TTS model with 50+ built-in voice presets.
 * No external audio files needed - just select a voice ID.
 * 
 * Voice ID format: {language}{gender}_{name}
 * - af_ = American Female, am_ = American Male
 * - bf_ = British Female, bm_ = British Male
 */

// Map our simplified voice IDs to Kokoro voice presets
const VOICE_MAP: Record<string, { kokoroVoice: string; description: string }> = {
  // Male voices
  onyx: { kokoroVoice: 'am_onyx', description: 'Deep, authoritative male voice' },
  echo: { kokoroVoice: 'am_echo', description: 'Friendly, warm male voice' },
  fable: { kokoroVoice: 'bm_fable', description: 'Storyteller, expressive male voice' },
  adam: { kokoroVoice: 'am_adam', description: 'Professional male narrator' },
  michael: { kokoroVoice: 'am_michael', description: 'Clear, confident male voice' },
  // Female voices
  nova: { kokoroVoice: 'af_nova', description: 'Warm, professional female voice' },
  shimmer: { kokoroVoice: 'af_sky', description: 'Soft, gentle female voice' },
  alloy: { kokoroVoice: 'af_alloy', description: 'Neutral, versatile voice' },
  sarah: { kokoroVoice: 'af_sarah', description: 'Clear, professional female' },
  bella: { kokoroVoice: 'af_bella', description: 'Warm, friendly female' },
  jessica: { kokoroVoice: 'af_jessica', description: 'Youthful, energetic female' },
  lily: { kokoroVoice: 'bf_lily', description: 'British female, soft-spoken' },
  // Default fallback
  narrator: { kokoroVoice: 'af_nova', description: 'Default narrator' },
  default: { kokoroVoice: 'af_bella', description: 'Default voice' },
};

// Voice type mapping for character types
const CHARACTER_VOICE_MAP: Record<string, string> = {
  grandmother: 'shimmer',
  elderly_female: 'shimmer',
  grandma: 'shimmer',
  narrator: 'nova',
  storyteller: 'fable',
  male: 'onyx',
  male_deep: 'onyx',
  friendly_male: 'echo',
  female: 'nova',
  young_female: 'jessica',
  default: 'bella',
};

async function generateWithKokoro(
  text: string, 
  voiceId: string,
  speed: number = 1.0
): Promise<{ audioUrl: string; duration: number } | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }
  
  // Get Kokoro voice preset
  const voiceConfig = VOICE_MAP[voiceId] || VOICE_MAP.default;
  const kokoroVoice = voiceConfig.kokoroVoice;
  
  try {
    console.log(`[Voice-Kokoro] Starting generation: ${text.length} chars, voice: ${kokoroVoice}`);
    
    // Kokoro-82M model via models endpoint (auto-selects latest version)
    const createResponse = await fetch("https://api.replicate.com/v1/models/jaaari/kokoro-82m/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          text: text,
          voice: kokoroVoice,
          speed: speed,
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Voice-Kokoro] Create failed:", errorText);
      return null;
    }
    
    const prediction = await createResponse.json();
    console.log("[Voice-Kokoro] Prediction started:", prediction.id);
    
    // Poll for completion (max 60 seconds - Kokoro is fast!)
    const maxAttempts = 24;
    const pollInterval = 2500;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      if (!statusResponse.ok) continue;
      
      const status = await statusResponse.json();
      console.log(`[Voice-Kokoro] Status: ${status.status}`);
      
      if (status.status === "succeeded" && status.output) {
        console.log("[Voice-Kokoro] ✅ Generation succeeded!");
        return {
          audioUrl: status.output,
          duration: estimateDuration(text),
        };
      }
      
      if (status.status === "failed" || status.status === "canceled") {
        console.error("[Voice-Kokoro] Failed:", status.error);
        return null;
      }
    }
    
    console.warn("[Voice-Kokoro] Polling timed out");
    return null;
    
  } catch (error) {
    console.error("[Voice-Kokoro] Error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      text, 
      voiceId,
      shotId, 
      projectId, 
      voiceType,
      speed,
      characterId,
      characterName,
    } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey) 
      : null;

    // Voice resolution priority
    let resolvedVoice = 'bella';
    let voiceSource = 'default';
    
    // Priority 1: Direct voice override
    if (voiceId && Object.keys(VOICE_MAP).includes(voiceId)) {
      resolvedVoice = voiceId;
      voiceSource = 'direct_override';
    }
    // Priority 2: Project voice assignment
    else if (projectId && characterName && supabase) {
      try {
        const { data: voiceData } = await supabase.rpc('get_or_assign_character_voice', {
          p_project_id: projectId,
          p_character_name: characterName,
          p_character_id: characterId || null,
          p_preferred_voice: null,
        });
        
        if (voiceData && voiceData.length > 0) {
          resolvedVoice = voiceData[0].voice_id;
          voiceSource = `project_assignment:${characterName}`;
        }
      } catch (rpcErr) {
        console.warn("[Voice] RPC failed, using default:", rpcErr);
      }
    }
    // Priority 3: Character's persistent voice
    else if (characterId && supabase) {
      const { data: character } = await supabase
        .from('characters')
        .select('voice_id, name')
        .eq('id', characterId)
        .single();
      
      if (character?.voice_id) {
        resolvedVoice = character.voice_id;
        voiceSource = `character:${character.name || characterId}`;
      }
    }
    // Priority 4: Voice type mapping
    else if (voiceType && CHARACTER_VOICE_MAP[voiceType]) {
      resolvedVoice = CHARACTER_VOICE_MAP[voiceType];
      voiceSource = `voiceType:${voiceType}`;
    }
    
    const finalSpeed = speed || 1.0;
    
    console.log(`[Voice] Generating: ${text.length} chars, voice: ${resolvedVoice}, source: ${voiceSource}`);

    // Generate with Kokoro
    const result = await generateWithKokoro(text, resolvedVoice, finalSpeed);
    
    if (!result) {
      throw new Error("Voice generation failed");
    }

    // Download and upload to our storage for persistence
    let finalAudioUrl = result.audioUrl;
    
    if (supabase) {
      try {
        const audioResponse = await fetch(result.audioUrl);
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          const timestamp = Date.now();
          const filename = shotId 
            ? `voice-${projectId || 'unknown'}-${shotId}-${timestamp}.wav`
            : `voice-${projectId || 'preview'}-${timestamp}.wav`;
          
          const { error: uploadError } = await supabase.storage
            .from('voice-tracks')
            .upload(filename, audioBuffer, {
              contentType: 'audio/wav',
              upsert: true,
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('voice-tracks')
              .getPublicUrl(filename);
            
            finalAudioUrl = publicUrl;
            console.log("[Voice] ✅ Uploaded to storage:", publicUrl);

            // Update project if needed
            if (projectId && shotId) {
              await supabase
                .from('movie_projects')
                .update({ voice_audio_url: publicUrl })
                .eq('id', projectId);
            }
          }
        }
        
        // Log API cost
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId || null,
          p_shot_id: shotId || 'preview',
          p_service: 'replicate-kokoro',
          p_operation: 'text_to_speech',
          p_credits_charged: 1,
          p_real_cost_cents: 1, // ~$0.01 per generation on Replicate
          p_duration_seconds: Math.round(result.duration / 1000),
          p_status: 'completed',
          p_metadata: JSON.stringify({
            textLength: text.length,
            voice: resolvedVoice,
            voiceSource,
            characterName: characterName || null,
          }),
        });
      } catch (storageError) {
        console.warn("[Voice] Storage error:", storageError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        audioUrl: finalAudioUrl,
        durationMs: result.duration,
        provider: "replicate-kokoro",
        voice: resolvedVoice,
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

// Estimate audio duration based on text length (~150 WPM)
function estimateDuration(text: string): number {
  const words = text.length / 5;
  const minutes = words / 150;
  return Math.round(minutes * 60 * 1000);
}
