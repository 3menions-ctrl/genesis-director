// Credit system constants
// Consistent across frontend and backend

/**
 * Credit Pricing (SINGLE SOURCE OF TRUTH):
 * - 10 credits = 1 clip (regardless of clip length)
 * - New users get 60 free credits (6 clips)
 * - No limit on clips per video
 * 
 * CLIP DURATION: User-selectable (5s or 10s via Kling 2.6)
 * CLIP COUNT: User-selectable (1-20 clips)
 * These values are ENFORCED throughout the pipeline
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
  
  // Clip duration options (Kling 2.6)
  CLIP_DURATIONS: [5, 10] as const,
  DEFAULT_CLIP_DURATION: 5,
  
  // Clip count limits
  MIN_CLIPS: 1,
  MAX_CLIPS: 20,
  DEFAULT_CLIP_COUNT: 6,
  
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
