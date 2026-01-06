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
  Video, Target, BarChart3, Timer,
  FolderOpen, CheckCircle2, Layers,
  PieChart as PieChartIcon, Activity, Play, X, Check,
  ChevronDown, LogOut, Settings, HelpCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
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
    
    const { data } = await supabase
      .from('movie_projects')
      .select('genre')
      .eq('user_id', user.id);

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
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, genre, created_at, video_clips')
        .eq('user_id', user.id);

      const { data: allTransactions } = await supabase
        .from('credit_transactions')
        .select('amount, clip_duration_seconds, created_at, transaction_type')
        .eq('user_id', user.id);

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
      .limit(5);

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

  const monthlyChange = metrics.creditsLastMonth > 0 
    ? Math.round(((metrics.creditsThisMonth - metrics.creditsLastMonth) / metrics.creditsLastMonth) * 100)
    : metrics.creditsThisMonth > 0 ? 100 : 0;

  const totalAvailableCredits = (profile?.total_credits_purchased || 0) + 50;
  const usagePercentage = profile?.total_credits_used && totalAvailableCredits > 0
    ? Math.min(100, Math.round((profile.total_credits_used / totalAvailableCredits) * 100))
    : 0;

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  const fetchUserVideoClips = async () => {
    if (!user) return;
    setLoadingVideos(true);
    
    try {
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('video_clips, video_url')
        .eq('user_id', user.id);
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-48 rounded-2xl bg-white/5" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-3 h-3 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-3 h-3 text-white/60" />;
    if (amount < 0) return <Zap className="w-3 h-3 text-white/40" />;
    return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-black relative">
      {/* Subtle ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[300px] bg-gradient-to-b from-white/[0.02] to-transparent blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-white/[0.015] to-transparent blur-[80px]" />
      </div>

      {/* Video Picker Modal */}
      <Dialog open={showVideoPicker} onOpenChange={setShowVideoPicker}>
        <DialogContent className="max-w-2xl bg-black/95 backdrop-blur-2xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Choose a Cover Video</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {loadingVideos ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-video rounded-lg bg-white/5" />
                ))}
              </div>
            ) : userVideoClips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-sm text-white/40">No generated videos yet</p>
                <p className="text-xs text-white/25 mt-1">Create a project to generate video clips</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {userVideoClips.map((clip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectCoverVideo(clip)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                      coverVideo === clip 
                        ? 'border-white/40 ring-2 ring-white/20' 
                        : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    <video 
                      src={clip} 
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-6 h-6 text-white/80" />
                    </div>
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

      {/* Premium Top Navigation Bar */}
      <nav className="sticky top-0 z-50">
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="bg-black/80 backdrop-blur-2xl border-b border-white/[0.05]">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Logo / Brand */}
            <button 
              onClick={() => navigate('/projects')}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.12] transition-colors">
                <Film className="w-4 h-4 text-white/70" />
              </div>
              <span className="text-sm font-semibold text-white/90">apex</span>
            </button>

            {/* Center Nav */}
            <div className="hidden sm:flex items-center gap-1">
              {[
                { label: 'Projects', path: '/projects' },
                { label: 'Create', path: '/pipeline/scripting' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white/90 hover:bg-white/[0.05] rounded-lg transition-all"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Credits */}
              <button
                onClick={() => setShowBuyModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              >
                <Coins className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs font-semibold text-white">{profile?.credits_balance?.toLocaleString() || 0}</span>
              </button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-white/60" />
                      )}
                    </div>
                    <ChevronDown className="w-3 h-3 text-white/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-black/95 backdrop-blur-xl border-white/10">
                  <div className="px-3 py-2 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white truncate">{profile?.display_name || profile?.full_name || 'Creator'}</p>
                    <p className="text-[10px] text-white/40 truncate">{profile?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="text-xs text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08]">
                    <User className="w-3.5 h-3.5 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08]">
                    <Settings className="w-3.5 h-3.5 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08]">
                    <HelpCircle className="w-3.5 h-3.5 mr-2" />
                    Help
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem onClick={handleSignOut} className="text-xs text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-white/[0.08]">
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-5">
        
        {/* Cover Video + Profile Header */}
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          {/* Shiny edge */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          {/* Cover Video Area */}
          <div className="relative h-44 bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden group">
            {coverVideo ? (
              <>
                <video 
                  ref={coverVideoRef}
                  src={coverVideo}
                  className="absolute inset-0 w-full h-full object-cover"
                  loop
                  muted
                  playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <button
                  onClick={handlePlayCover}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Play className={cn("w-3 h-3 text-white", isPlayingCover && "hidden")} />
                  {isPlayingCover && <div className="w-2 h-2 bg-white rounded-sm" />}
                </button>
                <button
                  onClick={() => setCoverVideo(null)}
                  className="absolute top-3 right-12 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenVideoPicker}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-white/30" />
                </div>
                <span className="text-xs text-white/30">Choose cover video</span>
              </button>
            )}
          </div>

          {/* Profile Info */}
          <div className="relative px-5 pb-5 -mt-10">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-xl blur-lg" />
                <div className="relative w-20 h-20 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] border-2 border-black flex items-center justify-center overflow-hidden shadow-2xl">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white/50" />
                  )}
                </div>
              </div>
              
              {/* Name & Meta */}
              <div className="flex-1 pb-1">
                <h1 className="text-xl font-semibold text-white">
                  {profile?.display_name || profile?.full_name || 'Creator'}
                </h1>
                <p className="text-xs text-white/40">{profile?.email} · Since {memberSince}</p>
              </div>

              {/* Balance */}
              <div 
                onClick={() => setShowBuyModal(true)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer group"
              >
                <Coins className="w-4 h-4 text-white/50 group-hover:text-white/70 transition-colors" />
                <div>
                  <p className="text-lg font-bold text-white leading-none">{profile?.credits_balance?.toLocaleString() || 0}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wide">Credits</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'This Month', value: loadingMetrics ? '—' : metrics.creditsThisMonth, icon: BarChart3, change: monthlyChange },
            { label: 'Videos', value: loadingMetrics ? '—' : metrics.totalVideosGenerated, icon: Video },
            { label: 'Projects', value: loadingMetrics ? '—' : metrics.totalProjects, icon: FolderOpen },
            { label: 'Avg/Video', value: loadingMetrics ? '—' : metrics.avgCreditsPerVideo, icon: Target },
          ].map((stat, i) => (
            <div 
              key={i}
              className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm hover:bg-white/[0.025] hover:border-white/[0.08] transition-all group"
            >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="w-3.5 h-3.5 text-white/30" />
                  {stat.change !== undefined && (
                    <span className={cn("text-[9px] font-medium", stat.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {stat.change >= 0 ? '+' : ''}{stat.change}%
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Usage Chart */}
          <div className="lg:col-span-3 relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs text-white/60">14-day trend</span>
              </div>
              
              {loadingMetrics ? (
                <Skeleton className="h-32 w-full rounded-lg bg-white/5" />
              ) : (
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={dailyUsage} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.15)" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.9)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '10px',
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="credits" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} fill="url(#usageGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Genre + Stats */}
          <div className="lg:col-span-2 space-y-3">
            {/* Genre Pie */}
            <div className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm p-4">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs text-white/60">Genres</span>
              </div>
              
              {loadingMetrics ? (
                <Skeleton className="h-24 w-full rounded-lg bg-white/5" />
              ) : genreData.length > 0 ? (
                <ResponsiveContainer width="100%" height={90}>
                  <PieChart>
                    <Pie
                      data={genreData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {genreData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.9)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        fontSize: '10px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-24 flex items-center justify-center text-white/15 text-xs">
                  No projects
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm p-4">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="space-y-2.5">
                {[
                  { icon: CheckCircle2, label: 'Completed', value: metrics.completedProjects },
                  { icon: Timer, label: 'Duration', value: formatDuration(metrics.totalVideoDuration) },
                  { icon: Film, label: 'Top Genre', value: metrics.mostUsedGenre },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/35">
                      <item.icon className="w-3 h-3" />
                      {item.label}
                    </span>
                    <span className="font-medium text-white/80">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/60">Activity</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-white/40 hover:text-white/60 hover:bg-white/5">
              All <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          </div>
          
          <div className="divide-y divide-white/[0.03]">
            {loadingTransactions ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-8 w-full rounded bg-white/5" />
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <History className="w-6 h-6 mx-auto mb-2 text-white/10" />
                <p className="text-[10px] text-white/25">No activity yet</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                    </div>
                    <div>
                      <p className="text-xs text-white/70">
                        {tx.description || (tx.transaction_type === 'bonus' ? 'Bonus' : tx.transaction_type === 'purchase' ? 'Purchase' : 'Generation')}
                      </p>
                      <p className="text-[9px] text-white/25 flex items-center gap-1">
                        <Clock className="w-2 h-2" />
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {tx.clip_duration_seconds && <span className="ml-1 text-white/35">{tx.clip_duration_seconds}s</span>}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-semibold tabular-nums",
                    tx.amount >= 0 ? 'text-emerald-400/80' : 'text-white/40'
                  )}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Credits Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm p-4">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Purchased</p>
            <p className="text-2xl font-bold text-white">{profile?.total_credits_purchased?.toLocaleString() || 0}</p>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-white/[0.05] bg-white/[0.015] backdrop-blur-sm p-4">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Used</p>
            <p className="text-2xl font-bold text-white">{profile?.total_credits_used?.toLocaleString() || 0}</p>
            <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-white/30" style={{ width: `${usagePercentage}%` }} />
            </div>
          </div>
        </div>
      </main>

      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
}
