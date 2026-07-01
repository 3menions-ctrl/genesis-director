/**
 * ImmersiveFeed — a full-screen, vertical scroll-to-next autoplay feed (the
 * "advanced" lobby mode). Each reel fills the viewport, autoplays when scrolled
 * into view (and pauses/rewinds when out), with a TikTok-style right-side action
 * rail: like (toggle_like_reel), emoji reactions (reel_reactions, with a floating
 * burst), and share. A single global mute toggle. Scroll-snap drives navigation.
 *
 * Data + RLS match the rest of the lobby: toggle_like_reel is SECURITY DEFINER;
 * reel_reactions lets a user toggle their own + everyone read; track_reel_play
 * bumps the play count once per item-mount (best effort).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Share2, Volume2, VolumeX, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface FeedReel {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  like_count: number;
  play_count: number;
  creator_id: string;
  creator_name: string | null;
  world_name: string | null;
  world_accent: string | null;
}

const REACTION_EMOJIS = ["🔥", "❤️", "😂", "😮", "👏", "🎬"] as const;

export function ImmersiveFeed({
  reels,
  startIndex = 0,
  onClose,
}: {
  reels: FeedReel[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Jump to the tapped reel on open.
  useEffect(() => {
    const el = containerRef.current?.children[startIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "auto" });
  }, [startIndex]);

  // ESC closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close feed (Esc)"
        className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white/95 backdrop-blur-md transition-colors hover:bg-black/75"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute right-4 top-16 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white/95 backdrop-blur-md transition-colors hover:bg-black/75"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <div
        ref={containerRef}
        className="scrollbar-hide h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {reels.map((r) => (
          <FeedItem key={r.id} reel={r} muted={muted} onUnmute={() => setMuted(false)} />
        ))}
      </div>
    </motion.div>
  );
}

function FeedItem({ reel, muted, onUnmute }: { reel: FeedReel; muted: boolean; onUnmute: () => void }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.like_count);
  const [inView, setInView] = useState(false);
  const [bursts, setBursts] = useState<Array<{ id: number; emoji: string }>>([]);
  // P2-2: track this viewer's reactions so taps TOGGLE (delete-or-insert) rather
  // than inserting a new reel_reactions row every time. reel_reactions has no
  // uniqueness, so the old insert-only react() let a user inflate counts by
  // tapping repeatedly and could never un-react.
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());

  // Autoplay when ≥60% visible; pause + rewind when it leaves. Bump play count
  // the first time it comes into view.
  const playedRef = useRef(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const vis = e.isIntersecting && e.intersectionRatio >= 0.6;
        setInView(vis);
        if (vis) {
          v.play().catch(() => {});
          if (!playedRef.current) {
            playedRef.current = true;
            void supabase.rpc("track_reel_play" as never, { p_reel_id: reel.id, p_watched_sec: 0, p_completed: false } as never);
          }
        } else {
          v.pause();
          v.currentTime = 0;
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reel.id]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted, inView]);

  const toggleLike = useCallback(async () => {
    if (!user) { toast.error("Sign in to like reels"); return; }
    const was = liked;
    setLiked(!was);
    setLikeCount((c) => Math.max(0, c + (was ? -1 : 1)));
    try {
      const { data, error } = await supabase.rpc("toggle_like_reel" as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
      const next = (data as { liked?: boolean })?.liked;
      if (typeof next === "boolean" && next !== !was) setLiked(next);
    } catch {
      setLiked(was);
      setLikeCount((c) => Math.max(0, c + (was ? 1 : -1)));
    }
  }, [user, liked, reel.id]);

  const react = useCallback(async (emoji: string) => {
    if (!user) { toast.error("Sign in to react"); return; }
    const had = myReactions.has(emoji);
    // Only burst on an ADD (not when removing a reaction).
    if (!had) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setBursts((b) => [...b, { id, emoji }]);
      window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1400);
    }
    setMyReactions((s) => { const n = new Set(s); if (had) n.delete(emoji); else n.add(emoji); return n; });
    try {
      if (had) {
        await supabase.from("reel_reactions" as never).delete()
          .eq("reel_id", reel.id).eq("reactor_id", user.id).eq("reaction_url", emoji);
      } else {
        await supabase.from("reel_reactions" as never)
          .insert({ reel_id: reel.id, reactor_id: user.id, reaction_url: emoji } as never);
      }
    } catch {
      // rollback membership on failure
      setMyReactions((s) => { const n = new Set(s); if (had) n.add(emoji); else n.delete(emoji); return n; });
    }
  }, [user, reel.id, myReactions]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}/r/${reel.id}`;
    if (navigator.share) { try { await navigator.share({ url, title: reel.title }); } catch { /* canceled */ } }
    else { try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { /* ignore */ } }
  }, [reel.id, reel.title]);

  return (
    <section className="relative h-full w-full snap-start snap-always">
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        loop
        playsInline
        muted={muted}
        onClick={() => { if (muted) onUnmute(); }}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/* legibility scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      {/* tap-to-unmute hint */}
      {muted && inView && (
        <button
          type="button"
          onClick={onUnmute}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 px-4 py-2 text-[12px] text-white/90 backdrop-blur-md"
        >
          Tap for sound
        </button>
      )}

      {/* meta — bottom-left */}
      <div className="absolute inset-x-0 bottom-0 z-10 max-w-[78%] p-5 sm:p-8">
        {reel.world_name && (
          <span className="font-mono text-[11px]" style={reel.world_accent ? { color: `hsl(${reel.world_accent})` } : undefined}>
            {reel.world_name}
          </span>
        )}
        <h2 className="mt-1 font-display text-[20px] font-semibold leading-tight tracking-tight text-white line-clamp-2 sm:text-[24px]">
          {reel.title}
        </h2>
        <p className="mt-1 text-[12.5px] text-white/65">{reel.creator_name ?? "Unknown director"}</p>
      </div>

      {/* action rail — right side */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4 sm:bottom-8">
        <RailButton onClick={() => void toggleLike()} active={liked} Icon={Heart} label={likeCount.toLocaleString()} />
        <RailButton onClick={() => void share()} Icon={Share2} label="Share" />
        <div className="flex flex-col items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-2 backdrop-blur-md">
          {REACTION_EMOJIS.map((em) => (
            <button key={em} type="button" onClick={() => void react(em)} aria-label={`React ${em}`}
              className="text-[18px] leading-none transition-transform active:scale-90 hover:scale-110">
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* floating reaction bursts */}
      <div className="pointer-events-none absolute bottom-28 right-6 z-20">
        <AnimatePresence>
          {bursts.map((b, i) => (
            <motion.span
              key={b.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: -160, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: "easeOut" }}
              className="absolute text-3xl"
              style={{ right: `${(i % 4) * 10}px` }}
            >
              {b.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function RailButton({ Icon, label, onClick, active }: { Icon: typeof Heart; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1">
      <span className={cn(
        "grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white/95 backdrop-blur-md transition-colors hover:bg-black/65",
        active && "text-[hsl(350_80%_65%)]",
      )}>
        <Icon className="h-5 w-5" fill={active && Icon === Heart ? "currentColor" : "none"} />
      </span>
      <span className="font-mono text-[10px] text-white/80">{label}</span>
    </button>
  );
}
