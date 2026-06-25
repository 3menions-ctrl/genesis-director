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
        <div className="lit-edge relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2f6bff]/24 to-[#7a3bff]/12 p-5">
          <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-[#7a3bff]/30 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <LevelRing level={level} pct={pct} />
            <div className="min-w-0 flex-1">
              <div className="text-[19px] font-normal italic leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
                {title}
              </div>
              <div className="mt-1 font-mono text-[11px] tabular-nums text-[#9ab4ff]">
                {intoLevel} / {XP_PER_LEVEL} XP to Level {level + 1}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <Flame className={cn('h-7 w-7', streak > 0 ? 'fill-orange-500 text-orange-400' : 'text-white/25')} />
              <span className="font-display text-[13px] font-bold tabular-nums">{streak}</span>
            </div>
          </div>
          <div className="relative mt-4 font-mono text-[11px] text-white/55">
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
                'grid h-[50px] w-[50px] place-items-center rounded-[17px] text-[22px]',
                b.earned ? 'surface-1' : 'bg-white/[0.025] opacity-35',
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
          <div className="surface-1 rounded-[24px] px-5 py-9 text-center">
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
                className="lit-edge relative aspect-video overflow-hidden rounded-[16px] bg-black/30"
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
    <div className="surface-1 flex-1 rounded-[20px] py-4 text-center">
      <div className={cn('flex items-center justify-center gap-1 font-display text-[22px] font-semibold tabular-nums', accent && 'text-[#7aa2ff]')}>
        {value}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
        {icon} {label}
      </div>
    </div>
  );
}

/** Circular XP progress ring with the current level in the center. */
function LevelRing({ level, pct }: { level: number; pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[64px] w-[64px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#xpgrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
        <defs>
          <linearGradient id="xpgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3f78ff" />
            <stop offset="100%" stopColor="#a061ff" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-[22px] font-bold leading-none tabular-nums">{level}</span>
      </div>
    </div>
  );
}
