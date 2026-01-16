import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, Coins, History, Gift, ShoppingCart,
  Film, Zap, TrendingUp, Video, Timer, Crown,
  FolderOpen, Activity, Play, X, Check,
  Sparkles, Calendar, Settings, Camera, Trophy, 
  Flame, Target, Award, ChevronRight, Plus,
  BarChart3, Clock, Star, Heart
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { SignOutDialog } from '@/components/auth/SignOutDialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useGamification } from '@/hooks/useGamification';
import { useSocial } from '@/hooks/useSocial';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  clip_duration_seconds: number | null;
}

interface UserMetrics {
  totalProjects: number;
  completedProjects: number;
  totalVideosGenerated: number;
  totalVideoDuration: number;
  creditsThisMonth: number;
  videosThisWeek: number;
}

interface DailyUsage {
  date: string;
  credits: number;
}

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_video', name: 'First Light', desc: 'Generated your first video', icon: Sparkles, threshold: 1, type: 'videos' },
  { id: '10_videos', name: 'Rising Star', desc: 'Generated 10 videos', icon: Star, threshold: 10, type: 'videos' },
  { id: '50_videos', name: 'Content Machine', desc: 'Generated 50 videos', icon: Zap, threshold: 50, type: 'videos' },
  { id: '100_videos', name: 'Video Legend', desc: 'Generated 100 videos', icon: Crown, threshold: 100, type: 'videos' },
  { id: 'first_project', name: 'Story Begins', desc: 'Created your first project', icon: Film, threshold: 1, type: 'projects' },
  { id: '5_projects', name: 'Prolific Creator', desc: 'Created 5 projects', icon: FolderOpen, threshold: 5, type: 'projects' },
  { id: '10_completed', name: 'Finisher', desc: 'Completed 10 projects', icon: Trophy, threshold: 10, type: 'completed' },
  { id: 'power_user', name: 'Power User', desc: 'Used 1000+ credits', icon: Flame, threshold: 1000, type: 'credits' },
];

const DAILY_CHALLENGES = [
  { id: '1', description: 'Create a new video', xp: 50, progress: 0, target: 1, icon: Video },
  { id: '2', description: 'Like 3 videos', xp: 30, progress: 1, target: 3, icon: Heart },
  { id: '3', description: 'Share a creation', xp: 25, progress: 0, target: 1, icon: Star },
];

type TabType = 'overview' | 'achievements' | 'activity';

export default function Profile() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { stats: gamificationStats, xpProgress, leaderboard } = useGamification();
  const { followersCount, followingCount } = useSocial();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [coverVideo, setCoverVideo] = useState<string | null>(null);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [userVideoClips, setUserVideoClips] = useState<string[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const coverVideoRef = useRef<HTMLVideoElement>(null);
  
  const [metrics, setMetrics] = useState<UserMetrics>({
    totalProjects: 0,
    completedProjects: 0,
    totalVideosGenerated: 0,
    totalVideoDuration: 0,
    creditsThisMonth: 0,
    videosThisWeek: 0,
  });
  
  const navigate = useNavigate();
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
      fetchDailyUsage();
    }
  }, [user]);

  const fetchDailyUsage = async () => {
    if (!user) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data } = await supabase
      .from('credit_transactions')
      .select('amount, created_at, transaction_type')
      .eq('user_id', user.id)
      .eq('transaction_type', 'usage')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const dailyMap: Record<string, number> = {};
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[key] = 0;
    }

    (data || []).forEach(t => {
      const date = new Date(t.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyMap[key] !== undefined) {
        dailyMap[key] += Math.abs(t.amount);
      }
    });

    setDailyUsage(Object.entries(dailyMap).map(([date, credits]) => ({ date, credits })));
  };

  const fetchMetrics = async () => {
    if (!user) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, created_at')
        .eq('user_id', session.user.id);

      const { data: allTransactions } = await supabase
        .from('credit_transactions')
        .select('amount, clip_duration_seconds, created_at, transaction_type')
        .eq('user_id', session.user.id);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const videoTransactions = allTransactions?.filter(t => t.transaction_type === 'usage' && t.amount < 0) || [];
      
      setMetrics({
        totalProjects: projects?.length || 0,
        completedProjects: projects?.filter(p => p.status === 'completed').length || 0,
        totalVideosGenerated: videoTransactions.length,
        totalVideoDuration: videoTransactions.reduce((sum, t) => sum + (t.clip_duration_seconds || 0), 0),
        creditsThisMonth: Math.abs(allTransactions?.filter(t => t.transaction_type === 'usage' && new Date(t.created_at) >= startOfMonth).reduce((sum, t) => sum + t.amount, 0) || 0),
        videosThisWeek: videoTransactions.filter(t => new Date(t.created_at) >= startOfWeek).length,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (!error) setTransactions(data || []);
    setLoadingTransactions(false);
  };

  const fetchUserVideoClips = async () => {
    if (!user) return;
    setLoadingVideos(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoadingVideos(false); return; }
    
    try {
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('video_clips, video_url')
        .eq('user_id', session.user.id);
      
      const allClips: string[] = [];
      projects?.forEach(p => {
        if (p.video_clips && Array.isArray(p.video_clips)) allClips.push(...p.video_clips.filter(Boolean));
        if (p.video_url) allClips.push(p.video_url);
      });
      
      setUserVideoClips([...new Set(allClips)]);
    } catch (error) {
      console.error('Error fetching video clips:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
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

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  const level = gamificationStats?.level || 1;
  const xpTotal = gamificationStats?.xp_total || 0;
  const streak = gamificationStats?.current_streak || 0;

  const unlockedAchievements = ACHIEVEMENTS.filter(a => {
    switch (a.type) {
      case 'videos': return metrics.totalVideosGenerated >= a.threshold;
      case 'projects': return metrics.totalProjects >= a.threshold;
      case 'completed': return metrics.completedProjects >= a.threshold;
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
      <div className="min-h-screen bg-black">
        <AppHeader showCreate={false} />
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-72 rounded-3xl bg-white/5" />
          <Skeleton className="h-24 rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-white/[0.02] to-transparent blur-3xl" />
      </div>

      {/* Video Picker Modal */}
      <Dialog open={showVideoPicker} onOpenChange={setShowVideoPicker}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Select Cover Video</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {loadingVideos ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg bg-white/5" />)}
              </div>
            ) : userVideoClips.length === 0 ? (
              <div className="py-16 text-center">
                <Video className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40">No videos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {userVideoClips.map((clip, i) => (
                  <button
                    key={i}
                    onClick={() => { setCoverVideo(clip); setShowVideoPicker(false); toast.success('Cover updated'); }}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden transition-all",
                      coverVideo === clip ? 'ring-2 ring-white' : 'hover:ring-1 hover:ring-white/50'
                    )}
                  >
                    <video src={clip} className="w-full h-full object-cover" muted preload="metadata" />
                    {coverVideo === clip && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-3 h-3 text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AppHeader showCreate={false} />

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: HERO PROFILE CARD
        ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden bg-zinc-900/80 border border-white/[0.08]"
        >
          {/* Cover Background */}
          <div className="relative h-40 sm:h-48 bg-gradient-to-br from-zinc-800 to-zinc-900">
            {coverVideo ? (
              <>
                <video ref={coverVideoRef} src={coverVideo} className="absolute inset-0 w-full h-full object-cover" loop muted playsInline autoPlay />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
                <button onClick={() => setCoverVideo(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-700/30 via-zinc-900 to-zinc-900" />
                <button
                  onClick={() => { fetchUserVideoClips(); setShowVideoPicker(true); }}
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30"
                >
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm">
                    <Camera className="w-4 h-4" /> Add cover
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Profile Content */}
          <div className="relative px-6 pb-6 -mt-16">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Avatar */}
              <div className="relative">
                <div className="w-28 h-28 rounded-2xl bg-zinc-800 border-4 border-zinc-900 shadow-xl flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-white/30" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-xs font-bold text-white shadow-lg">
                  Lv.{level}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 pt-2">
                <h1 className="text-2xl font-bold text-white">
                  {profile?.display_name || profile?.full_name || 'Creator'}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-white/40">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Joined {memberSince}
                  </span>
                  {streak > 0 && (
                    <span className="flex items-center gap-1 text-orange-400">
                      <Flame className="w-3.5 h-3.5" /> {streak} day streak
                    </span>
                  )}
                </div>
                
                {/* XP Progress */}
                <div className="mt-4 max-w-xs">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-white/50">{xpProgress?.current || 0} XP</span>
                    <span className="text-white/30">{xpProgress?.needed || 100} XP to Lv.{level + 1}</span>
                  </div>
                  <Progress value={xpProgress?.percentage || 0} className="h-2 bg-white/[0.08]" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 sm:pt-2">
                <Button onClick={() => setShowBuyModal(true)} className="h-11 px-5 rounded-xl bg-white text-black font-semibold hover:bg-white/90">
                  <Coins className="w-4 h-4 mr-2" />
                  {profile?.credits_balance?.toLocaleString() || 0}
                </Button>
                <Button onClick={() => navigate('/settings')} variant="ghost" className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white">
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: QUICK STATS BAR
        ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { label: 'Videos', value: metrics.totalVideosGenerated, icon: Video, color: 'text-blue-400' },
            { label: 'Projects', value: metrics.totalProjects, icon: FolderOpen, color: 'text-purple-400' },
            { label: 'XP Total', value: xpTotal.toLocaleString(), icon: Sparkles, color: 'text-amber-400' },
            { label: 'Followers', value: followersCount || 0, icon: User, color: 'text-pink-400' },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/40">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: TAB NAVIGATION
        ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-1 border-b border-white/[0.06] pb-1"
        >
          {[
            { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
            { id: 'achievements' as TabType, label: 'Achievements', icon: Trophy, badge: unlockedAchievements.length },
            { id: 'activity' as TabType, label: 'Activity', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all rounded-t-xl",
                activeTab === tab.id
                  ? "text-white bg-white/[0.05] border-b-2 border-white"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">{tab.badge}</span>
              )}
            </button>
          ))}
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4: TAB CONTENT
        ═══════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Usage Chart */}
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-white/40" />
                      <span className="font-medium text-white">Activity Overview</span>
                    </div>
                    <span className="text-xs text-white/30">Last 14 days</span>
                  </div>
                  
                  {loadingMetrics ? (
                    <Skeleton className="h-32 bg-white/5 rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={dailyUsage}>
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fff" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.1)" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                        <YAxis stroke="rgba(255,255,255,0.1)" fontSize={10} tickLine={false} axisLine={false} width={30} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="credits" stroke="rgba(255,255,255,0.5)" strokeWidth={2} fill="url(#chartGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'New Project', icon: Plus, onClick: () => navigate('/create'), gradient: 'from-blue-600 to-cyan-600' },
                    { label: 'My Videos', icon: Video, onClick: () => navigate('/clips'), gradient: 'from-purple-600 to-pink-600' },
                    { label: 'Buy Credits', icon: Coins, onClick: () => setShowBuyModal(true), gradient: 'from-amber-600 to-orange-600' },
                  ].map((action, i) => (
                    <button
                      key={i}
                      onClick={action.onClick}
                      className={cn(
                        "group p-4 rounded-2xl text-white transition-all hover:scale-[1.02]",
                        `bg-gradient-to-br ${action.gradient}`
                      )}
                    >
                      <action.icon className="w-6 h-6 mb-2" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>

                {/* Leaderboard Preview */}
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] overflow-hidden">
                  <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <span className="font-medium text-white">Leaderboard</span>
                    </div>
                    <button className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {(leaderboard || []).slice(0, 3).map((entry, i) => (
                      <div key={entry.user_id} className={cn(
                        "flex items-center gap-4 px-4 py-3",
                        entry.user_id === user?.id && "bg-white/[0.03]"
                      )}>
                        <span className={cn(
                          "w-6 text-center font-bold",
                          i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-white/30"
                        )}>
                          {i + 1}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-white/50">
                          {entry.display_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {entry.display_name || 'Anonymous'}
                            {entry.user_id === user?.id && <span className="text-white/40 ml-1">(You)</span>}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-white">{entry.xp_total.toLocaleString()} XP</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-6">
                
                {/* Daily Challenges */}
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] overflow-hidden">
                  <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-amber-400" />
                      <span className="font-medium text-white">Daily Challenges</span>
                    </div>
                    <span className="text-xs text-white/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 8h left
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {DAILY_CHALLENGES.map((challenge) => {
                      const isComplete = challenge.progress >= challenge.target;
                      return (
                        <div key={challenge.id} className={cn(
                          "p-3 rounded-xl",
                          isComplete ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/[0.02]"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              isComplete ? "bg-emerald-500/20" : "bg-white/[0.05]"
                            )}>
                              <challenge.icon className={cn("w-4 h-4", isComplete ? "text-emerald-400" : "text-white/40")} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-white">{challenge.description}</p>
                              <Progress value={(challenge.progress / challenge.target) * 100} className="h-1 mt-1.5 bg-white/[0.08]" />
                            </div>
                            <span className={cn(
                              "text-xs font-semibold px-2 py-1 rounded-lg",
                              isComplete ? "bg-emerald-500 text-white" : "bg-amber-500/20 text-amber-400"
                            )}>
                              +{challenge.xp}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats Summary */}
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4 space-y-4">
                  <h3 className="font-medium text-white">Stats Summary</h3>
                  {[
                    { label: 'This Week', value: `${metrics.videosThisWeek} videos`, sub: `${metrics.creditsThisMonth} credits used` },
                    { label: 'Total Duration', value: formatDuration(metrics.totalVideoDuration), sub: 'Content created' },
                    { label: 'Completion Rate', value: `${metrics.totalProjects > 0 ? Math.round((metrics.completedProjects / metrics.totalProjects) * 100) : 0}%`, sub: `${metrics.completedProjects} of ${metrics.totalProjects}` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-t border-white/[0.04] first:border-t-0 first:pt-0">
                      <div>
                        <p className="text-sm text-white">{item.value}</p>
                        <p className="text-xs text-white/40">{item.label}</p>
                      </div>
                      <p className="text-xs text-white/30">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'achievements' && (
            <motion.section
              key="achievements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Unlocked */}
              {unlockedAchievements.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-zinc-900/60 border border-amber-500/20 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Unlocked</h3>
                      <p className="text-xs text-white/40">{unlockedAchievements.length} achievements earned</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {unlockedAchievements.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 rounded-xl bg-black/30 border border-amber-500/30 text-center"
                      >
                        <a.icon className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                        <p className="font-semibold text-white text-sm">{a.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">{a.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked */}
              <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                    <Award className="w-5 h-5 text-white/40" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Locked</h3>
                    <p className="text-xs text-white/40">{ACHIEVEMENTS.length - unlockedAchievements.length} remaining</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ACHIEVEMENTS.filter(a => !unlockedAchievements.includes(a)).map((a, i) => (
                    <div key={a.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center opacity-50">
                      <a.icon className="w-8 h-8 text-white/30 mx-auto mb-2" />
                      <p className="font-semibold text-white/50 text-sm">{a.name}</p>
                      <p className="text-xs text-white/30 mt-0.5">{a.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'activity' && (
            <motion.section
              key="activity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] overflow-hidden"
            >
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
                <History className="w-5 h-5 text-white/40" />
                <span className="font-medium text-white">Recent Transactions</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {loadingTransactions ? (
                  [...Array(5)].map((_, i) => <div key={i} className="px-4 py-4"><Skeleton className="h-10 bg-white/5 rounded-lg" /></div>)
                ) : transactions.length === 0 ? (
                  <div className="py-16 text-center">
                    <History className="w-10 h-10 text-white/15 mx-auto mb-3" />
                    <p className="text-white/40">No activity yet</p>
                  </div>
                ) : (
                  transactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between px-4 py-4 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", tx.amount >= 0 ? "bg-emerald-500/10" : "bg-white/[0.05]")}>
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">
                            {tx.description || (tx.transaction_type === 'bonus' ? 'Bonus' : tx.transaction_type === 'purchase' ? 'Purchase' : 'Video Generation')}
                          </p>
                          <p className="text-xs text-white/40">{formatRelativeTime(tx.created_at)}</p>
                        </div>
                      </div>
                      <span className={cn("font-bold text-sm", tx.amount >= 0 ? 'text-emerald-400' : 'text-white/50')}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} onPurchaseComplete={() => { refreshProfile(); fetchTransactions(); setShowBuyModal(false); }} />
    </div>
  );
}
