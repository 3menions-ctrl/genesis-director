import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiFormData = new FormData();
    apiFormData.append("file", audioFile);
    apiFormData.append("model_id", "scribe_v2");
    apiFormData.append("tag_audio_events", "false");
    apiFormData.append("diarize", "false");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs STT error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();

    // Convert word-level timestamps to caption segments
    const captions: { start: number; end: number; text: string }[] = [];

    if (result.words && result.words.length > 0) {
      let currentCaption = { start: result.words[0].start, end: result.words[0].end, words: [result.words[0].text] };

      for (let i = 1; i < result.words.length; i++) {
        const word = result.words[i];
        const gap = word.start - currentCaption.end;

        // New caption segment if gap > 1s or > 8 words
        if (gap > 1.0 || currentCaption.words.length >= 8) {
          captions.push({
            start: currentCaption.start,
            end: currentCaption.end,
            text: currentCaption.words.join(" "),
          });
          currentCaption = { start: word.start, end: word.end, words: [word.text] };
        } else {
          currentCaption.end = word.end;
          currentCaption.words.push(word.text);
        }
      }

      // Push last segment
      captions.push({
        start: currentCaption.start,
        end: currentCaption.end,
        text: currentCaption.words.join(" "),
      });
    }

    return new Response(JSON.stringify({ text: result.text, captions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Transcription error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
