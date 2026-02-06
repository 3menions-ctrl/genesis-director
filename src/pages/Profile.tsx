/**
 * Profile Page - Redesigned with Projects page theme
 * Fun-focused with condensed layout, analytics and settings in separate tabs
 */

import { useState, useEffect, memo, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, Coins, Gift, ShoppingCart,
  Zap, Video, Crown, Sparkles, Trophy, 
  Flame, Target, Award, ChevronRight, Plus,
  Star, Heart, Users, Medal, Settings,
  BarChart3, MessageCircle, TrendingUp, Clock,
  Calendar, Camera, Edit2
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useGamification } from '@/hooks/useGamification';
import { useSocial } from '@/hooks/useSocial';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRealAnalytics } from '@/hooks/useRealAnalytics';
import { RealAnalyticsCards } from '@/components/analytics/RealAnalyticsCards';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { MessagesInbox } from '@/components/social/MessagesInbox';
import { ProjectsBackground } from '@/components/projects';

// Glass card styles matching Projects page
const glassCard = "relative backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl";
const glassCardHover = "hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300";

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_video', name: 'First Light', desc: 'Generated your first video', icon: Sparkles, threshold: 1, type: 'videos' },
  { id: '10_videos', name: 'Rising Star', desc: 'Generated 10 videos', icon: Star, threshold: 10, type: 'videos' },
  { id: '50_videos', name: 'Content Machine', desc: 'Generated 50 videos', icon: Zap, threshold: 50, type: 'videos' },
  { id: '100_videos', name: 'Video Legend', desc: 'Generated 100 videos', icon: Crown, threshold: 100, type: 'videos' },
  { id: 'power_user', name: 'Power User', desc: 'Used 1000+ credits', icon: Flame, threshold: 1000, type: 'credits' },
];

type TabType = 'overview' | 'analytics' | 'settings';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

interface UserMetrics {
  totalProjects: number;
  completedProjects: number;
  totalVideosGenerated: number;
  totalVideoDuration: number;
}

// Main content component
const ProfileContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function ProfileContent(_, ref) {
  const { navigate } = useSafeNavigation();
  const { user, profile, loading, refreshProfile } = useAuth();
  const { stats: gamificationStats, xpProgress, leaderboard, leaderboardLoading } = useGamification();
  const { followersCount, followingCount } = useSocial();
  
  let analyticsData: any = { analytics: null, loading: false };
  try {
    analyticsData = useRealAnalytics();
  } catch {
    console.warn('[Profile] useRealAnalytics failed, using fallback');
  }
  const { analytics, loading: analyticsLoading } = analyticsData;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [metrics, setMetrics] = useState<UserMetrics>({
    totalProjects: 0,
    completedProjects: 0,
    totalVideosGenerated: 0,
    totalVideoDuration: 0,
  });
  
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const creditsAdded = searchParams.get('credits');
    
    if (paymentStatus === 'success') {
      toast.success(`Payment successful! ${creditsAdded ? `${creditsAdded} credits` : 'Credits'} added.`);
      refreshProfile();
      fetchTransactions();
      fetchMetrics();
      setSearchParams({});
    } else if (paymentStatus === 'canceled') {
      toast.info('Payment was canceled');
      setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchMetrics();
    }
  }, [user]);

  const fetchMetrics = async () => {
    if (!user) return;
    
    try {
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status')
        .eq('user_id', user.id);

      const { data: allTransactions } = await supabase
        .from('credit_transactions')
        .select('amount, clip_duration_seconds, transaction_type')
        .eq('user_id', user.id);

      const videoTransactions = allTransactions?.filter(t => t.transaction_type === 'usage' && t.amount < 0) || [];
      
      setMetrics({
        totalProjects: projects?.length || 0,
        completedProjects: projects?.filter(p => p.status === 'completed').length || 0,
        totalVideosGenerated: videoTransactions.length,
        totalVideoDuration: videoTransactions.reduce((sum, t) => sum + (t.clip_duration_seconds || 0), 0),
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error) setTransactions(data || []);
    setLoadingTransactions(false);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const level = gamificationStats?.level || 1;
  const xpTotal = gamificationStats?.xp_total || 0;
  const streak = gamificationStats?.current_streak || 0;

  const unlockedAchievements = ACHIEVEMENTS.filter(a => {
    switch (a.type) {
      case 'videos': return metrics.totalVideosGenerated >= a.threshold;
      case 'credits': return (profile?.total_credits_used || 0) >= a.threshold;
      default: return false;
    }
  });

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-blue-400" />;
    if (amount < 0) return <Zap className="w-4 h-4 text-amber-400" />;
    return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303]">
        <ProjectsBackground />
        <AppHeader />
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-48 rounded-3xl bg-white/[0.03]" />
          <Skeleton className="h-32 rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="min-h-screen bg-[#030303] text-white overflow-hidden">
      {/* Projects page background */}
      <ProjectsBackground />

      <AppHeader />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* ═══════════════════════════════════════════════════════════════
            COMPACT PROFILE HERO - Matching Projects page style
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative px-5 py-6 rounded-2xl overflow-hidden animate-fade-in">
          {/* Gradient accents */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.04] via-transparent to-amber-500/[0.02]" />
          <div className="absolute inset-0 rounded-2xl border border-white/[0.06]" />
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl" />
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative group">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 opacity-60 blur-md group-hover:opacity-80 transition-opacity" />
              <Avatar className="relative w-20 h-20 ring-2 ring-white/20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-black text-2xl font-bold">
                  {profile?.display_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white truncate">
                  {profile?.display_name || 'Creator'}
                </h1>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30">
                  <Crown className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-orange-300">Level {level}</span>
                </div>
              </div>
              
              {/* XP Progress */}
              <div className="flex items-center gap-3 mb-3">
                <Progress value={xpProgress?.percentage || 0} className="h-1.5 flex-1 max-w-48 bg-white/10" />
                <span className="text-xs text-white/40">{xpTotal} XP</span>
              </div>
              
              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-white/40" />
                  <span className="text-white font-medium">{followersCount}</span>
                  <span className="text-white/40">followers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-white/40" />
                  <span className="text-white font-medium">{followingCount}</span>
                  <span className="text-white/40">following</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-white font-medium">{streak}</span>
                  <span className="text-white/40">day streak</span>
                </div>
              </div>
            </div>
            
            {/* Credits */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-xl font-bold text-white">{profile?.credits_balance || 0}</span>
                <span className="text-xs text-white/40">credits</span>
              </div>
              <Button
                onClick={() => setShowBuyModal(true)}
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Buy Credits
              </Button>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            TAB NAVIGATION - Pill Style
        ═══════════════════════════════════════════════════════════════ */}
        <section className="flex items-center justify-center animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex p-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
            {[
              { id: 'overview' as TabType, label: 'Overview', icon: Sparkles },
              { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
              { id: 'settings' as TabType, label: 'Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all rounded-full",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-lg shadow-orange-500/20"
                    : "text-white/40 hover:text-white hover:bg-white/[0.05]"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            TAB CONTENT
        ═══════════════════════════════════════════════════════════════ */}
        
        {/* OVERVIEW TAB - Fun focused */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'New Project', icon: Plus, onClick: () => navigate('/create'), gradient: 'from-orange-500 to-amber-500' },
                { label: 'My Videos', icon: Video, onClick: () => navigate('/clips'), gradient: 'from-purple-500 to-indigo-500' },
                { label: 'Leaderboard', icon: Trophy, onClick: () => {}, gradient: 'from-emerald-500 to-teal-500' },
                { label: 'Discover', icon: Star, onClick: () => navigate('/discover'), gradient: 'from-sky-500 to-cyan-500' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={cn("group relative p-4 rounded-xl overflow-hidden transition-all", glassCard, glassCardHover)}
                >
                  <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-60", action.gradient)} />
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-gradient-to-br shadow-lg", action.gradient)}>
                    <action.icon className="w-4 h-4 text-black" />
                  </div>
                  <span className="text-sm font-medium text-white">{action.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Achievements & Leaderboard */}
              <div className="lg:col-span-2 space-y-6">
                {/* Achievements */}
                <div className={cn("p-5", glassCard)}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Achievements</h3>
                        <p className="text-xs text-white/40">{unlockedAchievements.length}/{ACHIEVEMENTS.length} unlocked</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ACHIEVEMENTS.map((achievement) => {
                      const isUnlocked = unlockedAchievements.some(a => a.id === achievement.id);
                      return (
                        <div
                          key={achievement.id}
                          className={cn(
                            "relative p-3 rounded-xl border transition-all",
                            isUnlocked 
                              ? "bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30" 
                              : "bg-white/[0.02] border-white/[0.06] opacity-50"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                            isUnlocked ? "bg-gradient-to-br from-orange-500 to-amber-500" : "bg-white/10"
                          )}>
                            <achievement.icon className={cn("w-4 h-4", isUnlocked ? "text-black" : "text-white/40")} />
                          </div>
                          <p className="text-xs font-medium text-white truncate">{achievement.name}</p>
                          <p className="text-[10px] text-white/40 truncate">{achievement.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leaderboard */}
                <div className={cn("p-5", glassCard)}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                        <Medal className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Top Creators</h3>
                        <p className="text-xs text-white/40">This week</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {leaderboardLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-xl bg-white/[0.03]" />
                      ))
                    ) : (leaderboard || []).length === 0 ? (
                      <div className="text-center py-8">
                        <Trophy className="w-8 h-8 text-white/20 mx-auto mb-2" />
                        <p className="text-sm text-white/40">No rankings yet</p>
                      </div>
                    ) : (
                      (leaderboard || []).slice(0, 5).map((entry, i) => {
                        const isCurrentUser = entry.user_id === user?.id;
                        return (
                          <div
                            key={entry.user_id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all border",
                              i === 0 ? "bg-white/[0.04] border-orange-500/20" : "bg-white/[0.02] border-white/[0.06]",
                              isCurrentUser && "ring-1 ring-orange-500/30"
                            )}
                          >
                            <div className="w-6 text-center">
                              {i === 0 ? <Crown className="w-4 h-4 text-orange-400 mx-auto" /> :
                               i === 1 ? <Medal className="w-4 h-4 text-white/60 mx-auto" /> :
                               i === 2 ? <Medal className="w-4 h-4 text-amber-700 mx-auto" /> :
                               <span className="text-xs font-bold text-white/40">#{i + 1}</span>}
                            </div>
                            
                            <Avatar className={cn("h-9 w-9 border", i === 0 ? "border-orange-500/30" : "border-white/10")}>
                              <AvatarImage src={entry.avatar_url || undefined} />
                              <AvatarFallback className="bg-white/10 text-white text-xs">
                                {entry.display_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{entry.display_name || 'Creator'}</p>
                              <p className="text-xs text-white/40">{entry.xp_total?.toLocaleString()} XP</p>
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-orange-400">
                              <Flame className="w-3 h-3" />
                              <span>{entry.current_streak || 0}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Messages & Recent Activity */}
              <div className="space-y-6">
                {/* Messages */}
                <MessagesInbox className="h-auto" />
                
                {/* Recent Credits */}
                <div className={cn("p-5", glassCard)}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Recent Activity</h3>
                      <p className="text-xs text-white/40">Credit transactions</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {loadingTransactions ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded-lg bg-white/[0.03]" />
                      ))
                    ) : transactions.length === 0 ? (
                      <p className="text-sm text-white/40 text-center py-4">No transactions yet</p>
                    ) : (
                      transactions.slice(0, 4).map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{tx.description || tx.transaction_type}</p>
                            <p className="text-[10px] text-white/40">{formatRelativeTime(tx.created_at)}</p>
                          </div>
                          <span className={cn(
                            "text-sm font-medium",
                            tx.amount > 0 ? "text-emerald-400" : "text-white/60"
                          )}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fade-in">
            <RealAnalyticsCards analytics={analytics} loading={analyticsLoading} />
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Projects', value: metrics.totalProjects, icon: Video, gradient: 'from-purple-500 to-indigo-500' },
                { label: 'Completed', value: metrics.completedProjects, icon: Target, gradient: 'from-emerald-500 to-teal-500' },
                { label: 'Videos Generated', value: metrics.totalVideosGenerated, icon: Zap, gradient: 'from-orange-500 to-amber-500' },
                { label: 'Credits Used', value: profile?.total_credits_used || 0, icon: Coins, gradient: 'from-sky-500 to-cyan-500' },
              ].map((stat, i) => (
                <div key={i} className={cn("p-4", glassCard)}>
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br", stat.gradient)}>
                    <stat.icon className="w-4 h-4 text-black" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/40">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Credit History */}
            <div className={cn("p-5", glassCard)}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Credit History</h3>
                  <p className="text-xs text-white/40">Your recent transactions</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {loadingTransactions ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.03]" />
                  ))
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">No transactions yet</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{tx.description || tx.transaction_type}</p>
                        <p className="text-xs text-white/40">{formatRelativeTime(tx.created_at)}</p>
                      </div>
                      <span className={cn(
                        "text-lg font-semibold",
                        tx.amount > 0 ? "text-emerald-400" : "text-white/60"
                      )}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in">
            {/* Profile Settings */}
            <div className={cn("p-5", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Profile Settings</h3>
                  <p className="text-xs text-white/40">Manage your account</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <p className="text-sm font-medium text-white">Display Name</p>
                    <p className="text-xs text-white/40">{profile?.display_name || 'Not set'}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <p className="text-sm font-medium text-white">Email</p>
                    <p className="text-xs text-white/40">{user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <p className="text-sm font-medium text-white">Member Since</p>
                    <p className="text-xs text-white/40">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Tier */}
            <div className={cn("p-5", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Account Tier</h3>
                  <p className="text-xs text-white/40">Your current plan</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-white capitalize">Free</p>
                    <p className="text-sm text-white/40">
                      {profile?.credits_balance || 0} credits available
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowBuyModal(true)}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold"
                  >
                    Upgrade
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal} 
      />
    </div>
  );
}));

// Page export with error boundary
function Profile() {
  return (
    <ErrorBoundary>
      <ProfileContent />
    </ErrorBoundary>
  );
}

export default Profile;
