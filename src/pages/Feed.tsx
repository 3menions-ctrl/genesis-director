/**
 * Feed — the vertical, swipeable, full-screen "For You" wall of AI films.
 *
 * This is the first screen of the mobile-first redesign (see the iPhone
 * mockups). It is the native landing route; on web it's reachable at /feed for
 * testing. The differentiator vs. a passive video feed: every clip has a
 * one-tap **Remix** that drops you into the create flow with the film as a
 * starting point.
 *
 * Data: useReelsFeed (published_reels, with a static FILMS fallback).
 * Playback: FeedVideo (muted, looping, plays only while in view).
 * Social: toggle_like_reel + remix_reel RPCs (same as the theater view).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Repeat2, Share2, Volume2, VolumeX, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useReelsFeed, type FeedItem } from '@/hooks/useReelsFeed';
import { FeedVideo } from '@/components/feed/FeedVideo';
import { GrainOverlay } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export default function Feed() {
  const { items, loading } = useReelsFeed();
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track which card is in view → that one plays, the rest pause.
  useEffect(() => {
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { threshold: [0.6] },
    );
    cardRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white">
      {/* For You header */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-30 flex justify-center gap-6"
        style={{ top: 'calc(var(--safe-top, 0px) + 14px)' }}
      >
        <span className="font-display text-[15px] font-semibold text-white/45">Following</span>
        <span className="relative font-display text-[15px] font-semibold text-white">
          For You
          <span className="absolute -bottom-2 left-1/2 h-[2.5px] w-5 -translate-x-1/2 rounded bg-white" />
        </span>
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute z-30 grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur-md"
        style={{ top: 'calc(var(--safe-top, 0px) + 10px)', right: '14px' }}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
      </button>

      {/* Snap-scrolling feed */}
      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
        style={{ scrollbarWidth: 'none' }}
      >
        {loading && items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Sparkles className="h-6 w-6 animate-pulse text-white/40" />
          </div>
        ) : (
          items.map((item, i) => (
            <FeedCard
              key={`${item.id}-${i}`}
              innerRef={(el) => (cardRefs.current[i] = el)}
              index={i}
              item={item}
              active={i === active}
              muted={muted}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── single card ───────────────────────── */

interface FeedCardProps {
  index: number;
  item: FeedItem;
  active: boolean;
  muted: boolean;
}

const FeedCard = ({ innerRef, index, item, active, muted }: FeedCardProps & { innerRef: (el: HTMLDivElement | null) => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [busy, setBusy] = useState(false);

  const like = useCallback(async () => {
    void hapticTap();
    if (item.isStatic) {
      toast('Sign in on the full app to like films');
      return;
    }
    if (!user) {
      toast.error('Sign in to like');
      navigate('/auth');
      return;
    }
    const was = liked;
    setLiked(!was);
    setLikeCount((c) => Math.max(0, c + (was ? -1 : 1)));
    try {
      const { error } = await supabase.rpc('toggle_like_reel' as never, { p_reel_id: item.id } as never);
      if (error) throw error;
    } catch {
      // rollback
      setLiked(was);
      setLikeCount((c) => Math.max(0, c + (was ? 1 : -1)));
      toast.error("Couldn't update like");
    }
  }, [liked, item.id, item.isStatic, user, navigate]);

  const remix = useCallback(async () => {
    void hapticTap();
    // Static fallback films have no backend reel → start a fresh create
    // prefilled with the film's title as the seed idea.
    if (item.isStatic) {
      navigate(`/studio?prompt=${encodeURIComponent(item.title ?? '')}`);
      return;
    }
    if (!user) {
      toast.error('Sign in to remix');
      navigate('/auth');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('remix_reel' as never, { p_reel_id: item.id } as never);
      if (error) throw error;
      const out = data as { new_project_id?: string };
      if (out?.new_project_id) {
        toast.success('Remix started');
        navigate(`/editor/${out.new_project_id}`);
      } else {
        navigate(`/studio?prompt=${encodeURIComponent(item.title ?? '')}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remix failed');
    } finally {
      setBusy(false);
    }
  }, [item.id, item.isStatic, item.title, user, busy, navigate]);

  const share = useCallback(async () => {
    void hapticTap();
    const url = item.isStatic
      ? `${window.location.origin}/films`
      : `${window.location.origin}/r/${item.id}`;
    const title = item.title ?? 'A film on Small Bridges';
    // Native share sheet in WKWebView; clipboard fallback elsewhere.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user canceled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      } catch {
        toast.error("Couldn't copy");
      }
    }
  }, [item.id, item.isStatic, item.title]);

  const initial = (item.creator_name ?? 'S').trim().charAt(0).toUpperCase();

  return (
    <section
      ref={innerRef}
      data-idx={index}
      className="relative h-full w-full snap-start snap-always overflow-hidden"
    >
      <FeedVideo src={item.video_url} poster={item.thumbnail_url ?? undefined} active={active} muted={muted} />

      {/* cinematic grain + legibility scrims */}
      <GrainOverlay opacity={0.05} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/60 via-black/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* right action rail */}
      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-5"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 132px)' }}
      >
        <button onClick={() => navigate('/profile')} className="relative" aria-label="Creator">
          {item.creator_avatar ? (
            <img src={item.creator_avatar} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-[#ffb86b] to-[#ff6bcb] font-display text-lg font-bold">
              {initial}
            </span>
          )}
          <span className="absolute -bottom-1.5 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full border-2 border-[#0a0a0a] bg-[#2f6bff] text-[13px] font-bold leading-none">
            +
          </span>
        </button>

        <RailButton label={compact(likeCount)} onClick={like} active={liked} aria-label="Like">
          <Heart className={cn('h-6 w-6', liked && 'fill-[#ff3b6b] stroke-[#ff3b6b]')} />
        </RailButton>

        <RailButton label="Remix" highlight onClick={remix} aria-label="Remix">
          <Repeat2 className="h-6 w-6" />
        </RailButton>

        <RailButton label="Share" onClick={share} aria-label="Share">
          <Share2 className="h-6 w-6" />
        </RailButton>
      </div>

      {/* caption */}
      <div
        className="absolute left-4 z-20 max-w-[72%]"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 96px)' }}
      >
        <div className="flex items-center gap-2 font-display text-[16px] font-bold">
          @{(item.creator_name ?? 'smallbridges').replace(/\s+/g, '').toLowerCase()}
          <span className="text-[#7aa2ff]">✦</span>
        </div>
        {(item.title || item.synopsis) && (
          <div className="mt-1.5 text-[14px] leading-snug text-white/90 line-clamp-2">
            {item.synopsis || item.title}
          </div>
        )}
        {item.tags.length > 0 && (
          <div className="mt-1.5 text-[13px] font-semibold text-[#7aa2ff] line-clamp-1">
            {item.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
          </div>
        )}
      </div>

      {/* Remix CTA */}
      <button
        onClick={remix}
        disabled={busy}
        className="absolute left-4 right-4 z-20 flex h-[52px] items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] font-display text-[15px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_16px_34px_-8px_rgba(80,80,255,.65)] backdrop-blur-sm disabled:opacity-60"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 38px)' }}
      >
        <Repeat2 className="h-[18px] w-[18px]" />
        {busy ? 'Starting remix…' : 'Remix this into your own film'}
      </button>
    </section>
  );
};

function RailButton({
  children,
  label,
  onClick,
  highlight,
  active,
  ...rest
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
  active?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5" {...rest}>
      <span
        className={cn(
          'grid h-12 w-12 place-items-center rounded-full backdrop-blur-md transition-transform',
          highlight
            ? 'bg-gradient-to-br from-[#2f6bff] to-[#7a3bff] shadow-[0_12px_28px_-6px_rgba(80,90,255,.85)]'
            : 'bg-white/[0.12] shadow-[0_8px_22px_-10px_rgba(0,0,0,.8)]',
          active && 'scale-105',
        )}
      >
        {children}
      </span>
      <span className="font-display text-[11px] font-semibold">{label}</span>
    </button>
  );
}
