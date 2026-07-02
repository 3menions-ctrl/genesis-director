import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    // Provider chain: ElevenLabs when keyed; otherwise the Replicate-hosted
    // minimax speech-2.6-turbo (the same model generate-voice uses) — the
    // ElevenLabs key died with the Lovable migration, which left editor
    // voiceover silently broken.
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!ELEVENLABS_API_KEY && !REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "No TTS provider configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, voiceId, projectId, persist } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // When `persist:true` is set, the function uploads the generated
    // audio to storage and returns a signed URL the client can
    // immediately insert as an audio clip. Without persist, audio
    // bytes are streamed back (legacy behavior). Without persist OR
    // projectId, the bytes vanish — which was the dead-wire flagged
    // in the prior audit.

    // Default to a natural-sounding voice
    const selectedVoiceId = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George

    // ── Replicate fallback path (no ElevenLabs key) ──────────────────────
    let audioBuffer: ArrayBuffer;
    if (!ELEVENLABS_API_KEY) {
      const create = await fetch(
        "https://api.replicate.com/v1/models/minimax/speech-2.6-turbo/predictions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "wait",
          },
          body: JSON.stringify({
            input: { text: String(text).slice(0, 4900) },
          }),
        },
      );
      if (!create.ok) {
        console.error("editor-tts replicate error:", create.status, await create.text().catch(() => ""));
        return new Response(JSON.stringify({ error: "TTS generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let pred = await create.json();
      const started = Date.now();
      while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
        if (Date.now() - started > 120_000) throw new Error("TTS timeout");
        await new Promise((r) => setTimeout(r, 1500));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
        });
        if (poll.ok) pred = await poll.json();
      }
      const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      if (pred.status !== "succeeded" || !outUrl) {
        return new Response(JSON.stringify({ error: "TTS generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      audioBuffer = await (await fetch(outUrl)).arrayBuffer();
    } else {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    audioBuffer = await response.arrayBuffer();
    }

    // Persist path — upload to storage and return a public URL
    // alongside the bytes. The client can then insert as an A1
    // audio clip via insertWithNextShotIndex.
    if (persist && projectId) {
      try {
        const { createClient } = await import(
          "https://esm.sh/@supabase/supabase-js@2.39.3"
        );
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const path = `${auth.userId ?? "anon"}/${projectId}/tts-${Date.now()}.mp3`;
        const { error: upErr } = await supabase.storage
          .from("video-clips")
          .upload(path, new Uint8Array(audioBuffer), {
            contentType: "audio/mpeg",
            upsert: false,
          });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage
          .from("video-clips")
          .getPublicUrl(path);
        return new Response(
          JSON.stringify({
            audioUrl: pub.publicUrl,
            storagePath: path,
            voiceId: selectedVoiceId,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (e) {
        console.error("editor-tts persist failed", e);
        return new Response(
          JSON.stringify({ error: publicErrorMessage(e, "persist_failed") }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
