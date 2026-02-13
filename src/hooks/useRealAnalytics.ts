import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RealAnalytics {
  // Project stats
  totalProjects: number;
  completedProjects: number;
  processingProjects: number;
  failedProjects: number;
  
  // Video stats
  totalClips: number;
  totalVideoDuration: number;
  averageClipsPerProject: number;
  
  // Credit stats
  creditsUsed: number;
  creditsThisMonth: number;
  creditsRemaining: number;
  
  // Engagement stats
  totalLikes: number;
  totalViews: number;
  publicVideos: number;
  
  // Trend data
  weeklyActivity: { date: string; clips: number; credits: number }[];
  modeDistribution: { mode: string; count: number }[];
  
  // Time-based
  lastVideoDate: string | null;
  memberSince: string;
}

export function useRealAnalytics() {
  const { user, profile } = useAuth();
  const [analytics, setAnalytics] = useState<RealAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch projects
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, created_at, updated_at, video_url, is_public, likes_count, mode')
        .eq('user_id', user.id);

      // Fetch video clips
      const { data: clips } = await supabase
        .from('video_clips')
        .select('id, status, duration_seconds, created_at')
        .eq('user_id', user.id);

      // Fetch credit transactions
      const { data: transactions } = await supabase
        .from('credit_transactions_safe')
        .select('amount, transaction_type, created_at')
        .eq('user_id', user.id);

      // Calculate stats
      const totalProjects = projects?.length || 0;
      const completedProjects = projects?.filter(p => p.status === 'completed').length || 0;
      const processingProjects = projects?.filter(p => 
        ['generating', 'rendering', 'stitching', 'producing'].includes(p.status)
      ).length || 0;
      const failedProjects = projects?.filter(p => 
        ['failed', 'stitching_failed'].includes(p.status)
      ).length || 0;

      const totalClips = clips?.filter(c => c.status === 'completed').length || 0;
      const totalVideoDuration = clips?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;
      const averageClipsPerProject = totalProjects > 0 ? Math.round(totalClips / totalProjects) : 0;

      const usageTransactions = transactions?.filter(t => t.transaction_type === 'usage') || [];
      const creditsUsed = Math.abs(usageTransactions.reduce((sum, t) => sum + t.amount, 0));
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const creditsThisMonth = Math.abs(
        usageTransactions
          .filter(t => new Date(t.created_at) >= startOfMonth)
          .reduce((sum, t) => sum + t.amount, 0)
      );

      const totalLikes = projects?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
      const publicVideos = projects?.filter(p => p.is_public && p.video_url).length || 0;

      // Weekly activity (last 7 days)
      const weeklyActivity: { date: string; clips: number; credits: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayClips = clips?.filter(c => {
          const created = new Date(c.created_at);
          return created >= dayStart && created <= dayEnd && c.status === 'completed';
        }).length || 0;

        const dayCredits = Math.abs(
          usageTransactions
            .filter(t => {
              const created = new Date(t.created_at);
              return created >= dayStart && created <= dayEnd;
            })
            .reduce((sum, t) => sum + t.amount, 0)
        );

        weeklyActivity.push({ date: dateStr, clips: dayClips, credits: dayCredits });
      }

      // Mode distribution
      const modeCounts: Record<string, number> = {};
      projects?.forEach(p => {
        const mode = (p.mode as string) || 'text-to-video';
        modeCounts[mode] = (modeCounts[mode] || 0) + 1;
      });
      const modeDistribution = Object.entries(modeCounts).map(([mode, count]) => ({ mode, count }));

      // Last video date
      const completedProjectDates = projects
        ?.filter(p => p.status === 'completed' && p.video_url)
        .map(p => new Date(p.updated_at))
        .sort((a, b) => b.getTime() - a.getTime());
      const lastVideoDate = completedProjectDates?.[0]?.toISOString() || null;

      setAnalytics({
        totalProjects,
        completedProjects,
        processingProjects,
        failedProjects,
        totalClips,
        totalVideoDuration,
        averageClipsPerProject,
        creditsUsed,
        creditsThisMonth,
        creditsRemaining: profile?.credits_balance || 0,
        totalLikes,
        totalViews: 0, // Would need a views table
        publicVideos,
        weeklyActivity,
        modeDistribution,
        lastVideoDate,
        memberSince: profile?.created_at || new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refetch: fetchAnalytics };
}
