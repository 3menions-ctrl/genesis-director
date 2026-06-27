// ─────────────────────────────────────────────────────────────────────────
// costModel.ts — the single, comprehensive COGS model behind the admin
// Pricing/Economics tab. Every provider API cost + every DB/infra cost is a
// named, editable line. Credit prices and margins DERIVE from this, so changing
// any cost auto-updates the recommended prices.
//
// Defaults are current best-estimate provider list prices (Jun 2026). They are
// editable + persisted (pricing_cost_model table) — treat them as a starting
// point, not gospel; refine against real invoices.
// ─────────────────────────────────────────────────────────────────────────

export type CostGroup = "Generation" | "Add-ons" | "Infra / Database" | "Fees & policy";
export type CostUnit = "$/clip" | "$/sec" | "$/image" | "$/1k chars" | "$/track"
  | "$/call" | "$/render" | "$/GB·mo" | "$/GB" | "$/M" | "$/mo" | "%" | "$" | "GB" | "x" | "ratio";

export interface CostLine {
  key: string;
  label: string;
  group: CostGroup;
  unit: CostUnit;
  value: number;
  /** Analyst note: provider, how it scales, risk. */
  note: string;
}

// Per-engine provider compute $ per clip, by duration (mirrors engines.ts).
export type ClipCostTable = Record<string, Record<number, number>>;

export const DEFAULT_CLIP_COST_USD: ClipCostTable = {
  "wan-25":      { 5: 0.15,  10: 0.30 },
  "kling-v3":    { 5: 1.385, 10: 2.692, 15: 4.077 },
  "seedance-2":  { 5: 2.692, 10: 5.385, 12: 6.538 },
  "veo-3":       { 4: 1.923, 6: 2.923,  8: 3.846 },
  "runway-gen4": { 5: 1.538, 10: 3.0 },
  "sora-2":      { 4: 2.385, 8: 4.846,  12: 7.231 },
};

export const ENGINE_LABEL: Record<string, string> = {
  "wan-25": "Wan 2.5", "kling-v3": "Kling V3", "seedance-2": "Seedance 2.0",
  "veo-3": "Veo 3", "runway-gen4": "Runway Gen-4", "sora-2": "Sora 2",
};
export const ENGINE_PROVIDER_NOTE: Record<string, string> = {
  "wan-25": "Replicate wan-video/wan-2.5-t2v · ~$0.03/s. Free-tier engine.",
  "kling-v3": "Replicate kwaivgi/kling-v3-video · per-clip pro mode 1080p.",
  "seedance-2": "Replicate bytedance/seedance-2.0 · hyperreal, 2–12s.",
  "veo-3": "Replicate google/veo-3-fast · native audio, 4–8s.",
  "runway-gen4": "Replicate runwayml/gen4-turbo · char consistency, 5/10s.",
  "sora-2": "Replicate openai/sora-2 · SOTA realism, long renders.",
};

// All non-clip cost lines. Defaults = current provider list prices.
export const DEFAULT_COST_LINES: CostLine[] = [
  // ── Add-ons (per film, folded into clip price) ──────────────────────────
  { key: "imageFlux", label: "Scene image (Flux 1.1 Pro Ultra)", group: "Add-ons", unit: "$/image", value: 0.06,
    note: "Replicate black-forest-labs/flux-1.1-pro-ultra. ~1 per scene/clip. Pro (non-ultra) ≈ $0.04." },
  { key: "ttsPer1k", label: "Narration TTS (ElevenLabs)", group: "Add-ons", unit: "$/1k chars", value: 0.18,
    note: "ElevenLabs Creator ≈ $0.18–0.30 / 1k chars. A 30–60s narration ≈ 300–700 chars." },
  { key: "musicTrack", label: "Music (musicgen / ElevenLabs)", group: "Add-ons", unit: "$/track", value: 0.10,
    note: "Replicate musicgen ≈ $0.02–0.10; ElevenLabs Music pricier. One bed per film." },
  { key: "sfxClip", label: "SFX (ElevenLabs)", group: "Add-ons", unit: "$/clip", value: 0.02,
    note: "Optional per-clip sound effect. Off by default on most films." },
  { key: "llmScript", label: "Script gen (GPT-4o class)", group: "Add-ons", unit: "$/call", value: 0.12,
    note: "One script/story generation per project. Tokens scale with prompt+shots." },
  { key: "llmScenePlan", label: "Scene plan + continuity (LLM)", group: "Add-ons", unit: "$/call", value: 0.10,
    note: "Per project: shot list, character bible, continuity." },
  { key: "llmQualityAudit", label: "Quality/vision audit (LLM)", group: "Add-ons", unit: "$/clip", value: 0.04,
    note: "Per-clip vision QA + corrective prompts. Scales with clip count." },
  { key: "stitch", label: "Stitch (ffmpeg cog)", group: "Add-ons", unit: "$/render", value: 0.02,
    note: "Replicate magpai-app/cog-ffmpeg final assembly. Once per render." },
  { key: "thumbnail", label: "Thumbnail (Flux)", group: "Add-ons", unit: "$/render", value: 0.04,
    note: "One project thumbnail per film." },
  { key: "frameExtract", label: "Frame extraction", group: "Add-ons", unit: "$/clip", value: 0.005,
    note: "Last-frame extraction for continuity chaining (lucataco/frame-extractor)." },

  // ── Infra / Database (amortized per film) ───────────────────────────────
  { key: "storagePerGbMo", label: "Storage", group: "Infra / Database", unit: "$/GB·mo", value: 0.021,
    note: "Supabase storage ≈ $0.021/GB-mo. Clips + final + intermediates." },
  { key: "egressPerGb", label: "Egress / bandwidth", group: "Infra / Database", unit: "$/GB", value: 0.09,
    note: "Supabase egress ≈ $0.09/GB. The real silent killer — every view re-streams the film." },
  { key: "edgePerM", label: "Edge function invocations", group: "Infra / Database", unit: "$/M", value: 2.0,
    note: "≈ $2 / million invocations. A film fires dozens (pipeline + status polls + webhooks)." },
  { key: "dbComputeMo", label: "DB + base platform", group: "Infra / Database", unit: "$/mo", value: 35,
    note: "Supabase Pro ($25) + compute add-on + realtime. Fixed monthly; amortize across films." },
  { key: "avgFilmStorageGb", label: "Avg storage per film", group: "Infra / Database", unit: "GB", value: 0.08,
    note: "~6 clips + final + intermediates. Retained ~3 months on average." },
  { key: "storageMonths", label: "Avg months retained", group: "Infra / Database", unit: "x", value: 3,
    note: "How long a film's media sits in storage on average." },
  { key: "avgFilmEgressGb", label: "Avg egress per film", group: "Infra / Database", unit: "GB", value: 0.15,
    note: "Final film size × avg views (creator + a few shares). Grows with virality." },
  { key: "edgeCallsPerFilm", label: "Edge calls per film", group: "Infra / Database", unit: "x", value: 60,
    note: "Pipeline stages + status polling + webhooks per generated film." },
  { key: "filmsPerMonth", label: "Films / month (amortization base)", group: "Infra / Database", unit: "x", value: 1500,
    note: "Used to amortize the fixed monthly DB/platform cost across films." },

  // ── Fees & policy ───────────────────────────────────────────────────────
  { key: "paymentFeePct", label: "Payment fee", group: "Fees & policy", unit: "%", value: 0.039,
    note: "Polar/Stripe ≈ 2.9% + ~1% intl/FX. Applied to credit purchase revenue." },
  { key: "paymentFeeFixed", label: "Payment fee (fixed)", group: "Fees & policy", unit: "$", value: 0.30,
    note: "Per-transaction fixed fee, amortized over the pack size." },
  { key: "creditValueFloor", label: "Credit value — floor (biggest pack)", group: "Fees & policy", unit: "$", value: 0.078,
    note: "$/credit on agency+. Margin is GUARANTEED against this worst case." },
  { key: "creditValueList", label: "Credit value — list (small pack)", group: "Fees & policy", unit: "$", value: 0.10,
    note: "$/credit on mini/starter. Best-case revenue per credit." },
  { key: "targetGrossMargin", label: "Target gross margin", group: "Fees & policy", unit: "ratio", value: 0.30,
    note: "Pricing policy: credits = ceil(COGS / (floor × (1 − this)))." },
];

export interface CostModel {
  clipCost: ClipCostTable;
  lines: Record<string, number>; // key → value
}

export function defaultCostModel(): CostModel {
  return {
    clipCost: structuredClone(DEFAULT_CLIP_COST_USD),
    lines: Object.fromEntries(DEFAULT_COST_LINES.map((l) => [l.key, l.value])),
  };
}

// ── Derivation ────────────────────────────────────────────────────────────
const v = (m: CostModel, k: string) => m.lines[k] ?? 0;

/** Per-clip share of the bundled add-on COGS (image + LLM + audio + stitch/thumb). */
export function bundledAddonPerClip(m: CostModel, clipsPerFilm = 5, narration = true, music = true): number {
  const perClip =
    v(m, "imageFlux") +                       // 1 scene image / clip
    v(m, "llmQualityAudit") +                 // vision QA / clip
    v(m, "frameExtract") +                    // continuity / clip
    (narration ? v(m, "ttsPer1k") * 0.4 / clipsPerFilm : 0) + // ~400 chars/film narration
    (music ? v(m, "musicTrack") / clipsPerFilm : 0) +
    (v(m, "llmScript") + v(m, "llmScenePlan") + v(m, "stitch") + v(m, "thumbnail")) / clipsPerFilm;
  return perClip;
}

/** Per-clip share of infra/DB COGS (storage + egress + edge + amortized fixed). */
export function infraPerClip(m: CostModel, clipsPerFilm = 5): number {
  const storage = v(m, "avgFilmStorageGb") * v(m, "storagePerGbMo") * v(m, "storageMonths");
  const egress = v(m, "avgFilmEgressGb") * v(m, "egressPerGb");
  const edge = (v(m, "edgeCallsPerFilm") / 1_000_000) * v(m, "edgePerM");
  const fixed = v(m, "filmsPerMonth") > 0 ? v(m, "dbComputeMo") / v(m, "filmsPerMonth") : 0;
  return (storage + egress + edge + fixed) / clipsPerFilm;
}

export interface ClipEconomics {
  engine: string; duration: number;
  clipCost: number; addon: number; infra: number; cogs: number;
  credits: number; revFloor: number; revList: number;
  grossMargin: number;   // at floor (the guaranteed worst case)
  netMargin: number;     // after payment fee + infra, at floor
}

export function clipEconomics(m: CostModel, engine: string, duration: number, clipsPerFilm = 5): ClipEconomics {
  const clipCost = m.clipCost[engine]?.[duration] ?? 0;
  const addon = bundledAddonPerClip(m, clipsPerFilm);
  const infra = infraPerClip(m, clipsPerFilm);
  // Credit price is set on compute + add-ons (the catalog rule); infra eats into net.
  const priceCogs = clipCost + addon;
  const floor = v(m, "creditValueFloor"), list = v(m, "creditValueList"), margin = v(m, "targetGrossMargin");
  const credits = Math.ceil(priceCogs / (floor * (1 - margin)));
  const revFloor = credits * floor, revList = credits * list;
  const cogs = clipCost + addon + infra;
  const grossMargin = revFloor > 0 ? (revFloor - (clipCost + addon)) / revFloor : 0;
  const fee = revFloor * v(m, "paymentFeePct");
  const netMargin = revFloor > 0 ? (revFloor - cogs - fee) / revFloor : 0;
  return { engine, duration, clipCost, addon, infra, cogs, credits, revFloor, revList, grossMargin, netMargin };
}
