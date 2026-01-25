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
  BarChart3, Clock, Star, Heart, Users, Medal,
  Eye, Lock
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

// Premium card styles - using design system tokens
const glassCard = "relative backdrop-blur-xl bg-card/80 border border-border shadow-lg";
const glassCardHover = "hover:bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300";
const darkCard = "relative bg-muted border border-border shadow-lg";
const darkCardHover = "hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300";

export default function Profile() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { stats: gamificationStats, xpProgress, leaderboard, leaderboardLoading, unlockedAchievements } = useGamification();
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

  const localUnlockedAchievements = ACHIEVEMENTS.filter(a => {
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
      <div className="min-h-screen bg-background">
        <AppHeader showCreate={false} />
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-80 rounded-3xl bg-muted" />
          <Skeleton className="h-32 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* === PREMIUM AMBIENT BACKGROUND - Matching Landing === */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Subtle gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />
        {/* Soft ambient glow - top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-foreground/[0.02] to-transparent blur-[100px]" />
        {/* Mesh gradient for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(var(--foreground-rgb),0.03)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(var(--foreground-rgb),0.02)_0%,_transparent_50%)]" />
      </div>

      {/* Video Picker Modal */}
      <Dialog open={showVideoPicker} onOpenChange={setShowVideoPicker}>
        <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Select Cover Video</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {loadingVideos ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl bg-muted" />)}
              </div>
            ) : userVideoClips.length === 0 ? (
              <div className="py-16 text-center">
                <Video className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No videos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {userVideoClips.map((clip, i) => (
                  <button
                    key={i}
                    onClick={() => { setCoverVideo(clip); setShowVideoPicker(false); toast.success('Cover updated'); }}
                    className={cn(
                      "relative aspect-video rounded-xl overflow-hidden transition-all",
                      coverVideo === clip ? 'ring-2 ring-foreground' : 'hover:ring-1 hover:ring-foreground/50'
                    )}
                  >
                    <video src={clip} className="w-full h-full object-cover" muted preload="metadata" />
                    {coverVideo === clip && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                        <Check className="w-3 h-3 text-background" />
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

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        
        {/* ═══════════════════════════════════════════════════════════════
            HERO PROFILE CARD - Premium Design matching Landing
        ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={cn("relative rounded-3xl overflow-hidden", darkCard)}
        >
          {/* Cover Background */}
          <div className="relative h-48 sm:h-56 overflow-hidden">
            {coverVideo ? (
              <>
                <video 
                  ref={coverVideoRef} 
                  src={coverVideo} 
                  className="absolute inset-0 w-full h-full object-cover scale-110" 
                  loop muted playsInline autoPlay 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <button 
                  onClick={() => setCoverVideo(null)} 
                  className="absolute top-4 right-4 w-10 h-10 rounded-full backdrop-blur-xl bg-foreground/10 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/20 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.08] via-transparent to-transparent" />
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-foreground/[0.03] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                <button
                  onClick={() => { fetchUserVideoClips(); setShowVideoPicker(true); }}
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-300 bg-background/20 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-xl bg-foreground/10 border border-border text-muted-foreground text-sm font-medium hover:bg-foreground/20 transition-all">
                    <Camera className="w-4 h-4" /> Add cover video
                  </div>
                </button>
              </>
            )}
            
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Profile Content */}
          <div className="relative px-6 sm:px-8 pb-8 -mt-20">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Avatar with Premium Styling */}
              <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-foreground/30 to-foreground/10 blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-32 h-32 rounded-2xl bg-muted border-4 border-muted shadow-lg flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-foreground flex items-center justify-center">
                      <User className="w-12 h-12 text-background" />
                    </div>
                  )}
                </div>
                {/* Level Badge */}
                <div className="absolute -bottom-2 -right-2 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-bold shadow-lg">
                  Lv.{level}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 pt-4 sm:pt-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    {profile?.display_name || profile?.full_name || 'Creator'}
                  </h1>
                  {streak > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/10 border border-border text-muted-foreground text-sm font-medium">
                      <Flame className="w-3.5 h-3.5 text-orange-400" /> {streak} day streak
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Joined {memberSince}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {followersCount || 0} followers
                  </span>
                </div>
                
                {/* XP Progress Bar */}
                <div className="mt-5 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground font-medium">Progress to Level {level + 1}</span>
                    <span className="text-muted-foreground/60">{xpProgress?.current || 0} / {xpProgress?.needed || 100} XP</span>
                  </div>
                  <div className="relative h-2.5 rounded-full overflow-hidden bg-muted border border-border">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${xpProgress?.percentage || 0}%` }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                      className="absolute inset-y-0 left-0 bg-foreground rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 sm:pt-6">
                <Button 
                  onClick={() => setShowBuyModal(true)} 
                  className="h-12 px-6 rounded-full bg-foreground text-background font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all border-0"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  {profile?.credits_balance?.toLocaleString() || 0}
                </Button>
                <Button 
                  onClick={() => navigate('/settings')} 
                  variant="ghost" 
                  className="h-12 w-12 rounded-full bg-foreground/10 border border-border text-muted-foreground hover:text-foreground hover:bg-foreground/20 transition-all"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════
            STATS GRID - Premium Transparent Cards
        ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Videos Created', value: metrics.totalVideosGenerated, icon: Video },
            { label: 'Projects', value: metrics.totalProjects, icon: FolderOpen },
            { label: 'Total XP', value: xpTotal.toLocaleString(), icon: Sparkles },
            { label: 'Followers', value: followersCount || 0, icon: Users },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
              className={cn("group relative p-5 rounded-2xl transition-all duration-300", glassCard, glassCardHover)}
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-foreground text-background shadow-lg">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              
              <p className="text-3xl font-bold text-foreground mt-4 tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════
            TAB NAVIGATION - Pill Style
        ═══════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center"
        >
          <div className={cn("inline-flex p-1.5 rounded-full", glassCard)}>
            {[
              { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
              { id: 'achievements' as TabType, label: 'Achievements', icon: Trophy, badge: localUnlockedAchievements.length },
              { id: 'activity' as TabType, label: 'Activity', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all rounded-full",
                  activeTab === tab.id
                    ? "bg-foreground text-background shadow-obsidian"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-semibold",
                    activeTab === tab.id ? "bg-background/20 text-background" : "bg-foreground/10 text-foreground"
                  )}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════════
            TAB CONTENT
        ═══════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.section
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Activity Chart - Dark Card */}
                <div className={cn("rounded-3xl overflow-hidden", darkCard)}>
                  <div className="p-5 border-b border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">Activity Overview</h3>
                          <p className="text-xs text-white/50">Last 14 days</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    {loadingMetrics ? (
                      <Skeleton className="h-32 bg-white/5 rounded-xl" />
                    ) : (
                      <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={dailyUsage}>
                          <defs>
                            <linearGradient id="chartGradientProfile" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="rgba(255,255,255,0.3)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} width={30} />
                          <Tooltip
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.9)', 
                              backdropFilter: 'blur(12px)',
                              border: '1px solid rgba(255,255,255,0.1)', 
                              borderRadius: '12px', 
                              fontSize: '12px',
                            }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Area type="monotone" dataKey="credits" stroke="rgba(255,255,255,0.6)" strokeWidth={2} fill="url(#chartGradientProfile)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Quick Actions - Premium Dark Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'New Project', icon: Plus, onClick: () => navigate('/create') },
                    { label: 'My Videos', icon: Video, onClick: () => navigate('/clips') },
                    { label: 'Buy Credits', icon: Coins, onClick: () => setShowBuyModal(true) },
                  ].map((action, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={action.onClick}
                      className={cn(
                        "group relative p-5 rounded-2xl transition-all overflow-hidden",
                        darkCard, darkCardHover
                      )}
                    >
                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <action.icon className="w-7 h-7 mb-3 text-white" />
                      <span className="text-sm font-semibold text-white">{action.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Leaderboard - Transparent Glass Card */}
                <div className={cn("rounded-2xl overflow-hidden", glassCard)}>
                  <div className="p-5 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">Leaderboard</h3>
                          <p className="text-xs text-muted-foreground">Top creators this week</p>
                        </div>
                      </div>
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        View all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    {leaderboardLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 rounded-xl bg-muted" />
                        ))}
                      </div>
                    ) : (leaderboard || []).length === 0 ? (
                      <div className="text-center py-12">
                        <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No rankings yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(leaderboard || []).slice(0, 5).map((entry, i) => {
                          const isCurrentUser = entry.user_id === user?.id;
                          
                          return (
                            <motion.div
                              key={entry.user_id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-xl transition-all border",
                                i === 0 ? "bg-foreground/5 border-foreground/20" : "bg-background/50 border-border/50",
                                isCurrentUser && "ring-1 ring-foreground/30"
                              )}
                            >
                              <div className="w-8 flex-shrink-0 text-center">
                                {i === 0 ? <Crown className="w-5 h-5 text-foreground mx-auto" /> :
                                 i === 1 ? <Medal className="w-5 h-5 text-muted-foreground mx-auto" /> :
                                 i === 2 ? <Medal className="w-5 h-5 text-muted-foreground mx-auto" /> :
                                 <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                              </div>
                              
                              <Avatar className={cn("h-10 w-10 border-2", i === 0 ? "border-foreground/30" : "border-border")}>
                                <AvatarImage src={entry.avatar_url || undefined} />
                                <AvatarFallback className="bg-foreground text-background text-sm font-medium">
                                  {entry.display_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">
                                  {entry.display_name || 'Anonymous'}
                                  {isCurrentUser && <span className="text-muted-foreground font-normal ml-1.5">(You)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">Level {entry.level}</p>
                              </div>
                              
                              <div className="text-right">
                                <p className={cn("font-bold tabular-nums", i === 0 ? "text-foreground" : "text-foreground/80")}>
                                  {entry.xp_total.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">XP</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                
                {/* Daily Challenges - Transparent Card */}
                <div className={cn("rounded-2xl overflow-hidden", glassCard)}>
                  <div className="p-5 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">Daily Challenges</h3>
                          <p className="text-xs text-muted-foreground">Reset in 8 hours</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2">
                    {DAILY_CHALLENGES.map((challenge, i) => {
                      const isComplete = challenge.progress >= challenge.target;
                      return (
                        <motion.div
                          key={challenge.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={cn(
                            "p-4 rounded-xl transition-all border",
                            isComplete 
                              ? "bg-emerald-500/10 border-emerald-500/30" 
                              : "bg-background/50 border-border/50 hover:bg-background/80"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              isComplete ? "bg-emerald-500/20" : "bg-foreground/5"
                            )}>
                              {isComplete ? (
                                <Check className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <challenge.icon className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={cn("text-sm font-medium", isComplete ? "text-emerald-600" : "text-foreground")}>
                                {challenge.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      isComplete ? "bg-emerald-500" : "bg-foreground"
                                    )}
                                    style={{ width: `${(challenge.progress / challenge.target) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{challenge.progress}/{challenge.target}</span>
                              </div>
                            </div>
                            <div className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold",
                              isComplete ? "bg-emerald-500 text-white" : "bg-foreground/10 text-foreground"
                            )}>
                              +{challenge.xp} XP
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats Summary - Transparent Card */}
                <div className={cn("rounded-2xl p-5", glassCard)}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground">Stats Summary</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { label: 'This Week', value: `${metrics.videosThisWeek} videos`, sub: `${metrics.creditsThisMonth} credits used`, icon: TrendingUp },
                      { label: 'Total Duration', value: formatDuration(metrics.totalVideoDuration), sub: 'Content created', icon: Clock },
                      { label: 'Completion Rate', value: `${metrics.totalProjects > 0 ? Math.round((metrics.completedProjects / metrics.totalProjects) * 100) : 0}%`, sub: `${metrics.completedProjects} of ${metrics.totalProjects}`, icon: Target },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-4 py-3 border-t border-border/50 first:border-t-0 first:pt-0">
                        <item.icon className="w-5 h-5 text-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'achievements' && (
            <motion.section
              key="achievements"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Unlocked Achievements */}
              {localUnlockedAchievements.length > 0 && (
                <div className={cn("rounded-2xl overflow-hidden", glassCard, "border-amber-500/20")}>
                  <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-amber-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Unlocked Achievements</h3>
                        <p className="text-sm text-white/50">{localUnlockedAchievements.length} achievements earned</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {localUnlockedAchievements.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="group relative p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 text-center hover:border-amber-500/40 transition-all"
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
                            <a.icon className="w-7 h-7 text-white" />
                          </div>
                          <p className="font-bold text-white">{a.name}</p>
                          <p className="text-xs text-white/50 mt-1">{a.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked Achievements */}
              <div className={cn("rounded-2xl overflow-hidden", glassCard)}>
                <div className="p-5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white/30" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Locked Achievements</h3>
                      <p className="text-sm text-white/50">{ACHIEVEMENTS.length - localUnlockedAchievements.length} remaining to unlock</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {ACHIEVEMENTS.filter(a => !localUnlockedAchievements.includes(a)).map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center opacity-60 hover:opacity-80 transition-all"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-3">
                        <a.icon className="w-7 h-7 text-white/30" />
                      </div>
                      <p className="font-bold text-white/60">{a.name}</p>
                      <p className="text-xs text-white/30 mt-1">{a.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'activity' && (
            <motion.section
              key="activity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className={cn("rounded-2xl overflow-hidden", glassCard)}>
                <div className="p-5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <History className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Recent Activity</h3>
                      <p className="text-xs text-white/40">Your transaction history</p>
                    </div>
                  </div>
                </div>
                
                <div className="divide-y divide-white/[0.04]">
                  {loadingTransactions ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-4">
                        <Skeleton className="h-12 bg-white/5 rounded-xl" />
                      </div>
                    ))
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-16">
                      <History className="w-12 h-12 text-white/15 mx-auto mb-3" />
                      <p className="text-white/40">No activity yet</p>
                    </div>
                  ) : (
                    transactions.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                          {getTransactionIcon(t.transaction_type, t.amount)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {t.description || (t.amount > 0 ? 'Credits added' : 'Credits used')}
                          </p>
                          <p className="text-xs text-white/40">{formatRelativeTime(t.created_at)}</p>
                        </div>
                        <div className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-bold",
                          t.amount > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.05] text-white/60"
                        )}>
                          {t.amount > 0 ? '+' : ''}{t.amount}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
}
