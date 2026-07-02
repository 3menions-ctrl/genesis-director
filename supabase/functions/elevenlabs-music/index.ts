import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};


// ── Replicate fallback (music — Google Lyria 2) — the ElevenLabs key died with the
// Lovable migration; this keeps the feature alive on the always-present
// REPLICATE_API_KEY. Official-model billing, cheap.
async function replicateMusic(prompt: string): Promise<ArrayBuffer> {
  const key = Deno.env.get("REPLICATE_API_KEY");
  if (!key) throw new Error("No audio provider configured");
  const create = await fetch("https://api.replicate.com/v1/models/google/lyria-2/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "wait" },
    body: JSON.stringify({ input: { prompt, negative_prompt: "low quality, noise, distortion" } }),
  });
  if (!create.ok) throw new Error(`replicate audio error ${create.status}`);
  let pred = await create.json();
  const started = Date.now();
  while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    if (Date.now() - started > 180_000) throw new Error("audio generation timeout");
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (poll.ok) pred = await poll.json();
  }
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (pred.status !== "succeeded" || !out) throw new Error(`audio generation ${pred.status}`);
  return await (await fetch(out)).arrayBuffer();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ AUTH GUARD: prevent anonymous abuse of paid ElevenLabs API ═══
  const auth = await validateAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

  try {
    const { prompt, duration } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ElevenLabs-Music] Generating: "${prompt.substring(0, 100)}" (${duration || 30}s)`);

    if (!ELEVENLABS_API_KEY) {
      const buf = await replicateMusic(prompt);
      console.log(`[ElevenLabs-Music] ✅ Lyria-2 fallback generated ${buf.byteLength} bytes`);
      return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg" } });
    }

    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        duration_seconds: duration || 30,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ElevenLabs-Music] API error ${response.status}: ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Music generation failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[ElevenLabs-Music] ✅ Generated ${audioBuffer.byteLength} bytes`);

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[ElevenLabs-Music] Error:", error);
    return new Response(
      JSON.stringify({ error: publicErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
