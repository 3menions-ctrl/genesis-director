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
  /** 4K upscale surcharge (Topaz, ~$0.08/s of output video) in credits
   *  PER STARTED 10 SECONDS of final film — Topaz bills by video length,
   *  so a flat fee would go underwater on long films. */
  upscale4kCredits: number;
  /** 60fps interpolation surcharge (RIFE) in credits per started 10s. */
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
  const blocks = Math.max(1, Math.ceil(duration / 10)); // per started 10s
  if (opts.upscale4k) cost += blocks * spec.upscale4kCredits;
  if (opts.fps60) cost += blocks * spec.fps60Credits;
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
  'wan-25':      { 5: 0.60,  10: 1.20, 15: 1.80 },   // Wan 2.7: fal $0.10/s + 20% safety buffer
  'kling-v3':    { 5: 1.68,  10: 3.36,  15: 5.04 },  // Kling 3.0 Pro 1080p $20.16/min (vendor-verified) — was underpriced at $0.269/s
  'seedance-2':  { 5: 1.50,  10: 3.00,  12: 3.60 },  // $0.30/s = 2× verified 720p+audio rate ($9.07/min) as 1080p buffer
  'veo-3':       { 4: 0.72,  6: 1.08,   8: 1.44 },   // Veo 3.1 Fast w/audio: fal $0.15/s + 20% buffer
  'runway-gen4': { 5: 2.0,   10: 4.0 },              // Gen-4.5 (VERIFY vs Replicate billing)
  'sora-2':      { 4: 1.20,  8: 2.40,   12: 3.60 },  // OpenAI $0.10/s (720p) × 3 buffer for Replicate/1080p uncertainty
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
  'wan-25': {
    id: 'wan-25',
    provider: 'wan',
    tier: 'standard',
    label: 'Wan 2.7',
    shortLabel: 'Wan 2.7',
    description: "Alibaba's Wan 2.7 — fast, sharp and budget-friendly with native audio. Your first 5-second video is on us.",
    durations: [5, 10, 15],
    maxDuration: 15,
    supportsImageInput: true,
    supportsAudio: true,
    supportsAvatar: false,
    etaSeconds: 110,
    healthy: true,
    upscale4kCredits: 15,
    fps60Credits: 2,
    // Priced at Wan 2.7 Replicate compute (~$0.10/s) + ops, marked up 30%.
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
    upscale4kCredits: 15,
    fps60Credits: 2,
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
    upscale4kCredits: 15,
    fps60Credits: 2,
    baseCreditsFor: (d) => clipCredits('seedance-2', d),
  },

  // -------- CINEMA --------
  'veo-3': {
    id: 'veo-3',
    provider: 'veo3',
    tier: 'cinema',
    label: 'Veo 3.1 Fast — Cinema',
    shortLabel: 'Veo 3.1',
    description:
      'Google Veo 3.1 Fast. Higher-fidelity video, context-aware audio, and end-frame control.',
    durations: [4, 6, 8],
    maxDuration: 8,
    supportsImageInput: true,
    supportsAudio: true,
    supportsAvatar: true,
    etaSeconds: 120,
    healthy: true,
    requiresEntitlement: 'studio_cinema',
    upscale4kCredits: 15,
    fps60Credits: 2,
    baseCreditsFor: (d) => clipCredits('veo-3', d),
  },

  'runway-gen4': {
    id: 'runway-gen4',
    provider: 'runway',
    tier: 'cinema',
    label: 'Runway Gen-4.5 — Cinema',
    shortLabel: 'Runway 4.5',
    description:
      'State-of-the-art motion quality and prompt adherence. Max 10s per clip.',
    durations: [5, 10],
    maxDuration: 10,
    supportsImageInput: true,
    supportsAudio: false,
    supportsAvatar: true,
    etaSeconds: 150,
    healthy: true,
    requiresEntitlement: 'studio_cinema',
    upscale4kCredits: 15,
    fps60Credits: 2,
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
    upscale4kCredits: 15,
    fps60Credits: 2,
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

/** Reverse of engineToBackend, plus the 'wan' token. Backend
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
