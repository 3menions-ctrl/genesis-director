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
import { Heart, MessageCircle, Repeat2, Share2, Volume2, VolumeX, Sparkles, SmilePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useReelsFeed, type FeedItem } from '@/hooks/useReelsFeed';
import { useVideoReactions, EMOJI_OPTIONS } from '@/hooks/useVideoReactions';
import { FeedVideo } from '@/components/feed/FeedVideo';
import { FeedComments } from '@/components/feed/FeedComments';
import { useHeartBurst, HeartLayer, CommentFlow } from '@/components/feed/LiveFlow';
import { GrainOverlay } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export default function Feed() {
  const { items, loading, loadMore, refresh } = useReelsFeed();
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comments, setComments] = useState<{ item: FeedItem; bump: () => void } | null>(null);
  const pullY = useRef(0);
  const pulling = useRef(false);
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

  // Infinite scroll — fetch the next page as the active reel nears the end.
  useEffect(() => { if (!loading && active >= items.length - 3) void loadMore(); }, [active, items.length, loading, loadMore]);

  // Pull-to-refresh at the top of the feed.
  const onTouchStart = (e: React.TouchEvent) => { const c = containerRef.current; if (c && c.scrollTop <= 0) { pullY.current = e.touches[0].clientY; pulling.current = true; } };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    if (e.touches[0].clientY - pullY.current > 80) { pulling.current = false; setRefreshing(true); refresh(); window.setTimeout(() => setRefreshing(false), 1300); }
  };
  const onTouchEnd = () => { pulling.current = false; };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white">
      {/* Mute toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute z-30 grid h-9 w-9 place-items-center drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]"
        style={{ top: 'calc(var(--safe-top, 0px) + 12px)', right: '14px' }}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="h-[20px] w-[20px]" /> : <Volume2 className="h-[20px] w-[20px]" />}
      </button>

      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: 'calc(var(--safe-top,0px) + 14px)' }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-[12px] backdrop-blur-md"><Loader2 className="h-3.5 w-3.5 animate-spin" />Refreshing</span>
        </div>
      )}

      {/* Snap-scrolling feed */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
              near={Math.abs(i - active) <= 1}
              muted={muted}
            />
          ))
        )}
      </div>

      {/* Stationary overlay — rail + caption stay put while videos scroll.
          Keyed on the active reel so its state resets as you scroll. */}
      {items[active] && (
        <FeedOverlay key={items[active].id} item={items[active]} onComments={setComments} />
      )}

      <FeedComments
        open={!!comments}
        reelId={comments?.item.id ?? null}
        isStatic={comments?.item.isStatic ?? false}
        onClose={() => setComments(null)}
        onPosted={() => comments?.bump()}
      />
    </div>
  );
}

/* ───────────────────────── single card ───────────────────────── */

interface FeedCardProps {
  index: number;
  near: boolean;
  item: FeedItem;
  active: boolean;
  muted: boolean;
}

const FeedCard = ({ innerRef, index, item, active, near, muted }: FeedCardProps & { innerRef: (el: HTMLDivElement | null) => void }) => {
  return (
    <section ref={innerRef} data-idx={index} className="relative h-full w-full snap-start snap-always overflow-hidden">
      {/* Windowing: only the active card + immediate neighbours mount a <video>;
          far cards show a lightweight poster so long feeds stay smooth. */}
      {near ? (
        <FeedVideo src={item.video_url} poster={item.thumbnail_url ?? undefined} active={active} muted={muted} />
      ) : (
        <div className="absolute inset-0 bg-[#0a0a0a]">
          {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" /> : <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 30%, rgba(47,107,255,.18), transparent 60%)' }} />}
        </div>
      )}
      <GrainOverlay opacity={0.05} />
    </section>
  );
};

/* ─────────────── stationary overlay (rail + caption) ─────────────── */

const FeedOverlay = ({ item, onComments }: { item: FeedItem; onComments: (v: { item: FeedItem; bump: () => void }) => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [commentCount, setCommentCount] = useState(item.comment_count);
  const [busy, setBusy] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const { hearts, burst } = useHeartBurst();
  // This overlay only ever shows the active reel, so fetch its reactions.
  const reactions = useVideoReactions(!item.isStatic ? (item.project_id ?? undefined) : undefined);
  const myReaction = reactions.reactionCounts.find((r) => r.hasReacted)?.emoji;
  const reactionTotal = reactions.reactionCounts.reduce((s, r) => s + r.count, 0);

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
    if (!was) burst(4); // float hearts up on a new like
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
      navigate(`/me/generate?prompt=${encodeURIComponent(item.title ?? '')}`);
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
        navigate(`/production/${out.new_project_id}`);
      } else {
        navigate(`/me/generate?prompt=${encodeURIComponent(item.title ?? '')}`);
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
    // Fixed overlay over the scrolling feed: pointer-events pass through to the
    // video (so swiping still scrolls) except on the rail/caption.
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* legibility scrims */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/60 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* TikTok-style live flow over the video — containerless */}
      <CommentFlow reelId={item.id} isStatic={item.isStatic ?? false} bottom="calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 108px)" />
      <HeartLayer hearts={hearts} bottom="calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 160px)" />

      {/* right action rail */}
      <div
        className="pointer-events-auto absolute right-3 z-20 flex flex-col items-center gap-5"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 132px)' }}
      >
        <button onClick={() => navigate(item.creator_id ? `/u/${item.creator_id}` : '/you')} className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,.6)]" aria-label="Creator">
          {item.creator_avatar ? (
            <img src={item.creator_avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#ffb86b] to-[#ff6bcb] font-display text-lg font-bold">
              {initial}
            </span>
          )}
          <span className="absolute -bottom-1.5 left-1/2 grid h-[18px] w-[18px] -translate-x-1/2 place-items-center rounded-full bg-[#2f6bff] text-[13px] font-bold leading-none shadow-[0_0_0_3px_#0a0a0a]">
            +
          </span>
        </button>

        <RailButton label={compact(likeCount)} onClick={like} active={liked} aria-label="Like">
          <Heart className={cn('h-6 w-6', liked && 'fill-[#ff3b6b] stroke-[#ff3b6b]')} />
        </RailButton>

        <RailButton label={commentCount > 0 ? compact(commentCount) : 'Comments'} onClick={() => { void hapticTap(); onComments({ item, bump: () => setCommentCount((c) => c + 1) }); }} aria-label="Comments">
          <MessageCircle className="h-6 w-6" />
        </RailButton>

        {/* React — emoji reactions */}
        <div className="relative">
          {reactOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setReactOpen(false)} />
              <div className="msg-glass absolute right-full top-1/2 z-20 mr-3 flex -translate-y-1/2 items-center gap-0.5 rounded-full px-2 py-1.5">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} onClick={() => { void hapticTap(); reactions.toggleReaction.mutate(e); setReactOpen(false); }}
                    className={cn('grid h-9 w-9 place-items-center rounded-full text-[22px] leading-none transition-transform active:scale-110', myReaction === e && 'bg-white/15')}>
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
          <RailButton label={reactionTotal > 0 ? compact(reactionTotal) : 'React'} active={!!myReaction}
            onClick={() => { void hapticTap(); if (!item.isStatic) setReactOpen((o) => !o); else toast('Reactions open up on published films'); }} aria-label="React">
            {myReaction ? <span className="text-[26px] leading-none">{myReaction}</span> : <SmilePlus className="h-6 w-6" />}
          </RailButton>
        </div>

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
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + var(--tabbar-h, 0px) + 44px)' }}
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
    </div>
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
  label?: string;
  onClick: () => void;
  highlight?: boolean;
  active?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 drop-shadow-[0_2px_6px_rgba(0,0,0,.6)] transition-transform',
        highlight ? 'text-[#8fb4ff]' : 'text-white',
        active && 'scale-105',
      )}
      {...rest}
    >
      {children}
      {label ? <span className="font-display text-[11px] font-semibold tabular-nums">{label}</span> : null}
    </button>
  );
}
