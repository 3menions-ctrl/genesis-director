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
        className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#0a0a0a] px-8 text-center text-white"
        style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px))' }}
      >
        <Sparkles className="h-9 w-9 text-[#7aa2ff]" />
        <div className="font-display text-[22px] font-semibold">Sign in to see your studio</div>
        <p className="max-w-[260px] text-[14px] text-white/55">
          Track your films, levels, streaks and credits — and remix anything from the feed.
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="mt-1 flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] px-7 font-display text-[15px] font-bold"
        >
          <LogIn className="h-[18px] w-[18px]" /> Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0a] text-white">
      <div
        className="px-5"
        style={{
          paddingTop: 'calc(var(--safe-top,0px) + 24px)',
          paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 24px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-[72px] w-[72px] rounded-full border-2 border-white/20 object-cover" />
          ) : (
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-white/20 bg-gradient-to-br from-[#ffb86b] to-[#ff6bcb] font-display text-2xl font-bold">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate font-display text-[22px] font-semibold">{name}</div>
            <div className="font-mono text-[13px] text-white/45">{handle}</div>
          </div>
        </div>

        {/* Level / XP / streak */}
        <div className="mt-5 overflow-hidden rounded-[20px] border border-[#7a8cff]/40 bg-gradient-to-br from-[#2f6bff]/20 to-[#7a3bff]/18 p-[18px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[15px] font-bold">
                {title} · Level {level}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-[#9ab4ff]">
                {intoLevel} / {XP_PER_LEVEL} XP to Level {level + 1}
              </div>
            </div>
            <div className="flex items-center gap-1 font-display text-[15px] font-bold">
              <Flame className={cn('h-7 w-7', streak > 0 ? 'fill-orange-500 text-orange-400' : 'text-white/30')} />
              {streak}
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
            <div className="h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 font-mono text-[11px] text-white/55">
            {streak > 0 ? `${streak}-day streak — keep it alive, make a film today` : 'Make a film today to start a streak 🔥'}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3.5 flex gap-2.5">
          <Stat icon={<Film className="h-4 w-4" />} value={String(films.length)} label="Films" />
          <Stat icon={<Heart className="h-4 w-4" />} value={compact(totalLikes)} label="Likes" />
          {/* Credits — spend-only: balance shown, never a buy button. */}
          <Stat icon={<Zap className="h-4 w-4 text-[#7aa2ff]" />} value={`◇ ${compact(available)}`} label="Credits" accent />
        </div>

        {/* Badges */}
        <div className="mb-3 mt-6 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-white/55">
          <span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Badges</span>
        </div>
        <div className="flex gap-2.5">
          {badges.map((b) => (
            <div
              key={b.id}
              title={b.label}
              className={cn(
                'grid h-[46px] w-[46px] place-items-center rounded-[14px] border text-[22px]',
                b.earned ? 'border-white/12 bg-white/[0.06]' : 'border-white/8 bg-white/[0.02] opacity-35',
              )}
            >
              {b.earned ? b.emoji : <Lock className="h-4 w-4 text-white/40" />}
            </div>
          ))}
        </div>

        {/* Films grid */}
        <div className="mb-3 mt-6 text-[12px] font-semibold uppercase tracking-wide text-white/55">Your films</div>
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-[14px] bg-white/[0.04]" />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-8 text-center">
            <div className="font-display text-[15px] font-semibold">No films yet</div>
            <p className="mt-1 text-[13px] text-white/45">Tap + to create your first one.</p>
            <button
              onClick={() => {
                void hapticTap();
                navigate('/create');
              }}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] px-5 font-display text-[14px] font-bold"
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
                className="relative aspect-video overflow-hidden rounded-[14px] border border-white/8 bg-[#0a0a0a]"
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
    <div className="flex-1 rounded-[16px] border border-white/8 bg-white/[0.05] py-3.5 text-center">
      <div className={cn('flex items-center justify-center gap-1 font-display text-[20px] font-semibold', accent && 'text-[#7aa2ff]')}>
        {value}
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wide text-white/45">
        {icon} {label}
      </div>
    </div>
  );
}
