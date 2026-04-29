/**
 * Profile Page — Maximalist Cinematic
 * Pro-Dark + cinematic blue, conic aurora, halo rings, diagnostic ticker.
 * Purges orange/amber/purple/indigo/teal/sky/fuchsia per design memory.
 */

import { useState, useEffect, useRef, useCallback, memo, forwardRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, GATEKEEPER_PRESETS, getGatekeeperMessage } from '@/hooks/useGatekeeperLoading';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  User, Coins, Gift, ShoppingCart,
  Zap, Video, Crown, Sparkles, Trophy,
  Flame, Target, Award, ChevronRight, Plus,
  Star, Heart, Users, Medal, Settings,
  BarChart3, MessageCircle, TrendingUp, Clock,
  Calendar, Camera, Edit2, Loader2, ExternalLink
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

// Cinematic glass system (mirrors Settings/Pricing/Create signature)
const glassCard = "relative backdrop-blur-2xl bg-[hsla(220,14%,4%,0.55)] border border-[hsla(215,100%,60%,0.10)] rounded-2xl shadow-[0_30px_120px_-40px_hsla(215,100%,60%,0.35)]";
const glassCardHover = "hover:border-[hsla(215,100%,60%,0.22)] hover:shadow-[0_40px_140px_-40px_hsla(215,100%,60%,0.55)] transition-all duration-500";

// Animated counter — eases to target value
function useAnimatedNumber(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

// Magnetic 3D tilt — premium pointer-tracked transform
function useMagneticTilt(strength = 8) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1200px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg)`;
        el.style.setProperty('--mx', `${(px * 100 + 50).toFixed(1)}%`);
        el.style.setProperty('--my', `${(py * 100 + 50).toFixed(1)}%`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength]);
  return ref;
}

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

// ─── Signature cinematic atmosphere ───────────────────────────────────────────
const ProfileAtmosphere = memo(function ProfileAtmosphere() {
  return (
    <>
      <style>{`
        @keyframes profileAurora { to { transform: rotate(360deg); } }
        @keyframes profileTick { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes profileFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes profileShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes profileScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes profileTwinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        @keyframes profileGlowPulse { 0%,100% { box-shadow: 0 0 0 0 hsla(215,100%,60%,0.45); } 50% { box-shadow: 0 0 30px 6px hsla(215,100%,60%,0.0); } }
        @keyframes profileRise { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
      {/* Deep base */}
      <div className="fixed inset-0 -z-50 bg-[hsl(220,14%,2%)]" aria-hidden />
      {/* Conic aurora sweep */}
      <div
        className="fixed inset-0 -z-40 pointer-events-none"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 45%, transparent 0deg, hsla(215,100%,60%,0.34) 60deg, transparent 130deg, hsla(210,100%,55%,0.22) 220deg, transparent 300deg, hsla(215,100%,60%,0.28) 360deg)',
          filter: 'blur(90px)',
          animation: 'profileAurora 70s linear infinite',
          opacity: 0.85,
        }}
        aria-hidden
      />
      {/* Floating halos */}
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 720, height: 720, top: '-20%', right: '-12%',
          background: 'radial-gradient(circle, hsla(215,100%,60%,0.18), transparent 65%)',
          filter: 'blur(60px)', animation: 'profileFloat 14s ease-in-out infinite',
        }}
        aria-hidden
      />
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 560, height: 560, bottom: '-15%', left: '-10%',
          background: 'radial-gradient(circle, hsla(210,100%,55%,0.14), transparent 65%)',
          filter: 'blur(70px)', animation: 'profileFloat 18s ease-in-out infinite reverse',
        }}
        aria-hidden
      />
      {/* Ambient star/dust field */}
      <div className="fixed inset-0 -z-30 pointer-events-none overflow-hidden" aria-hidden>
        {Array.from({ length: 28 }).map((_, i) => {
          const top = (i * 137.5) % 100;
          const left = (i * 73.3) % 100;
          const size = 1 + ((i * 7) % 3);
          const delay = (i * 0.31) % 6;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-[hsl(215,100%,75%)]"
              style={{
                top: `${top}%`, left: `${left}%`,
                width: size, height: size,
                boxShadow: '0 0 8px hsla(215,100%,68%,0.6)',
                animation: `profileTwinkle ${5 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.35,
              }}
            />
          );
        })}
      </div>
      {/* Slow scan line */}
      <div
        className="fixed inset-x-0 -z-20 pointer-events-none h-[40vh]"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, hsla(215,100%,68%,0.06) 50%, transparent 100%)',
          animation: 'profileScan 18s linear infinite',
        }}
        aria-hidden
      />
      {/* Film grain */}
      <div
        className="fixed inset-0 -z-20 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06 0 0 0 0 0.07 0 0 0 0 0.08 0 0 0 0.65 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />
      {/* Edge vignette */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsla(220,14%,1%,0.85) 100%)' }}
        aria-hidden
      />
    </>
  );
});

const DiagnosticTicker = memo(function DiagnosticTicker() {
  const items = [
    { code: 'SIG', label: 'Signal' },
    { code: 'XP', label: 'Telemetry' },
    { code: 'LIVE', label: 'Stream' },
  ];
  return (
    <div className="inline-flex items-center gap-4 px-4 py-1.5 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.14)] backdrop-blur-xl">
      {items.map((item, i) => (
        <div key={item.code} className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)]"
            style={{ animation: `profileTick 2.4s ease-in-out infinite`, animationDelay: `${i * 0.4}s` }}
          />
          <span className="text-[10px] uppercase tracking-[0.32em] text-white/55 font-mono">
            {item.code} <span className="text-white/30">/</span> {item.label}
          </span>
        </div>
      ))}
    </div>
  );
});

// Main content component
const ProfileContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function ProfileContent(_, ref) {
  const { navigate } = useSafeNavigation();
  const { user, profile, loading, refreshProfile } = useAuth();
  const heroTiltRef = useMagneticTilt(4);

  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.profile,
    authLoading: loading,
    dataLoading: loading,
    dataSuccess: !loading && !!user,
  });
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
    totalProjects: 0, completedProjects: 0, totalVideosGenerated: 0, totalVideoDuration: 0,
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = useCallback(async () => {
    if (!user || !nameValue.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: nameValue.trim() }).eq('id', user.id);
      if (error) throw error;
      toast.success('Display name updated');
      setEditingName(false);
      refreshProfile();
    } catch {
      toast.error('Failed to update display name');
    } finally {
      setSavingName(false);
    }
  }, [user, nameValue, refreshProfile]);

  const [searchParams, setSearchParams] = useSearchParams();

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast.success('Profile picture updated!');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload picture');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const creditsAdded = searchParams.get('credits');
    const buy = searchParams.get('buy');
    if (paymentStatus === 'success') {
      toast.success(`Payment successful! ${creditsAdded ? `${creditsAdded} credits` : 'Credits'} added.`);
      refreshProfile(); fetchTransactions(); fetchMetrics(); setSearchParams({});
    } else if (paymentStatus === 'canceled') {
      toast.info('Payment was canceled'); setSearchParams({});
    } else if (buy) {
      setShowBuyModal(true); setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) { fetchTransactions(); fetchMetrics(); }
  }, [user]);

  const fetchMetrics = async () => {
    if (!user) return;
    try {
      const { data: projects } = await supabase
        .from('movie_projects').select('id, status').eq('user_id', user.id);
      const { data: allTransactions } = await supabase
        .from('credit_transactions_safe').select('amount, clip_duration_seconds, transaction_type').eq('user_id', user.id);
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
      .from('credit_transactions_safe').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(5);
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

  // Animated values — eased counters for premium feel
  const animatedCredits = useAnimatedNumber(profile?.credits_balance || 0);
  const animatedXp = useAnimatedNumber(xpTotal);
  const animatedFollowers = useAnimatedNumber(followersCount || 0);
  const animatedFollowing = useAnimatedNumber(followingCount || 0);
  const animatedStreak = useAnimatedNumber(streak);

  const unlockedAchievements = ACHIEVEMENTS.filter(a => {
    switch (a.type) {
      case 'videos': return metrics.totalVideosGenerated >= a.threshold;
      case 'credits': return (profile?.total_credits_used || 0) >= a.threshold;
      default: return false;
    }
  });

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-[hsl(150,80%,55%)]" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-[hsl(215,100%,60%)]" />;
    if (amount < 0) return <Zap className="w-4 h-4 text-[hsl(215,100%,68%)]" />;
    return <TrendingUp className="w-4 h-4 text-[hsl(150,80%,55%)]" />;
  };

  if (loading || gatekeeper.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <CinemaLoader
          isVisible={true}
          message={getGatekeeperMessage(gatekeeper.phase, GATEKEEPER_PRESETS.profile.messages)}
          showProgress={true}
          progress={gatekeeper.progress}
        />
      </div>
    );
  }

  return (
    <div ref={ref} className="min-h-screen text-foreground overflow-hidden relative">
      <ProfileAtmosphere />
      <AppHeader />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ─── Eyebrow ticker ─── */}
        <div className="flex items-center justify-center animate-fade-in">
          <DiagnosticTicker />
        </div>

        {/* ─── HERO ─── */}
        <section
          ref={heroTiltRef}
          className="relative px-6 sm:px-10 py-10 rounded-[28px] overflow-hidden animate-fade-in transition-transform duration-300 will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Hero halo */}
          <div className="absolute inset-0 rounded-[28px] bg-[hsla(220,14%,4%,0.55)] backdrop-blur-2xl border border-[hsla(215,100%,60%,0.12)]" />
          {/* Cursor spotlight */}
          <div
            className="absolute inset-0 rounded-[28px] pointer-events-none opacity-80"
            style={{
              background: 'radial-gradient(600px circle at var(--mx,50%) var(--my,50%), hsla(215,100%,60%,0.18), transparent 45%)',
            }}
          />
          {/* Prismatic top frame */}
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,75%,0.7), hsla(215,100%,60%,0.3), hsla(215,100%,75%,0.7), transparent)' }} />
          <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,60%,0.45), transparent)' }} />
          {/* Corner ticks */}
          {[
            'top-3 left-3 border-l border-t',
            'top-3 right-3 border-r border-t',
            'bottom-3 left-3 border-l border-b',
            'bottom-3 right-3 border-r border-b',
          ].map((p, i) => (
            <div key={i} className={`absolute ${p} w-4 h-4 border-[hsla(215,100%,68%,0.5)] rounded-[3px]`} />
          ))}
          <div
            className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.28), transparent 65%)', filter: 'blur(60px)' }}
          />
          <div
            className="absolute -bottom-40 -left-32 w-[24rem] h-[24rem] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsla(210,100%,55%,0.20), transparent 65%)', filter: 'blur(70px)' }}
          />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8">
            {/* Avatar — luminous halo */}
            <div className="relative group shrink-0">
              <div
                className="absolute -inset-3 rounded-full opacity-90 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'conic-gradient(from 0deg, hsla(215,100%,60%,0.6), hsla(210,100%,55%,0.2), hsla(215,100%,68%,0.5), hsla(215,100%,60%,0.6))',
                  filter: 'blur(18px)',
                  animation: 'profileAurora 12s linear infinite',
                }}
              />
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-[hsl(215,100%,60%)] to-[hsl(210,100%,55%)] opacity-80" />
              <Avatar className="relative w-28 h-28 ring-2 ring-[hsla(215,100%,60%,0.45)]">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-[hsl(220,14%,6%)] text-[hsl(215,100%,75%)] text-3xl font-bold font-[Sora]">
                  {profile?.display_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <input
                ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[hsl(220,14%,6%)] border border-[hsla(215,100%,60%,0.4)] flex items-center justify-center hover:bg-[hsl(220,14%,9%)] hover:border-[hsl(215,100%,60%)] transition-all disabled:opacity-50 shadow-[0_8px_24px_-8px_hsla(215,100%,60%,0.6)]"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 text-[hsl(215,100%,68%)] animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-[hsl(215,100%,68%)]" />
                )}
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.4em] text-[hsl(215,100%,68%)] font-mono">
                  CREATOR · ID {(user?.id || '').slice(0, 6).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1
                  className="text-4xl sm:text-5xl font-bold tracking-tight text-white"
                  style={{
                    fontFamily: 'Sora, sans-serif',
                    backgroundImage: 'linear-gradient(135deg, #ffffff 0%, hsl(215,100%,85%) 60%, hsl(215,100%,68%) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {profile?.display_name || 'Creator'}
                </h1>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.35)] backdrop-blur">
                  <Crown className="w-3.5 h-3.5 text-[hsl(215,100%,72%)]" />
                  <span className="text-xs font-semibold text-[hsl(215,100%,82%)] font-mono uppercase tracking-wider">Lvl {level}</span>
                </div>
              </div>

              {/* XP bar with shimmer */}
              <div className="flex items-center gap-3 mb-4 max-w-md">
                <div className="relative flex-1 h-1.5 rounded-full bg-[hsla(220,14%,10%,0.8)] overflow-hidden border border-[hsla(215,100%,60%,0.10)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${xpProgress?.percentage || 0}%`,
                      background: 'linear-gradient(90deg, hsl(210,100%,55%), hsl(215,100%,68%))',
                      boxShadow: '0 0 18px hsla(215,100%,60%,0.7)',
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, transparent, hsla(255,255,255,0.18), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'profileShimmer 3.2s linear infinite',
                    }}
                  />
                </div>
                <span className="text-xs text-white/60 font-mono">{xpTotal.toLocaleString()} XP</span>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-5 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[hsl(215,100%,68%)]" />
                  <span className="text-white font-semibold tabular-nums">{animatedFollowers}</span>
                  <span className="text-white/45 text-xs uppercase tracking-wider">Followers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-[hsl(215,100%,68%)]" />
                  <span className="text-white font-semibold tabular-nums">{animatedFollowing}</span>
                  <span className="text-white/45 text-xs uppercase tracking-wider">Following</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  <span className="text-white font-semibold tabular-nums">{animatedStreak}</span>
                  <span className="text-white/45 text-xs uppercase tracking-wider">Day streak</span>
                </div>
              </div>
            </div>

            {/* Credits cluster */}
            <div className="flex flex-col items-stretch gap-2 lg:items-end shrink-0">
              <div className="relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-[hsl(220,14%,4%)] border border-[hsla(215,100%,60%,0.25)] overflow-hidden">
                <div className="absolute inset-0 opacity-60"
                  style={{ background: 'radial-gradient(circle at 0% 0%, hsla(215,100%,60%,0.18), transparent 60%)' }}
                />
                <Coins className="relative w-5 h-5 text-[hsl(215,100%,72%)]" />
                <span className="relative text-2xl font-bold text-white font-[Sora] tabular-nums">{animatedCredits.toLocaleString()}</span>
                <span className="relative text-[10px] uppercase tracking-[0.3em] text-white/45">credits</span>
              </div>
              <Button
                onClick={() => setShowBuyModal(true)}
                size="sm"
                className="bg-[hsl(215,100%,60%)] hover:bg-[hsl(215,100%,55%)] text-white font-semibold shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.8)] border border-[hsla(215,100%,75%,0.3)]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Buy Credits
              </Button>
              {user && (
                <Link to={`/user/${user.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-[hsla(215,100%,60%,0.18)] text-white/65 hover:text-white hover:bg-[hsla(215,100%,60%,0.08)] hover:border-[hsla(215,100%,60%,0.35)] backdrop-blur"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Public Profile
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ─── TABS ─── */}
        <section className="flex items-center justify-center animate-fade-in" style={{ animationDelay: '0.08s' }}>
          <div className="inline-flex p-1.5 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.12)] backdrop-blur-2xl shadow-[0_20px_60px_-20px_hsla(215,100%,60%,0.4)]">
            {[
              { id: 'overview' as TabType, label: 'Overview', icon: Sparkles },
              { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
              { id: 'settings' as TabType, label: 'Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-2.5 text-sm font-medium transition-all rounded-full uppercase tracking-[0.18em] text-[11px]",
                  activeTab === tab.id
                    ? "text-white shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.7)]"
                    : "text-white/45 hover:text-white/85 hover:bg-[hsla(215,100%,60%,0.06)]"
                )}
                style={activeTab === tab.id ? {
                  background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(210,100%,50%))',
                } : undefined}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* ─── OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'New Project', icon: Plus, onClick: () => navigate('/create') },
                { label: 'My Videos', icon: Video, onClick: () => navigate('/projects') },
                { label: 'Leaderboard', icon: Trophy, onClick: () => {} },
                { label: 'Creators', icon: Star, onClick: () => navigate('/creators') },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={cn("group relative p-5 rounded-2xl overflow-hidden text-left", glassCard, glassCardHover)}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,60%,0.6)] to-transparent" />
                  <div
                    className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.35), transparent 65%)', filter: 'blur(20px)' }}
                  />
                  <div className="relative w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.28)] group-hover:bg-[hsla(215,100%,60%,0.2)] transition-all">
                    <action.icon className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  </div>
                  <span className="relative text-sm font-medium text-white">{action.label}</span>
                  <span className="block text-[10px] uppercase tracking-[0.3em] text-white/35 mt-1 font-mono">Open</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left — Achievements & Leaderboard */}
              <div className="lg:col-span-2 space-y-6">
                {/* Achievements */}
                <div className={cn("p-6", glassCard)}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white font-[Sora]">Achievements</h3>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 font-mono">{unlockedAchievements.length}/{ACHIEVEMENTS.length} Unlocked</p>
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
                            "relative p-4 rounded-xl border transition-all overflow-hidden",
                            isUnlocked
                              ? "bg-[hsla(215,100%,60%,0.08)] border-[hsla(215,100%,60%,0.35)] shadow-[0_10px_30px_-15px_hsla(215,100%,60%,0.6)]"
                              : "bg-[hsla(220,14%,5%,0.5)] border-white/[0.05] opacity-55"
                          )}
                        >
                          {isUnlocked && (
                            <div
                              className="absolute -top-8 -right-8 w-20 h-20 rounded-full pointer-events-none"
                              style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.35), transparent 65%)', filter: 'blur(12px)' }}
                            />
                          )}
                          <div className={cn(
                            "relative w-9 h-9 rounded-lg flex items-center justify-center mb-2 border",
                            isUnlocked
                              ? "bg-[hsla(215,100%,60%,0.18)] border-[hsla(215,100%,60%,0.45)]"
                              : "bg-white/5 border-white/10"
                          )}>
                            <achievement.icon className={cn("w-4 h-4", isUnlocked ? "text-[hsl(215,100%,75%)]" : "text-white/40")} />
                          </div>
                          <p className="relative text-xs font-semibold text-white truncate">{achievement.name}</p>
                          <p className="relative text-[10px] text-white/45 truncate">{achievement.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leaderboard */}
                <div className={cn("p-6", glassCard)}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                        <Medal className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white font-[Sora]">Top Creators</h3>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 font-mono">This Week · Live Ranking</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/45 hover:text-[hsl(215,100%,72%)] transition-colors font-mono">
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {leaderboardLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-xl bg-white/[0.03]" />
                      ))
                    ) : (leaderboard || []).length === 0 ? (
                      <div className="text-center py-10">
                        <Trophy className="w-10 h-10 text-white/15 mx-auto mb-2" />
                        <p className="text-sm text-white/40">No rankings yet — be the first.</p>
                      </div>
                    ) : (
                      (leaderboard || []).slice(0, 5).map((entry, i) => {
                        const isCurrentUser = entry.user_id === user?.id;
                        return (
                          <div
                            key={entry.user_id}
                            className={cn(
                              "relative flex items-center gap-3 p-3 rounded-xl transition-all border overflow-hidden",
                              i === 0
                                ? "bg-[hsla(215,100%,60%,0.08)] border-[hsla(215,100%,60%,0.32)]"
                                : "bg-[hsla(220,14%,5%,0.5)] border-white/[0.05] hover:border-[hsla(215,100%,60%,0.18)]",
                              isCurrentUser && "ring-1 ring-[hsla(215,100%,60%,0.5)]"
                            )}
                          >
                            {i === 0 && (
                              <div
                                className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none"
                                style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.35), transparent 65%)', filter: 'blur(14px)' }}
                              />
                            )}
                            <div className="relative w-7 text-center">
                              {i === 0 ? <Crown className="w-4 h-4 text-[hsl(215,100%,75%)] mx-auto" /> :
                               i === 1 ? <Medal className="w-4 h-4 text-white/70 mx-auto" /> :
                               i === 2 ? <Medal className="w-4 h-4 text-[hsl(215,100%,55%)] mx-auto" /> :
                               <span className="text-[10px] font-bold text-white/40 font-mono">#{i + 1}</span>}
                            </div>

                            <Avatar className={cn("relative h-9 w-9 border", i === 0 ? "border-[hsla(215,100%,60%,0.45)]" : "border-white/10")}>
                              <AvatarImage src={entry.avatar_url || undefined} />
                              <AvatarFallback className="bg-[hsla(215,100%,60%,0.1)] text-[hsl(215,100%,75%)] text-xs">
                                {entry.display_name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>

                            <div className="relative flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{entry.display_name || 'Creator'}</p>
                              <p className="text-[10px] text-white/45 font-mono uppercase tracking-wider">{entry.xp_total?.toLocaleString()} XP</p>
                            </div>

                            <div className="relative flex items-center gap-1 text-[11px] text-[hsl(215,100%,72%)]">
                              <Flame className="w-3 h-3" />
                              <span className="font-mono">{entry.current_streak || 0}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right — Messages & Recent Activity */}
              <div className="space-y-6">
                <MessagesInbox className="h-auto" />

                <div className={cn("p-6", glassCard)}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                      <Coins className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white font-[Sora]">Recent Activity</h3>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 font-mono">Credit Stream</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {loadingTransactions ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded-lg bg-white/[0.03]" />
                      ))
                    ) : transactions.length === 0 ? (
                      <p className="text-sm text-white/45 text-center py-5">No transactions yet</p>
                    ) : (
                      transactions.slice(0, 4).map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsla(220,14%,5%,0.5)] border border-white/[0.04] hover:border-[hsla(215,100%,60%,0.18)] transition-colors">
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{tx.description || tx.transaction_type}</p>
                            <p className="text-[10px] text-white/40 font-mono">{formatRelativeTime(tx.created_at)}</p>
                          </div>
                          <span className={cn(
                            "text-sm font-semibold font-mono",
                            tx.amount > 0 ? "text-[hsl(150,80%,60%)]" : "text-white/65"
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

        {/* ─── ANALYTICS ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-fade-in">
            <RealAnalyticsCards analytics={analytics} loading={analyticsLoading} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Projects', value: metrics.totalProjects, icon: Video },
                { label: 'Completed', value: metrics.completedProjects, icon: Target },
                { label: 'Videos Generated', value: metrics.totalVideosGenerated, icon: Zap },
                { label: 'Credits Used', value: profile?.total_credits_used || 0, icon: Coins },
              ].map((stat, i) => (
                <StatTile key={i} index={i} value={stat.value} label={stat.label} Icon={stat.icon} />
              ))}
            </div>

            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white font-[Sora]">Credit History</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 font-mono">Recent Transactions</p>
                </div>
              </div>

              <div className="space-y-2">
                {loadingTransactions ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.03]" />
                  ))
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-white/45 text-center py-8">No transactions yet</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05] hover:border-[hsla(215,100%,60%,0.18)] transition-colors">
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{tx.description || tx.transaction_type}</p>
                        <p className="text-[10px] text-white/45 font-mono">{formatRelativeTime(tx.created_at)}</p>
                      </div>
                      <span className={cn(
                        "text-lg font-semibold font-mono",
                        tx.amount > 0 ? "text-[hsl(150,80%,60%)]" : "text-white/70"
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

        {/* ─── SETTINGS ─── */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in">
            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <User className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white font-[Sora]">Profile Settings</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 font-mono">Account Identity</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Picture */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-1 ring-[hsla(215,100%,60%,0.25)]">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-[hsla(215,100%,60%,0.12)] text-[hsl(215,100%,75%)] text-sm">
                        {profile?.display_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white">Profile Picture</p>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono">JPG · PNG · 5MB MAX</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="text-white/65 hover:text-[hsl(215,100%,72%)] hover:bg-[hsla(215,100%,60%,0.08)]"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Display Name */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-medium text-white">Display Name</p>
                    {editingName ? (
                      <input
                        autoFocus
                        className="mt-1 w-full bg-[hsla(220,14%,3%,0.8)] border border-[hsla(215,100%,60%,0.3)] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[hsl(215,100%,60%)] focus:ring-2 focus:ring-[hsla(215,100%,60%,0.2)] transition-all"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                        maxLength={50}
                      />
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono">{profile?.display_name || 'Not set'}</p>
                    )}
                  </div>
                  {editingName ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-[hsl(150,80%,60%)] hover:text-[hsl(150,80%,70%)]" onClick={handleSaveName} disabled={savingName}>
                        {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : '✓'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-white/40 hover:text-white" onClick={() => setEditingName(false)}>✕</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-white/65 hover:text-[hsl(215,100%,72%)] hover:bg-[hsla(215,100%,60%,0.08)]" onClick={() => { setNameValue(profile?.display_name || ''); setEditingName(true); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                  <div>
                    <p className="text-sm font-medium text-white">Email</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono">{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                  <div>
                    <p className="text-sm font-medium text-white">Member Since</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Tier */}
            <div className={cn("p-6 relative overflow-hidden", glassCard)}>
              <div
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.22), transparent 65%)', filter: 'blur(40px)' }}
              />
              <div className="relative flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <Crown className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white font-[Sora]">Account Tier</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 font-mono">Current Plan</p>
                </div>
              </div>

              <div className="relative p-5 rounded-xl bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.25)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white capitalize font-[Sora]">Free</p>
                    <p className="text-xs text-white/55 mt-1">
                      {profile?.credits_balance || 0} credits available
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowBuyModal(true)}
                    className="bg-[hsl(215,100%,60%)] hover:bg-[hsl(215,100%,55%)] text-white font-semibold shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.8)] border border-[hsla(215,100%,75%,0.3)]"
                  >
                    Upgrade
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
}));

function Profile() {
  return (
    <ErrorBoundary>
      <ProfileContent />
    </ErrorBoundary>
  );
}

export default Profile;
