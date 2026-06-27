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
 * generate-ad-studio — the Generative Ad Studio backend.
 *
 * Turns a product brief into a complete, on-brand advertising creative package:
 * several distinct ad CONCEPTS, each with a strategic angle, scroll-stopping
 * hook variations, a shot-by-shot video script ready to hand to the generation
 * pipeline, plus platform-ready headline / primary text / CTA copy.
 *
 * Mirrors generate-script's conventions: shared script-utils, auth guard,
 * content-safety gate, organization brand-kit injection, OpenAI via
 * fetchWithRetry. Output is strict JSON, recovered with parseJsonWithRecovery.
 */

type Objective = "awareness" | "conversions" | "traffic" | "engagement" | "app_installs";
type Platform = "tiktok" | "reels" | "youtube_shorts" | "youtube" | "meta_feed" | "linkedin";

interface AdStudioRequest {
  organizationId?: string;
  productName?: string;
  productDescription?: string;
  objective?: Objective;
  platform?: Platform;
  audience?: string;
  conceptCount?: number;
  /** Optional explicit tone; otherwise the org brand voice is used. */
  toneOverride?: string;
}

interface AdConcept {
  angle: string;
  rationale: string;
  hooks: string[];
  script: string;
  headline: string;
  primaryText: string;
  cta: string;
  aspectRatio: string;
  durationSeconds: number;
  clipCount: number;
  recommendedEngine: string;
}

// Platform → format defaults + creative guidance. Keeps generated concepts
// native to where they'll actually run.
const PLATFORM_SPECS: Record<Platform, {
  label: string; aspectRatio: string; durationSeconds: number; clipCount: number; guidance: string;
}> = {
  tiktok:         { label: "TikTok", aspectRatio: "9:16", durationSeconds: 20, clipCount: 4, guidance: "Native, hand-held energy. Hook in the first 1.5s or they scroll. Trend-aware, fast cuts, sound-on, creator-style not corporate." },
  reels:          { label: "Instagram Reels", aspectRatio: "9:16", durationSeconds: 20, clipCount: 4, guidance: "Aesthetic but punchy. Strong visual hook, captions for sound-off viewing, satisfying payoff in under 20s." },
  youtube_shorts: { label: "YouTube Shorts", aspectRatio: "9:16", durationSeconds: 25, clipCount: 5, guidance: "Curiosity-gap hook, vertical, retain attention with momentum and a clear single idea." },
  youtube:        { label: "YouTube (in-stream)", aspectRatio: "16:9", durationSeconds: 30, clipCount: 5, guidance: "Earn the first 5s before skip. Lead with the most compelling promise, then deliver. Cinematic is rewarded." },
  meta_feed:      { label: "Meta Feed (FB/IG)", aspectRatio: "1:1", durationSeconds: 15, clipCount: 3, guidance: "Thumb-stopping first frame, works sound-off, square-safe framing, clear product moment and CTA." },
  linkedin:       { label: "LinkedIn", aspectRatio: "16:9", durationSeconds: 30, clipCount: 5, guidance: "Credible, outcome-led, professional. Lead with the business result; restrained, confident tone." },
};

const OBJECTIVE_GUIDANCE: Record<Objective, string> = {
  awareness:   "Maximize memorability and brand association. Bold, distinctive, emotionally resonant — the brand should be unmistakable even at a glance.",
  conversions: "Drive immediate action. Sharp problem→solution framing, a concrete offer, urgency, and an unambiguous CTA.",
  traffic:     "Earn the click. Tease value that lives on the other side of the click; create a curiosity gap the landing page resolves.",
  engagement:  "Provoke a reaction — comments, shares, saves. Take a stance, ask a question, or show something share-worthy.",
  app_installs:"Show the app in action solving a real moment. Demonstrate the core value fast, then a frictionless install CTA.",
};

const VALID_ENGINES = ["wan", "kling", "seedance", "veo", "runway", "sora"];

function clampConceptCount(n: unknown): number {
  const v = typeof n === "number" ? Math.floor(n) : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, v));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse, forbiddenResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body: AdStudioRequest = await req.json();

    // ═══ AUTHORIZATION GATE ═══
    // Route guards (RequireAccountType / org-scoped UI) do NOT protect this
    // function from direct invocation. Enforce the same rules server-side for
    // end-user JWTs. Service-role (internal function-to-function) calls bypass.
    if (!auth.isServiceRole && auth.userId) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } },
      );

      // (1) Business-tier account required — Ad Studio is a business feature.
      const { data: profile } = await admin
        .from("profiles")
        .select("account_type")
        .eq("id", auth.userId)
        .maybeSingle();
      const accountType = profile?.account_type;
      if (accountType !== "business" && accountType !== "enterprise" && accountType !== "admin") {
        return forbiddenResponse(corsHeaders, "A business account is required to use Ad Studio.");
      }

      // (2) Organization membership required when an org is targeted. Never rely
      // on RLS alone to silently drop the brand kit while still generating.
      if (body.organizationId && typeof body.organizationId === "string") {
        const { data: membership, error: membershipErr } = await admin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", body.organizationId)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (membershipErr) {
          return errorResponse("Couldn't verify workspace membership. Please retry.", 500);
        }
        if (!membership) {
          return forbiddenResponse(corsHeaders, "You are not a member of this organization.");
        }
      }
    }

    // ═══ CONTENT SAFETY ═══
    const safety = checkMultipleContent([
      body.productName,
      body.productDescription,
      body.audience,
      body.toneOverride,
    ]);
    if (!safety.isSafe) {
      console.error(`[generate-ad-studio] ⛔ CONTENT BLOCKED — ${safety.category}: ${safety.matchedTerms.slice(0, 3).join(", ")}`);
      return errorResponse(safety.message, 400);
    }

    // ═══ VALIDATION ═══
    const nameV = validateInput(body.productName, { maxLength: 200, minLength: 2, fieldName: "productName", required: true });
    if (!nameV.valid) return errorResponse(nameV.errors.join(", "), 400);
    const descV = validateInput(body.productDescription, { maxLength: 4000, minLength: 10, fieldName: "productDescription", required: true });
    if (!descV.valid) return errorResponse(descV.errors.join(", "), 400);
    const audienceV = validateInput(body.audience, { maxLength: 600, fieldName: "audience" });
    const toneV = validateInput(body.toneOverride, { maxLength: 200, fieldName: "toneOverride" });

    const productName = nameV.sanitized;
    const productDescription = descV.sanitized;
    const audience = audienceV.sanitized || "a broad consumer audience";
    const objective: Objective = (body.objective && OBJECTIVE_GUIDANCE[body.objective]) ? body.objective : "conversions";
    const platform: Platform = (body.platform && PLATFORM_SPECS[body.platform]) ? body.platform : "reels";
    const conceptCount = clampConceptCount(body.conceptCount);
    const spec = PLATFORM_SPECS[platform];

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // ═══ BRAND KIT INJECTION (mirrors generate-script) ═══
    let brandVoice = toneV.sanitized || "";
    let brandKitGuidance = "";
    try {
      const orgId = body.organizationId;
      if (orgId && typeof orgId === "string") {
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
          if (!brandVoice && org.brand_voice) brandVoice = org.brand_voice;
          const palette = (org.brand_colors && org.brand_colors.length > 0
            ? org.brand_colors
            : [org.brand_primary_color, org.brand_accent_color].filter(Boolean)
          ).slice(0, 5).join(", ");
          const lines: string[] = [];
          lines.push(`\n═══ BRAND KIT — ${org.name} ═══`);
          if (brandVoice)           lines.push(`Brand voice: ${brandVoice} — every hook, headline and line of copy must read in this register.`);
          if (palette)              lines.push(`Brand palette: ${palette}. Reference these colors in the visual direction (lighting, wardrobe, set, product staging) where natural.`);
          if (org.primary_use_case) lines.push(`Workspace context: ${org.primary_use_case}.`);
          lines.push(`This is a branded ad for this workspace — stay unmistakably on-brand.`);
          brandKitGuidance = lines.join("\n");
        }
      }
    } catch (e) {
      console.warn("[generate-ad-studio] brand kit fetch failed (non-fatal):", e);
    }

    // ═══ PROMPT ═══
    const systemPrompt = `You are an award-winning creative director and direct-response copywriter who has shipped scroll-stopping ads for the world's best brands. You think in HOOKS, ANGLES, and PAYOFFS — and you write video that performs, not video that wins awards nobody watches.

You will produce EXACTLY ${conceptCount} distinct ad concept${conceptCount > 1 ? "s" : ""}. Each concept must attack the brief from a GENUINELY DIFFERENT strategic angle (e.g. problem/agitation, transformation/before-after, social proof, founder/origin, bold contrarian claim, demonstration, day-in-the-life). Never repeat an angle.

CAMPAIGN OBJECTIVE — ${objective.toUpperCase()}: ${OBJECTIVE_GUIDANCE[objective]}
PLATFORM — ${spec.label}: ${spec.guidance}
Default format for this platform: ${spec.aspectRatio}, ~${spec.durationSeconds}s across ~${spec.clipCount} shots.
${brandKitGuidance}

For EACH concept, deliver:
- angle: a short name for the strategic angle (3–6 words).
- rationale: 1–2 sentences on why this angle wins for THIS objective and audience.
- hooks: an array of EXACTLY 3 alternative opening hooks (the first ~1.5 seconds / first line). Each must be able to stop the scroll on its own. Distinct from each other.
- script: a shot-by-shot video script in the format "[SHOT 1] <vivid, filmable visual description with motion and on-screen action> | VO/ON-SCREEN: <spoken line or caption>". Provide ${spec.clipCount} shots. Describe what the CAMERA SEES — concrete, shootable, with texture and motion — not abstract marketing language. Shot 1 must open on the strongest hook.
- headline: the platform headline (≤ 8 words, punchy).
- primaryText: the ad's primary body copy (1–3 sentences, ready to paste into the ad platform).
- cta: a specific call-to-action button label (2–4 words, e.g. "Shop the drop", "Start free trial").
- aspectRatio: one of "9:16", "1:1", "16:9" — match the platform unless a concept truly calls for another.
- durationSeconds: integer total duration.
- clipCount: integer number of shots in the script.
- recommendedEngine: one of ${VALID_ENGINES.map((e) => `"${e}"`).join(", ")} — pick the engine that best fits the concept's fidelity/realism needs.

Hard rules:
- Stay on-brand and on-objective in EVERY field.
- Hooks and copy must be specific to "${productName}" — never generic filler.
- Output STRICT JSON only. No markdown, no commentary.`;

    const userPrompt = `PRODUCT / BRAND: ${productName}
BRIEF: ${productDescription}
TARGET AUDIENCE: ${audience}
OBJECTIVE: ${objective}
PLATFORM: ${spec.label}
NUMBER OF CONCEPTS: ${conceptCount}

Return JSON with this exact shape:
{
  "concepts": [
    {
      "angle": string,
      "rationale": string,
      "hooks": [string, string, string],
      "script": string,
      "headline": string,
      "primaryText": string,
      "cta": string,
      "aspectRatio": "9:16" | "1:1" | "16:9",
      "durationSeconds": number,
      "clipCount": number,
      "recommendedEngine": ${VALID_ENGINES.map((e) => `"${e}"`).join(" | ")}
    }
  ]
}
Generate ${conceptCount} concept${conceptCount > 1 ? "s" : ""} now.`;

    // ═══ CREDIT + RATE-LIMIT GATE ═══
    // Org-scoped when organizationId is present (charges the org pool); otherwise
    // personal. Service-role/internal callers are exempt (handled by the helper).
    const orgId = (body.organizationId && typeof body.organizationId === "string") ? body.organizationId : undefined;
    const { createClient: createGateClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const gateClient = createGateClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const gateCtx = {
      supabase: gateClient,
      fnName: "generate-ad-studio",
      userId: auth.userId,
      isServiceRole: auth.isServiceRole,
      orgId,
      cost: 3,
      dailyCap: 60,
      corsHeaders,
    };
    const gateBlocked = await preflightAiGate(gateCtx);
    if (gateBlocked) return gateBlocked;

    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: calculateMaxTokens(conceptCount, 900, 2000, 8000),
        }),
      },
      { maxRetries: 3, baseDelayMs: 1000 },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-ad-studio] OpenAI error:", response.status, errorText);
      if (response.status === 429) return errorResponse("Rate limit exceeded. Please try again shortly.", 429);
      if (response.status === 401) return errorResponse("Invalid OpenAI API key.", 401);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return errorResponse("Ad generation returned no content. Please try again.", 500);

    const parsed = parseJsonWithRecovery<{ concepts?: AdConcept[] }>(raw);
    if (!parsed.success || !parsed.data?.concepts || !Array.isArray(parsed.data.concepts) || parsed.data.concepts.length === 0) {
      console.error("[generate-ad-studio] JSON parse/shape failure:", parsed.error);
      return errorResponse("Couldn't parse the generated concepts. Please try again.", 502);
    }

    // ═══ NORMALIZE — defend against missing/oddly-typed fields ═══
    const concepts: AdConcept[] = parsed.data.concepts
      .filter((c): c is AdConcept => c != null && typeof c === "object")
      .slice(0, conceptCount).map((c, i) => {
      const hooks = Array.isArray(c.hooks)
        ? c.hooks.map((h) => String(h)).filter((h) => h.trim().length > 0).slice(0, 5)
        : [];
      const engine = VALID_ENGINES.includes(String(c.recommendedEngine)) ? String(c.recommendedEngine) : "kling";
      const aspect = ["9:16", "1:1", "16:9"].includes(String(c.aspectRatio)) ? String(c.aspectRatio) : spec.aspectRatio;
      const clipCount = Number.isFinite(c.clipCount) && c.clipCount > 0 ? Math.min(Math.floor(c.clipCount), 12) : spec.clipCount;
      const durationSeconds = Number.isFinite(c.durationSeconds) && c.durationSeconds > 0 ? Math.floor(c.durationSeconds) : spec.durationSeconds;
      return {
        angle: String(c.angle || `Concept ${i + 1}`).trim(),
        rationale: String(c.rationale || "").trim(),
        hooks: hooks.length ? hooks : ["(hook unavailable — regenerate)"],
        script: String(c.script || "").trim(),
        headline: String(c.headline || "").trim(),
        primaryText: String(c.primaryText || "").trim(),
        cta: String(c.cta || "Learn more").trim(),
        aspectRatio: aspect,
        durationSeconds,
        clipCount,
        recommendedEngine: engine,
      };
    });

    const generationTimeMs = Date.now() - startTime;
    console.log(`[generate-ad-studio] Success in ${generationTimeMs}ms — ${concepts.length} concept(s), platform=${platform}, objective=${objective}`);

    // ═══ CHARGE ON SUCCESS — exactly once, after a usable result ═══
    await chargeAiGate(gateCtx);

    return successResponse({
      concepts,
      meta: {
        productName,
        objective,
        platform,
        platformLabel: spec.label,
        audience,
        brandVoice: brandVoice || null,
        conceptCount: concepts.length,
      },
      model: "gpt-4o-mini",
      usage: data.usage,
      generationTimeMs,
    });
  } catch (error) {
    console.error("[generate-ad-studio] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
