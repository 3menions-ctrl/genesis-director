import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, Coins, History, LogOut, Sparkles, 
  ArrowUpRight, ArrowDownRight, Gift, ShoppingCart,
  Film, Clock, Zap, TrendingUp, ChevronRight,
  Video, Target, BarChart3, Timer,
  FolderOpen, CheckCircle2, Edit3, Play, Layers,
  PieChart as PieChartIcon, Activity, ArrowLeft
} from 'lucide-react';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
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
  drama: '#8b5cf6',
  comedy: '#eab308',
  thriller: '#6b7280',
  scifi: '#0ea5e9',
  fantasy: '#d946ef',
  romance: '#ec4899',
  horror: '#1f2937',
  documentary: '#22c55e',
  adventure: '#f97316',
  ad: '#3b82f6',
  educational: '#06b6d4',
  cinematic: '#a855f7',
  funny: '#facc15',
  religious: '#f59e0b',
  motivational: '#10b981',
  storytelling: '#8b5cf6',
  explainer: '#6366f1',
  vlog: '#ec4899',
};

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [genreData, setGenreData] = useState<GenreData[]>([]);
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
        color: GENRE_COLORS[name] || '#8b5cf6'
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
      const projectsThisMonth = projects?.filter(p => new Date(p.created_at) >= startOfMonth).length || 0;

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
        projectsThisMonth,
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

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data || []);
    }
    setLoadingTransactions(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Signed out successfully');
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
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const monthlyChange = metrics.creditsLastMonth > 0 
    ? Math.round(((metrics.creditsThisMonth - metrics.creditsLastMonth) / metrics.creditsLastMonth) * 100)
    : metrics.creditsThisMonth > 0 ? 100 : 0;

  const totalAvailableCredits = (profile?.total_credits_purchased || 0) + 50;
  const usagePercentage = profile?.total_credits_used && totalAvailableCredits > 0
    ? Math.min(100, Math.round((profile.total_credits_used / totalAvailableCredits) * 100))
    : 0;

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(0_0%_3%)] p-8 space-y-8 max-w-7xl mx-auto">
        <Skeleton className="h-64 rounded-3xl bg-white/5" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-2xl bg-white/5" />
          <Skeleton className="h-40 rounded-2xl bg-white/5" />
          <Skeleton className="h-40 rounded-2xl bg-white/5" />
        </div>
        <Skeleton className="h-80 rounded-2xl bg-white/5" />
      </div>
    );
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-violet-400" />;
    if (amount < 0) return <ArrowDownRight className="w-4 h-4 text-rose-400" />;
    return <ArrowUpRight className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="min-h-screen bg-[hsl(0_0%_3%)] relative overflow-hidden">
      {/* Premium Dark Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-violet-500/[0.08] to-transparent blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-blue-500/[0.06] to-transparent blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-bl from-purple-500/[0.04] to-transparent blur-[80px] animate-pulse-soft" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }}
        />
        
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Premium Header */}
      <header className="relative z-10">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative bg-white/[0.02] backdrop-blur-2xl border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer" />
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 sm:py-5 flex items-center justify-between">
              <div className="flex items-center gap-4 animate-fade-in">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/projects')}
                  className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-purple-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-white/20 flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-white/80" />
                    )}
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {profile?.display_name || profile?.full_name || 'Creator'}
                  </h1>
                  <p className="text-sm text-white/40">{profile?.email}</p>
                </div>
              </div>
              
              <Button 
                variant="ghost"
                onClick={handleSignOut} 
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Hero Credits Card */}
        <div className="relative rounded-3xl overflow-hidden animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-400/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/3" />
          
          <div className="relative px-8 py-10 lg:px-12 lg:py-12">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30">
                    <Coins className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-white">Active Balance</span>
                  </div>
                </div>
                
                <p className="text-white/60 text-sm mb-2">Available Credits</p>
                <p className="text-6xl lg:text-7xl font-bold text-white tracking-tight">
                  {profile?.credits_balance.toLocaleString() || 0}
                </p>
                <p className="text-white/50 text-sm mt-3">Member since {memberSince}</p>
              </div>
              
              <Button 
                onClick={() => setShowBuyModal(true)}
                size="lg"
                className="h-14 px-8 rounded-2xl bg-white text-violet-600 font-bold hover:bg-white/90 shadow-2xl shadow-black/30 hover:-translate-y-1 transition-all"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Buy Credits
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          {[
            { 
              label: 'Credits This Month', 
              value: loadingMetrics ? '...' : metrics.creditsThisMonth.toLocaleString(),
              subtext: `vs ${metrics.creditsLastMonth.toLocaleString()} last month`,
              icon: BarChart3,
              iconColor: 'text-blue-400',
              bgGlow: 'from-blue-500/20',
              change: monthlyChange,
            },
            { 
              label: 'Avg Credits/Video', 
              value: loadingMetrics ? '...' : metrics.avgCreditsPerVideo.toLocaleString(),
              subtext: 'Per generated clip',
              icon: Target,
              iconColor: 'text-amber-400',
              bgGlow: 'from-amber-500/20',
            },
            { 
              label: 'Videos Generated', 
              value: loadingMetrics ? '...' : metrics.totalVideosGenerated.toLocaleString(),
              subtext: `${metrics.videosThisWeek} this week`,
              icon: Video,
              iconColor: 'text-emerald-400',
              bgGlow: 'from-emerald-500/20',
            },
            { 
              label: 'Total Projects', 
              value: loadingMetrics ? '...' : metrics.totalProjects.toLocaleString(),
              subtext: `${metrics.completedProjects} completed`,
              icon: FolderOpen,
              iconColor: 'text-violet-400',
              bgGlow: 'from-violet-500/20',
            },
          ].map((stat, i) => (
            <div 
              key={i}
              className="group relative p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300"
            >
              <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-bl", stat.bgGlow, "to-transparent")} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform")}>
                    <stat.icon className={cn("w-5 h-5", stat.iconColor)} />
                  </div>
                  {stat.change !== undefined && (
                    <div className={cn(
                      "px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
                      stat.change >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {stat.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {stat.change >= 0 ? '+' : ''}{stat.change}%
                    </div>
                  )}
                </div>
                <p className="text-white/40 text-xs mb-1">{stat.label}</p>
                <p className="text-2xl lg:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-white/30 text-xs mt-1">{stat.subtext}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Credit Usage Trend */}
          <div className="lg:col-span-2 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center border border-blue-500/20">
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Credit Usage Trend</h3>
                  <p className="text-sm text-white/40">Last 14 days activity</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <span className="text-white/50">Credits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-white/50">Videos</span>
                </div>
              </div>
            </div>
            
            {loadingMetrics ? (
              <Skeleton className="h-64 w-full rounded-xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="creditGradientDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="videoGradientDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    yAxisId="left"
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    yAxisId="right"
                    orientation="right"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(20px)',
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                    itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="credits" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fill="url(#creditGradientDark)" 
                    name="Credits Used"
                    yAxisId="left"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="videos" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    fill="url(#videoGradientDark)" 
                    name="Videos"
                    yAxisId="right"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Genre Distribution */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center border border-purple-500/20">
                <PieChartIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Genre Mix</h3>
                <p className="text-sm text-white/40">Project distribution</p>
              </div>
            </div>
            
            {loadingMetrics ? (
              <Skeleton className="h-52 w-full rounded-xl bg-white/5" />
            ) : genreData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={genreData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
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
                      borderRadius: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-white/30">
                <Film className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No projects yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Bar Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Videos Generated Bar Chart */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
                <Video className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Videos Generated</h3>
                <p className="text-sm text-white/40">Daily production rate</p>
              </div>
            </div>
            
            {loadingMetrics ? (
              <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="videos" 
                    fill="#22c55e" 
                    radius={[4, 4, 0, 0]}
                    name="Videos"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Credit Consumption Bar Chart */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center border border-rose-500/20">
                <Coins className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Credit Consumption</h3>
                <p className="text-sm text-white/40">Daily spending pattern</p>
              </div>
            </div>
            
            {loadingMetrics ? (
              <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyUsage} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="credits" 
                    fill="#f43f5e" 
                    radius={[4, 4, 0, 0]}
                    name="Credits"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Production Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Breakdown */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '350ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center border border-violet-500/20">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Project Status</h3>
                <p className="text-sm text-white/40">Your project breakdown</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {[
                { label: 'Completed', value: metrics.completedProjects, color: 'bg-emerald-500', icon: CheckCircle2 },
                { label: 'In Progress', value: metrics.inProgressProjects, color: 'bg-blue-500', icon: Play },
                { label: 'Drafts', value: metrics.draftProjects, color: 'bg-white/30', icon: Edit3 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <item.icon className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white/60">{item.label}</span>
                  </div>
                  <span className="font-bold text-white">{loadingMetrics ? '...' : item.value}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/60">Total Projects</span>
                <span className="text-lg font-bold text-violet-400">{loadingMetrics ? '...' : metrics.totalProjects}</span>
              </div>
            </div>
          </div>

          {/* Production Stats */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center border border-rose-500/20">
                <Video className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Production Stats</h3>
                <p className="text-sm text-white/40">Your video metrics</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/50">Total Videos</span>
                  <span className="font-bold text-white">{loadingMetrics ? '...' : metrics.totalVideosGenerated}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${Math.min((metrics.totalVideosGenerated / 50) * 100, 100)}%` }}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-white/40" />
                  <span className="text-sm text-white/60">Total Duration</span>
                </div>
                <span className="font-bold text-white">
                  {loadingMetrics ? '...' : formatDuration(metrics.totalVideoDuration)}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-white/40" />
                  <span className="text-sm text-white/60">Top Genre</span>
                </div>
                <span className="font-bold text-white">
                  {loadingMetrics ? '...' : metrics.mostUsedGenre}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 animate-fade-in" style={{ animationDelay: '450ms' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Activity</h3>
                <p className="text-sm text-white/40">Your usage summary</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-400 font-medium">Credits Purchased</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {profile?.total_credits_purchased.toLocaleString() || 0}
                    </p>
                  </div>
                  <ArrowUpRight className="w-6 h-6 text-emerald-400/60" />
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-violet-400 font-medium">Credits Used</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {profile?.total_credits_used.toLocaleString() || 0}
                    </p>
                  </div>
                  <Zap className="w-6 h-6 text-violet-400/60" />
                </div>
              </div>
              
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-white/40 text-center">{usagePercentage}% of total credits used</p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="rounded-2xl overflow-hidden bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] animate-fade-in" style={{ animationDelay: '500ms' }}>
          <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <History className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                <p className="text-sm text-white/40">Your latest transactions</p>
              </div>
            </div>
            <Button variant="ghost" className="text-sm text-violet-400 hover:text-violet-300 hover:bg-white/5">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="p-4">
            {loadingTransactions ? (
              <div className="space-y-3 p-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                  <History className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white font-medium mb-1">No transactions yet</p>
                <p className="text-white/40 text-sm">Your credit activity will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx, i) => (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                        tx.transaction_type === 'bonus' && "bg-emerald-500/20",
                        tx.transaction_type === 'purchase' && "bg-violet-500/20",
                        tx.amount < 0 && tx.transaction_type !== 'bonus' && tx.transaction_type !== 'purchase' && "bg-rose-500/20",
                        tx.amount >= 0 && tx.transaction_type !== 'bonus' && tx.transaction_type !== 'purchase' && "bg-emerald-500/20"
                      )}>
                        {getTransactionIcon(tx.transaction_type, tx.amount)}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {tx.description || (tx.transaction_type === 'bonus' ? 'Bonus Credits' : tx.transaction_type === 'purchase' ? 'Credit Purchase' : 'Video Generation')}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(tx.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {tx.clip_duration_seconds && (
                            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">
                              {tx.clip_duration_seconds}s clip
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      "font-bold text-lg",
                      tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
