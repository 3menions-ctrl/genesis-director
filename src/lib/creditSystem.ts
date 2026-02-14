// Credit system constants
// Consistent across frontend and backend

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH):
 * - Base: 10 credits per clip (clips 1-6, up to 6 seconds each)
 * - Extended: 15 credits per clip if:
 *   - Clip count exceeds 6 clips (clips 7+), OR
 *   - Clip duration exceeds 6 seconds
 * - All credits are purchased (no free credits)
 * 
 * Stripe: 1 credit = $0.10 (10 credits = $1)
 * 
 * CLIP DURATION: User-selectable (5s or 10s via Kling 2.6)
 * CLIP COUNT: User-selectable (1-20 clips)
 * These values are ENFORCED throughout the pipeline
 */

export const CREDIT_SYSTEM = {
  // Base cost for clips 1-6 at ≤6 seconds
  BASE_CREDITS_PER_CLIP: 10,
  
  // Extended cost for clips 7+ OR clips >6 seconds
  EXTENDED_CREDITS_PER_CLIP: 15,
  
  // Threshold for base vs extended pricing
  BASE_CLIP_COUNT_THRESHOLD: 6,  // Clips 1-6 are base rate
  BASE_DURATION_THRESHOLD: 6,    // Up to 6 seconds is base rate
  
  // Stripe pricing: 1 credit = $0.10
  CENTS_PER_CREDIT: 10,
  
  // Cost per clip breakdown (for base rate clips)
  COST_PER_CLIP: {
    PRE_PRODUCTION: 2,    // Script analysis, scene optimization
    PRODUCTION: 6,        // Video generation, voice synthesis
    QUALITY_ASSURANCE: 2, // Director audit, visual debugger, retries
    TOTAL: 10,            // Total per clip (base rate)
  },
  
  // Cost per clip breakdown (for extended rate clips)
  COST_PER_CLIP_EXTENDED: {
    PRE_PRODUCTION: 3,    // More complex processing
    PRODUCTION: 9,        // Longer generation
    QUALITY_ASSURANCE: 3, // More QA needed
    TOTAL: 15,            // Total per clip (extended rate)
  },
  
  // No welcome bonus — all credits purchased
  WELCOME_CREDITS: 0,
  
  // Clip duration options (Kling 2.6)
  CLIP_DURATIONS: [5, 10] as const,
  DEFAULT_CLIP_DURATION: 5,
  DEFAULT_AVATAR_CLIP_DURATION: 10, // Avatars default to 10s for natural speech
  
  // Clip count limits
  MIN_CLIPS: 1,
  MAX_CLIPS: 20,
  DEFAULT_CLIP_COUNT: 6,
  
  // Max clips by tier (for display purposes)
  MAX_CLIPS_FREE: 6,      // Based on purchased credits
  MAX_CLIPS_PRO: 30,      // 300 credits
} as const;

/**
 * Determine if a clip should use extended pricing
 * Extended if: clip index > 6 OR duration > 6 seconds
 */
export function isExtendedPricing(clipIndex: number, clipDuration: number): boolean {
  // clipIndex is 0-based, so clip 7 is index 6
  return clipIndex >= CREDIT_SYSTEM.BASE_CLIP_COUNT_THRESHOLD || 
         clipDuration > CREDIT_SYSTEM.BASE_DURATION_THRESHOLD;
}

/**
 * Calculate credits for a single clip based on its index and duration
 * Base (10): clips 1-6 at ≤6 seconds
 * Extended (15): clips 7+ OR duration >6 seconds
 */
export function calculateCreditsPerClip(clipDuration: number, clipIndex: number = 0): number {
  if (isExtendedPricing(clipIndex, clipDuration)) {
    return CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP;
  }
  return CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP;
}

/**
 * Calculate credits required for a given number of clips at specified duration
 * Accounts for per-clip pricing based on index
 */
export function calculateCreditsRequired(clipCount: number, clipDuration: number = 5): number {
  let total = 0;
  for (let i = 0; i < clipCount; i++) {
    total += calculateCreditsPerClip(clipDuration, i);
  }
  return total;
}

/**
 * Calculate how many clips can be afforded with given credits at specified duration
 */
export function calculateAffordableClips(credits: number, clipDuration: number = 5): number {
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
export function getCreditBreakdown(clipCount: number, clipDuration: number): {
  baseClipCount: number;
  extendedClipCount: number;
  baseCredits: number;
  extendedCredits: number;
  totalCredits: number;
  creditsPerClipBase: number;
  creditsPerClipExtended: number;
  isExtended: boolean;
} {
  // Determine how many clips are base vs extended
  let baseClipCount = 0;
  let extendedClipCount = 0;
  
  for (let i = 0; i < clipCount; i++) {
    if (isExtendedPricing(i, clipDuration)) {
      extendedClipCount++;
    } else {
      baseClipCount++;
    }
  }
  
  const baseCredits = baseClipCount * CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP;
  const extendedCredits = extendedClipCount * CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP;
  
  return {
    baseClipCount,
    extendedClipCount,
    baseCredits,
    extendedCredits,
    totalCredits: baseCredits + extendedCredits,
    creditsPerClipBase: CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP,
    creditsPerClipExtended: CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP,
    isExtended: extendedClipCount > 0,
  };
}

/**
 * Check if user can afford the generation
 */
export function canAffordGeneration(
  availableCredits: number, 
  clipCount: number,
  clipDuration: number = 5
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
