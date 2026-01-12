import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface UniverseActivity {
  id: string;
  universe_id: string;
  user_id: string;
  activity_type: 'video_created' | 'video_completed' | 'timeline_event' | 'character_added' | 'character_borrowed' | 'member_joined' | 'lore_updated';
  title: string;
  description: string | null;
  metadata: Json;
  reference_id: string | null;
  reference_type: string | null;
  thumbnail_url: string | null;
  created_at: string;
  // Joined data
  universe?: {
    name: string;
    cover_image_url: string | null;
  };
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useUniverseActivityFeed(universeId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeActivity, setRealtimeActivity] = useState<UniverseActivity[]>([]);

  // Fetch activity feed
  const { data: activities, isLoading } = useQuery({
    queryKey: ['universe-activity', universeId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('universe_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (universeId) {
        query = query.eq('universe_id', universeId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as UniverseActivity[];
    },
    enabled: !!user,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('universe-activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'universe_activity',
        },
        (payload) => {
          const newActivity = payload.new as UniverseActivity;
          
          // If filtering by universe, only add if it matches
          if (universeId && newActivity.universe_id !== universeId) {
            return;
          }

          setRealtimeActivity((prev) => [newActivity, ...prev]);
          
          // Also invalidate the query to ensure consistency
          queryClient.invalidateQueries({ queryKey: ['universe-activity'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, universeId, queryClient]);

  // Combine cached and realtime activities
  const allActivities = [...realtimeActivity, ...(activities || [])];
  
  // Deduplicate by ID
  const uniqueActivities = allActivities.filter(
    (activity, index, self) => index === self.findIndex((a) => a.id === activity.id)
  );

  return {
    activities: uniqueActivities,
    isLoading,
  };
}
