// Studio Image — Lovable AI (Nano Banana / Nano Banana Pro) text-to-image and image edit.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";

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

interface Body {
  prompt: string;
  style?: string;
  aspect?: string;
  referenceUrl?: string; // when provided we run an edit
  count?: number; // 1..4
  hq?: boolean; // use Nano Banana Pro
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  // ═══ AUTH GUARD: prevent anonymous abuse of paid Lovable AI Gateway ═══
  const auth = await validateAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured" }),
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

    const styleSuffix = body.style && STYLE_PROMPTS[body.style] ? `\n\nStyle: ${STYLE_PROMPTS[body.style]}.` : "";
    const aspectSuffix = body.aspect && SIZE_HINTS[body.aspect] ? `\n\nFraming: ${SIZE_HINTS[body.aspect]}.` : "";
    const fullPrompt = `${prompt}${styleSuffix}${aspectSuffix}`;

    const count = Math.max(1, Math.min(4, body.count ?? 1));
    const model = body.hq
      ? "google/gemini-3-pro-image-preview"
      : "google/gemini-2.5-flash-image";

    // Build user content: text + optional reference image for edits
    const userContent: unknown =
      body.referenceUrl
        ? [
            { type: "text", text: fullPrompt },
            { type: "image_url", image_url: { url: body.referenceUrl } },
          ]
        : fullPrompt;

    const callOnce = async (): Promise<string | null> => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: userContent }],
          modalities: ["image", "text"],
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        console.error("AI gateway error", r.status, txt);
        const err = new Error(`AI gateway ${r.status}`);
        (err as Error & { status?: number }).status = r.status;
        throw err;
      }
      const j = await r.json();
      const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      return url;
    };

    // Run N requests in parallel; partial failures allowed
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
          JSON.stringify({ error: "Out of AI credits. Add credits to your workspace." }),
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

    return new Response(
      JSON.stringify({ images, model, prompt: fullPrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("studio-image error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
