// ─────────────────────────────────────────────────────────────────────────
// generate-cast-portrait — a reference portrait for a reusable cast member.
//
// Generates a clean, identity-anchored character portrait (FLUX 1.1 Pro Ultra)
// from a name + description and stores it in the `character-references` bucket.
// The client then saves it onto a director_cast row (RLS-owned), so the cast
// member can seed identity across many projects.
//
// Owner-implicit (writes only to the caller's folder) + credit-gated.
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "character-references";
const COST = 4;
const DAILY_CAP = 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) return unauthorizedResponse(corsHeaders, auth.error);

    const { name, description, kind } = await req.json().catch(() => ({}));
    if (!name && !description) {
      return new Response(JSON.stringify({ error: "name or description required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("REPLICATE_API_KEY")!;
    if (!apiKey) throw new Error("REPLICATE_API_KEY not configured");

    const gateCtx = {
      supabase, fnName: "generate-cast-portrait", userId: auth.userId,
      isServiceRole: auth.isServiceRole, cost: COST, dailyCap: DAILY_CAP, corsHeaders,
    };
    const blocked = await preflightAiGate(gateCtx);
    if (blocked) return blocked;

    // Identity-anchored portrait prompt. Worlds get an establishing location plate.
    const isWorld = kind === "world";
    const prompt = isWorld
      ? `${name ? name + ". " : ""}${description || ""}. Cinematic establishing shot of this location, photorealistic, dramatic natural lighting, rich atmosphere, ultra detailed, 8k.`.trim()
      : `Character reference portrait of ${name || "a person"}. ${description || ""}. Centered medium close-up, neutral background, even cinematic lighting, sharp focus on the face, consistent identity, photorealistic, ultra detailed, 8k.`.trim();

    // FLUX 1.1 Pro Ultra (fallback to Pro).
    const submit = async (model: string) =>
      fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { prompt: prompt.slice(0, 2400), aspect_ratio: isWorld ? "16:9" : "1:1", output_format: "png", output_quality: 100, prompt_upsampling: true, safety_tolerance: 5 },
        }),
      });
    let res = await submit("black-forest-labs/flux-1.1-pro-ultra");
    if (!res.ok) res = await submit("black-forest-labs/flux-1.1-pro");
    if (!res.ok) throw new Error(`flux_${res.status}: ${(await res.text()).slice(0, 160)}`);
    let pred = await res.json();
    const deadline = Date.now() + 120_000;
    while (pred.status !== "succeeded") {
      if (pred.status === "failed" || pred.status === "canceled") throw new Error(`flux_${pred.status}`);
      if (Date.now() > deadline) throw new Error("flux_timeout");
      await sleep(2500);
      pred = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }).then((r) => r.json());
    }
    const fluxUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (typeof fluxUrl !== "string") throw new Error("flux_no_output");

    // Persist to the user's folder in character-references.
    const bytes = new Uint8Array(await (await fetch(fluxUrl)).arrayBuffer());
    const key = `${auth.userId}/${Date.now()}.png`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, bytes, {
      contentType: "image/png", upsert: true,
    });
    if (upErr) throw new Error(`upload_failed: ${upErr.message}`);
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

    const charged = await chargeAiGate(gateCtx);
    return new Response(JSON.stringify({ success: true, imageUrl, cost: charged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[generate-cast-portrait]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
