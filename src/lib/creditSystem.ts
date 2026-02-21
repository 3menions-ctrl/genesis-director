// Credit system constants
// Consistent across frontend and backend

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH) — Kling V3 (kwaivgi/kling-v3-video)
 *
 * REAL COST: $3.38 per 10s clip via Replicate/Kling V3
 * TARGET: Minimum 48% profit margin on every clip
 *
 * Standard (T2V / I2V):
 *   - 10s clip: 50 credits ($5.00) — real cost $3.38, margin 32%
 *   - 15s clip: 75 credits ($7.50) — real cost ~$5.07, margin 32%
 *
 * Avatar (with native lip-sync audio — higher compute):
 *   - 10s clip: 60 credits ($6.00) — real cost ~$4.00, margin 33%
 *   - 15s clip: 90 credits ($9.00) — real cost ~$6.00, margin 33%
 *
 * Stripe: 1 credit = $0.10 (10 credits = $1)
 *
 * CLIP DURATION: User-selectable (5, 10, 15s via Kling V3)
 * CLIP COUNT: User-selectable (1-20 clips)
 */

export const CREDIT_SYSTEM = {
  // ── Kling V3 — Standard (T2V / I2V) ─────────────────────────────────
  BASE_CREDITS_PER_CLIP: 50,         // 10s clip = $5.00
  EXTENDED_CREDITS_PER_CLIP: 75,     // 15s clip = $7.50

  // ── Kling V3 — Avatar mode (with native lip-sync audio) ─────────────
  AVATAR_BASE_CREDITS_PER_CLIP: 60,      // 10s clip = $6.00
  AVATAR_EXTENDED_CREDITS_PER_CLIP: 90,   // 15s clip = $9.00

  // ── Legacy Veo aliases (backward compat — both route to Kling V3) ────
  VEO_BASE_CREDITS_PER_CLIP: 50,
  VEO_EXTENDED_CREDITS_PER_CLIP: 75,
  VEO_CLIP_DURATION: 10,

  // Threshold for base vs extended pricing
  BASE_CLIP_COUNT_THRESHOLD: 100,  // No clip-count-based surcharge anymore
  BASE_DURATION_THRESHOLD: 10,     // Up to 10 seconds is base rate

  // Stripe pricing: 1 credit = $0.10
  CENTS_PER_CREDIT: 10,

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
export function calculateCreditsPerClip(clipDuration: number, clipIndex: number = 0, videoEngine: 'kling' | 'veo' = 'kling'): number {
  const extended = isExtendedPricing(clipIndex, clipDuration);
  if (videoEngine === 'kling') {
    return extended ? CREDIT_SYSTEM.AVATAR_EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.AVATAR_BASE_CREDITS_PER_CLIP;
  }
  return extended ? CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP;
}

/**
 * Calculate credits required for a given number of clips at specified duration and engine
 */
export function calculateCreditsRequired(clipCount: number, clipDuration: number = 10, videoEngine: 'kling' | 'veo' = 'kling'): number {
  let total = 0;
  for (let i = 0; i < clipCount; i++) {
    total += calculateCreditsPerClip(clipDuration, i, videoEngine);
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
export function getCreditBreakdown(clipCount: number, clipDuration: number, videoEngine: 'kling' | 'veo' = 'kling'): {
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
  const isAvatar = videoEngine === 'kling';
  const baseRate = isAvatar ? CREDIT_SYSTEM.AVATAR_BASE_CREDITS_PER_CLIP : CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP;
  const extRate = isAvatar ? CREDIT_SYSTEM.AVATAR_EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP;

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
    isVeo: !isAvatar,
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
