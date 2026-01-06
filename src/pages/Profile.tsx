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
  PieChart as PieChartIcon, Activity, ArrowLeft, Crown
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
      .limit(6);

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
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-32 rounded-2xl bg-white/5" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />)}
        </div>
        <Skeleton className="h-48 rounded-xl bg-white/5" />
      </div>
    );
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-3.5 h-3.5 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-3.5 h-3.5 text-violet-400" />;
    if (amount < 0) return <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />;
    return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="min-h-screen bg-black relative overflow-x-hidden">
      {/* Premium Dark Ambient Background with Shiny Black Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Glossy reflections */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[400px] bg-gradient-to-b from-white/[0.03] to-transparent blur-[100px] -rotate-12" />
        <div className="absolute top-[20%] right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-violet-500/[0.06] to-transparent blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-500/[0.04] to-transparent blur-[100px]" />
        
        {/* Shiny overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] via-transparent to-white/[0.005]" />
        
        {/* Ultra-fine grid */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Compact Premium Header */}
      <header className="sticky top-0 z-50">
        <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/projects')}
                className="h-8 w-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] p-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/40 to-purple-500/30 rounded-lg blur-md" />
                <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-white/80" />
                  )}
                </div>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white leading-tight">
                  {profile?.display_name || profile?.full_name || 'Creator'}
                </h1>
                <p className="text-[11px] text-white/40">{profile?.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setShowBuyModal(true)}
                size="sm"
                className="h-8 px-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium text-xs hover:opacity-90 shadow-lg shadow-violet-500/20"
              >
                <Sparkles className="w-3 h-3 mr-1.5" />
                Buy Credits
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleSignOut} 
                className="h-8 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] text-xs"
              >
                <LogOut className="w-3 h-3 mr-1.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Compact Layout */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-5 space-y-5">
        
        {/* Hero Row: Balance + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Credit Balance - Premium Glassmorphic Card */}
          <div className="lg:col-span-2 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 via-purple-500/20 to-fuchsia-500/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl">
              {/* Shiny top edge */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              {/* Inner glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.05] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/20 flex items-center justify-center border border-violet-400/20">
                    <Coins className="w-4 h-4 text-violet-300" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">Available</span>
                  <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-medium text-emerald-400">Active</span>
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-white tracking-tight">
                      {profile?.credits_balance.toLocaleString() || 0}
                    </p>
                    <p className="text-[10px] text-white/30 mt-1">Since {memberSince}</p>
                  </div>
                  <Crown className="w-6 h-6 text-amber-400/60" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'This Month', value: loadingMetrics ? '—' : metrics.creditsThisMonth, icon: BarChart3, color: 'blue', change: monthlyChange },
              { label: 'Videos', value: loadingMetrics ? '—' : metrics.totalVideosGenerated, icon: Video, color: 'emerald' },
              { label: 'Projects', value: loadingMetrics ? '—' : metrics.totalProjects, icon: FolderOpen, color: 'violet' },
              { label: 'Avg/Video', value: loadingMetrics ? '—' : metrics.avgCreditsPerVideo, icon: Target, color: 'amber' },
            ].map((stat, i) => (
              <div 
                key={i}
                className="relative group rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className={cn("w-3.5 h-3.5", {
                      'text-blue-400': stat.color === 'blue',
                      'text-emerald-400': stat.color === 'emerald',
                      'text-violet-400': stat.color === 'violet',
                      'text-amber-400': stat.color === 'amber',
                    })} />
                    {stat.change !== undefined && (
                      <span className={cn("text-[9px] font-semibold", stat.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {stat.change >= 0 ? '+' : ''}{stat.change}%
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                  <p className="text-[10px] text-white/30">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Credit Trend Chart */}
          <div className="lg:col-span-2 relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-white">Usage Trend</span>
                  <span className="text-[10px] text-white/30">14 days</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />Credits</span>
                  <span className="flex items-center gap-1 text-white/40"><span className="w-2 h-2 rounded-full bg-emerald-500" />Videos</span>
                </div>
              </div>
              
              {loadingMetrics ? (
                <Skeleton className="h-40 w-full rounded-lg bg-white/5" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={dailyUsage} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} axisLine={false} yAxisId="left" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="credits" stroke="#8b5cf6" strokeWidth={2} fill="url(#creditGrad)" yAxisId="left" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Genre Pie */}
          <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChartIcon className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-white">Genres</span>
              </div>
              
              {loadingMetrics ? (
                <Skeleton className="h-36 w-full rounded-lg bg-white/5" />
              ) : genreData.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={genreData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
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
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center text-white/20">
                  <Film className="w-8 h-8 mb-1" />
                  <p className="text-[10px]">No data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Stats + Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Compact Stats */}
          <div className="lg:col-span-1 space-y-3">
            {/* Project Status */}
            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-medium text-white">Projects</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Completed', value: metrics.completedProjects, color: 'bg-emerald-500' },
                  { label: 'In Progress', value: metrics.inProgressProjects, color: 'bg-blue-500' },
                  { label: 'Drafts', value: metrics.draftProjects, color: 'bg-white/30' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/50">
                      <span className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
                      {item.label}
                    </span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Production Summary */}
            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <Video className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-medium text-white">Production</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50 flex items-center gap-1.5"><Timer className="w-3 h-3" />Duration</span>
                  <span className="font-semibold text-white">{formatDuration(metrics.totalVideoDuration)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50 flex items-center gap-1.5"><Film className="w-3 h-3" />Top Genre</span>
                  <span className="font-semibold text-white">{metrics.mostUsedGenre}</span>
                </div>
              </div>
            </div>

            {/* Credits Summary */}
            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[9px] uppercase tracking-wide text-emerald-400/70 mb-0.5">Purchased</p>
                  <p className="text-lg font-bold text-white">{profile?.total_credits_purchased?.toLocaleString() || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <p className="text-[9px] uppercase tracking-wide text-violet-400/70 mb-0.5">Used</p>
                  <p className="text-lg font-bold text-white">{profile?.total_credits_used?.toLocaleString() || 0}</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
                <p className="text-[9px] text-white/30 text-center mt-1">{usagePercentage}% utilized</p>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="lg:col-span-2 relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-white/40" />
                <span className="text-xs font-medium text-white">Recent Activity</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-violet-400 hover:text-violet-300 hover:bg-white/5">
                View All <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
            
            <div className="p-2">
              {loadingTransactions ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg bg-white/5" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-10">
                  <History className="w-8 h-8 mx-auto mb-2 text-white/10" />
                  <p className="text-xs text-white/30">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          tx.transaction_type === 'bonus' && "bg-emerald-500/15",
                          tx.transaction_type === 'purchase' && "bg-violet-500/15",
                          tx.amount < 0 && tx.transaction_type !== 'bonus' && tx.transaction_type !== 'purchase' && "bg-rose-500/15",
                          tx.amount >= 0 && tx.transaction_type !== 'bonus' && tx.transaction_type !== 'purchase' && "bg-emerald-500/15"
                        )}>
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white/90">
                            {tx.description || (tx.transaction_type === 'bonus' ? 'Bonus' : tx.transaction_type === 'purchase' ? 'Purchase' : 'Video Gen')}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-white/30">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {tx.clip_duration_seconds && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">{tx.clip_duration_seconds}s</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={cn(
                        "text-sm font-bold",
                        tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
