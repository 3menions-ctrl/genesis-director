import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Voice Generation - ElevenLabs Primary, Replicate Fallback
 * 
 * Uses ElevenLabs for fast, high-quality TTS with built-in voices.
 * Falls back to Replicate Kokoro if ElevenLabs is unavailable.
 */

// ElevenLabs voice mapping
const ELEVENLABS_VOICES: Record<string, { voiceId: string; name: string }> = {
  // Male voices
  onyx: { voiceId: 'onyx', name: 'Onyx - Deep male' },
  adam: { voiceId: 'pNInz6obpgDQGcFmaJgB', name: 'Adam - Narrator' },
  echo: { voiceId: 'VR6AewLTigWG4xSOukaG', name: 'Arnold - Deep' },
  fable: { voiceId: 'ODq5zmih8GrVes37Dizd', name: 'Patrick - Expressive' },
  michael: { voiceId: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael - Professional' },
  george: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George - British' },
  // Female voices  
  nova: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella - Warm' },
  bella: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella - Friendly' },
  shimmer: { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli - Soft' },
  alloy: { voiceId: 'jsCqWAovK2LkecY7zXl4', name: 'Freya - Versatile' },
  sarah: { voiceId: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily - Professional' },
  jessica: { voiceId: 'g5CIjZEefAph4nQFvHAz', name: 'Aria - Young' },
  lily: { voiceId: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily - British' },
  emma: { voiceId: 'D38z5RcWu1voky8WS1ja', name: 'Fin - British' },
  // Defaults
  narrator: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Default narrator' },
  default: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Default' },
};

// Character type to voice mapping
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

async function generateWithElevenLabs(
  text: string, 
  voiceId: string
): Promise<{ audioUrl: string; duration: number } | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.log("[Voice] ElevenLabs API key not configured");
    return null;
  }
  
  const voiceConfig = ELEVENLABS_VOICES[voiceId] || ELEVENLABS_VOICES.default;
  const elevenLabsVoiceId = voiceConfig.voiceId;
  
  try {
    console.log(`[Voice-ElevenLabs] Starting: ${text.length} chars, voice: ${elevenLabsVoiceId}`);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Voice-ElevenLabs] Error:", errorText);
      return null;
    }
    
    // ElevenLabs returns audio directly
    const audioBuffer = await response.arrayBuffer();
    
    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const timestamp = Date.now();
    const filename = `preview-${timestamp}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('voice-tracks')
      .upload(filename, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    
    if (uploadError) {
      console.error("[Voice-ElevenLabs] Upload error:", uploadError);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('voice-tracks')
      .getPublicUrl(filename);
    
    console.log("[Voice-ElevenLabs] ✅ Success:", publicUrl);
    
    return {
      audioUrl: publicUrl,
      duration: estimateDuration(text),
    };
    
  } catch (error) {
    console.error("[Voice-ElevenLabs] Error:", error);
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
    if (voiceId && Object.keys(ELEVENLABS_VOICES).includes(voiceId)) {
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
    
    console.log(`[Voice] Generating: ${text.length} chars, voice: ${resolvedVoice}, source: ${voiceSource}`);

    // Try ElevenLabs first (faster, more reliable)
    let result = await generateWithElevenLabs(text, resolvedVoice);
    let provider = "elevenlabs";
    
    if (!result) {
      // Return a user-friendly error with retry suggestion
      console.warn("[Voice] ElevenLabs unavailable, quota may be exhausted");
      throw new Error("Voice preview temporarily unavailable. Please try again later.");
    }

    // Log API cost
    if (supabase) {
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId || null,
          p_shot_id: shotId || 'preview',
          p_service: 'elevenlabs',
          p_operation: 'text_to_speech',
          p_credits_charged: 1,
          p_real_cost_cents: 1,
          p_duration_seconds: Math.round(result.duration / 1000),
          p_status: 'completed',
          p_metadata: JSON.stringify({
            textLength: text.length,
            voice: resolvedVoice,
            voiceSource,
            characterName: characterName || null,
          }),
        });
      } catch (logError) {
        console.warn("[Voice] Cost logging error:", logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        audioUrl: result.audioUrl,
        durationMs: result.duration,
        provider: "elevenlabs",
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
