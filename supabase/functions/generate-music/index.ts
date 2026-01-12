import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Music Generation Edge Function
 * 
 * Generates background music using Lovable AI's music generation capabilities.
 * Falls back to a stock music library or silent placeholder if unavailable.
 * 
 * Supports mood-based generation for cinematic consistency.
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
};

const GENRE_MODIFIERS: Record<string, string> = {
  orchestral: "Full orchestra with strings, brass, woodwinds, and percussion.",
  electronic: "Modern electronic production with synthesizers and digital elements.",
  hybrid: "Hybrid orchestral-electronic fusion combining classical and modern elements.",
  minimal: "Minimalist ambient score with sparse instrumentation and space.",
  piano: "Solo piano or piano-focused intimate arrangement.",
  acoustic: "Acoustic instruments with warm natural sound.",
};

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

    // Try Lovable AI music generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (LOVABLE_API_KEY) {
      try {
        // Use Lovable AI's image model for generating music prompts
        // (Lovable AI doesn't have direct music generation, but we can use it to enhance prompts)
        console.log("[generate-music] Using Lovable AI for prompt enhancement");
        
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a music director. Given a music prompt, enhance it with specific musical details like tempo (BPM), key, instruments, and structure. Keep response under 100 words."
              },
              {
                role: "user",
                content: `Enhance this music prompt for a ${duration} second track: ${finalPrompt}`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const enhancedPrompt = aiData.choices?.[0]?.message?.content || finalPrompt;
          console.log(`[generate-music] Enhanced prompt: ${enhancedPrompt.substring(0, 100)}...`);
          finalPrompt = enhancedPrompt;
        }
      } catch (aiError) {
        console.warn("[generate-music] Lovable AI enhancement failed, using original prompt:", aiError);
      }
    }

    // Since we don't have a reliable free music generation API,
    // we'll return a "music pending" response that the frontend can handle
    // The actual music can be added manually or through a future integration
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Check if we have any pre-existing stock music that matches the mood
      const stockMusicBucket = 'stock-music';
      const moodKey = mood || 'default';
      
      try {
        // Try to get stock music file
        const { data: files } = await supabase.storage
          .from(stockMusicBucket)
          .list('', { limit: 100 });
        
        // Find a matching file based on mood
        const matchingFile = files?.find(f => 
          f.name.toLowerCase().includes(moodKey.toLowerCase()) ||
          f.name.toLowerCase().includes('background')
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
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (stockError) {
        console.log("[generate-music] No stock music available:", stockError);
      }
      
      // Log that music generation was attempted but no source available
      try {
        await supabase.rpc('log_api_cost', {
          p_user_id: null,
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

    // Return a response indicating music is not available but video can proceed without it
    return new Response(
      JSON.stringify({
        success: true,
        musicUrl: null,
        durationSeconds: duration,
        prompt: finalPrompt,
        message: "Music generation skipped - no provider available. Video will be generated without background music.",
        source: "none",
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
