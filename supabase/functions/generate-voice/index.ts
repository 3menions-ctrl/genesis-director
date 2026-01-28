import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Voice Generation using Replicate XTTS-v2
 * 
 * Replaces OpenAI TTS with Replicate's cjwbw/xtts-v2 model for high-quality
 * text-to-speech without external API dependencies.
 * 
 * CHARACTER VOICE CONSISTENCY:
 * - Each character can have a persistent voice_id stored in the characters table
 * - Voice IDs map to reference audio samples for voice cloning
 */

// Voice presets - these map to reference audio samples or speaker embeddings
const VOICE_PRESETS: Record<string, { 
  name: string; 
  gender: string; 
  description: string;
  language: string;
}> = {
  onyx: { name: 'Onyx', gender: 'male', description: 'Deep, authoritative male voice', language: 'en' },
  echo: { name: 'Echo', gender: 'male', description: 'Friendly, warm male voice', language: 'en' },
  fable: { name: 'Fable', gender: 'male', description: 'Storyteller, expressive male voice', language: 'en' },
  nova: { name: 'Nova', gender: 'female', description: 'Warm, professional female voice', language: 'en' },
  shimmer: { name: 'Shimmer', gender: 'female', description: 'Soft, elderly female voice', language: 'en' },
  alloy: { name: 'Alloy', gender: 'neutral', description: 'Neutral, versatile voice', language: 'en' },
};

// Voice type mapping for character types
const VOICE_MAP: Record<string, { voice: string; speed: number }> = {
  grandmother: { voice: 'shimmer', speed: 0.85 },
  elderly_female: { voice: 'shimmer', speed: 0.85 },
  grandma: { voice: 'shimmer', speed: 0.85 },
  narrator: { voice: 'nova', speed: 1.0 },
  storyteller: { voice: 'fable', speed: 0.95 },
  male: { voice: 'onyx', speed: 1.0 },
  male_deep: { voice: 'onyx', speed: 0.9 },
  friendly_male: { voice: 'echo', speed: 1.0 },
  female: { voice: 'nova', speed: 1.0 },
  young_female: { voice: 'alloy', speed: 1.0 },
  default: { voice: 'nova', speed: 1.0 },
};

// Generate voice using Replicate XTTS-v2
async function generateWithReplicate(
  text: string, 
  voicePreset: string,
  speed: number,
  language: string = 'en'
): Promise<{ audioUrl: string; duration: number } | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    throw new Error("REPLICATE_API_KEY is not configured");
  }
  
  try {
    console.log(`[Voice-Replicate] Starting XTTS-v2 generation for ${text.length} chars`);
    
    // XTTS-v2 model - high quality TTS with voice cloning capability
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e", // cjwbw/xtts-v2
        input: {
          text: text,
          speaker: voicePreset, // Built-in speaker presets
          language: language,
          cleanup_voice: true, // Clean up generated audio
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Voice-Replicate] Create failed:", errorText);
      return null;
    }
    
    const prediction = await createResponse.json();
    console.log("[Voice-Replicate] Prediction started:", prediction.id);
    
    // Poll for completion (max 90 seconds)
    const maxAttempts = 18;
    const pollInterval = 5000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      if (!statusResponse.ok) continue;
      
      const status = await statusResponse.json();
      console.log(`[Voice-Replicate] Status: ${status.status}`);
      
      if (status.status === "succeeded" && status.output) {
        console.log("[Voice-Replicate] Generation succeeded!");
        return {
          audioUrl: status.output,
          duration: estimateDuration(text),
        };
      }
      
      if (status.status === "failed" || status.status === "canceled") {
        console.error("[Voice-Replicate] Failed:", status.error);
        return null;
      }
    }
    
    console.warn("[Voice-Replicate] Polling timed out");
    return null;
    
  } catch (error) {
    console.error("[Voice-Replicate] Error:", error);
    return null;
  }
}

// Fallback: Use Bark for more expressive speech
async function generateWithBark(text: string): Promise<{ audioUrl: string; duration: number } | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) return null;
  
  try {
    console.log(`[Voice-Bark] Fallback: Using Bark for ${text.length} chars`);
    
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787", // suno-ai/bark
        input: {
          prompt: text,
          text_temp: 0.7,
          waveform_temp: 0.7,
        },
      }),
    });
    
    if (!createResponse.ok) return null;
    
    const prediction = await createResponse.json();
    
    // Poll for completion
    for (let i = 0; i < 18; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded" && status.output?.audio_out) {
        return {
          audioUrl: status.output.audio_out,
          duration: estimateDuration(text),
        };
      }
      
      if (status.status === "failed" || status.status === "canceled") return null;
    }
    
    return null;
  } catch (error) {
    console.error("[Voice-Bark] Error:", error);
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
      language = 'en',
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
    let resolvedVoice = 'nova';
    let resolvedSpeed = 1.0;
    let voiceSource = 'default';
    
    // Priority 1: Direct voice override
    if (voiceId && Object.keys(VOICE_PRESETS).includes(voiceId)) {
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
    else if (voiceType && VOICE_MAP[voiceType]) {
      const config = VOICE_MAP[voiceType];
      resolvedVoice = config.voice;
      resolvedSpeed = config.speed;
      voiceSource = `voiceType:${voiceType}`;
    }
    
    const finalSpeed = speed || resolvedSpeed;
    
    console.log(`[Voice] Generating: ${text.length} chars, voice: ${resolvedVoice}, source: ${voiceSource}`);

    // Try XTTS-v2 first
    let result = await generateWithReplicate(text, resolvedVoice, finalSpeed, language);
    
    // Fallback to Bark if XTTS fails
    if (!result) {
      console.log("[Voice] XTTS failed, trying Bark fallback...");
      result = await generateWithBark(text);
    }
    
    if (!result) {
      throw new Error("Voice generation failed with all providers");
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
            : `voice-${projectId || 'unknown'}-${timestamp}.wav`;
          
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
            console.log("[Voice] Uploaded to storage:", publicUrl);

            // Update project if needed
            if (projectId) {
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
          p_shot_id: shotId || 'narration',
          p_service: 'replicate-xtts',
          p_operation: 'text_to_speech',
          p_credits_charged: 2,
          p_real_cost_cents: 3, // ~$0.03 per generation on Replicate
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
        provider: "replicate-xtts",
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
