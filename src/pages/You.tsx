/**
 * You — the mobile profile. Borderless, editorial, floating.
 *
 * No card containers: the avatar, name, level, stats, achievements and films
 * sit directly on the Aurora backdrop, separated by space and hairlines, so
 * everything reads as floating rather than boxed.
 *
 * Levels / XP / streak are DERIVED from real activity (films · plays · likes).
 * Credits are spend-only (Apple 3.1.1): a balance, never a buy button. Films
 * are shown at their native aspect ratio.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Lock, LogIn, Sparkles } from 'lucide-react';
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

  const stats = [
    { value: String(films.length), label: 'Films' },
    { value: compact(totalLikes), label: 'Likes' },
    { value: `◇ ${compact(available)}`, label: 'Credits', accent: true },
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
          aria-label="Sign in"
          title="Sign in"
          className="relative z-10 mt-1 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_16px_40px_-12px_rgba(80,90,255,.7)]"
        >
          <LogIn className="h-[22px] w-[22px]" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div
        className="relative z-10 px-6"
        style={{
          paddingTop: 'calc(var(--safe-top,0px) + 36px)',
          paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)',
        }}
      >
        {/* Hero — floating, centered */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {/* soft glow halo so the avatar floats */}
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-[#5a6bff]/25 blur-2xl" />
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="relative h-[92px] w-[92px] rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <span className="relative grid h-[92px] w-[92px] place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] font-display text-3xl font-semibold">
                {initial}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-[28px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{name}</h1>
          <div className="mt-0.5 font-mono text-[13px] text-white/40">{handle}</div>
        </div>

        {/* Level — a floating line + hairline progress, no container */}
        <div className="mt-8">
          <div className="flex items-end justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#9ab4ff]">
              {title} · Level {level}
            </span>
            <span className="flex items-center gap-1.5 font-display text-[13px] font-semibold">
              <Flame className={cn('h-[18px] w-[18px]', streak > 0 ? 'fill-orange-500 text-orange-400' : 'text-white/25')} />
              <span className="tabular-nums">{streak}</span>
              <span className="text-white/40">day{streak === 1 ? '' : 's'}</span>
            </span>
          </div>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#3f78ff] to-[#a061ff]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 font-mono text-[11px] tabular-nums text-white/40">
            {intoLevel} / {XP_PER_LEVEL} XP to Level {level + 1}
          </div>
        </div>

        {/* Stats — floating numbers, separated by hairlines (no boxes) */}
        <div className="mt-9 flex items-stretch">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('flex flex-1 flex-col items-center', i > 0 && 'border-l border-white/[0.08]')}>
              <span className={cn('font-light tabular-nums text-[26px]', s.accent ? 'text-[#8fb4ff]' : 'text-white')} style={{ fontFamily: 'Fraunces, serif' }}>
                {s.value}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Achievements — floating medallions, no tiles, no label */}
        <div className="mt-9 text-center">
          <div className="flex justify-center gap-6">
            {badges.map((b) => (
              <div key={b.id} title={b.label} className="relative grid place-items-center">
                {b.earned ? (
                  <>
                    <span className="pointer-events-none absolute h-9 w-9 rounded-full bg-[#5a6bff]/25 blur-lg" />
                    <span className="relative text-[26px] drop-shadow-[0_4px_10px_rgba(0,0,0,.5)]">{b.emoji}</span>
                  </>
                ) : (
                  <Lock className="h-[18px] w-[18px] text-white/20" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Films — borderless thumbnails floating in a grid, no label */}
        <div className="mt-10">
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-[16px] bg-white/[0.04]" />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div className="flex justify-center py-10">
            <button
              onClick={() => { void hapticTap(); navigate('/create'); }}
              aria-label="Create your first film"
              title="Create your first film"
              className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_14px_34px_-12px_rgba(80,90,255,.7)]"
            >
              <Sparkles className="h-[22px] w-[22px]" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {films.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate(`/r/${f.id}`)}
                className="relative aspect-video overflow-hidden rounded-[16px] bg-black/30 shadow-[0_10px_26px_-14px_rgba(0,0,0,.8)]"
              >
                {f.thumbnail_url ? (
                  <img src={f.thumbnail_url} alt={f.title} className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-2 left-2 flex items-center gap-1 font-mono text-[10px] font-semibold text-white/90">
                  ▶ {compact(f.play_count)}
                </span>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
