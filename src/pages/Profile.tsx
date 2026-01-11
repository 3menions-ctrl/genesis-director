import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, Coins, History, Gift, ShoppingCart,
  Film, Clock, Zap, TrendingUp, ChevronRight,
  Video, Target, BarChart3, Timer, Crown,
  FolderOpen, CheckCircle2, Layers, Award, Star,
  PieChart as PieChartIcon, Activity, Play, X, Check,
  Sparkles, Calendar, ArrowUpRight, Settings, LogOut,
  Camera, Edit3, Trophy, Flame, Shield, Gem
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
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
  draftProjects: number;
  inProgressProjects: number;
  totalVideosGenerated: number;
  totalVideoDuration: number;
  avgCreditsPerVideo: number;
  creditsThisMonth: number;
  creditsLastMonth: number;
  mostUsedGenre: string;
  projectsThisMonth: number;
  lastActivityDate: string | null;
  videosThisWeek: number;
}

interface DailyUsage {
  date: string;
  credits: number;
  videos: number;
}

interface GenreData {
  name: string;
  value: number;
  color: string;
}

const GENRE_COLORS: Record<string, string> = {
  action: '#ef4444',
  drama: '#a1a1aa',
  comedy: '#fbbf24',
  thriller: '#6b7280',
  scifi: '#60a5fa',
  fantasy: '#c084fc',
  romance: '#f472b6',
  horror: '#374151',
  documentary: '#4ade80',
  adventure: '#fb923c',
  ad: '#60a5fa',
  educational: '#22d3ee',
  cinematic: '#a1a1aa',
  funny: '#fbbf24',
  religious: '#f59e0b',
  motivational: '#34d399',
  storytelling: '#a1a1aa',
  explainer: '#818cf8',
  vlog: '#f472b6',
};

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

export default function Profile() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [genreData, setGenreData] = useState<GenreData[]>([]);
  const [coverVideo, setCoverVideo] = useState<string | null>(null);
  const [isPlayingCover, setIsPlayingCover] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [userVideoClips, setUserVideoClips] = useState<string[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'achievements'>('overview');
  const coverVideoRef = useRef<HTMLVideoElement>(null);
  const [metrics, setMetrics] = useState<UserMetrics>({
    totalProjects: 0,
    completedProjects: 0,
    draftProjects: 0,
    inProgressProjects: 0,
    totalVideosGenerated: 0,
    totalVideoDuration: 0,
    avgCreditsPerVideo: 0,
    creditsThisMonth: 0,
    creditsLastMonth: 0,
    mostUsedGenre: 'None',
    projectsThisMonth: 0,
    lastActivityDate: null,
    videosThisWeek: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchMetrics();
      fetchDailyUsage();
      fetchGenreData();
    }
  }, [user]);

  const fetchDailyUsage = async () => {
    if (!user) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data } = await supabase
      .from('credit_transactions')
      .select('amount, created_at, clip_duration_seconds, transaction_type')
      .eq('user_id', user.id)
      .eq('transaction_type', 'usage')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const dailyMap: Record<string, { credits: number; videos: number }> = {};
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[key] = { credits: 0, videos: 0 };
    }

    (data || []).forEach(t => {
      const date = new Date(t.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyMap[key]) {
        dailyMap[key].credits += Math.abs(t.amount);
        if (t.clip_duration_seconds) {
          dailyMap[key].videos += 1;
        }
      }
    });

    setDailyUsage(
      Object.entries(dailyMap).map(([date, data]) => ({
        date,
        credits: data.credits,
        videos: data.videos
      }))
    );
  };

  const fetchGenreData = async () => {
    if (!user) return;
    
    // Verify session before querying
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data } = await supabase
      .from('movie_projects')
      .select('genre')
      .eq('user_id', session.user.id);

    const genreCounts: Record<string, number> = {};
    (data || []).forEach(p => {
      if (p.genre) {
        genreCounts[p.genre] = (genreCounts[p.genre] || 0) + 1;
      }
    });

    setGenreData(
      Object.entries(genreCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: GENRE_COLORS[name] || '#a1a1aa'
      }))
    );
  };

  const fetchMetrics = async () => {
    if (!user) return;
    
    try {
      // Verify session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, genre, created_at, video_clips')
        .eq('user_id', session.user.id);

      const { data: allTransactions } = await supabase
        .from('credit_transactions')
        .select('amount, clip_duration_seconds, created_at, transaction_type')
        .eq('user_id', session.user.id);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const totalProjects = projects?.length || 0;
      const completedProjects = projects?.filter(p => p.status === 'completed').length || 0;
      const draftProjects = projects?.filter(p => p.status === 'draft' || p.status === 'idle').length || 0;
      const inProgressProjects = projects?.filter(p => p.status === 'in_progress' || p.status === 'generating').length || 0;

      const genreCounts: Record<string, number> = {};
      projects?.forEach(p => {
        if (p.genre) {
          genreCounts[p.genre] = (genreCounts[p.genre] || 0) + 1;
        }
      });
      const mostUsedGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      const videoTransactions = allTransactions?.filter(t => t.transaction_type === 'usage' && t.amount < 0) || [];
      const totalVideosGenerated = videoTransactions.length;
      const totalVideoDuration = videoTransactions.reduce((sum, t) => sum + (t.clip_duration_seconds || 0), 0);
      const avgCreditsPerVideo = totalVideosGenerated > 0 
        ? Math.round(Math.abs(videoTransactions.reduce((sum, t) => sum + t.amount, 0)) / totalVideosGenerated)
        : 0;

      const videosThisWeek = videoTransactions.filter(t => new Date(t.created_at) >= startOfWeek).length;

      const creditsThisMonth = Math.abs(
        allTransactions
          ?.filter(t => t.transaction_type === 'usage' && new Date(t.created_at) >= startOfMonth)
          .reduce((sum, t) => sum + t.amount, 0) || 0
      );
      const creditsLastMonth = Math.abs(
        allTransactions
          ?.filter(t => 
            t.transaction_type === 'usage' && 
            new Date(t.created_at) >= startOfLastMonth && 
            new Date(t.created_at) <= endOfLastMonth
          )
          .reduce((sum, t) => sum + t.amount, 0) || 0
      );

      const lastTx = allTransactions?.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      setMetrics({
        totalProjects,
        completedProjects,
        draftProjects,
        inProgressProjects,
        totalVideosGenerated,
        totalVideoDuration,
        avgCreditsPerVideo,
        creditsThisMonth,
        creditsLastMonth,
        mostUsedGenre: mostUsedGenre.charAt(0).toUpperCase() + mostUsedGenre.slice(1),
        projectsThisMonth: projects?.filter(p => new Date(p.created_at) >= startOfMonth).length || 0,
        lastActivityDate: lastTx?.created_at || null,
        videosThisWeek,
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
      .limit(10);

    if (!error) {
      setTransactions(data || []);
    }
    setLoadingTransactions(false);
  };

  const handlePurchaseComplete = () => {
    refreshProfile();
    fetchTransactions();
    fetchMetrics();
    setShowBuyModal(false);
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

  const monthlyChange = metrics.creditsLastMonth > 0 
    ? Math.round(((metrics.creditsThisMonth - metrics.creditsLastMonth) / metrics.creditsLastMonth) * 100)
    : metrics.creditsThisMonth > 0 ? 100 : 0;

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  const daysSinceJoined = profile?.created_at 
    ? Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Calculate unlocked achievements
  const unlockedAchievements = ACHIEVEMENTS.filter(a => {
    switch (a.type) {
      case 'videos': return metrics.totalVideosGenerated >= a.threshold;
      case 'projects': return metrics.totalProjects >= a.threshold;
      case 'completed': return metrics.completedProjects >= a.threshold;
      case 'credits': return (profile?.total_credits_used || 0) >= a.threshold;
      default: return false;
    }
  });

  const fetchUserVideoClips = async () => {
    if (!user) return;
    setLoadingVideos(true);
    
    // Verify session before querying
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoadingVideos(false);
      return;
    }
    
    try {
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('video_clips, video_url')
        .eq('user_id', session.user.id);
      
      const allClips: string[] = [];
      projects?.forEach(p => {
        if (p.video_clips && Array.isArray(p.video_clips)) {
          allClips.push(...p.video_clips.filter(Boolean));
        }
        if (p.video_url) {
          allClips.push(p.video_url);
        }
      });
      
      setUserVideoClips([...new Set(allClips)]);
    } catch (error) {
      console.error('Error fetching video clips:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleOpenVideoPicker = () => {
    fetchUserVideoClips();
    setShowVideoPicker(true);
  };

  const handleSelectCoverVideo = (videoUrl: string) => {
    setCoverVideo(videoUrl);
    setShowVideoPicker(false);
    toast.success('Cover video updated');
  };

  const handlePlayCover = () => {
    if (coverVideoRef.current) {
      if (isPlayingCover) {
        coverVideoRef.current.pause();
      } else {
        coverVideoRef.current.play();
      }
      setIsPlayingCover(!isPlayingCover);
    }
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-blue-400" />;
    if (amount < 0) return <Zap className="w-4 h-4 text-amber-400" />;
    return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Signed out successfully');
  };

  // Calculate level based on total activity
  const totalActivity = metrics.totalVideosGenerated + (metrics.completedProjects * 5);
  const level = Math.floor(totalActivity / 10) + 1;
  const levelProgress = (totalActivity % 10) * 10;

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-64 rounded-3xl bg-white/5" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[400px] bg-gradient-to-b from-white/[0.015] to-transparent blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-to-tl from-white/[0.01] to-transparent blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-white/[0.008] to-transparent" />
        {/* Film grain */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
      </div>

      {/* Video Picker Modal */}
      <Dialog open={showVideoPicker} onOpenChange={setShowVideoPicker}>
        <DialogContent className="max-w-2xl bg-black/95 backdrop-blur-2xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Choose a Cover Video
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {loadingVideos ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-xl bg-white/5" />
                ))}
              </div>
            ) : userVideoClips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
                  <Video className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40">No videos yet</p>
                <p className="text-sm text-white/25 mt-1">Create your first project to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {userVideoClips.map((clip, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleSelectCoverVideo(clip)}
                    className={cn(
                      "relative aspect-video rounded-xl overflow-hidden border-2 transition-all group",
                      coverVideo === clip 
                        ? 'border-white ring-2 ring-white/30' 
                        : 'border-white/10 hover:border-white/30'
                    )}
                  >
                    <video 
                      src={clip} 
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-8 h-8 text-white" fill="currentColor" />
                    </div>
                    {coverVideo === clip && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AppHeader showCreate={false} />

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Hero Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl group"
        >
          {/* Shiny edge */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          
          {/* Cover Video Area */}
          <div className="relative h-48 sm:h-56">
            {coverVideo ? (
              <>
                <video 
                  ref={coverVideoRef}
                  src={coverVideo}
                  className="absolute inset-0 w-full h-full object-cover"
                  loop
                  muted
                  playsInline
                  autoPlay
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handlePlayCover}
                    className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    {isPlayingCover ? (
                      <div className="w-3 h-3 bg-white rounded-sm" />
                    ) : (
                      <Play className="w-4 h-4 text-white" fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={() => setCoverVideo(null)}
                    className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={handleOpenVideoPicker}
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/[0.03] to-transparent hover:from-white/[0.05] transition-all group/cover"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover/cover:scale-110 group-hover/cover:bg-white/[0.08] transition-all">
                  <Camera className="w-7 h-7 text-white/40" />
                </div>
                <span className="text-sm text-white/40 group-hover/cover:text-white/60 transition-colors">Add cover video</span>
              </button>
            )}
          </div>

          {/* Profile Info */}
          <div className="relative px-6 sm:px-8 pb-6 -mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              {/* Avatar with Level Ring */}
              <div className="relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 blur-lg" />
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-white/15 to-white/[0.03] border-4 border-black flex items-center justify-center overflow-hidden shadow-2xl">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-white/50" />
                  )}
                </div>
                {/* Level Badge */}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-black flex items-center justify-center shadow-lg">
                  <span className="text-sm font-bold text-white">{level}</span>
                </div>
              </div>
              
              {/* Name & Details */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    {profile?.display_name || profile?.full_name || 'Creator'}
                  </h1>
                  {level >= 5 && (
                    <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                      <span className="text-xs font-medium text-amber-400">Pro</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Member since {memberSince}
                  </span>
                  <span className="text-white/20">•</span>
                  <span>{daysSinceJoined} days on platform</span>
                  {metrics.lastActivityDate && (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="text-emerald-400/70">Active {formatRelativeTime(metrics.lastActivityDate)}</span>
                    </>
                  )}
                </div>
                {/* Level Progress */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 max-w-xs h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${levelProgress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                    />
                  </div>
                  <span className="text-xs text-white/40">{levelProgress}% to Level {level + 1}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-3 self-start sm:self-auto mt-4 sm:mt-0">
                <Button
                  onClick={() => setShowBuyModal(true)}
                  className="h-12 px-5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  <span className="text-lg font-bold">{profile?.credits_balance?.toLocaleString() || 0}</span>
                </Button>
                <Button
                  onClick={() => navigate('/settings')}
                  variant="ghost"
                  className="h-12 w-12 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                >
                  <Settings className="w-5 h-5" />
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  className="h-12 w-12 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'activity', label: 'Activity', icon: History },
            { id: 'achievements', label: 'Achievements', icon: Trophy },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'achievements' && unlockedAchievements.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center">
                  {unlockedAchievements.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { 
                    label: 'Videos Generated', 
                    value: metrics.totalVideosGenerated, 
                    icon: Video, 
                    color: 'from-blue-500/20 to-cyan-500/20',
                    iconColor: 'text-blue-400',
                    sub: `${metrics.videosThisWeek} this week`
                  },
                  { 
                    label: 'Total Duration', 
                    value: formatDuration(metrics.totalVideoDuration), 
                    icon: Timer, 
                    color: 'from-purple-500/20 to-pink-500/20',
                    iconColor: 'text-purple-400',
                    sub: 'of content created'
                  },
                  { 
                    label: 'Projects', 
                    value: metrics.totalProjects, 
                    icon: FolderOpen, 
                    color: 'from-amber-500/20 to-orange-500/20',
                    iconColor: 'text-amber-400',
                    sub: `${metrics.completedProjects} completed`
                  },
                  { 
                    label: 'Credits Used', 
                    value: profile?.total_credits_used?.toLocaleString() || 0, 
                    icon: Zap, 
                    color: 'from-emerald-500/20 to-teal-500/20',
                    iconColor: 'text-emerald-400',
                    sub: monthlyChange !== 0 ? `${monthlyChange > 0 ? '+' : ''}${monthlyChange}% vs last month` : 'this month'
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 group hover:bg-white/[0.04] transition-all"
                  >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br", stat.color)} />
                    
                    <div className="relative">
                      <div className={cn("w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4", stat.iconColor)}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <p className="text-2xl font-bold text-white mb-1">
                        {loadingMetrics ? <Skeleton className="h-8 w-20 bg-white/10" /> : stat.value}
                      </p>
                      <p className="text-sm text-white/40">{stat.label}</p>
                      <p className="text-xs text-white/25 mt-1">{stat.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Usage Trend */}
                <div className="lg:col-span-2 relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                        <Activity className="w-5 h-5 text-white/40" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Usage Trend</h3>
                        <p className="text-xs text-white/40">Last 14 days</p>
                      </div>
                    </div>
                  </div>
                  
                  {loadingMetrics ? (
                    <Skeleton className="h-40 w-full rounded-xl bg-white/5" />
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={dailyUsage} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          stroke="rgba(255,255,255,0.1)" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={2}
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.1)" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0,0,0,0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                          labelStyle={{ color: '#fff', marginBottom: '4px' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="credits" 
                          stroke="rgba(255,255,255,0.5)" 
                          strokeWidth={2} 
                          fill="url(#usageGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Genre Distribution */}
                <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <PieChartIcon className="w-5 h-5 text-white/40" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Genre Mix</h3>
                      <p className="text-xs text-white/40">By project count</p>
                    </div>
                  </div>

                  {loadingMetrics ? (
                    <Skeleton className="h-40 w-full rounded-xl bg-white/5" />
                  ) : genreData.length > 0 ? (
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie 
                            data={genreData} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={40} 
                            outerRadius={65} 
                            paddingAngle={3} 
                            dataKey="value"
                          >
                            {genreData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.95)', 
                              border: '1px solid rgba(255,255,255,0.1)', 
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-sm text-white/25">No data yet</p>
                    </div>
                  )}
                  
                  {/* Legend */}
                  {genreData.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 justify-center">
                      {genreData.slice(0, 4).map((g, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="text-xs text-white/40">{g.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/studio')}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-white">New Project</p>
                    <p className="text-sm text-white/40">Start creating</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                </button>
                
                <button
                  onClick={() => navigate('/clips')}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Video className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-white">My Clips</p>
                    <p className="text-sm text-white/40">{metrics.totalVideosGenerated} videos</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                </button>
                
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Coins className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-white">Buy Credits</p>
                    <p className="text-sm text-white/40">{profile?.credits_balance || 0} available</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
            >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              
              <div className="p-6 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                    <History className="w-5 h-5 text-white/40" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Recent Activity</h3>
                    <p className="text-xs text-white/40">Your credit transactions</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {loadingTransactions ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="px-6 py-4">
                      <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
                    </div>
                  ))
                ) : transactions.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                      <History className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/40">No activity yet</p>
                    <p className="text-sm text-white/25 mt-1">Start creating to see your history</p>
                  </div>
                ) : (
                  transactions.map((tx, i) => (
                    <motion.div 
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          tx.amount >= 0 ? "bg-emerald-500/10" : "bg-white/[0.05]"
                        )}>
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {tx.description || (tx.transaction_type === 'bonus' ? 'Welcome Bonus' : tx.transaction_type === 'purchase' ? 'Credit Purchase' : 'Video Generation')}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-white/40">
                            <span>{formatRelativeTime(tx.created_at)}</span>
                            {tx.clip_duration_seconds && (
                              <>
                                <span className="text-white/20">•</span>
                                <span>{tx.clip_duration_seconds}s clip</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={cn(
                        "text-lg font-semibold tabular-nums",
                        tx.amount >= 0 ? 'text-emerald-400' : 'text-white/50'
                      )}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Achievements Tab */}
          {activeTab === 'achievements' && (
            <motion.div
              key="achievements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Unlocked Achievements */}
              {unlockedAchievements.length > 0 && (
                <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                  
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Unlocked</h3>
                      <p className="text-xs text-white/40">{unlockedAchievements.length} achievements earned</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {unlockedAchievements.map((achievement, i) => (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative rounded-xl overflow-hidden border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 group"
                      >
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center flex-shrink-0">
                            <achievement.icon className="w-5 h-5 text-amber-300" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{achievement.name}</p>
                            <p className="text-xs text-white/50 mt-0.5">{achievement.desc}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked Achievements */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white/40" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Locked</h3>
                    <p className="text-xs text-white/40">{ACHIEVEMENTS.length - unlockedAchievements.length} remaining</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {ACHIEVEMENTS.filter(a => !unlockedAchievements.includes(a)).map((achievement, i) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-4 opacity-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                          <achievement.icon className="w-5 h-5 text-white/30" />
                        </div>
                        <div>
                          <p className="font-semibold text-white/50">{achievement.name}</p>
                          <p className="text-xs text-white/30 mt-0.5">{achievement.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
}
