import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserGamification {
  id: string;
  user_id: string;
  xp_total: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  videos_created: number;
  videos_completed: number;
  total_views: number;
  total_likes_received: number;
  characters_created: number;
  characters_lent: number;
  universes_joined: number;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
  requirement_type: string;
  requirement_value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievements?: Achievement;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  xp_total: number;
  level: number;
  current_streak: number;
  videos_created: number;
  total_likes_received: number;
  followers_count: number;
  rank: number;
}

export function useGamification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's gamification stats with timeout and fallback
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['gamification', user?.id],
    queryFn: async (): Promise<UserGamification | null> => {
      if (!user) return null;
      
      try {
        // Add timeout to prevent indefinite hanging
        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
          setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 8000);
        });
        
        const fetchPromise = supabase
          .from('user_gamification')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (result.error) {
          // Log but don't throw - return fallback data
          console.warn('[useGamification] Stats fetch error:', result.error.message);
          return createFallbackStats(user.id);
        }
        
        return result.data as UserGamification | null;
      } catch (err) {
        console.warn('[useGamification] Unexpected error:', err);
        return createFallbackStats(user.id);
      }
    },
    enabled: !!user,
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Fallback stats creator to prevent null crashes
  function createFallbackStats(userId: string): UserGamification {
    return {
      id: 'fallback',
      user_id: userId,
      xp_total: 0,
      level: 1,
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null,
      videos_created: 0,
      videos_completed: 0,
      total_views: 0,
      total_likes_received: 0,
      characters_created: 0,
      characters_lent: 0,
      universes_joined: 0,
    };
  }

  // Fetch all achievements
  const { data: achievements } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      return data as Achievement[];
    },
  });

  // Fetch user's unlocked achievements
  const { data: unlockedAchievements } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*, achievements(*)')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserAchievement[];
    },
    enabled: !!user,
  });

  // Fetch leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(100);
      
      if (error) throw error;
      return data as LeaderboardEntry[];
    },
  });

  // Add XP mutation
  const addXp = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.rpc('add_user_xp', {
        p_user_id: user.id,
        p_xp_amount: amount,
        p_reason: reason || 'activity',
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  // Update streak mutation
  const updateStreak = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.rpc('update_user_streak', {
        p_user_id: user.id,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification', user?.id] });
    },
  });

  // Calculate XP needed for next level
  const xpForLevel = (level: number) => Math.floor(50 * Math.pow(level, 2));
  const xpProgress = stats ? {
    current: stats.xp_total - xpForLevel(stats.level - 1),
    needed: xpForLevel(stats.level) - xpForLevel(stats.level - 1),
    percentage: ((stats.xp_total - xpForLevel(stats.level - 1)) / (xpForLevel(stats.level) - xpForLevel(stats.level - 1))) * 100,
  } : null;

  return {
    stats,
    statsLoading,
    achievements,
    unlockedAchievements,
    leaderboard,
    leaderboardLoading,
    addXp,
    updateStreak,
    xpProgress,
  };
}
