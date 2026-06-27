import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  validateInput,
  errorResponse,
  successResponse,
  fetchWithRetry,
  calculateMaxTokens,
  checkMultipleContent,
  parseJsonWithRecovery,
} from "../_shared/script-utils.ts";
import { preflightAiGate, chargeAiGate } from "../_shared/ai-credit-gate.ts";

/**
 * generate-ad-variants — variant generation at scale + multi-format reframe.
 *
 * Takes ONE winning ad concept and explodes it into a production-ready matrix
 * of variants: every (distinct hook × selected aspect ratio) pair, each with a
 * script genuinely re-framed for that format's safe zones and pacing — not the
 * same script letterboxed. This is the "make 12 ads from 1" step advertisers
 * batch-test.
 *
 * Same conventions as generate-ad-studio: shared script-utils, auth guard,
 * content-safety gate, org brand-kit injection, OpenAI via fetchWithRetry,
 * strict JSON recovered with parseJsonWithRecovery.
 */

type Aspect = "9:16" | "1:1" | "4:5" | "16:9";

interface BaseConcept {
  angle?: string;
  script?: string;
  headline?: string;
  primaryText?: string;
  cta?: string;
  hooks?: string[];
}

interface VariantsRequest {
  organizationId?: string;
  productName?: string;
  productDescription?: string;
  objective?: string;
  platform?: string;
  baseConcept?: BaseConcept;
  formats?: Aspect[];
  /** Distinct hook openers per format (1–4). */
  hookVariants?: number;
}

interface AdVariant {
  label: string;
  aspectRatio: string;
  hook: string;
  headline: string;
  primaryText: string;
  cta: string;
  script: string;
  framingNotes: string;
  durationSeconds: number;
  clipCount: number;
  recommendedEngine: string;
}

// Per-format reframe guidance — safe zones, composition, pacing.
const FORMAT_SPECS: Record<Aspect, { label: string; durationSeconds: number; clipCount: number; guidance: string }> = {
  "9:16": { label: "Vertical (Stories/Reels/TikTok)", durationSeconds: 20, clipCount: 4, guidance: "Full-screen mobile. Subject centered in the middle 60%; keep top ~15% and bottom ~20% clear of key action for UI/captions. Tight, fast pacing; one idea per shot; sound-on but caption-safe." },
  "1:1":  { label: "Square (feed)", durationSeconds: 15, clipCount: 3, guidance: "Center-safe square. Critical content inside the central square; leave top/bottom thirds calm for overlaid headline + CTA. Punchy, works sound-off." },
  "4:5":  { label: "Portrait (feed)", durationSeconds: 18, clipCount: 4, guidance: "Tall feed format that wins screen real estate. Vertical-leaning composition; keep faces/product in upper-middle; CTA band reads at the bottom." },
  "16:9": { label: "Horizontal (in-stream/desktop/YouTube)", durationSeconds: 30, clipCount: 5, guidance: "Cinematic widescreen. Wider establishing shots, more room for environment and motion. Earn the first 5s before skip; lead with the strongest promise." },
};

const VALID_ENGINES = ["wan", "kling", "seedance", "veo", "runway", "sora"];
const ALL_ASPECTS: Aspect[] = ["9:16", "1:1", "4:5", "16:9"];
const MAX_VARIANTS = 12;

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? Math.floor(v) : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body: VariantsRequest = await req.json();
    const base = body.baseConcept ?? {};

    // ═══ ORG MEMBERSHIP GATE ═══
    // If an organizationId is supplied (used below for brand-kit injection), the
    // caller MUST be a member of that workspace. Without this, a request could pass
    // an arbitrary organizationId and pull a workspace it does not belong to — the
    // anon/RLS path alone fails open (org=null → generation proceeds regardless).
    // End-user JWTs are verified against organization_members; internal
    // service-role calls (auth.userId === null) are trusted.
    const orgId = typeof body.organizationId === "string" && body.organizationId
      ? body.organizationId
      : null;
    if (orgId && !auth.isServiceRole) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: membership, error: membershipErr } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (membershipErr) return errorResponse("Couldn't verify workspace membership. Please retry.", 500);
      if (!membership) return errorResponse("You are not a member of this workspace.", 403);
    }

    // ═══ CONTENT SAFETY ═══
    const safety = checkMultipleContent([
      body.productName,
      body.productDescription,
      base.angle,
      base.script,
      base.headline,
      base.primaryText,
      ...(base.hooks ?? []),
    ]);
    if (!safety.isSafe) {
      console.error(`[generate-ad-variants] ⛔ CONTENT BLOCKED — ${safety.category}: ${safety.matchedTerms.slice(0, 3).join(", ")}`);
      return errorResponse(safety.message, 400);
    }

    // ═══ VALIDATION ═══
    const nameV = validateInput(body.productName, { maxLength: 200, minLength: 2, fieldName: "productName", required: true });
    if (!nameV.valid) return errorResponse(nameV.errors.join(", "), 400);
    const scriptV = validateInput(base.script, { maxLength: 8000, minLength: 10, fieldName: "baseConcept.script", required: true });
    if (!scriptV.valid) return errorResponse("A base concept script is required to generate variants.", 400);

    const productName = nameV.sanitized;
    const productDescription = validateInput(body.productDescription, { maxLength: 4000, fieldName: "productDescription" }).sanitized;
    const baseScript = scriptV.sanitized;
    const angle = validateInput(base.angle, { maxLength: 200, fieldName: "angle" }).sanitized || "the concept";
    const baseCta = validateInput(base.cta, { maxLength: 60, fieldName: "cta" }).sanitized || "Learn more";
    const baseHeadline = validateInput(base.headline, { maxLength: 160, fieldName: "headline" }).sanitized;
    const basePrimary = validateInput(base.primaryText, { maxLength: 800, fieldName: "primaryText" }).sanitized;
    const baseHooks = Array.isArray(base.hooks) ? base.hooks.map((h) => String(h)).filter((h) => h.trim().length > 0).slice(0, 5) : [];

    // Enum-constrain objective/platform — they flow into the prompt, so free-form
    // text here would be a content-safety / prompt-injection bypass.
    const OBJECTIVES = ["awareness", "conversions", "traffic", "engagement", "app_installs"];
    const PLATFORMS_LIST = ["tiktok", "reels", "youtube_shorts", "youtube", "meta_feed", "linkedin"];
    const objective = OBJECTIVES.includes(String(body.objective)) ? String(body.objective) : "";
    const platform = PLATFORMS_LIST.includes(String(body.platform)) ? String(body.platform) : "";

    const formats: Aspect[] = (Array.isArray(body.formats) ? body.formats : []).filter((f): f is Aspect => ALL_ASPECTS.includes(f as Aspect));
    const selectedFormats = formats.length > 0 ? Array.from(new Set(formats)) : (["9:16", "1:1"] as Aspect[]);
    let hookVariants = clampInt(body.hookVariants, 1, 4, 2);

    // Bound the combinatorial blowup to MAX_VARIANTS.
    while (selectedFormats.length * hookVariants > MAX_VARIANTS && hookVariants > 1) hookVariants--;
    const trimmedFormats = selectedFormats.slice(0, Math.max(1, Math.floor(MAX_VARIANTS / hookVariants)));
    const totalVariants = trimmedFormats.length * hookVariants;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // ═══ BRAND KIT INJECTION ═══
    let brandKitGuidance = "";
    try {
      if (orgId) {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
        const sb = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
        );
        const { data: org } = await sb
          .from("organizations")
          .select("name, brand_voice, brand_colors, brand_primary_color, brand_accent_color, primary_use_case")
          .eq("id", orgId)
          .maybeSingle();
        if (org) {
          const palette = (org.brand_colors && org.brand_colors.length > 0
            ? org.brand_colors
            : [org.brand_primary_color, org.brand_accent_color].filter(Boolean)
          ).slice(0, 5).join(", ");
          const lines: string[] = [`\n═══ BRAND KIT — ${org.name} ═══`];
          if (org.brand_voice) lines.push(`Brand voice: ${org.brand_voice} — every hook and line of copy stays in this register.`);
          if (palette) lines.push(`Brand palette: ${palette}. Reference in visual direction where natural.`);
          if (org.primary_use_case) lines.push(`Workspace context: ${org.primary_use_case}.`);
          brandKitGuidance = lines.join("\n");
        }
      }
    } catch (e) {
      console.warn("[generate-ad-variants] brand kit fetch failed (non-fatal):", e);
    }

    const formatBlock = trimmedFormats
      .map((f) => `- ${f} — ${FORMAT_SPECS[f].label}. ${FORMAT_SPECS[f].guidance} (~${FORMAT_SPECS[f].durationSeconds}s, ~${FORMAT_SPECS[f].clipCount} shots)`)
      .join("\n");

    const systemPrompt = `You are a performance creative director running a variant test. You take ONE winning ad concept and produce a MATRIX of variants to A/B test — different opening hooks, each genuinely RE-FRAMED for its target aspect ratio (not the same footage cropped).

You will produce EXACTLY ${totalVariants} variants: ${hookVariants} distinct hook${hookVariants > 1 ? "s" : ""} × each of these ${trimmedFormats.length} format${trimmedFormats.length > 1 ? "s" : ""}:
${formatBlock}
${brandKitGuidance}

Rules:
- The ${hookVariants} hooks must be GENUINELY DIFFERENT opening angles (different first lines / first visual) — not reworded twins. Reuse strong hooks from the base concept where they fit, and invent new ones to reach ${hookVariants}.
- For EACH format, re-frame the script for that format's composition and safe zones (per the guidance above) and tune pacing/length to the format's duration — same story, format-native execution.
- Every variant opens on its assigned hook (Shot 1).
- script format per variant: "[SHOT n] <filmable visual with motion + on-screen action> | VO/ON-SCREEN: <line or caption>".
- Keep copy on-brand and consistent with the concept; you may tailor headline/CTA emphasis per hook.
- recommendedEngine: one of ${VALID_ENGINES.map((e) => `"${e}"`).join(", ")}.
- Output STRICT JSON only. No markdown, no commentary.`;

    const userPrompt = `PRODUCT / BRAND: ${productName}
${productDescription ? `BRIEF: ${productDescription}` : ""}
${objective ? `OBJECTIVE: ${objective}` : ""}
${platform ? `PRIMARY PLATFORM: ${platform}` : ""}

WINNING CONCEPT TO VARY:
Angle: ${angle}
${baseHeadline ? `Headline: ${baseHeadline}` : ""}
${basePrimary ? `Primary text: ${basePrimary}` : ""}
CTA: ${baseCta}
${baseHooks.length ? `Existing hooks:\n${baseHooks.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}` : ""}
Base script:
"""
${baseScript}
"""

Return JSON with this exact shape:
{
  "variants": [
    {
      "label": string,                 // e.g. "Hook 1 · 9:16"
      "aspectRatio": ${trimmedFormats.map((f) => `"${f}"`).join(" | ")},
      "hook": string,
      "headline": string,
      "primaryText": string,
      "cta": string,
      "script": string,
      "framingNotes": string,          // composition/safe-zone notes for this format
      "durationSeconds": number,
      "clipCount": number,
      "recommendedEngine": ${VALID_ENGINES.map((e) => `"${e}"`).join(" | ")}
    }
  ]
}
Produce all ${totalVariants} variants (every hook × every format) now.`;

    // ═══ AI CREDIT GATE (pre-flight) ═══
    // Org-scoped: charge the org pool when organizationId is present, else personal.
    const gateOrgId = body.organizationId && typeof body.organizationId === "string" ? body.organizationId : undefined;
    const { createClient: createGateClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const gateSupabase = createGateClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const gateCtx = {
      supabase: gateSupabase,
      fnName: "generate-ad-variants",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      orgId: gateOrgId,
      cost: 2,
      dailyCap: 100,
      corsHeaders,
    };
    const gateBlocked = await preflightAiGate(gateCtx);
    if (gateBlocked) return gateBlocked;

    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: calculateMaxTokens(totalVariants, 900, 2500, 14000),
        }),
      },
      { maxRetries: 3, baseDelayMs: 1000 },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-ad-variants] OpenAI error:", response.status, errorText);
      if (response.status === 429) return errorResponse("Rate limit exceeded. Please try again shortly.", 429);
      if (response.status === 401) return errorResponse("Invalid OpenAI API key.", 401);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return errorResponse("Variant generation returned no content. Please try again.", 500);

    const parsed = parseJsonWithRecovery<{ variants?: AdVariant[] }>(raw);
    if (!parsed.success || !parsed.data?.variants || !Array.isArray(parsed.data.variants) || parsed.data.variants.length === 0) {
      console.error("[generate-ad-variants] JSON parse/shape failure:", parsed.error);
      return errorResponse("Couldn't parse the generated variants. Please try again.", 502);
    }

    // ═══ NORMALIZE ═══
    const variants: AdVariant[] = parsed.data.variants
      .filter((v): v is AdVariant => v != null && typeof v === "object")
      .slice(0, totalVariants).map((v, i) => {
      // Coerce to a REQUESTED format, not just any valid aspect, so the matrix
      // matches what was asked for.
      const aspect = trimmedFormats.includes(String(v.aspectRatio) as Aspect) ? String(v.aspectRatio) : trimmedFormats[i % trimmedFormats.length];
      const fspec = FORMAT_SPECS[aspect as Aspect];
      const engine = VALID_ENGINES.includes(String(v.recommendedEngine)) ? String(v.recommendedEngine) : "kling";
      return {
        label: String(v.label || `Variant ${i + 1}`).trim(),
        aspectRatio: aspect,
        hook: String(v.hook || "").trim(),
        headline: String(v.headline || baseHeadline).trim(),
        primaryText: String(v.primaryText || basePrimary).trim(),
        cta: String(v.cta || baseCta).trim(),
        script: String(v.script || "").trim(),
        framingNotes: String(v.framingNotes || "").trim(),
        durationSeconds: Number.isFinite(v.durationSeconds) && v.durationSeconds > 0 ? Math.floor(v.durationSeconds) : fspec.durationSeconds,
        clipCount: Number.isFinite(v.clipCount) && v.clipCount > 0 ? Math.min(Math.floor(v.clipCount), 12) : fspec.clipCount,
        recommendedEngine: engine,
      };
    });

    const generationTimeMs = Date.now() - startTime;
    console.log(`[generate-ad-variants] Success in ${generationTimeMs}ms — ${variants.length} variant(s), formats=${trimmedFormats.join("/")}, hooks=${hookVariants}`);

    // ═══ AI CREDIT GATE (charge once, on success) ═══
    await chargeAiGate(gateCtx);

    return successResponse({
      variants,
      meta: {
        productName,
        angle,
        formats: trimmedFormats,
        hookVariants,
        requestedTotal: totalVariants,
      },
      model: "gpt-4o-mini",
      usage: data.usage,
      generationTimeMs,
    });
  } catch (error) {
    console.error("[generate-ad-variants] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
