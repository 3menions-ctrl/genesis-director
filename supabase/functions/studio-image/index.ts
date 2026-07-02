// Studio Image — Replicate FLUX text-to-image and image remix.
//   • Default (fast/cheap): black-forest-labs/flux-schnell
//   • HQ or remix (reference image): black-forest-labs/flux-1.1-pro (image_prompt)
// Auth-guarded so the shared Replicate key isn't abused anonymously.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";
import { publicErrorMessage } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STYLE_PROMPTS: Record<string, string> = {
  cinematic:
    "cinematic still, anamorphic 40mm, shallow depth of field, dramatic motivated lighting, teal-and-orange color grade, subtle film grain, 35mm photography",
  editorial:
    "editorial fashion photography, soft window light, neutral palette, magazine cover composition, ultra sharp, 85mm portrait lens",
  brutalist:
    "high-contrast brutalist photography, harsh single-source key light, monochromatic palette, raw concrete textures, deep shadows",
  dreamlike:
    "ethereal pastel dreamscape, glowing rim light, lens bloom, soft fog, painterly atmosphere, hazy backlight",
  product:
    "premium product photography, seamless gradient backdrop, soft box lighting, crisp specular highlights, hero composition, ultra-clean studio",
  illustration:
    "modern editorial illustration, hand-drawn line work, layered gouache color, paper grain, sophisticated composition",
  noir:
    "black and white film noir, venetian blind shadows, smoke, hard chiaroscuro, low key lighting, 1940s cinematography",
  poster:
    "bold graphic movie-poster composition, dramatic typography-friendly negative space, saturated key color, painterly hero subject",
};

const SIZE_HINTS: Record<string, string> = {
  "1:1": "square 1:1 composition",
  "16:9": "wide cinematic 16:9 composition, horizontal landscape framing",
  "9:16": "tall 9:16 vertical composition, portrait framing for mobile",
  "3:4": "3:4 portrait composition",
  "4:3": "4:3 classic landscape composition",
  "21:9": "ultra-wide 21:9 cinematic anamorphic composition",
};

// FLUX accepts these aspect_ratio values; map UI aspects, fall back to 1:1.
const FLUX_ASPECTS = new Set(["1:1", "16:9", "9:16", "3:4", "4:3", "21:9", "2:3", "3:2", "4:5", "5:4", "9:21"]);

interface Body {
  prompt: string;
  style?: string;
  aspect?: string;
  referenceUrl?: string; // when provided we run a remix (image_prompt)
  count?: number; // 1..4
  hq?: boolean; // use flux-1.1-pro
}

async function pollPrediction(getUrl: string, token: string, maxSeconds: number): Promise<Record<string, unknown>> {
  const deadline = maxSeconds * 1000;
  let waited = 0;
  while (waited < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    waited += 1500;
    const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) continue;
    const result = await resp.json();
    if (result.status === "succeeded" || result.status === "failed" || result.status === "canceled") {
      return result;
    }
  }
  throw new Error("Replicate prediction timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  // ═══ AUTH GUARD: prevent anonymous abuse of the shared Replicate key ═══
  const auth = await validateAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

  try {
    const REPLICATE_TOKEN =
      Deno.env.get("REPLICATE_API_TOKEN") || Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Image generation is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    const prompt = (body.prompt || "").trim();
    if (!prompt || prompt.length < 3) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const styleSuffix = body.style && STYLE_PROMPTS[body.style] ? `. ${STYLE_PROMPTS[body.style]}` : "";
    const aspectSuffix = body.aspect && SIZE_HINTS[body.aspect] ? `. ${SIZE_HINTS[body.aspect]}` : "";
    const fullPrompt = `${prompt}${styleSuffix}${aspectSuffix}`;

    // ═══ CREDIT GATE: rate-limit + balance pre-check BEFORE the paid Replicate call ═══
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const gateCtx = {
      supabase: supabaseAdmin,
      fnName: "studio-image",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      projectId: null,
      cost: 5,
      dailyCap: 100,
      corsHeaders,
    };
    const gateBlock = await preflightAiGate(gateCtx);
    if (gateBlock) return gateBlock;

    const count = Math.max(1, Math.min(4, body.count ?? 1));
    const aspect = body.aspect && FLUX_ASPECTS.has(body.aspect) ? body.aspect : "1:1";
    // Remix (reference image) and HQ both use flux-1.1-pro (supports image_prompt
    // and higher fidelity). The fast default is flux-schnell.
    const useHq = !!body.hq || !!body.referenceUrl;
    const modelSlug = useHq ? "black-forest-labs/flux-1.1-pro" : "black-forest-labs/flux-schnell";
    const model = useHq ? "flux-1.1-pro" : "flux-schnell";

    const callOnce = async (): Promise<string | null> => {
      const input: Record<string, unknown> = useHq
        ? {
            prompt: fullPrompt,
            aspect_ratio: aspect,
            output_format: "webp",
            output_quality: 90,
            safety_tolerance: 2,
            ...(body.referenceUrl ? { image_prompt: body.referenceUrl } : {}),
          }
        : {
            prompt: fullPrompt,
            aspect_ratio: aspect,
            num_outputs: 1,
            output_format: "webp",
            output_quality: 90,
            go_fast: true,
          };

      const r = await fetch(
        `https://api.replicate.com/v1/models/${modelSlug}/predictions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${REPLICATE_TOKEN}`,
            "Content-Type": "application/json",
            // Wait up to 60s for the result inline so we don't have to poll
            // for fast models; pollPrediction is the fallback for slower ones.
            Prefer: "wait=60",
          },
          body: JSON.stringify({ input }),
        },
      );
      if (!r.ok) {
        const txt = await r.text();
        console.error("Replicate error", r.status, txt.slice(0, 300));
        const err = new Error(`Replicate ${r.status}`);
        (err as Error & { status?: number }).status = r.status;
        throw err;
      }
      let pred = (await r.json()) as Record<string, unknown>;
      const status = pred.status as string;
      if (status !== "succeeded" && status !== "failed" && status !== "canceled") {
        const getUrl = (pred.urls as { get?: string } | undefined)?.get;
        if (getUrl) pred = await pollPrediction(getUrl, REPLICATE_TOKEN, 90);
      }
      if (pred.status !== "succeeded") {
        const err = new Error(`Replicate prediction ${pred.status}: ${String(pred.error ?? "")}`.slice(0, 200));
        throw err;
      }
      const out = pred.output;
      if (Array.isArray(out)) return (out[0] as string) ?? null;
      if (typeof out === "string") return out;
      return null;
    };

    // Run N predictions in parallel; partial failures allowed.
    const settled = await Promise.allSettled(
      Array.from({ length: count }, () => callOnce()),
    );

    const images: string[] = [];
    let blockingStatus: number | null = null;
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) images.push(s.value);
      else if (s.status === "rejected") {
        const st = (s.reason as Error & { status?: number })?.status;
        if (st === 402 || st === 429) blockingStatus = st;
      }
    }

    if (images.length === 0) {
      if (blockingStatus === 402) {
        return new Response(
          JSON.stringify({ error: "Image provider is out of credits. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (blockingStatus === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ CREDIT GATE: charge once now that at least one image generated ═══
    await chargeAiGate(gateCtx);

    return new Response(
      JSON.stringify({ images, model, prompt: fullPrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("studio-image error", e);
    return new Response(
      JSON.stringify({ error: publicErrorMessage(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
