import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Music Generation Edge Function
 * 
 * Generates background music using:
 * 1. Replicate's MusicGen model (primary)
 * 2. Stock music library (fallback)
 * 3. Silent placeholder (last resort)
 */

interface MusicRequest {
  prompt: string;
  duration?: number; // seconds
  mood?: string;
  genre?: string;
  projectId?: string;
}

// Mood-to-prompt mappings for cinematic consistency
const MOOD_PROMPTS: Record<string, string> = {
  epic: "Epic orchestral cinematic score with powerful brass, dramatic strings, and thundering percussion. Hollywood blockbuster style.",
  tension: "Suspenseful cinematic underscore with low drones, subtle pulses, and building tension. Thriller movie style.",
  emotional: "Emotional piano-driven cinematic score with gentle strings and heartfelt melody. Oscar-winning drama style.",
  action: "High-energy action movie score with driving percussion, intense brass hits, and adrenaline-pumping rhythm.",
  mysterious: "Mysterious atmospheric score with ethereal pads, subtle textures, and intrigue. Mystery thriller style.",
  uplifting: "Uplifting inspirational score with soaring strings, hopeful piano, and triumphant crescendo.",
  dark: "Dark brooding cinematic score with ominous tones, deep bass, and foreboding atmosphere.",
  romantic: "Romantic cinematic score with lush strings, tender piano, and sweeping melody.",
  adventure: "Adventure movie score with bold themes, heroic brass, and exciting orchestration. Indiana Jones style.",
  scifi: "Sci-fi cinematic score with synthesizers, electronic elements, and futuristic soundscape. Blade Runner style.",
  calm: "Calm ambient background music with soft pads and gentle melody.",
  happy: "Happy upbeat background music with cheerful melody and positive energy.",
  cinematic: "Cinematic orchestral score with dramatic swells, emotional strings, and professional film quality.",
};

const GENRE_MODIFIERS: Record<string, string> = {
  orchestral: "Full orchestra with strings, brass, woodwinds, and percussion.",
  electronic: "Modern electronic production with synthesizers and digital elements.",
  hybrid: "Hybrid orchestral-electronic fusion combining classical and modern elements.",
  minimal: "Minimalist ambient score with sparse instrumentation and space.",
  piano: "Solo piano or piano-focused intimate arrangement.",
  acoustic: "Acoustic instruments with warm natural sound.",
};

// Try Replicate MusicGen
async function generateWithReplicate(prompt: string, duration: number): Promise<string | null> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  
  if (!REPLICATE_API_KEY) {
    console.log("[generate-music] No Replicate API key configured");
    return null;
  }
  
  try {
    console.log("[generate-music] Starting Replicate MusicGen generation...");
    
    // Create prediction
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
          duration: Math.min(duration, 30), // MusicGen max is 30s
          output_format: "mp3",
          normalization_strategy: "loudness",
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[generate-music] Replicate create failed:", errorText);
      return null;
    }
    
    const prediction = await createResponse.json();
    console.log("[generate-music] Replicate prediction started:", prediction.id);
    
    // Poll for completion (max 2 minutes)
    const maxAttempts = 24;
    const pollInterval = 5000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        },
      });
      
      if (!statusResponse.ok) continue;
      
      const status = await statusResponse.json();
      console.log(`[generate-music] Replicate status: ${status.status}`);
      
      if (status.status === "succeeded" && status.output) {
        console.log("[generate-music] Replicate MusicGen succeeded!");
        return status.output;
      }
      
      if (status.status === "failed" || status.status === "canceled") {
        console.error("[generate-music] Replicate failed:", status.error);
        return null;
      }
    }
    
    console.warn("[generate-music] Replicate polling timed out");
    return null;
    
  } catch (error) {
    console.error("[generate-music] Replicate error:", error);
    return null;
  }
}

// Upload audio URL to Supabase storage
async function uploadToStorage(audioUrl: string, projectId: string, supabase: any): Promise<string | null> {
  try {
    // Download the audio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) return null;
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${projectId}/background-music-${Date.now()}.mp3`;
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("voice-tracks") // Reuse voice-tracks bucket for audio
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("[generate-music] Upload error:", uploadError);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("voice-tracks")
      .getPublicUrl(fileName);
    
    console.log("[generate-music] Uploaded to storage:", publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error("[generate-music] Upload failed:", error);
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
    
    // Add mood-based prompt if specified
    if (mood && MOOD_PROMPTS[mood]) {
      finalPrompt = finalPrompt 
        ? `${finalPrompt}. ${MOOD_PROMPTS[mood]}`
        : MOOD_PROMPTS[mood];
    }
    
    // Add genre modifier if specified
    if (genre && GENRE_MODIFIERS[genre]) {
      finalPrompt = `${finalPrompt} ${GENRE_MODIFIERS[genre]}`;
    }
    
    // Default if nothing provided
    if (!finalPrompt.trim()) {
      finalPrompt = "Cinematic orchestral score suitable for a professional short film. Emotional and engaging.";
    }

    console.log(`[generate-music] Generating ${duration}s track for project ${projectId || 'unknown'}`);
    console.log(`[generate-music] Prompt: ${finalPrompt.substring(0, 100)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // Try Replicate MusicGen first
    const replicateResult = await generateWithReplicate(finalPrompt, duration);
    
    if (replicateResult && supabase && projectId) {
      // Upload to storage for persistence
      const storedUrl = await uploadToStorage(replicateResult, projectId, supabase);
      const musicUrl = storedUrl || replicateResult;
      
      // Log success
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId,
          p_shot_id: 'background_music',
          p_service: 'music-generation',
          p_operation: 'generate_music',
          p_credits_charged: 0,
          p_real_cost_cents: 5, // ~$0.05 for MusicGen
          p_duration_seconds: duration,
          p_status: 'success',
          p_metadata: JSON.stringify({
            mood,
            genre,
            provider: 'replicate-musicgen',
            stored: !!storedUrl,
          }),
        });
      } catch (logError) {
        console.warn("[generate-music] Failed to log:", logError);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          musicUrl,
          durationSeconds: duration,
          prompt: finalPrompt,
          source: "replicate-musicgen",
          hasMusic: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: Check for stock music
    if (supabase) {
      const stockMusicBucket = 'stock-music';
      const moodKey = mood || 'cinematic';
      
      try {
        const { data: files } = await supabase.storage
          .from(stockMusicBucket)
          .list('', { limit: 100 });
        
        const matchingFile = files?.find((f: any) => 
          f.name.toLowerCase().includes(moodKey.toLowerCase()) ||
          f.name.toLowerCase().includes('background') ||
          f.name.toLowerCase().includes('cinematic')
        );
        
        if (matchingFile) {
          const { data: { publicUrl } } = supabase.storage
            .from(stockMusicBucket)
            .getPublicUrl(matchingFile.name);
          
          console.log(`[generate-music] Using stock music: ${publicUrl}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              musicUrl: publicUrl,
              durationSeconds: duration,
              prompt: finalPrompt,
              source: "stock",
              hasMusic: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (stockError) {
        console.log("[generate-music] No stock music available:", stockError);
      }
      
      // Log that music generation was skipped
      try {
        await supabase.rpc('log_api_cost', {
          p_project_id: projectId || null,
          p_shot_id: 'background_music',
          p_service: 'music-generation',
          p_operation: 'generate_music',
          p_credits_charged: 0,
          p_real_cost_cents: 0,
          p_duration_seconds: duration,
          p_status: 'skipped',
          p_metadata: JSON.stringify({
            mood,
            genre,
            reason: 'no_music_provider_available',
          }),
        });
      } catch (logError) {
        console.warn("[generate-music] Failed to log:", logError);
      }
    }

    // Return response indicating music is not available
    console.log("[generate-music] No music available - returning null URL");
    
    return new Response(
      JSON.stringify({
        success: true,
        musicUrl: null,
        durationSeconds: duration,
        prompt: finalPrompt,
        message: "Music generation skipped - no provider available. Video will be generated without background music.",
        source: "none",
        hasMusic: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-music] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Music generation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
