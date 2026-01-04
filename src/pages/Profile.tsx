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
  Film, Clock, Crown, Zap, TrendingUp, 
  ChevronRight, Settings, Camera, Mail, Calendar,
  Video, Target, BarChart3, Timer, Flame,
  FolderOpen, CheckCircle2, Edit3, Play, Layers
} from 'lucide-react';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { cn } from '@/lib/utils';

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

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
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
    }
  }, [user]);

  const fetchMetrics = async () => {
    if (!user) return;
    
    try {
      // Fetch projects
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, genre, created_at, video_clips')
        .eq('user_id', user.id);

      // Fetch all transactions for metrics
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

      // Calculate project metrics
      const totalProjects = projects?.length || 0;
      const completedProjects = projects?.filter(p => p.status === 'completed').length || 0;
      const draftProjects = projects?.filter(p => p.status === 'draft').length || 0;
      const inProgressProjects = projects?.filter(p => p.status === 'in_progress' || p.status === 'generating').length || 0;
      const projectsThisMonth = projects?.filter(p => new Date(p.created_at) >= startOfMonth).length || 0;

      // Count genres
      const genreCounts: Record<string, number> = {};
      projects?.forEach(p => {
        if (p.genre) {
          genreCounts[p.genre] = (genreCounts[p.genre] || 0) + 1;
        }
      });
      const mostUsedGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      // Calculate video metrics from transactions (usage type = video generation)
      const videoTransactions = allTransactions?.filter(t => t.transaction_type === 'usage' && t.amount < 0) || [];
      const totalVideosGenerated = videoTransactions.length;
      const totalVideoDuration = videoTransactions.reduce((sum, t) => sum + (t.clip_duration_seconds || 0), 0);
      const avgCreditsPerVideo = totalVideosGenerated > 0 
        ? Math.round(Math.abs(videoTransactions.reduce((sum, t) => sum + t.amount, 0)) / totalVideosGenerated)
        : 0;

      // Videos this week
      const videosThisWeek = videoTransactions.filter(t => new Date(t.created_at) >= startOfWeek).length;

      // Credits this month vs last month
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

      // Last activity
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

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const monthlyChange = metrics.creditsLastMonth > 0 
    ? Math.round(((metrics.creditsThisMonth - metrics.creditsLastMonth) / metrics.creditsLastMonth) * 100)
    : metrics.creditsThisMonth > 0 ? 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-8 max-w-6xl mx-auto">
        <Skeleton className="h-64 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-emerald-500" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-violet-500" />;
    if (amount < 0) return <ArrowDownRight className="w-4 h-4 text-rose-500" />;
    return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
  };

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  const usagePercentage = profile?.total_credits_purchased 
    ? Math.round((profile.total_credits_used / (profile.total_credits_purchased + 50)) * 100)
    : 0;

  return (
    <div className="min-h-screen p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-violet-200/40 via-purple-200/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-200/30 via-cyan-200/15 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Hero Profile Card */}
      <div className="relative rounded-3xl overflow-hidden animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
        
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl animate-pulse-soft" />
          <div 
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-br from-white/30 to-white/10 rounded-2xl blur-sm" />
                <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 lg:w-12 lg:h-12 text-white/90" />
                  )}
                </div>
                <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                  <Camera className="w-4 h-4 text-violet-600" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl lg:text-3xl font-display font-bold text-white">
                    {profile?.display_name || profile?.full_name || 'Creator'}
                  </h1>
                  <div className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-xs font-semibold text-amber-200">Pro</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {profile?.email}
                  </span>
                  <span className="hidden sm:flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Member since {memberSince}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="h-11 px-5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button 
                variant="ghost"
                onClick={handleSignOut} 
                className="h-11 px-5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-red-500/20 hover:border-red-400/30 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Hero Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {[
              { label: 'Total Projects', value: loadingMetrics ? '...' : metrics.totalProjects.toString(), icon: FolderOpen },
              { label: 'Videos Generated', value: loadingMetrics ? '...' : metrics.totalVideosGenerated.toString(), icon: Video },
              { label: 'This Week', value: loadingMetrics ? '...' : `+${metrics.videosThisWeek}`, icon: Flame },
              { label: 'Last Active', value: metrics.lastActivityDate ? getTimeAgo(metrics.lastActivityDate) : 'Never', icon: Clock },
            ].map((stat, i) => (
              <div 
                key={stat.label}
                className={cn(
                  "px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 animate-fade-in",
                  `delay-${i + 1}`
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4 text-white/60" />
                  <span className="text-xs text-white/60">{stat.label}</span>
                </div>
                <p className="text-xl font-display font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current Balance */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden group animate-fade-in delay-2">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute top-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse-soft" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-400/30 rounded-full blur-2xl" />
          
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Coins className="w-7 h-7 text-white" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-white">Active</span>
              </div>
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/70 text-sm mb-1">Available Balance</p>
                <p className="text-5xl font-display font-bold text-white">
                  {profile?.credits_balance.toLocaleString() || 0}
                </p>
              </div>
              <Button 
                onClick={() => setShowBuyModal(true)}
                className="h-12 px-6 rounded-xl bg-white text-violet-600 font-semibold hover:bg-white/90 shadow-lg shadow-black/20"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Buy Credits
              </Button>
            </div>
          </div>
        </div>

        {/* Credits This Month */}
        <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 animate-fade-in delay-3">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-100 to-transparent rounded-bl-full opacity-60" />
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
                monthlyChange >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {monthlyChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {monthlyChange >= 0 ? '+' : ''}{monthlyChange}%
              </div>
            </div>
            <p className="text-slate-500 text-sm mb-1">Credits This Month</p>
            <p className="text-3xl font-display font-bold text-slate-900">
              {loadingMetrics ? '...' : metrics.creditsThisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">vs {metrics.creditsLastMonth.toLocaleString()} last month</p>
          </div>
        </div>

        {/* Avg Credits Per Video */}
        <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 animate-fade-in delay-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100 to-transparent rounded-bl-full opacity-60" />
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                <Target className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-slate-500 text-sm mb-1">Avg Credits/Video</p>
            <p className="text-3xl font-display font-bold text-slate-900">
              {loadingMetrics ? '...' : metrics.avgCreditsPerVideo.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">Per generated clip</p>
          </div>
        </div>
      </div>

      {/* Production Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Breakdown */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 p-6 animate-fade-in delay-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center">
              <Layers className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900">Project Status</h3>
              <p className="text-sm text-slate-500">Your project breakdown</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {[
              { label: 'Completed', value: metrics.completedProjects, color: 'bg-emerald-500', icon: CheckCircle2 },
              { label: 'In Progress', value: metrics.inProgressProjects, color: 'bg-blue-500', icon: Play },
              { label: 'Drafts', value: metrics.draftProjects, color: 'bg-slate-400', icon: Edit3 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", item.color)} />
                  <item.icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="font-display font-bold text-slate-900">{loadingMetrics ? '...' : item.value}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Total Projects</span>
              <span className="text-lg font-display font-bold text-violet-600">{loadingMetrics ? '...' : metrics.totalProjects}</span>
            </div>
          </div>
        </div>

        {/* Video Production Stats */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 p-6 animate-fade-in delay-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 flex items-center justify-center">
              <Video className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900">Production Stats</h3>
              <p className="text-sm text-slate-500">Your video creation metrics</p>
            </div>
          </div>
          
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Total Videos</span>
                <span className="font-display font-bold text-slate-900">{loadingMetrics ? '...' : metrics.totalVideosGenerated}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${Math.min((metrics.totalVideosGenerated / 50) * 100, 100)}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Total Duration</span>
              </div>
              <span className="font-display font-bold text-slate-900">
                {loadingMetrics ? '...' : formatDuration(metrics.totalVideoDuration)}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Top Genre</span>
              </div>
              <span className="font-display font-bold text-slate-900">
                {loadingMetrics ? '...' : metrics.mostUsedGenre}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 p-6 animate-fade-in delay-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900">Activity</h3>
              <p className="text-sm text-slate-500">Your usage summary</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Credits Purchased</p>
                <p className="text-2xl font-display font-bold text-emerald-700">
                  {profile?.total_credits_purchased.toLocaleString() || 0}
                </p>
              </div>
              <ArrowUpRight className="w-6 h-6 text-emerald-500" />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
              <div>
                <p className="text-sm text-violet-600 font-medium">Credits Used</p>
                <p className="text-2xl font-display font-bold text-violet-700">
                  {profile?.total_credits_used.toLocaleString() || 0}
                </p>
              </div>
              <Zap className="w-6 h-6 text-violet-500" />
            </div>
            
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 text-center">{usagePercentage}% of total credits used</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 animate-fade-in delay-8">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
              <History className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-500">Your latest transactions</p>
            </div>
          </div>
          <Button variant="ghost" className="text-sm text-violet-600 hover:text-violet-700 hover:bg-violet-50">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        
        <div className="p-4">
          {loadingTransactions ? (
            <div className="space-y-3 p-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                <History className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-900 font-medium mb-1">No transactions yet</p>
              <p className="text-slate-500 text-sm">Your credit activity will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx, i) => (
                <div 
                  key={tx.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-all group cursor-pointer animate-fade-in",
                    `delay-${Math.min(i + 1, 8)}`
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                      tx.transaction_type === 'bonus' && "bg-emerald-50",
                      tx.transaction_type === 'purchase' && "bg-violet-50",
                      tx.amount < 0 && tx.transaction_type !== 'bonus' && tx.transaction_type !== 'purchase' && "bg-rose-50",
                      tx.amount >= 0 && tx.transaction_type !== 'bonus' && tx.transaction_type !== 'purchase' && "bg-emerald-50"
                    )}>
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {tx.description || (tx.transaction_type === 'bonus' ? 'Bonus Credits' : tx.transaction_type === 'purchase' ? 'Credit Purchase' : 'Video Generation')}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
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
                          <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                            {tx.clip_duration_seconds}s clip
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    "font-display font-bold text-lg",
                    tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-500'
                  )}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
}
