// Account Tier System Types
// Defines limits for Free, Pro, Growth, and Agency tiers

export type AccountTier = 'free' | 'pro' | 'growth' | 'agency';

export interface TierLimits {
  tier: AccountTier;
  max_duration_minutes: number;
  max_clips_per_video: number;
  max_concurrent_projects: number;
  max_retries_per_clip: number;
  priority_queue: boolean;
  chunked_stitching: boolean;
}

export interface GenerationCheckpoint {
  lastCompletedShot: number;
  totalShots: number;
  failedShots: string[];
  retryCount: number;
}

export type PipelineStage = 
  | 'draft'
  | 'script_generating'
  | 'script_ready'
  | 'images_generating'
  | 'images_ready'
  | 'clips_generating'
  | 'clips_ready'
  | 'stitching'
  | 'completed'
  | 'failed';

export type ErrorCategory = 'timeout' | 'api_error' | 'validation' | 'quota' | 'unknown';

// Default limits for each tier
export const DEFAULT_TIER_LIMITS: Record<AccountTier, TierLimits> = {
  free: {
    tier: 'free',
    max_duration_minutes: 1,
    max_clips_per_video: 10,
    max_concurrent_projects: 2,
    max_retries_per_clip: 1,
    priority_queue: false,
    chunked_stitching: false,
  },
  pro: {
    tier: 'pro',
    max_duration_minutes: 1,
    max_clips_per_video: 15,
    max_concurrent_projects: 5,
    max_retries_per_clip: 2,
    priority_queue: false,
    chunked_stitching: false,
  },
  growth: {
    tier: 'growth',
    max_duration_minutes: 2,
    max_clips_per_video: 30,
    max_concurrent_projects: 10,
    max_retries_per_clip: 3,
    priority_queue: true,
    chunked_stitching: true,
  },
  agency: {
    tier: 'agency',
    max_duration_minutes: 2,
    max_clips_per_video: 30,
    max_concurrent_projects: 25,
    max_retries_per_clip: 4,
    priority_queue: true,
    chunked_stitching: true,
  },
};

// Helper to check if tier supports 2-minute videos
export function supports2MinuteVideos(tier: AccountTier): boolean {
  return tier === 'growth' || tier === 'agency';
}

// Helper to get max clips for tier
export function getMaxClipsForTier(tier: AccountTier): number {
  return DEFAULT_TIER_LIMITS[tier].max_clips_per_video;
}

// Helper to check if tier has priority processing
export function hasPriorityProcessing(tier: AccountTier): boolean {
  return DEFAULT_TIER_LIMITS[tier].priority_queue;
}
