import { creditsForScene, type EngineId } from '@/lib/video/engines';

// Credit system constants
// Kept for legacy screens. Canonical create-page pricing is resolved through
// src/lib/video/engines.ts via creditsForScene().

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH)
 *
 * Engines & verified Replicate cost (as of audit):
 *   • Kling V3 (kwaivgi/kling-v3-video): ~$0.338/sec  → 10s = $3.38
 *   • Seedance 2.0 1080p (bytedance/seedance-2.0): $0.45/sec → 10s = $4.50, 12s = $5.40
 *
 * TARGET: ≥30% gross margin on every clip
 *
 * ⚠️ Canonical per-clip prices are DERIVED from src/lib/video/engines.ts via
 * creditsForScene() (see CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP below). The credit
 * figures in this doc block and in COST_PER_CLIP are LEGACY and feed only the
 * dead chargePreProduction/chargeProduction path — do NOT trust them as the
 * live price (a 10s Kling clip is 35 credits, not 50).
 *
 * Standard (T2V / I2V):  [legacy figures]
 *   - 10s clip: 50 credits ($5.00) — real cost $3.38, margin 32%
 *   - 15s clip: 75 credits ($7.50) — real cost ~$5.07, margin 32%
 *
 * Avatar (with native lip-sync audio — higher compute):
 *   - 10s clip: 60 credits ($6.00) — real cost ~$4.00, margin 33%
 *   - 15s clip: 90 credits ($9.00) — real cost ~$6.00, margin 33%
 *
 * Seedance 2.0 (premium tier — 1080p hyperreal motion, max 12s/clip):
 *   - 10s clip: 65 credits ($6.50) — real cost $4.50, margin 31%
 *   - 12s clip (extended): 95 credits ($9.50) — real cost $5.40, margin 43%
 *
 * Stripe: 1 credit = $0.10 (10 credits = $1)
 *
 * CLIP DURATION:
 *   • Kling V3: 5, 10, 15s
 *   • Seedance 2.0: 5, 10, 12s (model hard-clamps >12s)
 * CLIP COUNT: User-selectable (1-20 clips)
 */

export const CREDIT_SYSTEM = {
  // ── Per-clip prices are DERIVED from the engine registry
  // (src/lib/video/engines.ts) — the single source of truth, parity-locked
  // to the backend. These named aliases exist only so display/threshold
  // code reads one place; NEVER hardcode a price here again. Avatar mode
  // carries the Kling +50% native-audio premium (mirrors priceClipCredits).
  BASE_CREDITS_PER_CLIP: creditsForScene('kling-v3', 10),
  EXTENDED_CREDITS_PER_CLIP: creditsForScene('kling-v3', 15),

  AVATAR_BASE_CREDITS_PER_CLIP: Math.round(creditsForScene('kling-v3', 10) * 1.5),
  AVATAR_EXTENDED_CREDITS_PER_CLIP: Math.round(creditsForScene('kling-v3', 15) * 1.5),

  SEEDANCE_BASE_CREDITS_PER_CLIP: creditsForScene('seedance-2', 10),
  SEEDANCE_EXTENDED_CREDITS_PER_CLIP: creditsForScene('seedance-2', 12),

  VEO_BASE_CREDITS_PER_CLIP: creditsForScene('veo-3', 8),
  VEO_EXTENDED_CREDITS_PER_CLIP: creditsForScene('veo-3', 8),
  VEO_CLIP_DURATION: 8,

  SORA_BASE_CREDITS_PER_CLIP: creditsForScene('sora-2', 8),
  SORA_EXTENDED_CREDITS_PER_CLIP: creditsForScene('sora-2', 12),

  // Threshold for base vs extended pricing
  BASE_CLIP_COUNT_THRESHOLD: 100,  // No clip-count-based surcharge anymore
  BASE_DURATION_THRESHOLD: 10,     // Up to 10 seconds is base rate

  // Stripe pricing: 1 credit = $0.10
  CENTS_PER_CREDIT: 10,

  // LEGACY phase-split breakdown — used only by the dead chargePreProduction/
  // chargeProduction path. The live per-clip price is BASE_CREDITS_PER_CLIP
  // (derived). Do not use these for new code.
  // Cost per clip breakdown — Standard T2V/I2V 10s
  COST_PER_CLIP: {
    PRE_PRODUCTION: 8,
    PRODUCTION: 34,
    QUALITY_ASSURANCE: 8,
    TOTAL: 50,
  },

  // Cost per clip breakdown — Standard T2V/I2V 15s
  COST_PER_CLIP_EXTENDED: {
    PRE_PRODUCTION: 12,
    PRODUCTION: 51,
    QUALITY_ASSURANCE: 12,
    TOTAL: 75,
  },

  // No welcome bonus — all credits purchased
  WELCOME_CREDITS: 0,

  // Clip duration options (Kling V3: 3–15 seconds)
  CLIP_DURATIONS: [5, 10, 15] as const,
  // Seedance 2.0 hard-clamps duration to 2–12s; expose only legal options.
  SEEDANCE_CLIP_DURATIONS: [5, 10, 12] as const,
  SEEDANCE_MAX_CLIP_DURATION: 12,
  DEFAULT_CLIP_DURATION: 10,
  DEFAULT_AVATAR_CLIP_DURATION: 10,
  MIN_CLIP_DURATION: 3,
  MAX_CLIP_DURATION: 15,

  // Clip count limits
  MIN_CLIPS: 1,
  MAX_CLIPS: 20,
  DEFAULT_CLIP_COUNT: 6,

  // Max clips by tier (for display purposes)
  MAX_CLIPS_FREE: 6,
  MAX_CLIPS_PRO: 30,
} as const;

/**
 * Determine if a clip should use extended pricing.
 * Extended if: duration > 10 seconds.
 * (No more clip-count surcharge — pricing is purely duration-based.)
 */
export function isExtendedPricing(_clipIndex: number, clipDuration: number): boolean {
  return clipDuration > CREDIT_SYSTEM.BASE_DURATION_THRESHOLD;
}

/**
 * Calculate credits for a single clip based on duration and engine.
 * 'kling' = Avatar mode (native audio), 'veo' = Standard T2V/I2V
 */
export type VideoEngine = 'wan' | 'kling' | 'veo' | 'seedance' | 'runway' | 'sora';

function toEngineId(videoEngine: VideoEngine): EngineId {
  switch (videoEngine) {
    case 'wan': return 'wan-25';
    case 'seedance': return 'seedance-2';
    case 'veo': return 'veo-3';
    case 'runway': return 'runway-gen4';
    case 'sora': return 'sora-2';
    case 'kling':
    default: return 'kling-v3';
  }
}

export function calculateCreditsPerClip(clipDuration: number, clipIndex: number = 0, videoEngine: VideoEngine = 'wan'): number {
  void clipIndex;
  try {
    return creditsForScene(toEngineId(videoEngine), clipDuration);
  } catch {
    const extended = isExtendedPricing(0, clipDuration);
    // Wan = free tier. Base render is 0; only optional 4k/60fps surcharges cost.
    if (videoEngine === 'wan') {
      return 0;
    }
    if (videoEngine === 'seedance') {
      return extended ? CREDIT_SYSTEM.SEEDANCE_EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.SEEDANCE_BASE_CREDITS_PER_CLIP;
    }
    if (videoEngine === 'sora') {
      return clipDuration > 8 ? CREDIT_SYSTEM.SORA_EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.SORA_BASE_CREDITS_PER_CLIP;
    }
    if (videoEngine === 'veo') {
      return CREDIT_SYSTEM.VEO_BASE_CREDITS_PER_CLIP;
    }
    return extended ? CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP;
  }
}

/**
 * Calculate credits required for a given number of clips at specified duration and engine
 */
export function calculateCreditsRequired(clipCount: number, clipDuration: number = 10, videoEngine: VideoEngine = 'kling'): number {
  let total = 0;
  for (let i = 0; i < clipCount; i++) {
    total += calculateCreditsPerClip(clipDuration, i, videoEngine);
  }
  return total;
}

/**
 * Calculate credits when each scene has its own duration.
 * Used by per-scene duration UI in CreationHub.
 */
export function calculateCreditsForDurations(
  durations: number[],
  videoEngine: VideoEngine = 'kling',
): number {
  let total = 0;
  for (let i = 0; i < durations.length; i++) {
    total += calculateCreditsPerClip(durations[i], i, videoEngine);
  }
  return total;
}

/**
 * Calculate how many clips can be afforded with given credits at specified duration
 */
export function calculateAffordableClips(credits: number, clipDuration: number = 10): number {
  let clipCount = 0;
  let remaining = credits;

  while (remaining > 0) {
    const costForNextClip = calculateCreditsPerClip(clipDuration, clipCount);
    // Guard against a zero/negative per-clip cost (e.g. the free 'wan' engine, or
    // a duration not in the pricing table whose fallback returns 0) — without
    // this the loop never decrements `remaining` and spins forever.
    if (costForNextClip <= 0) break;
    if (remaining < costForNextClip) break;
    remaining -= costForNextClip;
    clipCount++;
  }

  return clipCount;
}

/**
 * Calculate total video duration in seconds
 */
export function calculateTotalDuration(clipCount: number, clipDuration: number): number {
  return clipCount * clipDuration;
}

/**
 * Format duration for display (e.g., "30s" or "1m 30s")
 */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Get breakdown of credits for display
 */
export function getCreditBreakdown(clipCount: number, clipDuration: number, videoEngine: VideoEngine = 'kling'): {
  baseClipCount: number;
  extendedClipCount: number;
  baseCredits: number;
  extendedCredits: number;
  totalCredits: number;
  creditsPerClipBase: number;
  creditsPerClipExtended: number;
  isExtended: boolean;
  isVeo: boolean;
} {
  // Price the actual clip duration (e.g. a 5s clip costs less than 10s) — this
  // must match calculateCreditsRequired, which prices each clip at clipDuration.
  // Hardcoding the 10s threshold here over-charged shorter clips ~2x.
  const baseRate = calculateCreditsPerClip(clipDuration, 0, videoEngine);
  const extRate = calculateCreditsPerClip(clipDuration > CREDIT_SYSTEM.BASE_DURATION_THRESHOLD ? clipDuration : 15, 0, videoEngine);

  let baseClipCount = 0;
  let extendedClipCount = 0;

  for (let i = 0; i < clipCount; i++) {
    if (isExtendedPricing(i, clipDuration)) {
      extendedClipCount++;
    } else {
      baseClipCount++;
    }
  }

  const baseCredits = baseClipCount * baseRate;
  const extendedCredits = extendedClipCount * extRate;

  return {
    baseClipCount,
    extendedClipCount,
    baseCredits,
    extendedCredits,
    totalCredits: baseCredits + extendedCredits,
    creditsPerClipBase: baseRate,
    creditsPerClipExtended: extRate,
    isExtended: extendedClipCount > 0,
    isVeo: videoEngine === 'veo',
  };
}

/**
 * Check if user can afford the generation
 */
export function canAffordGeneration(
  availableCredits: number,
  clipCount: number,
  clipDuration: number = 10
): { canAfford: boolean; required: number; shortfall: number } {
  const required = calculateCreditsRequired(clipCount, clipDuration);
  const shortfall = Math.max(0, required - availableCredits);
  return {
    canAfford: availableCredits >= required,
    required,
    shortfall,
  };
}

/**
 * Convert credits to dollars (for display)
 */
export function creditsToDollars(credits: number): number {
  return credits * (CREDIT_SYSTEM.CENTS_PER_CREDIT / 100);
}

/**
 * Convert dollars to credits
 */
export function dollarsToCredits(dollars: number): number {
  return Math.floor(dollars * 100 / CREDIT_SYSTEM.CENTS_PER_CREDIT);
}
