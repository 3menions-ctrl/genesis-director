/**
 * Engine Registry — single source of truth for video generation engines.
 * Frontend and backend (supabase/functions/_shared/engines.ts) MUST stay in sync.
 *
 * Pricing model: $0.10/credit (see CREDIT_SYSTEM).
 * Cinema engines = pass-through provider cost + ~30% margin, rounded.
 */

export type EngineId =
  | 'wan-25'
  | 'kling-v3'
  | 'seedance-2'
  | 'veo-3'
  | 'runway-gen4'
  | 'sora-2';

export type EngineTier = 'standard' | 'pro' | 'cinema';

export type EngineProvider = 'wan' | 'kling' | 'seedance' | 'veo3' | 'runway' | 'sora';

export type EntitlementId = 'studio_cinema';

export interface QualityOptions {
  upscale4k?: boolean;
  fps60?: boolean;
  autoRetake?: boolean;
}

export interface EngineSpec {
  id: EngineId;
  provider: EngineProvider;
  tier: EngineTier;
  label: string;
  shortLabel: string;
  description: string;
  durations: number[];
  maxDuration: number;
  supportsImageInput: boolean;
  supportsAudio: boolean;
  supportsAvatar: boolean;
  /** Approx generation wall-clock seconds at shortest duration, for ETA UX. */
  etaSeconds: number;
  /** Whether engine is currently reachable. Flip false to soft-disable in UI. */
  healthy: boolean;
  /** When set, user must hold this entitlement to render. */
  requiresEntitlement?: EntitlementId;
  /** Surcharge per clip for 4K upscale (Topaz Astra). */
  upscale4kCredits: number;
  /** Surcharge per clip for 60fps interpolation (RIFE). */
  fps60Credits: number;
  /** Base credit cost for `duration` seconds. Throws on unsupported duration. */
  baseCreditsFor(duration: number): number;
}

/** Cost helper that includes Quality Core surcharges. */
export function creditsFor(
  spec: EngineSpec,
  duration: number,
  opts: QualityOptions = {},
): number {
  let cost = spec.baseCreditsFor(duration);
  if (opts.upscale4k) cost += spec.upscale4kCredits;
  if (opts.fps60) cost += spec.fps60Credits;
  return cost;
}

// ── PRICING POLICY — single source of truth ──────────────────────────────
// Target: ≥30% GROSS margin on EVERY generation, guaranteed even at the
// cheapest credit value (the largest pack). A film's add-on COGS — scene image
// + script/scene LLM + narration + music + stitch/thumbnail — are folded into
// each clip's credit cost, because the pipeline produces them with the per-clip
// credit charge SKIPPED (so they'd otherwise be unpriced).
//   credits = ceil( fullClipCostUsd / (CREDIT_VALUE_FLOOR_USD × (1 − MARGIN)) )
// At the floor that yields exactly 30% gross; on smaller packs, more.
export const CREDIT_VALUE_FLOOR_USD = 0.078;   // $/credit on the largest (cheapest) pack — see creditPackages
export const TARGET_GROSS_MARGIN = 0.30;
export const BUNDLED_ADDON_COST_USD = 0.205;   // per-clip share of image + LLM + narration + music + stitch/thumbnail

// Provider compute $ per clip (our COGS). EDIT HERE to reprice — credits derive.
export const CLIP_COST_USD: Record<string, Record<number, number>> = {
  'wan-25':      { 5: 0.15,  10: 0.30 },
  'kling-v3':    { 5: 1.385, 10: 2.692, 15: 4.077 },
  'seedance-2':  { 5: 2.692, 10: 5.385, 12: 6.538 },
  'veo-3':       { 4: 1.923, 6: 2.923,  8: 3.846 },
  'runway-gen4': { 5: 1.538, 10: 3.0 },
  'sora-2':      { 4: 2.385, 8: 4.846,  12: 7.231 },
};

/** Credits needed to net ≥TARGET_GROSS_MARGIN on `costUsd` at the credit-value floor. */
export function creditsForCostUsd(costUsd: number): number {
  return Math.ceil(costUsd / (CREDIT_VALUE_FLOOR_USD * (1 - TARGET_GROSS_MARGIN)));
}

/** Full per-clip credit cost (compute + bundled add-ons) for an engine+duration. */
function clipCredits(engineId: string, duration: number): number {
  const cost = CLIP_COST_USD[engineId]?.[duration];
  if (cost == null) {
    throw new Error(
      `Unsupported duration ${duration}s (allowed: ${Object.keys(CLIP_COST_USD[engineId] ?? {}).join(', ')}s)`,
    );
  }
  return creditsForCostUsd(cost + BUNDLED_ADDON_COST_USD);
}

export const ENGINES: Record<EngineId, EngineSpec> = {
  // -------- FREE --------
  'wan-25': {
    id: 'wan-25',
    provider: 'wan',
    tier: 'standard',
    label: 'Wan 2.5 — Free',
    shortLabel: 'Wan 2.5',
    description: "Alibaba's Wan 2.5 — the free engine. Your first 5-second video is free; strong baseline quality.",
    durations: [5, 10],
    maxDuration: 10,
    supportsImageInput: true,
    supportsAudio: false,
    supportsAvatar: false,
    etaSeconds: 110,
    healthy: true,
    upscale4kCredits: 10,
    fps60Credits: 5,
    // Priced at Replicate compute (~$0.03/s) + storage + ops, marked up 30%.
    // FE/BE parity test in src/test/engines/fe-be-parity.test.ts pins this.
    baseCreditsFor: (d) => clipCredits('wan-25', d),
  },
  // -------- STANDARD --------
  'kling-v3': {
    id: 'kling-v3',
    provider: 'kling',
    tier: 'standard',
    label: 'Kling V3 — Standard',
    shortLabel: 'Kling V3',
    description:
      'Reliable cinematic output with native audio. Best baseline for most projects.',
    durations: [5, 10, 15],
    maxDuration: 15,
    supportsImageInput: true,
    supportsAudio: true,
    supportsAvatar: true,
    etaSeconds: 90,
    healthy: true,
    upscale4kCredits: 10,
    fps60Credits: 5,
    baseCreditsFor: (d) => clipCredits('kling-v3', d),
  },

  // -------- PRO --------
  'seedance-2': {
    id: 'seedance-2',
    provider: 'seedance',
    tier: 'pro',
    label: 'Seedance 2.0 — Pro',
    shortLabel: 'Seedance 2.0',
    description:
      'Sharper motion and higher prompt adherence. Capped at 12s per clip.',
    durations: [5, 10, 12],
    maxDuration: 12,
    supportsImageInput: true,
    supportsAudio: true,
    supportsAvatar: true,
    etaSeconds: 100,
    healthy: true,
    upscale4kCredits: 10,
    fps60Credits: 5,
    baseCreditsFor: (d) => clipCredits('seedance-2', d),
  },

  // -------- CINEMA --------
  'veo-3': {
    id: 'veo-3',
    provider: 'veo3',
    tier: 'cinema',
    label: 'Veo 3 Fast — Cinema',
    shortLabel: 'Veo 3',
    description:
      'Google Veo 3 Fast. Excellent physics and natural motion with native audio.',
    durations: [4, 6, 8],
    maxDuration: 8,
    supportsImageInput: true,
    supportsAudio: true,
    supportsAvatar: true,
    etaSeconds: 120,
    healthy: true,
    requiresEntitlement: 'studio_cinema',
    upscale4kCredits: 10,
    fps60Credits: 5,
    baseCreditsFor: (d) => clipCredits('veo-3', d),
  },

  'runway-gen4': {
    id: 'runway-gen4',
    provider: 'runway',
    tier: 'cinema',
    label: 'Runway Gen-4 Turbo — Cinema',
    shortLabel: 'Runway Gen-4',
    description:
      'Best-in-class character consistency and stylized control. Max 10s per clip.',
    durations: [5, 10],
    maxDuration: 10,
    supportsImageInput: true,
    supportsAudio: false,
    supportsAvatar: true,
    etaSeconds: 150,
    healthy: true,
    requiresEntitlement: 'studio_cinema',
    upscale4kCredits: 10,
    fps60Credits: 5,
    baseCreditsFor: (d) => clipCredits('runway-gen4', d),
  },

  'sora-2': {
    id: 'sora-2',
    provider: 'sora',
    tier: 'cinema',
    label: 'Sora 2 — Cinema',
    shortLabel: 'Sora 2',
    description:
      'OpenAI Sora 2. State-of-the-art realism and complex multi-shot scenes. Long render times.',
    durations: [4, 8, 12],
    maxDuration: 12,
    supportsImageInput: true,
    supportsAudio: true,
    supportsAvatar: true,
    etaSeconds: 360,
    healthy: true,
    requiresEntitlement: 'studio_cinema',
    upscale4kCredits: 10,
    fps60Credits: 5,
    baseCreditsFor: (d) => clipCredits('sora-2', d),
  },
};

// NO DEFAULT MODEL: engine selection is always explicit (user-picked or
// template-forced). There is intentionally no DEFAULT_ENGINE_ID export.

export function getEngine(id: EngineId): EngineSpec {
  const spec = ENGINES[id];
  if (!spec) throw new Error(`Unknown engine id: ${id}`);
  return spec;
}

export function isCinemaEngine(id: EngineId): boolean {
  return ENGINES[id]?.tier === 'cinema';
}

export function listEngines(opts: { healthyOnly?: boolean } = {}): EngineSpec[] {
  const all = Object.values(ENGINES);
  return opts.healthyOnly ? all.filter((e) => e.healthy) : all;
}

export function listEnginesByTier(tier: EngineTier): EngineSpec[] {
  return listEngines().filter((e) => e.tier === tier);
}

/** Tier display order for pickers. */
export const TIER_ORDER: EngineTier[] = ['standard', 'pro', 'cinema'];

export const TIER_LABEL: Record<EngineTier, string> = {
  standard: 'Standard',
  pro: 'Pro',
  cinema: 'Cinema',
};

/**
 * Translate the kebab frontend EngineId to the backend token expected by
 * `generate-single-clip` / `hollywood-pipeline`. All five engines have a
 * dedicated native branch — no silent fallbacks.
 */
export type BackendEngine = 'kling' | 'seedance' | 'veo' | 'runway' | 'sora';

export function engineToBackend(id: EngineId): BackendEngine {
  switch (id) {
    case 'seedance-2':  return 'seedance';
    case 'veo-3':       return 'veo';
    case 'runway-gen4': return 'runway';
    case 'sora-2':      return 'sora';
    case 'kling-v3':    return 'kling';
    default:
      throw new Error(`Unknown engine id: ${id} (no default model — engine must be explicit)`);
  }
}

/** Reverse of engineToBackend, plus the free-tier 'wan' token. Backend
 *  deduction paths speak the short token; map it back to a registry spec.
 *  Unknown tokens THROW — silently pricing an unknown engine as Kling was
 *  a hidden default-model path. */
export function backendToEngineId(token: string): EngineId {
  switch (token) {
    case 'wan':      return 'wan-25';
    case 'seedance': return 'seedance-2';
    case 'veo':      return 'veo-3';
    case 'runway':   return 'runway-gen4';
    case 'sora':     return 'sora-2';
    case 'kling':    return 'kling-v3';
    default:
      throw new Error(`Unknown backend engine token: "${token}" (no default model)`);
  }
}

/** Snap an arbitrary duration to the nearest provider-supported duration
 *  for this engine, so pricing always lands on a real table key AND matches
 *  the clip length the provider actually delivers (no charge≠deliver gap). */
export function snapDuration(spec: EngineSpec, duration: number): number {
  return spec.durations.reduce(
    (best, d) => (Math.abs(d - duration) < Math.abs(best - duration) ? d : best),
    spec.durations[0],
  );
}

/**
 * SINGLE SOURCE OF TRUTH for per-clip credit pricing. Both the backend
 * deduction (hollywood-pipeline, mode-router) and the FE quote resolve
 * through the registry, so quote == charge. Avatar mode (native-audio
 * lip-sync on Kling) carries a +50% premium reflecting the higher
 * Replicate audio compute cost.
 */
export function priceClipCredits(
  engineToken: string,
  duration: number,
  opts: { avatar?: boolean } & QualityOptions = {},
): number {
  const spec = getEngine(backendToEngineId(engineToken));
  const snapped = snapDuration(spec, duration);
  let cost = creditsFor(spec, snapped, opts);
  if (opts.avatar && spec.provider === 'kling') {
    cost = Math.round(cost * 1.5);
  }
  return cost;
}
