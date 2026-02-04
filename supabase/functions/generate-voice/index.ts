import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  resilientFetch,
  calculateBackoff,
  isRetryableError,
  sleep,
  RESILIENCE_CONFIG,
} from "../_shared/network-resilience.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Voice Generation - MiniMax Speech 2.6 Turbo (World-Class Reliability)
 * 
 * HARDENED with:
 * - Exponential backoff with jitter
 * - Connection reset recovery
 * - Rate limit detection and smart waiting
 * - Timeout handling with graceful degradation
 */

// Default speech rate - slightly slower for clearer articulation
const DEFAULT_SPEED = 0.9;

// TTS-specific resilience config
const TTS_CONFIG = {
  MAX_RETRIES: 4,
  BASE_DELAY_MS: 2000,
  MAX_POLL_ATTEMPTS: 40, // 40 seconds max polling
  POLL_INTERVAL_MS: 1000,
  RATE_LIMIT_WAIT_MS: 12000, // 12 seconds for TTS rate limits
};

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

/**
 * WORLD-CLASS TTS GENERATION with comprehensive error recovery
 */
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
  
  let lastError: Error | null = null;
  let rateLimitRetries = 0;
  
  // OUTER RETRY LOOP: Handles connection resets, rate limits, and network errors
  for (let attempt = 0; attempt < TTS_CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Add delay between retries with exponential backoff
      if (attempt > 0) {
        const delayMs = calculateBackoff(attempt, TTS_CONFIG.BASE_DELAY_MS);
        console.log(`[Voice-MiniMax] Retry ${attempt}/${TTS_CONFIG.MAX_RETRIES} after ${delayMs}ms...`);
        await sleep(delayMs);
      }
      
      // Create prediction using model-specific endpoint with resilient fetch
      const createResponse = await resilientFetch(
        "https://api.replicate.com/v1/models/minimax/speech-2.6-turbo/predictions",
        {
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
          maxRetries: 2, // Inner retries for this specific request
          timeoutMs: 65000,
        }
      );
      
      // Handle rate limiting with smart wait
      if (createResponse.status === 429) {
        rateLimitRetries++;
        if (rateLimitRetries <= 3) {
          const retryAfter = createResponse.headers.get('Retry-After');
          const waitMs = retryAfter 
            ? Math.min(parseInt(retryAfter, 10) * 1000, 30000)
            : TTS_CONFIG.RATE_LIMIT_WAIT_MS;
          
          console.log(`[Voice-MiniMax] Rate limited (429), waiting ${waitMs}ms (attempt ${rateLimitRetries}/3)...`);
          await sleep(waitMs);
          continue;
        }
        console.error("[Voice-MiniMax] Max rate limit retries exceeded");
        return null;
      }
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`[Voice-MiniMax] Create error ${createResponse.status}: ${errorText.substring(0, 200)}`);
        
        // Retry on server errors
        if (createResponse.status >= 500) {
          lastError = new Error(`Server error ${createResponse.status}`);
          continue;
        }
        
        return null;
      }
      
      const prediction = await createResponse.json();
      console.log(`[Voice-MiniMax] Prediction created: ${prediction.id}`);
      
      // INNER POLLING LOOP with resilient polling
      for (let pollAttempt = 0; pollAttempt < TTS_CONFIG.MAX_POLL_ATTEMPTS; pollAttempt++) {
        await sleep(TTS_CONFIG.POLL_INTERVAL_MS);
        
        try {
          const statusResponse = await resilientFetch(
            `https://api.replicate.com/v1/predictions/${prediction.id}`,
            {
              headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
              maxRetries: 2,
              timeoutMs: 15000,
            }
          );
          
          if (!statusResponse.ok) {
            console.warn(`[Voice-MiniMax] Poll request failed: ${statusResponse.status}`);
            continue; // Keep polling
          }
          
          const status = await statusResponse.json();
          
          if (status.status === "succeeded") {
            // MiniMax returns the audio URL directly
            const audioUrl = typeof status.output === 'string' ? status.output : status.output?.url || status.output;
            
            if (!audioUrl) {
              console.error("[Voice-MiniMax] No audio URL in output:", status.output);
              return null;
            }
            
            console.log(`[Voice-MiniMax] ✅ Success in ${pollAttempt + 1}s: ${audioUrl.substring(0, 80)}...`);
            
            return {
              audioUrl: audioUrl,
              duration: estimateDuration(text),
            };
          }
          
          if (status.status === "failed") {
            console.error("[Voice-MiniMax] Generation failed:", status.error);
            lastError = new Error(status.error || 'Generation failed');
            break; // Exit polling, try outer retry
          }
          
          // Still processing - log every 5 polls
          if (pollAttempt % 5 === 0) {
            console.log(`[Voice-MiniMax] Still processing... (${pollAttempt}s)`);
          }
          
        } catch (pollError) {
          // Connection errors during polling - continue polling
          if (isRetryableError(pollError as Error)) {
            console.warn(`[Voice-MiniMax] Poll error (retrying): ${(pollError as Error).message}`);
            continue;
          }
          throw pollError;
        }
      }
      
      console.error("[Voice-MiniMax] Polling timeout");
      lastError = new Error('Polling timeout');
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if this is a connection reset or network error - should retry
      if (isRetryableError(lastError)) {
        console.warn(`[Voice-MiniMax] Network error (will retry): ${lastError.message}`);
        continue;
      }
      
      console.error("[Voice-MiniMax] Unrecoverable error:", lastError);
      return null;
    }
  }
  
  console.error(`[Voice-MiniMax] All ${TTS_CONFIG.MAX_RETRIES} attempts failed. Last error: ${lastError?.message}`);
  return null;
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
