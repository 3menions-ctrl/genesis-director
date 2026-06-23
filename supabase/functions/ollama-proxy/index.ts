import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ollama-proxy — server-side bridge to a self-hosted Ollama for TEXT-ONLY
 * prompt rewrites (the `local-ollama` AIProvider, opt-in via VITE_AI_PROVIDER).
 *
 * Why a proxy: the frontend never talks to Ollama directly — the box running
 * Ollama stays off the public internet. This function is the single, auth-gated
 * door. The Ollama endpoint is read from `OLLAMA_URL` (NOT the request body) so
 * a caller can never point us at an arbitrary host (SSRF-safe).
 *
 * Request:  { prompt: string, instruction?: string, model?: string }
 * Response: { text: string }
 */

const DEFAULT_MODEL = Deno.env.get("OLLAMA_MODEL") || "llama3.1";
// No default to a public host — if unset, the feature is simply unavailable.
const OLLAMA_URL = Deno.env.get("OLLAMA_URL") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth-gate: only signed-in users (or service role) may spend the box's compute.
  const auth = await validateAuth(req);
  if (!auth.authenticated && !auth.isServiceRole) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  if (!OLLAMA_URL) {
    return new Response(
      JSON.stringify({ error: "Ollama is not configured (set OLLAMA_URL)." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { prompt, instruction, model } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullPrompt = instruction ? `${instruction}\n\n${prompt}` : prompt;

    // Ollama's native generate endpoint. stream:false → one JSON response.
    const resp = await fetch(`${OLLAMA_URL.replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: typeof model === "string" && model ? model : DEFAULT_MODEL,
        prompt: fullPrompt,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Ollama error ${resp.status}`, detail: detail.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const text = typeof data?.response === "string" ? data.response : "";
    if (!text) {
      return new Response(JSON.stringify({ error: "Empty Ollama response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
