import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TierLimits, DEFAULT_TIER_LIMITS, AccountTier } from '@/types/tier-limits';

interface TierLimitsResponse {
  tier: string;
  max_duration_minutes: number;
  max_clips_per_video: number;
  max_concurrent_projects: number;
  max_retries_per_clip: number;
  priority_queue: boolean;
  chunked_stitching: boolean;
}

export function useTierLimits() {
  const { data: tierLimits, isLoading, error } = useQuery({
    queryKey: ['tier-limits'],
    queryFn: async (): Promise<TierLimits> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return DEFAULT_TIER_LIMITS.free;
      }

      // Call the database function to get tier limits
      const { data, error } = await supabase.rpc('get_user_tier_limits', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Failed to fetch tier limits:', error);
        // Fallback to profile tier
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_tier')
          .eq('id', user.id)
          .single();
        
        const tier = (profile?.account_tier as AccountTier) || 'free';
        return DEFAULT_TIER_LIMITS[tier];
      }

      // Parse the JSON response
      const response = data as unknown as TierLimitsResponse;

      return {
        tier: response.tier as AccountTier,
        max_duration_minutes: response.max_duration_minutes,
        max_clips_per_video: response.max_clips_per_video,
        max_concurrent_projects: response.max_concurrent_projects,
        max_retries_per_clip: response.max_retries_per_clip,
        priority_queue: response.priority_queue,
        chunked_stitching: response.chunked_stitching,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const canCreate2MinuteVideo = tierLimits?.max_duration_minutes === 2;
  const maxClips = tierLimits?.max_clips_per_video ?? 6;
  const maxRetries = tierLimits?.max_retries_per_clip ?? 1;
  const hasChunkedStitching = tierLimits?.chunked_stitching ?? false;
  const hasPriorityQueue = tierLimits?.priority_queue ?? false;

  return {
    tierLimits,
    isLoading,
    error,
    canCreate2MinuteVideo,
    maxClips,
    maxRetries,
    hasChunkedStitching,
    hasPriorityQueue,
  };
}
