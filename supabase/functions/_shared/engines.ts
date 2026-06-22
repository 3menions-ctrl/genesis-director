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

function tableCost(table: Record<number, number>, duration: number): number {
  const v = table[duration];
  if (v == null) {
    throw new Error(
      `Unsupported duration ${duration}s (allowed: ${Object.keys(table).join(', ')}s)`,
    );
  }
  return v;
}

export const ENGINES: Record<EngineId, EngineSpec> = {
  // -------- FREE --------
  'wan-25': {
    id: 'wan-25',
    provider: 'wan',
    tier: 'standard',
    label: 'Wan 2.5 — Free',
    shortLabel: 'Wan 2.5',
    description: "Alibaba's Wan 2.5 — the free-tier engine. Strong baseline quality, bundled with starter credit grants.",
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
    baseCreditsFor: (d) => tableCost({ 5: 3, 10: 5 }, d),
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
    baseCreditsFor: (d) => tableCost({ 5: 18, 10: 35, 15: 53 }, d),
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
    baseCreditsFor: (d) => tableCost({ 5: 35, 10: 70, 12: 85 }, d),
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
    baseCreditsFor: (d) => tableCost({ 4: 25, 6: 38, 8: 50 }, d),
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
    baseCreditsFor: (d) => tableCost({ 5: 20, 10: 39 }, d),
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
    baseCreditsFor: (d) => tableCost({ 4: 31, 8: 63, 12: 94 }, d),
  },
};

export const DEFAULT_ENGINE_ID: EngineId = 'kling-v3';

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
    case 'kling-v3':
    default:            return 'kling';
  }
}

/** Reverse of engineToBackend, plus the free-tier 'wan' token. Backend
 *  deduction paths speak the short token; map it back to a registry spec. */
export function backendToEngineId(token: string): EngineId {
  switch (token) {
    case 'wan':      return 'wan-25';
    case 'seedance': return 'seedance-2';
    case 'veo':      return 'veo-3';
    case 'runway':   return 'runway-gen4';
    case 'sora':     return 'sora-2';
    case 'kling':
    default:         return 'kling-v3';
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
