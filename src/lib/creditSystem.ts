// Credit system constants
// Consistent across frontend and backend

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH):
 * - 10 credits = 1 clip (regardless of clip length)
 * - New users get 60 free credits (6 clips)
 * - No limit on clips per video
 */

export const CREDIT_SYSTEM = {
  
  // Cost per clip breakdown
  COST_PER_CLIP: {
    PRE_PRODUCTION: 2,    // Script analysis, scene optimization
    PRODUCTION: 6,        // Video generation, voice synthesis
    QUALITY_ASSURANCE: 2, // Director audit, visual debugger, retries
    TOTAL: 10,            // Total per clip
  },
  
  // Welcome bonus
  WELCOME_CREDITS: 60,    // 6 free clips for new users
  
  // Clip duration
  CLIP_DURATION_SECONDS: 6,
  
  // Max clips by tier (for display purposes)
  MAX_CLIPS_FREE: 6,      // 60 credits
  MAX_CLIPS_PRO: 30,      // 300 credits
} as const;

/**
 * Calculate credits required for a given number of clips
 */
export function calculateCreditsRequired(clipCount: number): number {
  return clipCount * CREDIT_SYSTEM.COST_PER_CLIP.TOTAL;
}

/**
 * Calculate how many clips can be afforded with given credits
 */
export function calculateAffordableClips(credits: number): number {
  return Math.floor(credits / CREDIT_SYSTEM.COST_PER_CLIP.TOTAL);
}

/**
 * Check if user can afford the generation
 */

/**
 * Check if user can afford the generation
 */
export function canAffordGeneration(
  availableCredits: number, 
  clipCount: number
): { canAfford: boolean; required: number; shortfall: number } {
  const required = calculateCreditsRequired(clipCount);
  const shortfall = Math.max(0, required - availableCredits);
  return {
    canAfford: availableCredits >= required,
    required,
    shortfall,
  };
}
