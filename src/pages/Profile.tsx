/**
 * Profile Page — Private Account
 * Cinematic Pro-Dark identity page. Only private data: account identity,
 * plan, credits, billing history, usage, messages, settings.
 * NO public/social surfaces (followers, leaderboards, achievements, public link).
 */

import { useState, useEffect, useRef, useCallback, memo, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, GATEKEEPER_PRESETS, getGatekeeperMessage } from '@/hooks/useGatekeeperLoading';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  User, Coins, Gift, ShoppingCart, Zap, Video, Crown, Sparkles,
  Plus, Settings, BarChart3, TrendingUp, Clock, Camera, Edit2, Loader2,
  Mail, Shield, KeyRound, Calendar, CreditCard, Download, LogOut, Check,
  Copy, Fingerprint, Smartphone, Globe, Lock, Star, Award, ChevronRight,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRealAnalytics } from '@/hooks/useRealAnalytics';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { MessagesInbox } from '@/components/social/MessagesInbox';
import { SupportInbox } from '@/components/social/SupportInbox';
import { TwoFactorCard } from '@/components/security/TwoFactorCard';

import { usePageMeta } from '@/hooks/usePageMeta';
// Cinematic glass system (mirrors Settings/Pricing/Create signature)
const glassCard = "relative backdrop-blur-2xl bg-[hsla(220,14%,4%,0.55)] border border-[hsla(215,100%,60%,0.10)] rounded-2xl shadow-[0_30px_120px_-40px_hsla(215,100%,60%,0.35)]";
const glassCardHover = "hover:border-[hsla(215,100%,60%,0.22)] hover:shadow-[0_40px_140px_-40px_hsla(215,100%,60%,0.55)] transition-all duration-500";

// Animated counter
function useAnimatedNumber(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
  usePageMeta({ title: "Profile — Apex Studio", description: "Your public director profile, showcased projects, and creator stats." });

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

type TabType = 'account' | 'usage' | 'security';

// Ranking, tiers, XP and achievements are intentionally NOT shown.
// Account data — including credits and lifetime spend — is private to the user.

function Sparkline({ values, color = 'hsl(215,100%,70%)' }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const w = 96, h = 28, max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sp-${color})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

// Atmosphere (kept identical to design system)
const ProfileAtmosphere = memo(function ProfileAtmosphere() {
  return (
    <>
      <style>{`
        @keyframes profileAurora { to { transform: rotate(360deg); } }
        @keyframes profileTick { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes profileFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes profileShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes profileTwinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        @keyframes profileRise { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="fixed inset-0 -z-50 bg-[hsl(220,14%,2%)]" aria-hidden />
      <div
        className="fixed inset-0 -z-40 pointer-events-none"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 45%, transparent 0deg, hsla(215,100%,60%,0.30) 60deg, transparent 130deg, hsla(210,100%,55%,0.18) 220deg, transparent 300deg, hsla(215,100%,60%,0.24) 360deg)',
          filter: 'blur(100px)',
          animation: 'profileAurora 80s linear infinite',
          opacity: 0.7,
        }}
        aria-hidden
      />
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 720, height: 720, top: '-20%', right: '-12%',
          background: 'radial-gradient(circle, hsla(215,100%,60%,0.14), transparent 65%)',
          filter: 'blur(60px)', animation: 'profileFloat 14s ease-in-out infinite',
        }}
        aria-hidden
      />
      <div className="fixed inset-0 -z-30 pointer-events-none overflow-hidden" aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => {
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
                opacity: 0.3,
              }}
            />
          );
        })}
      </div>
      <div
        className="fixed inset-0 -z-20 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06 0 0 0 0 0.07 0 0 0 0 0.08 0 0 0 0.65 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsla(220,14%,1%,0.85) 100%)' }}
        aria-hidden
      />
    </>
  );
});

const PrivateBadge = memo(function PrivateBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.18)] backdrop-blur-xl">
      <Shield className="w-3 h-3 text-[hsl(215,100%,72%)]" />
      <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
        Private · Only visible to you
      </span>
    </div>
  );
});

const ProfileContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function ProfileContent(_, ref) {
  const { navigate } = useSafeNavigation();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();

  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.profile,
    authLoading: loading,
    dataLoading: loading,
    dataSuccess: !loading && !!user,
  });

  let analyticsData: any = { analytics: null, loading: false };
  try { analyticsData = useRealAnalytics(); } catch { /* noop */ }
  const { analytics, loading: analyticsLoading } = analyticsData;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [metrics, setMetrics] = useState<UserMetrics>({
    totalProjects: 0, completedProjects: 0, totalVideosGenerated: 0, totalVideoDuration: 0,
  });
  const [usageSeries, setUsageSeries] = useState<number[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();

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
      toast.success('Profile picture updated');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload picture');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }, [user, refreshProfile]);

  const handlePasswordReset = useCallback(async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset link sent to your email');
    } catch {
      toast.error('Failed to send reset link');
    } finally {
      setSendingReset(false);
    }
  }, [user]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({
      account: { id: user?.id, email: user?.email, display_name: profile?.display_name, member_since: profile?.created_at },
      credits: { balance: profile?.credits_balance, total_used: profile?.total_credits_used },
      transactions,
      metrics,
      exported_at: new Date().toISOString(),
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `apex-account-${(user?.id || '').slice(0,8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Account data exported');
  }, [user, profile, transactions, metrics]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (user) { fetchTransactions(); fetchMetrics(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchMetrics = async () => {
    if (!user) return;
    try {
      const { data: projects } = await supabase
        .from('movie_projects').select('id, status').eq('user_id', user.id);
      const { data: allTransactions } = await supabase
        .from('credit_transactions_safe').select('amount, clip_duration_seconds, transaction_type, created_at').eq('user_id', user.id);
      const videoTransactions = allTransactions?.filter(t => t.transaction_type === 'usage' && t.amount < 0) || [];
      setMetrics({
        totalProjects: projects?.length || 0,
        completedProjects: projects?.filter(p => p.status === 'completed').length || 0,
        totalVideosGenerated: videoTransactions.length,
        totalVideoDuration: videoTransactions.reduce((sum, t) => sum + (t.clip_duration_seconds || 0), 0),
      });
      // Build a 14-day usage sparkline (absolute spend per day)
      const now = new Date();
      const buckets: number[] = Array.from({ length: 14 }, () => 0);
      (allTransactions || []).forEach((t: any) => {
        if (t.amount >= 0 || !t.created_at) return;
        const d = new Date(t.created_at);
        const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days < 14) buckets[13 - days] += Math.abs(t.amount);
      });
      setUsageSeries(buckets);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('credit_transactions_safe').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
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

  const animatedCredits = useAnimatedNumber(profile?.credits_balance || 0);
  const animatedUsed = useAnimatedNumber(profile?.total_credits_used || 0);
  const animatedVideos = useAnimatedNumber(metrics.totalVideosGenerated);

  const lifetimeSpendUsd = ((profile?.total_credits_used || 0) * 0.10);
  const lifetimeValueUsd = ((profile?.total_credits_used || 0) + (profile?.credits_balance || 0)) * 0.10;
  const serial = (user?.id || '').replace(/-/g, '').slice(0, 12).toUpperCase();

  const copyToClipboard = useCallback((value: string, label: string) => {
    navigator.clipboard?.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed'),
    );
  }, []);

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-[hsl(150,80%,55%)]" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-[hsl(215,100%,60%)]" />;
    if (amount < 0) return <Zap className="w-4 h-4 text-[hsl(215,100%,68%)]" />;
    return <TrendingUp className="w-4 h-4 text-[hsl(150,80%,55%)]" />;
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Recently';

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

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ─── Eyebrow: privacy badge ─── */}
        <div className="flex items-center justify-center animate-fade-in">
          <PrivateBadge />
        </div>

        {/* ─── HERO: Identity card ─── */}
        <section
          className="relative px-6 sm:px-10 py-8 rounded-[28px] overflow-hidden animate-fade-in"
        >
          <div className="absolute inset-0 rounded-[28px] bg-[hsla(220,14%,4%,0.6)] backdrop-blur-2xl border border-[hsla(215,100%,60%,0.12)]" />
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,75%,0.7), hsla(215,100%,60%,0.3), hsla(215,100%,75%,0.7), transparent)' }} />
          <div
            className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.22), transparent 65%)', filter: 'blur(60px)' }}
          />

          {/* Engraved monogram watermark */}
          <div
            aria-hidden
            className="absolute right-6 bottom-2 pointer-events-none select-none font-bold tracking-tighter opacity-[0.06] text-foreground hidden sm:block"
            style={{ fontFamily: 'Sora, sans-serif', fontSize: 180, lineHeight: 1 }}
          >
            {(profile?.display_name?.charAt(0) || user?.email?.charAt(0) || 'A').toUpperCase()}
          </div>
          {/* Serial engraving */}
          <div className="absolute left-6 top-3 hidden md:flex items-center gap-2 text-[9px] uppercase tracking-[0.5em] text-muted-foreground font-mono">
            <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)]" style={{ animation: 'profileTick 2.4s ease-in-out infinite' }} />
            SN · {serial}
          </div>

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div
                className="absolute -inset-2 rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'conic-gradient(from 0deg, hsla(215,100%,60%,0.55), hsla(210,100%,55%,0.2), hsla(215,100%,68%,0.45), hsla(215,100%,60%,0.55))',
                  filter: 'blur(14px)',
                  animation: 'profileAurora 14s linear infinite',
                }}
              />
              <Avatar className="relative w-24 h-24 ring-2 ring-[hsla(215,100%,60%,0.4)]">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-[hsl(220,14%,6%)] text-[hsl(215,100%,75%)] text-2xl font-bold">
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
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[hsl(220,14%,6%)] border border-[hsla(215,100%,60%,0.4)] flex items-center justify-center hover:bg-[hsl(220,14%,9%)] hover:border-[hsl(215,100%,60%)] transition-all disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 text-[hsl(215,100%,68%)] animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5 text-[hsl(215,100%,68%)]" />
                )}
              </button>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.4em] text-[hsl(215,100%,68%)] font-mono">
                  ACCOUNT · ID {(user?.id || '').slice(0, 6).toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.28em] font-mono border border-white/10 text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="bg-[hsla(220,14%,3%,0.85)] border border-[hsla(215,100%,60%,0.35)] rounded-lg px-3 py-1.5 text-2xl font-bold text-foreground outline-none focus:border-[hsl(215,100%,60%)] focus:ring-2 focus:ring-[hsla(215,100%,60%,0.2)]"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      maxLength={50}
                    />
                    <Button size="sm" variant="ghost" className="text-[hsl(150,80%,60%)]" onClick={handleSaveName} disabled={savingName}>
                      {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <>
                    <h1
                      className="text-3xl sm:text-4xl font-bold tracking-tight"
                      style={{
                        fontFamily: 'Sora, sans-serif',
                        backgroundImage: 'linear-gradient(135deg, #ffffff 0%, hsl(215,100%,85%) 60%, hsl(215,100%,68%) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {profile?.display_name || 'Set your name'}
                    </h1>
                    <button
                      onClick={() => { setNameValue(profile?.display_name || ''); setEditingName(true); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-[hsl(215,100%,72%)] hover:bg-[hsla(215,100%,60%,0.08)] transition"
                      aria-label="Edit display name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[hsl(215,100%,68%)]" />
                  <span className="font-mono text-xs">{user?.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[hsl(215,100%,68%)]" />
                  <span className="text-xs">Member since {memberSince}</span>
                </div>
              </div>

              {/* Quick action chips */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => user?.email && copyToClipboard(user.email, 'Email')}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground bg-[hsla(220,14%,5%,0.6)] border border-white/[0.06] hover:border-[hsla(215,100%,60%,0.3)] transition-all"
                >
                  <Copy className="w-3 h-3 group-hover:text-[hsl(215,100%,72%)]" /> Copy email
                </button>
                <button
                  onClick={() => user?.id && copyToClipboard(user.id, 'Account ID')}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground bg-[hsla(220,14%,5%,0.6)] border border-white/[0.06] hover:border-[hsla(215,100%,60%,0.3)] transition-all"
                >
                  <Fingerprint className="w-3 h-3 group-hover:text-[hsl(215,100%,72%)]" /> Copy ID
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground bg-[hsla(220,14%,5%,0.6)] border border-white/[0.06] hover:border-[hsla(215,100%,60%,0.3)] transition-all"
                >
                  <Settings className="w-3 h-3 group-hover:text-[hsl(215,100%,72%)]" /> Settings
                </button>
              </div>
            </div>

            {/* Credits */}
            <div className="flex flex-col items-stretch gap-2 lg:items-end shrink-0">
              <div className="relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-[hsl(220,14%,4%)] border border-[hsla(215,100%,60%,0.25)] overflow-hidden">
                <div className="absolute inset-0 opacity-60"
                  style={{ background: 'radial-gradient(circle at 0% 0%, hsla(215,100%,60%,0.18), transparent 60%)' }}
                />
                <Coins className="relative w-5 h-5 text-[hsl(215,100%,72%)]" />
                <span className="relative text-2xl font-bold text-foreground tabular-nums">{animatedCredits.toLocaleString()}</span>
                <span className="relative text-[10px] uppercase tracking-[0.3em] text-muted-foreground">credits</span>
              </div>
              <Button
                onClick={() => setShowBuyModal(true)}
                size="sm"
                className="bg-[hsl(215,100%,60%)] hover:bg-[hsl(215,100%,55%)] text-foreground font-semibold shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.8)] border border-[hsla(215,100%,75%,0.3)]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Buy Credits
              </Button>
            </div>
          </div>

        </section>

        {/* ─── At-a-glance stats ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
          {[
            { label: 'Credits Available', value: animatedCredits, icon: Coins, accent: true, sub: `$${(animatedCredits * 0.10).toFixed(2)} value` },
            { label: 'Credits Used', value: animatedUsed, icon: Zap, sub: `$${lifetimeSpendUsd.toFixed(2)} lifetime`, spark: true },
            { label: 'Videos Generated', value: animatedVideos, icon: Video, sub: `${Math.round(metrics.totalVideoDuration)}s rendered` },
            { label: 'Projects', value: metrics.totalProjects, icon: Sparkles, sub: `${metrics.completedProjects} completed` },
          ].map((stat, i) => (
            <div
              key={i}
              className={cn("relative p-5 overflow-hidden", glassCard, glassCardHover)}
              style={{ animation: `profileRise 0.55s ease-out both`, animationDelay: `${i * 70}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,60%,0.45)] to-transparent" />
              <div className="relative flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)]">
                  <stat.icon className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                {stat.spark && usageSeries.some(v => v > 0) && (
                  <div className="opacity-90"><Sparkline values={usageSeries} /></div>
                )}
              </div>
              <p className="relative text-3xl font-bold text-foreground tabular-nums">{Number(stat.value).toLocaleString()}</p>
              <p className="relative text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mt-1">{stat.label}</p>
              {stat.sub && (
                <p className="relative text-[11px] text-muted-foreground/80 mt-2 font-mono">{stat.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* ─── TABS ─── */}
        <section className="flex items-center justify-center animate-fade-in">
          <div className="inline-flex p-1.5 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.12)] backdrop-blur-2xl">
            {[
              { id: 'account' as TabType, label: 'Account', icon: User },
              { id: 'usage' as TabType, label: 'Usage & Billing', icon: BarChart3 },
              { id: 'security' as TabType, label: 'Security', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all rounded-full uppercase tracking-[0.18em] text-[11px]",
                  activeTab === tab.id
                    ? "text-foreground shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.7)]"
                    : "text-muted-foreground hover:text-foreground/90 hover:bg-[hsla(215,100%,60%,0.06)]"
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

        {/* ─── ACCOUNT ─── */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Account fields */}
            <div className="lg:col-span-2 space-y-6">
              <div className={cn("p-6", glassCard)}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                    <User className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Account Identity</h3>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Private to you</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <FieldRow
                    label="Display Name"
                    value={profile?.display_name || 'Not set'}
                    action={
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[hsl(215,100%,72%)]"
                        onClick={() => { setNameValue(profile?.display_name || ''); setEditingName(true); }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    }
                  />
                  <FieldRow label="Email" value={user?.email || ''} mono />
                  <FieldRow label="Account ID" value={user?.id || ''} mono />
                  <FieldRow label="Member Since" value={memberSince} />
                </div>
              </div>

              {/* Plan */}
              <div className={cn("p-6 relative overflow-hidden", glassCard)}>
                <div
                  className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.20), transparent 65%)', filter: 'blur(40px)' }}
                />
                <div className="relative flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                    <Crown className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Plan & Credits</h3>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Pay-as-you-go</p>
                  </div>
                </div>

                <div className="relative p-5 rounded-xl bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.25)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-foreground">Personal</p>
                      <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground">Pay-as-you-go · $0.10/credit</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(profile?.credits_balance || 0).toLocaleString()} credits · ${((profile?.credits_balance || 0) * 0.10).toFixed(2)} balance · ${lifetimeValueUsd.toFixed(2)} lifetime value
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowBuyModal(true)}
                    className="bg-[hsl(215,100%,60%)] hover:bg-[hsl(215,100%,55%)] text-foreground font-semibold shadow-[0_10px_30px_-10px_hsla(215,100%,60%,0.8)] border border-[hsla(215,100%,75%,0.3)]"
                  >
                    Top up
                  </Button>
                </div>

                {/* Mini spend summary */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { k: 'Lifetime spend', v: `$${lifetimeSpendUsd.toFixed(2)}` },
                    { k: 'Avg / video', v: metrics.totalVideosGenerated ? `$${(lifetimeSpendUsd / metrics.totalVideosGenerated).toFixed(2)}` : '—' },
                    { k: 'Credits / project', v: metrics.totalProjects ? Math.round((profile?.total_credits_used || 0) / metrics.totalProjects).toLocaleString() : '—' },
                  ].map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                      <p className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground font-mono">{m.k}</p>
                      <p className="text-base font-bold text-foreground tabular-nums mt-1">{m.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Messages — private */}
            <div className="space-y-6">
              <ErrorBoundary fallback={null}>
                <MessagesInbox className="h-auto" />
              </ErrorBoundary>
              <ErrorBoundary fallback={null}>
                <SupportInbox />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* ─── USAGE & BILLING ─── */}
        {activeTab === 'usage' && (
          <div className="space-y-6 animate-fade-in">
            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Credit History</h3>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">All transactions</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleExport} className="text-muted-foreground hover:text-[hsl(215,100%,72%)] gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
              </div>

              <div className="space-y-2">
                {loadingTransactions ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.03]" />
                  ))
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05] hover:border-[hsla(215,100%,60%,0.18)] transition-colors">
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{tx.description || tx.transaction_type}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{formatRelativeTime(tx.created_at)}</p>
                      </div>
                      <span className={cn(
                        "text-base font-semibold font-mono tabular-nums",
                        tx.amount > 0 ? "text-[hsl(150,80%,60%)]" : "text-muted-foreground"
                      )}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Billing</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Manage payment methods</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                <p className="text-sm text-muted-foreground">Buy more credits or open the secure payment portal.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/credits')}
                    className="border-[hsla(215,100%,60%,0.25)] text-foreground hover:bg-[hsla(215,100%,60%,0.08)]">
                    Open Credits
                  </Button>
                  <Button size="sm" onClick={() => setShowBuyModal(true)}
                    className="bg-[hsl(215,100%,60%)] hover:bg-[hsl(215,100%,55%)] text-foreground">
                    Buy Credits
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── SECURITY ─── */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-fade-in">
            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Password</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Account access</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                <div>
                  <p className="text-sm font-medium text-foreground">Reset password</p>
                  <p className="text-xs text-muted-foreground mt-0.5">We'll email a secure link to {user?.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={handlePasswordReset} disabled={sendingReset}
                  className="border-[hsla(215,100%,60%,0.25)] text-foreground hover:bg-[hsla(215,100%,60%,0.08)]">
                  {sendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send link'}
                </Button>
              </div>
            </div>

            {/* Two-factor — full TOTP enroll/verify/disable */}
            <TwoFactorCard glassCard={glassCard} />

            {/* Connected accounts */}
            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <Globe className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Connected sign-in</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Identity providers</p>
                </div>
              </div>
              <div className="space-y-3">
                {(() => {
                  const provider = (user as any)?.app_metadata?.provider || 'email';
                  const isGoogle = provider === 'google';
                  const isApple = provider === 'apple';
                  return (
                    <>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                        <div>
                          <p className="text-sm font-medium text-foreground">Email & password</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-[hsl(150,80%,60%)]">Active</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                        <div>
                          <p className="text-sm font-medium text-foreground">Google</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{isGoogle ? 'Linked to this account' : 'Not connected'}</p>
                        </div>
                        <span className={cn("text-[10px] uppercase tracking-[0.3em] font-mono", isGoogle ? 'text-[hsl(150,80%,60%)]' : 'text-muted-foreground')}>
                          {isGoogle ? 'Linked' : 'Available'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                        <div>
                          <p className="text-sm font-medium text-foreground">Apple</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{isApple ? 'Linked to this account' : 'Not connected'}</p>
                        </div>
                        <span className={cn("text-[10px] uppercase tracking-[0.3em] font-mono", isApple ? 'text-[hsl(150,80%,60%)]' : 'text-muted-foreground')}>
                          {isApple ? 'Linked' : 'Available'}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Active session */}
            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <Fingerprint className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Active session</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">This device</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[hsla(215,100%,60%,0.1)] border border-[hsla(215,100%,60%,0.25)] flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-[hsl(215,100%,68%)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {typeof navigator !== 'undefined' ? (navigator.userAgent.match(/(Chrome|Safari|Firefox|Edge)/)?.[0] || 'Browser') : 'Browser'}
                      {' · '}
                      {typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'} · last active just now
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] font-mono text-[hsl(150,80%,60%)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(150,80%,55%)]" style={{ animation: 'profileTick 1.6s ease-in-out infinite' }} />
                  Live
                </span>
              </div>
            </div>

            <div className={cn("p-6", glassCard)}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                  <Settings className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Sessions & Data</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Privacy controls</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                  <div>
                    <p className="text-sm font-medium text-foreground">Export account data</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Download your identity, credits and transactions</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleExport}
                    className="border-[hsla(215,100%,60%,0.25)] text-foreground hover:bg-[hsla(215,100%,60%,0.08)] gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sign out everywhere</p>
                    <p className="text-xs text-muted-foreground mt-0.5">End this session and return to sign-in</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => signOut?.()}
                    className="border-[hsla(0,70%,50%,0.3)] text-[hsl(0,70%,70%)] hover:bg-[hsla(0,70%,50%,0.08)] gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(0,70%,50%,0.05)] border border-[hsla(0,70%,50%,0.18)]">
                  <div>
                    <p className="text-sm font-medium text-[hsl(0,70%,75%)]">Deactivate account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account and all data</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/settings/deactivate')}
                    className="border-[hsla(0,70%,50%,0.4)] text-[hsl(0,70%,75%)] hover:bg-[hsla(0,70%,50%,0.12)]">
                    Deactivate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Footer plate ─── */}
        <div className="relative pt-4 pb-2 flex flex-col items-center gap-2 animate-fade-in">
          <div className="h-px w-32" style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,68%,0.6), transparent)' }} />
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-mono">
            <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)]" style={{ animation: 'profileTick 2.4s ease-in-out infinite' }} />
            APEX STUDIO · PRIVATE ACCOUNT · ENC-{(user?.id || '').slice(0, 4).toUpperCase()}
            <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)]" style={{ animation: 'profileTick 2.4s ease-in-out infinite', animationDelay: '0.6s' }} />
          </div>
        </div>
      </main>

      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </div>
  );
}));

function FieldRow({ label, value, mono, action }: { label: string; value: string; mono?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-1">{label}</p>
        <p className={cn("text-sm text-foreground truncate", mono && "font-mono text-xs")}>{value}</p>
      </div>
      {action}
    </div>
  );
}

function Profile() {
  return (
    <ErrorBoundary>
      <ProfileContent />
    </ErrorBoundary>
  );
}

export default Profile;
