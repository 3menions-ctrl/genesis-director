import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Music Generation using Replicate MusicGen
 * 
 * Generates background music using Meta's MusicGen model via Replicate.
 * Fully self-contained - no external music API dependencies.
 */

interface MusicRequest {
  prompt: string;
  duration?: number;
  mood?: string;
  genre?: string;
  projectId?: string;
}

// Mood to prompt mappings
const MOOD_PROMPTS: Record<string, string> = {
  epic: "Epic orchestral cinematic score with powerful brass, dramatic strings, thundering percussion, Hollywood blockbuster style",
  tension: "Suspenseful cinematic underscore with low drones, subtle pulses, building tension, thriller movie style",
  emotional: "Emotional piano-driven cinematic score with gentle strings, heartfelt melody, Oscar drama style",
  action: "High-energy action movie score with driving percussion, intense brass hits, adrenaline rhythm",
  mysterious: "Mysterious atmospheric score with ethereal pads, subtle textures, intrigue and wonder",
  uplifting: "Uplifting inspirational score with soaring strings, hopeful piano, triumphant crescendo",
  dark: "Dark brooding cinematic score with ominous tones, deep bass, foreboding atmosphere",
  romantic: "Romantic cinematic score with lush strings, tender piano, sweeping melody",
  adventure: "Adventure movie score with bold themes, heroic brass, exciting orchestration",
  scifi: "Sci-fi cinematic score with synthesizers, electronic elements, futuristic soundscape",
  calm: "Calm ambient background music with soft pads, gentle melody, peaceful atmosphere",
  happy: "Happy upbeat background music with cheerful melody, positive energy, bright tones",
  cinematic: "Cinematic orchestral score with dramatic swells, emotional strings, professional film quality",
  horror: "Horror movie score with dissonant tones, creepy ambience, unsettling atmosphere",
  comedy: "Light comedic score with playful melody, whimsical instruments, fun energy",
};

const GENRE_MODIFIERS: Record<string, string> = {
  orchestral: "full orchestra with strings, brass, woodwinds, and percussion",
  electronic: "modern electronic production with synthesizers and digital elements",
  hybrid: "hybrid orchestral-electronic fusion combining classical and modern",
  minimal: "minimalist ambient score with sparse instrumentation and space",
  piano: "solo piano or piano-focused intimate arrangement",
  acoustic: "acoustic instruments with warm natural sound",
  synthwave: "retro synthwave with 80s synthesizers and pulsing basslines",
  ambient: "ambient textures with evolving pads and atmospheric sounds",
};

// Generate music using Replicate MusicGen
async function generateWithMusicGen(
  prompt: string,
  duration: number
): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    console.error("[Music-Replicate] No REPLICATE_API_KEY configured");
    return null;
  }
  
  try {
    console.log(`[Music-Replicate] Starting MusicGen for ${duration}s`);
    console.log(`[Music-Replicate] Prompt: ${prompt.substring(0, 100)}...`);
    
    // MusicGen Stereo Large model
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38", // MusicGen Stereo Large
        input: {
          prompt: prompt,
          duration: Math.min(30, Math.max(5, duration)), // MusicGen: 5-30 seconds
          output_format: "mp3",
          normalization_strategy: "loudness",
          top_k: 250,
          top_p: 0.95,
          temperature: 1.0,
          classifier_free_guidance: 3,
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Music-Replicate] Create failed:", errorText);
      return await generateWithRiffusion(prompt, duration);
    }
    
    const prediction = await createResponse.json();
    console.log("[Music-Replicate] Prediction started:", prediction.id);
    
    // Poll for completion (max 3 minutes for music generation)
    const maxAttempts = 36;
    const pollInterval = 5000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      if (!statusResponse.ok) continue;
      
      const status = await statusResponse.json();
      console.log(`[Music-Replicate] Status: ${status.status} (attempt ${i + 1}/${maxAttempts})`);
      
      if (status.status === "succeeded" && status.output) {
        console.log("[Music-Replicate] MusicGen succeeded!");
        return status.output;
      }
      
      if (status.status === "failed" || status.status === "canceled") {
        console.error("[Music-Replicate] Failed:", status.error);
        return await generateWithRiffusion(prompt, duration);
      }
    }
    
    console.warn("[Music-Replicate] Polling timed out");
    return null;
    
  } catch (error) {
    console.error("[Music-Replicate] Error:", error);
    return null;
  }
}

// Fallback: Riffusion for faster generation
async function generateWithRiffusion(
  prompt: string,
  duration: number
): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) return null;
  
  try {
    console.log("[Music-Riffusion] Fallback generation...");
    
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05", // riffusion
        input: {
          prompt_a: prompt,
          denoising: 0.75,
          prompt_b: prompt,
          alpha: 0.5,
          num_inference_steps: 50,
          seed_image_id: "og_beat",
        },
      }),
    });
    
    if (!createResponse.ok) return null;
    
    const prediction = await createResponse.json();
    
    // Poll for completion
    for (let i = 0; i < 24; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` },
      });
      
      const status = await statusResponse.json();
      
      if (status.status === "succeeded" && status.output?.audio) {
        console.log("[Music-Riffusion] Succeeded!");
        return status.output.audio;
      }
      
      if (status.status === "failed") return null;
    }
    
    return null;
  } catch (error) {
    console.error("[Music-Riffusion] Error:", error);
    return null;
  }
}

// Upload to storage
async function uploadToStorage(
  audioUrl: string,
  projectId: string,
  supabase: any
): Promise<string | null> {
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) return null;
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${projectId}/background-music-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from("voice-tracks")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("[Music] Upload error:", uploadError);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from("voice-tracks")
      .getPublicUrl(fileName);
    
    console.log("[Music] Uploaded:", publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error("[Music] Upload failed:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 30, mood, genre, projectId }: MusicRequest = await req.json();

    // Build the final prompt
    let finalPrompt = prompt || "";
    
    if (mood && MOOD_PROMPTS[mood]) {
      finalPrompt = finalPrompt 
        ? `${finalPrompt}. ${MOOD_PROMPTS[mood]}`
        : MOOD_PROMPTS[mood];
    }
    
    if (genre && GENRE_MODIFIERS[genre]) {
      finalPrompt = `${finalPrompt}, ${GENRE_MODIFIERS[genre]}`;
    }
    
    if (!finalPrompt.trim()) {
      finalPrompt = "Cinematic orchestral score suitable for a professional short film, emotional and engaging, high quality";
    }

    console.log(`[Music] Generating ${duration}s track for project ${projectId || 'unknown'}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // Generate with MusicGen
    const musicUrl = await generateWithMusicGen(finalPrompt, duration);
    
    if (musicUrl && supabase && projectId) {
      // Upload to storage for persistence
      const storedUrl = await uploadToStorage(musicUrl, projectId, supabase);
      const finalUrl = storedUrl || musicUrl;
      
      // Update project with music URL
      if (storedUrl) {
        await supabase
          .from('movie_projects')
          .update({ music_url: storedUrl })
          .eq('id', projectId);
      }
      
      // Log cost
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId,
          p_shot_id: 'background_music',
          p_service: 'replicate-musicgen',
          p_operation: 'generate_music',
          p_credits_charged: 0,
          p_real_cost_cents: 5, // ~$0.05 for MusicGen
          p_duration_seconds: duration,
          p_status: 'completed',
          p_metadata: JSON.stringify({
            mood,
            genre,
            provider: 'replicate-musicgen',
            stored: !!storedUrl,
          }),
        });
      } catch (e) {
        console.warn("[Music] Cost log failed:", e);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          musicUrl: finalUrl,
          durationSeconds: duration,
          prompt: finalPrompt,
          source: "replicate-musicgen",
          hasMusic: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No music generated
    console.log("[Music] No music generated");
    
    return new Response(
      JSON.stringify({
        success: true,
        musicUrl: null,
        durationSeconds: duration,
        prompt: finalPrompt,
        message: "Music generation unavailable. Video will proceed without background music.",
        source: "none",
        hasMusic: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Music] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Music generation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
