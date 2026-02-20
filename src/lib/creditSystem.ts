// Credit system constants
// Consistent across frontend and backend

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH) — Kling V3 (kwaivgi/kling-v3-video)
 *
 * ALL modes (Text-to-Video, Image-to-Video, Avatar) use Kling V3:
 *
 * T2V / I2V (Standard mode):
 *   - Base: 12 credits per clip (clips 1-6, up to 10s)
 *   - Extended: 18 credits per clip (clips 7+ OR clip > 10s)
 *
 * Avatar (with native lip-sync audio):
 *   - Base: 15 credits per clip (clips 1-6, up to 10s)
 *   - Extended: 22 credits per clip (clips 7+ OR clip > 10s)
 *
 * Stripe: 1 credit = $0.10 (10 credits = $1)
 *
 * CLIP DURATION: User-selectable (3–15s via Kling V3)
 * CLIP COUNT: User-selectable (1-20 clips)
 */

export const CREDIT_SYSTEM = {
  // ── Kling V3 — Standard (T2V / I2V) ─────────────────────────────────
  BASE_CREDITS_PER_CLIP: 12,
  EXTENDED_CREDITS_PER_CLIP: 18,

  // ── Kling V3 — Avatar mode (with native lip-sync audio) ─────────────
  AVATAR_BASE_CREDITS_PER_CLIP: 15,
  AVATAR_EXTENDED_CREDITS_PER_CLIP: 22,

  // ── Legacy Veo aliases (backward compat — both route to Kling V3) ────
  VEO_BASE_CREDITS_PER_CLIP: 12,
  VEO_EXTENDED_CREDITS_PER_CLIP: 18,
  VEO_CLIP_DURATION: 10, // Kling V3 default duration

  // Threshold for base vs extended pricing
  BASE_CLIP_COUNT_THRESHOLD: 6,  // Clips 1-6 are base rate
  BASE_DURATION_THRESHOLD: 10,   // Up to 10 seconds is base rate (Kling V3 default)

  // Stripe pricing: 1 credit = $0.10
  CENTS_PER_CREDIT: 10,

  // Cost per clip breakdown — Standard T2V/I2V base rate
  COST_PER_CLIP: {
    PRE_PRODUCTION: 2,
    PRODUCTION: 8,
    QUALITY_ASSURANCE: 2,
    TOTAL: 12,
  },

  // Cost per clip breakdown — Standard T2V/I2V extended rate
  COST_PER_CLIP_EXTENDED: {
    PRE_PRODUCTION: 3,
    PRODUCTION: 12,
    QUALITY_ASSURANCE: 3,
    TOTAL: 18,
  },

  // No welcome bonus — all credits purchased
  WELCOME_CREDITS: 0,

  // Clip duration options (Kling V3: 3–15 seconds)
  CLIP_DURATIONS: [5, 10, 15] as const,
  DEFAULT_CLIP_DURATION: 10,
  DEFAULT_AVATAR_CLIP_DURATION: 10, // Avatars default to 10s for natural speech
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
 * Determine if a clip should use extended pricing
 * Extended if: clip index >= 6 OR duration > 10 seconds
 */
export function isExtendedPricing(clipIndex: number, clipDuration: number): boolean {
  return clipIndex >= CREDIT_SYSTEM.BASE_CLIP_COUNT_THRESHOLD ||
         clipDuration > CREDIT_SYSTEM.BASE_DURATION_THRESHOLD;
}

/**
 * Calculate credits for a single clip based on its index, duration, and engine
 * Kling V3 Standard (T2V/I2V): Base 12 / Extended 18
 * Kling V3 Avatar (native audio): Base 15 / Extended 22
 * Note: 'veo' param still routes to Kling V3 (legacy alias for T2V/I2V)
 */
export function calculateCreditsPerClip(clipDuration: number, clipIndex: number = 0, videoEngine: 'kling' | 'veo' = 'kling'): number {
  const extended = isExtendedPricing(clipIndex, clipDuration);
  if (videoEngine === 'kling') {
    // Avatar mode with native audio
    return extended ? CREDIT_SYSTEM.AVATAR_EXTENDED_CREDITS_PER_CLIP : CREDIT_SYSTEM.AVATAR_BASE_CREDITS_PER_CLIP;
  }
  // Standard T2V/I2V
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
    isVeo: !isAvatar, // backward compat flag
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
