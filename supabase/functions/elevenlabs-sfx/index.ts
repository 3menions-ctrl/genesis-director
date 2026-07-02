import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};


// ── Replicate fallback (SFX — Stable Audio Open) — the ElevenLabs key died
// with the Lovable migration; this keeps SFX alive on REPLICATE_API_KEY.
const STABLE_AUDIO_VERSION = "9aff84a639f96d0f7e6081cdea002d15133d0043727f849c40abdd166b7c75a8";
async function replicateSfx(prompt: string, seconds: number): Promise<ArrayBuffer> {
  const key = Deno.env.get("REPLICATE_API_KEY");
  if (!key) throw new Error("No SFX provider configured");
  const create = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "wait" },
    body: JSON.stringify({
      version: STABLE_AUDIO_VERSION,
      input: { prompt, seconds_total: Math.max(1, Math.min(30, seconds)) },
    }),
  });
  if (!create.ok) throw new Error(`replicate sfx error ${create.status}`);
  let pred = await create.json();
  const started = Date.now();
  while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    if (Date.now() - started > 180_000) throw new Error("sfx generation timeout");
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (poll.ok) pred = await poll.json();
  }
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (pred.status !== "succeeded" || !out) throw new Error(`sfx generation ${pred.status}`);
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

    // ═══ CREDIT GATE: rate-limit + balance pre-check BEFORE the paid SFX call ═══
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const gateCtx = {
      supabase: supabaseAdmin,
      fnName: "elevenlabs-sfx",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      projectId: null,
      cost: 2,
      dailyCap: 100,
      corsHeaders,
    };
    const gateBlock = await preflightAiGate(gateCtx);
    if (gateBlock) return gateBlock;

    console.log(`[ElevenLabs-SFX] Generating: "${prompt.substring(0, 100)}" (${duration || 5}s)`);

    if (!ELEVENLABS_API_KEY) {
      const buf = await replicateSfx(prompt, duration || 5);
      console.log(`[ElevenLabs-SFX] ✅ stable-audio fallback generated ${buf.byteLength} bytes`);
      await chargeAiGate(gateCtx);
      return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg" } });
    }

    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: duration || 5,
        prompt_influence: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ElevenLabs-SFX] API error ${response.status}: ${errorText}`);
      return new Response(
        JSON.stringify({ error: `SFX generation failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[ElevenLabs-SFX] ✅ Generated ${audioBuffer.byteLength} bytes`);

    // ═══ CREDIT GATE: charge once now that SFX generated successfully ═══
    await chargeAiGate(gateCtx);

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[ElevenLabs-SFX] Error:", error);
    return new Response(
      JSON.stringify({ error: publicErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
