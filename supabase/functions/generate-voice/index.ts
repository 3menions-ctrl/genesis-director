import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Voice Generation - MiniMax Speech 2.6 Turbo (Always Warm)
 * 
 * Uses minimax/speech-2.6-turbo on Replicate for fast, high-quality TTS.
 * This model is always warm (~3s generation time) with 300+ voices.
 */

// Default speech rate - slightly slower for clearer articulation
const DEFAULT_SPEED = 0.9;

// MiniMax voice mapping - using verified MiniMax voice IDs from their API
// Reference: https://platform.minimax.io/docs/faq/system-voice-id
const VOICE_MAP: Record<string, { minimaxVoice: string; description: string }> = {
  // Male voices - Deep & Authoritative
  onyx: { minimaxVoice: 'English_ManWithDeepVoice', description: 'Deep male voice' },
  george: { minimaxVoice: 'English_Deep-VoicedGentleman', description: 'Deep-voiced gentleman' },
  michael: { minimaxVoice: 'English_Trustworth_Man', description: 'Trustworthy man' },
  
  // Male voices - Warm & Friendly
  echo: { minimaxVoice: 'English_Gentle-voiced_man', description: 'Gentle male voice' },
  adam: { minimaxVoice: 'English_expressive_narrator', description: 'Expressive narrator' },
  fable: { minimaxVoice: 'English_CaptivatingStoryteller', description: 'Captivating storyteller' },
  
  // Male voices - Youthful & Energetic
  marcus: { minimaxVoice: 'English_DecentYoungMan', description: 'Decent young man' },
  tyler: { minimaxVoice: 'English_FriendlyPerson', description: 'Friendly guy' },
  jake: { minimaxVoice: 'English_Strong-WilledBoy', description: 'Strong-willed boy' },
  
  // Male voices - Professional
  david: { minimaxVoice: 'English_PatientMan', description: 'Patient professional man' },
  james: { minimaxVoice: 'English_Debator', description: 'Male debater style' },
  
  // Female voices - Confident & Strong
  nova: { minimaxVoice: 'English_ConfidentWoman', description: 'Confident woman' },
  aria: { minimaxVoice: 'English_AssertiveQueen', description: 'Assertive queen voice' },
  victoria: { minimaxVoice: 'English_ImposingManner', description: 'Imposing queen' },
  
  // Female voices - Warm & Friendly
  bella: { minimaxVoice: 'English_Upbeat_Woman', description: 'Upbeat woman' },
  sarah: { minimaxVoice: 'English_CalmWoman', description: 'Calm woman' },
  alloy: { minimaxVoice: 'English_SereneWoman', description: 'Serene woman' },
  emma: { minimaxVoice: 'English_Kind-heartedGirl', description: 'Kind-hearted girl' },
  
  // Female voices - Elegant & Sophisticated
  shimmer: { minimaxVoice: 'English_Wiselady', description: 'Wise lady' },
  lily: { minimaxVoice: 'English_Graceful_Lady', description: 'Graceful lady' },
  charlotte: { minimaxVoice: 'English_SentimentalLady', description: 'Sentimental lady' },
  
  // Female voices - Youthful & Energetic
  jessica: { minimaxVoice: 'English_radiant_girl', description: 'Radiant girl' },
  zoey: { minimaxVoice: 'English_PlayfulGirl', description: 'Playful girl' },
  mia: { minimaxVoice: 'English_LovelyGirl', description: 'Lovely girl' },
  
  // Female voices - Professional
  rachel: { minimaxVoice: 'English_AnimeCharacter', description: 'Female narrator' },
  claire: { minimaxVoice: 'English_MatureBoss', description: 'Professional boss voice' },
  
  // Special voices - Narration
  narrator: { minimaxVoice: 'English_expressive_narrator', description: 'Expressive narrator' },
  storyteller: { minimaxVoice: 'English_CaptivatingStoryteller', description: 'Storyteller voice' },
  documentary: { minimaxVoice: 'English_WiseScholar', description: 'Wise scholar style' },
  
  // Default fallback
  default: { minimaxVoice: 'English_ConfidentWoman', description: 'Default voice' },
};

// Character type to voice mapping
const CHARACTER_VOICE_MAP: Record<string, string> = {
  grandmother: 'shimmer',
  elderly_female: 'shimmer',
  grandma: 'shimmer',
  narrator: 'adam',
  storyteller: 'fable',
  male: 'onyx',
  male_deep: 'onyx',
  friendly_male: 'echo',
  female: 'nova',
  young_female: 'jessica',
  default: 'bella',
};

// Emotion mapping based on context
function detectEmotion(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('!') && (lowerText.includes('wow') || lowerText.includes('amazing'))) return 'surprised';
  if (lowerText.includes('sorry') || lowerText.includes('sad') || lowerText.includes('unfortunately')) return 'sad';
  if (lowerText.includes('angry') || lowerText.includes('furious')) return 'angry';
  if (lowerText.includes('scared') || lowerText.includes('afraid')) return 'fearful';
  if (lowerText.includes('happy') || lowerText.includes('excited') || lowerText.includes('!')) return 'happy';
  return 'auto'; // Let MiniMax choose
}

async function generateWithMiniMax(
  text: string, 
  voiceId: string,
  speed: number = 1.0
): Promise<{ audioUrl: string; duration: number } | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    console.error("[Voice] REPLICATE_API_KEY not configured");
    return null;
  }
  
  const voiceConfig = VOICE_MAP[voiceId] || VOICE_MAP.default;
  const emotion = detectEmotion(text);
  
  console.log(`[Voice-MiniMax] Starting: ${text.length} chars, voice: ${voiceConfig.minimaxVoice}, emotion: ${emotion}`);
  
  try {
    // Create prediction using model-specific endpoint
    const createResponse = await fetch("https://api.replicate.com/v1/models/minimax/speech-2.6-turbo/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60",
      },
      body: JSON.stringify({
        input: {
          text: text,
          voice_id: voiceConfig.minimaxVoice,
          speed: Math.max(0.5, Math.min(2.0, speed)),
          emotion: emotion,
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Voice-MiniMax] Create error:", errorText);
      return null;
    }
    
    const prediction = await createResponse.json();
    console.log(`[Voice-MiniMax] Prediction created: ${prediction.id}`);
    
    // Poll for completion (MiniMax is fast, ~3-5 seconds)
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
        }
      );
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded") {
        // MiniMax returns the audio URL directly
        const audioUrl = typeof status.output === 'string' ? status.output : status.output?.url || status.output;
        
        if (!audioUrl) {
          console.error("[Voice-MiniMax] No audio URL in output:", status.output);
          return null;
        }
        
        console.log(`[Voice-MiniMax] ✅ Success in ${i + 1}s: ${audioUrl.substring(0, 80)}...`);
        
        return {
          audioUrl: audioUrl,
          duration: estimateDuration(text),
        };
      }
      
      if (status.status === "failed") {
        console.error("[Voice-MiniMax] Generation failed:", status.error);
        return null;
      }
      
      // Still processing
      if (i % 5 === 0) {
        console.log(`[Voice-MiniMax] Still processing... (${i}s)`);
      }
    }
    
    console.error("[Voice-MiniMax] Timeout after 30s");
    return null;
    
  } catch (error) {
    console.error("[Voice-MiniMax] Error:", error);
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
    
    // Apply slightly slower default speed for clearer articulation
    const finalSpeed = speed || DEFAULT_SPEED;
    console.log(`[Voice] Generating: ${text.length} chars, voice: ${resolvedVoice}, speed: ${finalSpeed}, source: ${voiceSource}`);

    // Generate with MiniMax (always warm, ~3s)
    const result = await generateWithMiniMax(text, resolvedVoice, finalSpeed);
    
    if (!result) {
      throw new Error("Voice generation failed. Please try again.");
    }

    // Log API cost
    if (supabase) {
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId || null,
          p_shot_id: shotId || 'preview',
          p_service: 'replicate_minimax',
          p_operation: 'text_to_speech',
          p_credits_charged: 1,
          p_real_cost_cents: Math.ceil(text.length * 0.006), // $0.06 per 1000 chars
          p_duration_seconds: Math.round(result.duration / 1000),
          p_status: 'completed',
          p_metadata: JSON.stringify({
            textLength: text.length,
            voice: resolvedVoice,
            voiceSource,
            characterName: characterName || null,
            model: 'minimax/speech-2.6-turbo',
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
        provider: "minimax",
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
