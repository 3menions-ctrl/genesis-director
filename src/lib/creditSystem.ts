// Credit system constants
// Consistent across frontend and backend

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH):
 * - Base: 10 credits per clip (up to 6 seconds)
 * - Extended: +5 credits per additional second beyond 6s
 * - New users get 60 free credits (6 clips at base rate)
 * 
 * CLIP DURATION: User-selectable (5s or 10s via Kling 2.6)
 * CLIP COUNT: User-selectable (1-20 clips)
 * These values are ENFORCED throughout the pipeline
 */

export const CREDIT_SYSTEM = {
  // Base cost for clips up to 6 seconds
  BASE_CREDITS_PER_CLIP: 10,
  
  // Threshold for additional charges
  BASE_DURATION_THRESHOLD: 6,
  
  // Additional credits per second beyond threshold
  CREDITS_PER_EXTRA_SECOND: 5,
  
  // Cost per clip breakdown (for base 6s clips)
  COST_PER_CLIP: {
    PRE_PRODUCTION: 2,    // Script analysis, scene optimization
    PRODUCTION: 6,        // Video generation, voice synthesis
    QUALITY_ASSURANCE: 2, // Director audit, visual debugger, retries
    TOTAL: 10,            // Total per clip (base rate)
  },
  
  // Welcome bonus
  WELCOME_CREDITS: 60,    // 6 free clips for new users (at base rate)
  
  // Clip duration options (Kling 2.6)
  CLIP_DURATIONS: [5, 10] as const,
  DEFAULT_CLIP_DURATION: 5,
  
  // Clip count limits
  MIN_CLIPS: 1,
  MAX_CLIPS: 20,
  DEFAULT_CLIP_COUNT: 6,
  
  // Max clips by tier (for display purposes)
  MAX_CLIPS_FREE: 6,      // 60 credits (at base rate)
  MAX_CLIPS_PRO: 30,      // 300 credits
} as const;

/**
 * Calculate credits for a single clip based on duration
 * Base: 10 credits for up to 6 seconds
 * Extended: +5 credits per additional second
 */
export function calculateCreditsPerClip(clipDuration: number): number {
  const baseCost = CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP;
  
  if (clipDuration <= CREDIT_SYSTEM.BASE_DURATION_THRESHOLD) {
    return baseCost;
  }
  
  const extraSeconds = clipDuration - CREDIT_SYSTEM.BASE_DURATION_THRESHOLD;
  const extraCost = extraSeconds * CREDIT_SYSTEM.CREDITS_PER_EXTRA_SECOND;
  
  return baseCost + extraCost;
}

/**
 * Calculate credits required for a given number of clips at specified duration
 */
export function calculateCreditsRequired(clipCount: number, clipDuration: number = 5): number {
  const creditsPerClip = calculateCreditsPerClip(clipDuration);
  return clipCount * creditsPerClip;
}

/**
 * Calculate how many clips can be afforded with given credits at specified duration
 */
export function calculateAffordableClips(credits: number, clipDuration: number = 5): number {
  const creditsPerClip = calculateCreditsPerClip(clipDuration);
  return Math.floor(credits / creditsPerClip);
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
  baseCredits: number;
  extraCredits: number;
  totalCredits: number;
  creditsPerClip: number;
  extraSecondsPerClip: number;
} {
  const creditsPerClip = calculateCreditsPerClip(clipDuration);
  const extraSecondsPerClip = Math.max(0, clipDuration - CREDIT_SYSTEM.BASE_DURATION_THRESHOLD);
  const extraCreditsPerClip = extraSecondsPerClip * CREDIT_SYSTEM.CREDITS_PER_EXTRA_SECOND;
  
  return {
    baseCredits: clipCount * CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP,
    extraCredits: clipCount * extraCreditsPerClip,
    totalCredits: clipCount * creditsPerClip,
    creditsPerClip,
    extraSecondsPerClip,
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
