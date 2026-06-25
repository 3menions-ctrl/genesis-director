/**
 * You — the mobile profile, gamified.
 *
 * Levels / XP / streak are DERIVED from real activity (films published, plays,
 * likes) — not faked. Credits are shown spend-only (Apple 3.1.1): a balance,
 * never a buy button. Films grid is the user's own published reels, each shown
 * at its native aspect ratio (object-contain), per the media rule.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Heart, Film, Sparkles, Trophy, Lock, Zap, Star, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useMyFilms } from '@/hooks/useMyFilms';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const TITLES = ['Newcomer', 'Creator', 'Director', 'Auteur', 'Visionary', 'Legend'];
const XP_PER_LEVEL = 500;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export default function You() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { available } = useCredits();
  const { films, totalLikes, totalPlays, streak, loading } = useMyFilms();

  const { level, title, intoLevel, pct } = useMemo(() => {
    const xp = films.length * 100 + totalLikes * 5 + totalPlays;
    const lvl = Math.floor(xp / XP_PER_LEVEL) + 1;
    return {
      level: lvl,
      title: TITLES[Math.min(lvl - 1, TITLES.length - 1)],
      intoLevel: xp % XP_PER_LEVEL,
      pct: Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100),
    };
  }, [films.length, totalLikes, totalPlays]);

  const name = profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'You';
  const handle = `@${name.replace(/\s+/g, '').toLowerCase()}`;
  const initial = name.trim().charAt(0).toUpperCase();

  const badges = [
    { id: 'first', emoji: '🎬', label: 'First film', earned: films.length >= 1 },
    { id: 'streak', emoji: '🔥', label: '3-day streak', earned: streak >= 3 },
    { id: 'liked', emoji: '❤️', label: '100 likes', earned: totalLikes >= 100 },
    { id: 'viral', emoji: '🚀', label: '10k plays', earned: totalPlays >= 10_000 },
    { id: 'prolific', emoji: '🏆', label: '10 films', earned: films.length >= 10 },
  ];

  if (!user) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center text-white"
        style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px))' }}
      >
        <AuroraBackdrop />
        <Sparkles className="relative z-10 h-9 w-9 text-[#7aa2ff]" />
        <div className="relative z-10 text-[24px] font-light italic" style={{ fontFamily: 'Fraunces, serif' }}>Sign in to see your studio</div>
        <p className="relative z-10 max-w-[260px] text-[14px] text-white/55">
          Track your films, levels, streaks and credits — and remix anything from the feed.
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="relative z-10 mt-1 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] px-7 font-display text-[15px] font-bold shadow-[0_16px_40px_-12px_rgba(80,90,255,.7)]"
        >
          <LogIn className="h-[18px] w-[18px]" /> Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div
        className="relative z-10 px-5"
        style={{
          paddingTop: 'calc(var(--safe-top,0px) + 26px)',
          paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 24px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-[74px] w-[74px] rounded-full object-cover shadow-[0_10px_30px_-8px_rgba(0,0,0,.7)] ring-1 ring-white/10" />
          ) : (
            <span className="grid h-[74px] w-[74px] place-items-center rounded-full bg-gradient-to-br from-[#ffb86b] to-[#ff6bcb] font-display text-2xl font-bold shadow-[0_12px_34px_-8px_rgba(255,120,180,.5)]">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-[24px] font-light" style={{ fontFamily: 'Fraunces, serif' }}>{name}</div>
            <div className="font-mono text-[13px] text-white/40">{handle}</div>
          </div>
        </div>

        {/* Level / XP / streak — borderless, lit by its own bloom */}
        <div className="relative mt-6 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#2f6bff]/22 to-[#7a3bff]/14 p-5 shadow-[0_24px_60px_-26px_rgba(60,80,255,.7)]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#7a3bff]/30 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-[18px] font-normal italic" style={{ fontFamily: 'Fraunces, serif' }}>
                {title} · Level {level}
              </div>
              <div className="mt-1 font-mono text-[11px] text-[#9ab4ff]">
                {intoLevel} / {XP_PER_LEVEL} XP to Level {level + 1}
              </div>
            </div>
            <div className="flex items-center gap-1 font-display text-[16px] font-bold">
              <Flame className={cn('h-7 w-7', streak > 0 ? 'fill-orange-500 text-orange-400' : 'text-white/30')} />
              {streak}
            </div>
          </div>
          <div className="relative mt-3.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff]" style={{ width: `${pct}%` }} />
          </div>
          <div className="relative mt-2.5 font-mono text-[11px] text-white/55">
            {streak > 0 ? `${streak}-day streak — keep it alive, make a film today` : 'Make a film today to start a streak 🔥'}
          </div>
        </div>

        {/* Stats — borderless floating tiles */}
        <div className="mt-4 flex gap-3">
          <Stat icon={<Film className="h-4 w-4" />} value={String(films.length)} label="Films" />
          <Stat icon={<Heart className="h-4 w-4" />} value={compact(totalLikes)} label="Likes" />
          {/* Credits — spend-only: balance shown, never a buy button. */}
          <Stat icon={<Zap className="h-4 w-4 text-[#7aa2ff]" />} value={`◇ ${compact(available)}`} label="Credits" accent />
        </div>

        {/* Badges */}
        <div className="mb-3.5 mt-7 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          <span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Badges</span>
        </div>
        <div className="flex gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              title={b.label}
              className={cn(
                'grid h-[48px] w-[48px] place-items-center rounded-[16px] text-[22px]',
                b.earned
                  ? 'bg-gradient-to-b from-white/[0.10] to-white/[0.03] shadow-[0_8px_20px_-10px_rgba(0,0,0,.7)]'
                  : 'bg-white/[0.03] opacity-35',
              )}
            >
              {b.earned ? b.emoji : <Lock className="h-4 w-4 text-white/40" />}
            </div>
          ))}
        </div>

        {/* Films grid */}
        <div className="mb-3.5 mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Your films</div>
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-[16px] bg-white/[0.04]" />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div className="rounded-[24px] bg-gradient-to-b from-white/[0.06] to-white/[0.015] px-5 py-9 text-center shadow-[0_20px_50px_-28px_rgba(0,0,0,.8)]">
            <div className="text-[17px] font-light italic" style={{ fontFamily: 'Fraunces, serif' }}>No films yet</div>
            <p className="mt-1.5 text-[13px] text-white/45">Tap + to create your first one.</p>
            <button
              onClick={() => {
                void hapticTap();
                navigate('/create');
              }}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] px-6 font-display text-[14px] font-bold shadow-[0_14px_34px_-12px_rgba(80,90,255,.7)]"
            >
              <Star className="h-4 w-4" /> Create
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {films.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate(`/r/${f.id}`)}
                className="relative aspect-video overflow-hidden rounded-[16px] bg-black/40 shadow-[0_10px_26px_-14px_rgba(0,0,0,.8)]"
              >
                {f.thumbnail_url ? (
                  // Native aspect ratio honored — contained, never cropped.
                  <img src={f.thumbnail_url} alt={f.title} className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a1130] to-[#0a0a0a]" />
                )}
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 font-mono text-[10px] font-semibold text-white drop-shadow">
                  ▶ {compact(f.play_count)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 rounded-[20px] bg-gradient-to-b from-white/[0.07] to-white/[0.02] py-4 text-center shadow-[0_12px_30px_-18px_rgba(0,0,0,.8)]">
      <div className={cn('flex items-center justify-center gap-1 font-display text-[21px] font-semibold', accent && 'text-[#7aa2ff]')}>
        {value}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
        {icon} {label}
      </div>
    </div>
  );
}
