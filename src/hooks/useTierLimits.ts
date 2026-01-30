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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return DEFAULT_TIER_LIMITS.free;
        }

        // Create a timeout promise for the RPC call
        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
          setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 8000);
        });

        // Call the database function to get tier limits
        const fetchPromise = supabase.rpc('get_user_tier_limits', {
          p_user_id: user.id
        });
        
        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if (result.error) {
          console.warn('Failed to fetch tier limits:', result.error.message);
          // Fallback to profile tier
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('account_tier')
              .eq('id', user.id)
              .single();
            
            const tier = (profile?.account_tier as AccountTier) || 'free';
            return DEFAULT_TIER_LIMITS[tier];
          } catch {
            return DEFAULT_TIER_LIMITS.free;
          }
        }

        // Parse the JSON response
        const response = result.data as unknown as TierLimitsResponse;

        return {
          tier: response.tier as AccountTier,
          max_duration_minutes: response.max_duration_minutes,
          max_clips_per_video: response.max_clips_per_video,
          max_concurrent_projects: response.max_concurrent_projects,
          max_retries_per_clip: response.max_retries_per_clip,
          priority_queue: response.priority_queue,
          chunked_stitching: response.chunked_stitching,
        };
      } catch (err) {
        // Graceful fallback on any error
        console.warn('[useTierLimits] Error fetching limits, using defaults:', err);
        return DEFAULT_TIER_LIMITS.free;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once to avoid hanging
    retryDelay: 1000,
  });

  const canCreate2MinuteVideo = tierLimits?.max_duration_minutes === 2;
  const maxClips = tierLimits?.max_clips_per_video ?? 5; // Free tier default
  const maxRetries = tierLimits?.max_retries_per_clip ?? 4;
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
