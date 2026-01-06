import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Music Generation Edge Function
 * 
 * Generates background music using ElevenLabs Music API.
 * Stores the result in Supabase storage for use in video stitching.
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
};

const GENRE_MODIFIERS: Record<string, string> = {
  orchestral: "Full orchestra with strings, brass, woodwinds, and percussion.",
  electronic: "Modern electronic production with synthesizers and digital elements.",
  hybrid: "Hybrid orchestral-electronic fusion combining classical and modern elements.",
  minimal: "Minimalist ambient score with sparse instrumentation and space.",
  piano: "Solo piano or piano-focused intimate arrangement.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 30, mood, genre, projectId }: MusicRequest = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

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

    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        duration_seconds: Math.min(duration, 120), // Max 2 minutes
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-music] ElevenLabs error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs quota exceeded. Please upgrade your plan." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`ElevenLabs music API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[generate-music] Generated ${audioBuffer.byteLength} bytes of audio`);

    // Upload to Supabase storage if we have credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const timestamp = Date.now();
      const filename = projectId 
        ? `music-${projectId}-${timestamp}.mp3`
        : `music-${timestamp}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('voice-tracks')
        .upload(filename, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error("[generate-music] Storage upload error:", uploadError);
        // Fall back to base64 response
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('voice-tracks')
          .getPublicUrl(filename);

        console.log(`[generate-music] Uploaded to storage: ${publicUrl}`);

        return new Response(
          JSON.stringify({
            success: true,
            musicUrl: publicUrl,
            durationSeconds: duration,
            prompt: finalPrompt,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: return base64 encoded audio
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    return new Response(
      JSON.stringify({
        success: true,
        audioBase64: base64Audio,
        durationSeconds: duration,
        prompt: finalPrompt,
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
