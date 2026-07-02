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

/**
 * A named quality preset surfaced to the user (e.g. "HD", "4K Cinema").
 * Each preset maps to a concrete QualityOptions bundle plus a credit surcharge
 * already encoded in upscale4kCredits / fps60Credits on the spec.
 */
export interface QualityProfile {
  id: string;
  label: string;
  description: string;
  resolution: '720p' | '1080p' | '4K';
  fps: 24 | 30 | 60;
  options: QualityOptions;
  /** Recommended for this engine (one per engine). */
  recommended?: boolean;
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
  /** Backend pipeline routing — every engine maps to a concrete edge function. */
  pipelineId: string;
  /** Edge function name invoked to render this engine's clips. */
  pipelineFunction: string;
  /** Hard cap on scenes per project for this engine (provider/cost ceiling). */
  maxScenesPerProject: number;
  /** Default scene count when auto-scripting on this engine. */
  recommendedScenes: number;
  /** Default duration to pre-fill when this engine is selected. */
  defaultDuration: number;
  /** Quality presets exposed to the user for this engine. */
  qualityProfiles: QualityProfile[];
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

/**
 * Per-RENDER quality surcharge for the chosen cores. 4K upscale (Topaz) and
 * 60fps interpolation (RIFE) are POST-PROCESSING on the final stitched film,
 * so they're charged ONCE per render — not per clip. Mirrors the backend
 * finalizer's charge-on-delivery (seamless-stitcher).
 */
export function renderSurchargeCredits(
  spec: EngineSpec,
  opts: QualityOptions = {},
): number {
  let c = 0;
  if (opts.upscale4k) c += spec.upscale4kCredits;
  if (opts.fps60) c += spec.fps60Credits;
  return c;
}

// ── PRICING POLICY — mirror of supabase/functions/_shared/engines.ts ──────
// ≥30% GROSS margin on every generation, guaranteed at the cheapest credit
// value, with a film's add-on COGS (image+LLM+narration+music+stitch) folded
// into each clip's credit cost. MUST stay identical to the backend copy
// (fe-be-parity test enforces it).
export const CREDIT_VALUE_FLOOR_USD = 0.078;
export const TARGET_GROSS_MARGIN = 0.30;
export const BUNDLED_ADDON_COST_USD = 0.205;

export const CLIP_COST_USD: Record<string, Record<number, number>> = {
  'wan-25':      { 5: 0.15,  10: 0.30 },
  'kling-v3':    { 5: 1.385, 10: 2.692, 15: 4.077 },
  'seedance-2':  { 5: 2.692, 10: 5.385, 12: 6.538 },
  'veo-3':       { 4: 1.923, 6: 2.923,  8: 3.846 },
  'runway-gen4': { 5: 1.538, 10: 3.0 },
  'sora-2':      { 4: 2.385, 8: 4.846,  12: 7.231 },
};

export function creditsForCostUsd(costUsd: number): number {
  return Math.ceil(costUsd / (CREDIT_VALUE_FLOOR_USD * (1 - TARGET_GROSS_MARGIN)));
}

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
  // Alibaba Wan 2.5 — the free-tier engine. Generous baseline quality,
  // low credit cost so we can hand it to users on signup-grant credits
  // without breaching the platform budget.
  'wan-25': {
    id: 'wan-25',
    provider: 'wan',
    tier: 'standard',
    label: 'Wan 2.5 — Free',
    shortLabel: 'Wan 2.5',
    description:
      "Alibaba's Wan 2.5 — the free engine. Smooth motion, good prompt adherence; your first 5-second video is free.",
    durations: [5, 10],
    maxDuration: 10,
    supportsImageInput: true,
    supportsAudio: false,
    supportsAvatar: false,
    etaSeconds: 110,
    healthy: true,
    upscale4kCredits: 10,
    fps60Credits: 5,
    pipelineId: 'pipe.wan.v25',
    pipelineFunction: 'generate-video',
    maxScenesPerProject: 8,
    recommendedScenes: 5,
    defaultDuration: 5,
    qualityProfiles: [
      { id: 'hd24',  label: 'HD 1080p',         description: 'Wan 2.5 native, 1080p · 24fps',           resolution: '1080p', fps: 24, options: {},                                  recommended: true },
      { id: 'hd60',  label: 'HD 1080p · 60fps', description: 'Smooth motion via RIFE interpolation',     resolution: '1080p', fps: 60, options: { fps60: true } },
    ],
    // Priced at Replicate compute (~$0.03/s) + storage + ops, marked up 30%.
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
    pipelineId: 'pipe.kling.v3',
    pipelineFunction: 'hollywood-pipeline',
    maxScenesPerProject: 12,
    recommendedScenes: 6,
    defaultDuration: 10,
    qualityProfiles: [
      { id: 'hd24',     label: 'HD 1080p',          description: 'Native Kling V3 output, 1080p · 24fps',                  resolution: '1080p', fps: 24, options: {},                                 recommended: true },
      { id: 'hd60',     label: 'HD 1080p · 60fps',  description: 'Smooth motion via RIFE interpolation',                    resolution: '1080p', fps: 60, options: { fps60: true } },
      { id: 'uhd24',    label: '4K Cinema',         description: 'Topaz Astra upscale to 4K · 24fps',                       resolution: '4K',    fps: 24, options: { upscale4k: true } },
      { id: 'uhd60',    label: '4K Cinema · 60fps', description: 'Topaz 4K + RIFE 60fps + auto retake on failed shots',     resolution: '4K',    fps: 60, options: { upscale4k: true, fps60: true, autoRetake: true } },
    ],
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
    pipelineId: 'pipe.seedance.v2',
    // Unified orchestrator — the legacy seedance-pipeline fn was deleted;
    // seedance runs through hollywood-pipeline's parallel dispatch strategy.
    pipelineFunction: 'hollywood-pipeline',
    maxScenesPerProject: 10,
    recommendedScenes: 6,
    defaultDuration: 10,
    qualityProfiles: [
      { id: 'hd24',  label: 'HD 1080p',         description: 'Seedance 2.0 native, 1080p · 24fps',                resolution: '1080p', fps: 24, options: {},                                  recommended: true },
      { id: 'hd60',  label: 'HD 1080p · 60fps', description: 'Smooth slow-mo via RIFE interpolation',             resolution: '1080p', fps: 60, options: { fps60: true } },
      { id: 'uhd24', label: '4K Pro',           description: 'Topaz upscale to 4K · 24fps',                       resolution: '4K',    fps: 24, options: { upscale4k: true } },
    ],
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
    pipelineId: 'pipe.veo3.fast',
    pipelineFunction: 'generate-video',
    maxScenesPerProject: 8,
    recommendedScenes: 5,
    defaultDuration: 6,
    qualityProfiles: [
      { id: 'hd24',  label: 'HD 1080p',         description: 'Veo 3 Fast native, 1080p · 24fps + native audio',   resolution: '1080p', fps: 24, options: {},                                                  recommended: true },
      { id: 'uhd24', label: '4K Cinema',        description: 'Topaz upscale to 4K · 24fps',                       resolution: '4K',    fps: 24, options: { upscale4k: true } },
      { id: 'uhd60', label: '4K Cinema · 60fps',description: 'Topaz 4K + RIFE 60fps + auto retake',               resolution: '4K',    fps: 60, options: { upscale4k: true, fps60: true, autoRetake: true } },
    ],
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
    pipelineId: 'pipe.runway.gen4turbo',
    pipelineFunction: 'generate-video',
    maxScenesPerProject: 8,
    recommendedScenes: 5,
    defaultDuration: 10,
    qualityProfiles: [
      { id: 'hd24',  label: 'HD 1080p',          description: 'Runway Gen-4 Turbo native, 1080p · 24fps (no audio)', resolution: '1080p', fps: 24, options: {},                                  recommended: true },
      { id: 'uhd24', label: '4K Cinema',         description: 'Topaz upscale to 4K · 24fps',                         resolution: '4K',    fps: 24, options: { upscale4k: true } },
      { id: 'uhd60', label: '4K Cinema · 60fps', description: 'Topaz 4K + RIFE 60fps interpolation',                 resolution: '4K',    fps: 60, options: { upscale4k: true, fps60: true } },
    ],
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
    pipelineId: 'pipe.sora.v2',
    pipelineFunction: 'generate-video',
    maxScenesPerProject: 6,
    recommendedScenes: 4,
    defaultDuration: 8,
    qualityProfiles: [
      { id: 'hd24',  label: 'HD 1080p',          description: 'Sora 2 native, 1080p · 24fps + native audio',         resolution: '1080p', fps: 24, options: {},                                                  recommended: true },
      { id: 'uhd24', label: '4K Cinema',         description: 'Topaz upscale to 4K · 24fps',                         resolution: '4K',    fps: 24, options: { upscale4k: true } },
      { id: 'uhd60', label: '4K Cinema · 60fps', description: 'Topaz 4K + RIFE 60fps + auto retake',                 resolution: '4K',    fps: 60, options: { upscale4k: true, fps60: true, autoRetake: true } },
    ],
    baseCreditsFor: (d) => clipCredits('sora-2', d),
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
 * Clamp a desired duration to the closest value the engine actually supports.
 * Used by the studio when a user switches engines mid-flow.
 */
export function clampDurationForEngine(id: EngineId, desired: number): number {
  const spec = ENGINES[id];
  if (!spec) return desired;
  if (spec.durations.includes(desired)) return desired;
  return spec.durations.reduce((best, d) =>
    Math.abs(d - desired) < Math.abs(best - desired) ? d : best,
  spec.durations[0]);
}

/** Default quality profile for a given engine. */
export function defaultQualityProfile(id: EngineId): QualityProfile {
  const spec = ENGINES[id];
  return spec.qualityProfiles.find(q => q.recommended) ?? spec.qualityProfiles[0];
}

/**
 * Translate the kebab frontend EngineId to the backend token expected by
 * `generate-single-clip` / `hollywood-pipeline`. All five engines now have
 * a dedicated native branch — no silent fallbacks.
 */
export type BackendEngine = 'wan' | 'kling' | 'seedance' | 'veo' | 'runway' | 'sora';

export function engineToBackend(id: EngineId): BackendEngine {
  switch (id) {
    case 'wan-25':      return 'wan';
    case 'seedance-2':  return 'seedance';
    case 'veo-3':       return 'veo';
    case 'runway-gen4': return 'runway';
    case 'sora-2':      return 'sora';
    case 'kling-v3':
    default:            return 'kling';
  }
}

/**
 * Resolve a quality profile by id (fallback to the engine default).
 */
export function getQualityProfile(id: EngineId, profileId?: string): QualityProfile {
  const spec = ENGINES[id];
  return spec.qualityProfiles.find(q => q.id === profileId) ?? defaultQualityProfile(id);
}

/**
 * Total credits for one scene at the given duration on the given engine,
 * including the active quality profile's surcharges. Throws on unsupported
 * duration (caller should clamp first via `clampDurationForEngine`).
 */
export function creditsForScene(
  id: EngineId,
  duration: number,
  profileId?: string,
): number {
  const spec = ENGINES[id];
  const profile = getQualityProfile(id, profileId);
  return creditsFor(spec, duration, profile.options);
}
