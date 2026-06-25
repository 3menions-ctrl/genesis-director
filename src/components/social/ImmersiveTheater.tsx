/**
 * ImmersiveTheater — a full-viewport video player overlay with
 * comments, likes, and remix. Stays inside the host page (no route
 * change) so users can browse, watch, comment, and close to keep
 * scrolling — Substack-style theater behavior.
 *
 * Wired RPCs:
 *   • toggle_like_reel        — heart button
 *   • reel_comments_for       — load + paginate comments
 *   • add_reel_comment        — post a comment
 *   • toggle_like_reel_comment— like a comment
 *
 * Realtime: subscribes to `reel_comments` inserts on the active reel
 * so new takes appear live while the theater is open.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Heart, MessageCircle, Wand2, Eye, X, Send, Loader2, Volume2, VolumeX,
  Maximize, Sparkles, Share2, FastForward,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { BridgeIntro as StudioIntro } from "@/components/intro/BridgeIntro";

/**
 * Length of the Small Bridges brand-ident animation that plays before
 * every reel — Netflix / Disney / HBO style. The full ceremony runs
 * through to its natural end, then we HOLD on the final wordmark frame
 * for one beat before dissolving into the video — same as a real
 * studio ident before a feature. A "skip intro" pill in the top-right
 * lets power viewers bypass.
 */
const INTRO_DURATION_MS = 7500; // full StudioIntro ceremony — every act plays through
const INTRO_HOLD_MS     = 1000; // one-second hold on the final wordmark before video starts

export interface TheaterReel {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  play_count: number;
  like_count: number;
  remix_count: number;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
  world_name: string | null;
  world_accent: string | null;
  world_glyph: string | null;
}

interface Comment {
  id: string;
  reel_id: string;
  author_id: string;
  body: string;
  like_count: number;
  created_at: string;
  author?: { id?: string; display_name: string | null; avatar_url: string | null };
}

interface Props {
  reel: TheaterReel | null;
  onClose: () => void;
  /** Optional: queue of reels to navigate "next" through. */
  queue?: TheaterReel[];
  onSwitch?: (next: TheaterReel) => void;
}

export function ImmersiveTheater({ reel, onClose, queue, onSwitch }: Props) {
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // The modal root — we request browser fullscreen on this element so
  // the intro + reel feel like a real cinema, not a webpage overlay.
  const rootRef = useRef<HTMLDivElement>(null);
  // Tracks the post-animation 1 s hold timer so we can cancel it on
  // reel switch, close, or explicit skip.
  const introHoldTimerRef = useRef<number | null>(null);
  // Tracks the reel currently on screen so async like/comment loads from a
  // PREVIOUS reel can't apply their results after the user switches reels.
  const currentReelIdRef = useRef<string | null>(null);

  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [composeBody, setComposeBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Set<string>>(new Set());
  // Brand-ident intro is RETIRED — reels now play immediately. The
  // "Small Bridges" branded animation lives only on the landing entrance.
  // `introPlaying` stays false so the curtain never mounts; the dormant
  // render path below is kept (referenced) but never triggered.
  const [introPlaying, setIntroPlaying] = useState(false);
  // Mobile / tablet — the comments pane is hidden by default below lg.
  // This flag pops it as a full-screen sheet on demand.
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);

  // Esc to close
  useEffect(() => {
    if (!reel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) { void v.play(); } else { v.pause(); }
        }
      } else if (e.key === "m" || e.key === "M") {
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reel, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!reel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [reel]);

  // True browser fullscreen — covers the OS chrome too. Fires on next
  // micro-task so the modal root is in the DOM. Best-effort: some
  // browsers (Safari iOS) require user-gesture and may reject; we
  // silently fall back to the modal's own viewport-fill in that case.
  useEffect(() => {
    if (!reel) return;
    const root = rootRef.current;
    if (!root) return;
    // Don't re-request if we're already fullscreen on this element.
    if (document.fullscreenElement === root) return;
    const enterFs = async () => {
      try {
        if (root.requestFullscreen) {
          await root.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
        } else {
          // Safari prefix fallback.
          const r = root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
          await r.webkitRequestFullscreen?.();
        }
      } catch {
        // Fullscreen denied (no gesture, browser policy, iOS). Modal
        // still covers the viewport via `fixed inset-0`.
      }
    };
    void enterFs();

    // When the user exits fullscreen via Esc/browser controls, close
    // the theater entirely so we're not stuck in a stranded overlay.
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        onClose();
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);

    // On unmount / reel-null, exit fullscreen cleanly.
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel?.id]);

  // Init state on reel change
  useEffect(() => {
    if (!reel) return;
    currentReelIdRef.current = reel.id;
    setLikeCount(reel.like_count);
    setLiked(false);
    setComments([]);
    setMuted(true);
    setPlaying(true);
    setComposeBody("");
    // Brand intro retired — the reel plays immediately, no pre-roll curtain.
    // Cancel any stray hold timer from a previous reel just in case.
    if (introHoldTimerRef.current !== null) {
      window.clearTimeout(introHoldTimerRef.current);
      introHoldTimerRef.current = null;
    }
    // Optimistic: check if user already liked
    (async () => {
      if (!user) return;
      const reelId = reel.id;
      const { data } = await supabase
        .from("reel_likes" as never)
        .select("user_id")
        .eq("reel_id", reelId)
        .eq("user_id", user.id)
        .maybeSingle();
      // Ignore a late response if the user already switched reels.
      if (data && currentReelIdRef.current === reelId) setLiked(true);
    })();
  }, [reel, user]);

  // While the intro is playing, hold the video paused at frame 0 so it
  // doesn't burn time / data behind a curtain that's hiding it.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (introPlaying) {
      try { v.pause(); v.currentTime = 0; } catch { /* ignore */ }
    } else {
      // Intro just ended — kick the video off (if user intent says play).
      if (playing) void v.play().catch(() => setPlaying(false));
    }
  }, [introPlaying, playing]);

  const skipIntro = useCallback(() => {
    if (introHoldTimerRef.current !== null) {
      window.clearTimeout(introHoldTimerRef.current);
      introHoldTimerRef.current = null;
    }
    setIntroPlaying(false);
  }, []);

  // Clean up the hold timer on unmount or when the dialog closes.
  useEffect(() => () => {
    if (introHoldTimerRef.current !== null) {
      window.clearTimeout(introHoldTimerRef.current);
      introHoldTimerRef.current = null;
    }
  }, []);

  // Load comments
  const loadComments = useCallback(async () => {
    if (!reel) return;
    const reelId = reel.id;
    setLoadingComments(true);
    try {
      const { data, error } = await supabase.rpc("reel_comments_for" as never, {
        p_reel_id: reelId, p_before_ts: null, p_limit: 50,
      } as never);
      if (error) throw error;
      // Ignore a late response if the user already switched reels, otherwise
      // reel A's comments would render under reel B (and B's realtime INSERTs
      // would append onto the wrong base).
      if (currentReelIdRef.current !== reelId) return;
      setComments(((data as Comment[]) ?? []).slice().reverse()); // oldest -> newest for chat-style
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[Theater] load comments failed", e);
    } finally {
      setLoadingComments(false);
    }
  }, [reel]);
  useEffect(() => { void loadComments(); }, [loadComments]);

  // Realtime: subscribe to new comments on this reel
  useEffect(() => {
    if (!reel) return;
    const channel = supabase
      .channel(`reel-comments-${reel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reel_comments", filter: `reel_id=eq.${reel.id}` },
        (payload) => {
          const row = payload.new as Comment;
          // Skip our own optimistic inserts (they're already in the list)
          setComments((prev) => prev.some((c) => c.id === row.id) ? prev : [...prev, row]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reel]);

  // Bump play_count once per reel-mount via track_reel_play. Best effort.
  useEffect(() => {
    if (!reel) return;
    void supabase.rpc("track_reel_play" as never, {
      p_reel_id: reel.id, p_watched_sec: 0, p_completed: false,
    } as never);
  }, [reel]);

  const toggleLike = useCallback(async () => {
    if (!reel) return;
    if (!user) { toast.error("Sign in to like reels"); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const { data, error } = await supabase.rpc("toggle_like_reel" as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
      const next = (data as { liked?: boolean })?.liked;
      if (typeof next === "boolean" && next !== !wasLiked) {
        setLiked(next);
      }
    } catch (e) {
      // rollback
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      toast.error(e instanceof Error ? e.message : "Couldn't update like");
    }
  }, [liked, reel, user]);

  const remix = useCallback(async () => {
    if (!reel) return;
    if (!user) { toast.error("Sign in to remix"); return; }
    try {
      const { data, error } = await supabase.rpc("remix_reel" as never, { p_reel_id: reel.id } as never);
      if (error) throw error;
      const out = data as { new_project_id: string };
      toast.success("Remix project created");
      window.location.href = `/editor/${out.new_project_id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remix failed");
    }
  }, [reel, user]);

  const share = useCallback(async () => {
    if (!reel) return;
    const url = `${window.location.origin}/r/${reel.id}`;
    if (navigator.share) {
      try { await navigator.share({ url, title: reel.title }); } catch { /* canceled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        toast.error("Couldn't copy");
      }
    }
  }, [reel]);

  const submitComment = useCallback(async () => {
    if (!reel) return;
    if (!user) { toast.error("Sign in to comment"); return; }
    const body = composeBody.trim();
    if (!body) return;
    setPosting(true);
    try {
      const { data, error } = await supabase.rpc("add_reel_comment" as never, {
        p_reel_id: reel.id, p_body: body,
      } as never);
      if (error) throw error;
      const c = data as Comment;
      setComments((prev) => [...prev, c]);
      setComposeBody("");
      composerRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post");
    } finally {
      setPosting(false);
    }
  }, [composeBody, reel, user]);

  const toggleCommentLike = useCallback(async (commentId: string) => {
    if (!user) { toast.error("Sign in to like"); return; }
    const wasLiked = commentLikes.has(commentId);
    setCommentLikes((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(commentId) : next.add(commentId);
      return next;
    });
    setComments((prev) => prev.map((c) =>
      c.id === commentId ? { ...c, like_count: Math.max(0, c.like_count + (wasLiked ? -1 : 1)) } : c
    ));
    try {
      await supabase.rpc("toggle_like_reel_comment" as never, { p_comment_id: commentId } as never);
    } catch {
      // ignore — non-critical
    }
  }, [commentLikes, user]);

  // Auto-resume on play state change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { void v.play().catch(() => setPlaying(false)); }
    else v.pause();
  }, [playing]);

  const accent = reel?.world_accent ?? "213 100% 60%";
  const next = useMemo(() => {
    if (!reel || !queue || queue.length < 2) return null;
    const i = queue.findIndex((r) => r.id === reel.id);
    if (i < 0) return null;
    return queue[(i + 1) % queue.length];
  }, [reel, queue]);

  return (
    <AnimatePresence>
      {reel && (
        <motion.div
          ref={rootRef}
          key={reel.id}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-[hsl(220_30%_2%)]"
          aria-modal="true"
          role="dialog"
        >
          {/* ── EDGE-TO-EDGE VIDEO ──────────────────────────────────
              The video fills the ENTIRE viewport on every device. The
              intro overlay is the same dimensions. All UI controls are
              absolute-positioned overlays on top of the video. */}
          <video
            key={reel.id}
            ref={videoRef}
            src={reel.video_url}
            poster={reel.thumbnail_url ?? undefined}
            muted={muted}
            loop
            playsInline
            controls={false}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            onClick={() => {
              if (introPlaying) return;
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) { void v.play(); setPlaying(true); }
              else { v.pause(); setPlaying(false); }
            }}
          />

          {/* Hue-tinted top wash matching the reel's world — only after the
              intro so it doesn't fight the brand animation. */}
          {!introPlaying && (
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-40 pointer-events-none"
              style={{ background: `radial-gradient(120% 100% at 50% 0%, hsla(${accent} / 0.18) 0%, transparent 65%)` }}
            />
          )}

          {/* Bottom vignette for readability of the overlays — only
              after the intro. */}
          {!introPlaying && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none"
            />
          )}

          {/* Top vignette so the close button has contrast */}
          {!introPlaying && (
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/65 to-transparent pointer-events-none"
            />
          )}

          {/* ── BRAND INTRO — edge-to-edge, plays before every video ── */}
          <AnimatePresence>
            {introPlaying && (
              <motion.div
                key="intro"
                className="absolute inset-0 z-30 bg-black"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <StudioIntro
                  isPlaying={true}
                  onComplete={() => {
                    if (introHoldTimerRef.current !== null) {
                      window.clearTimeout(introHoldTimerRef.current);
                    }
                    introHoldTimerRef.current = window.setTimeout(() => {
                      introHoldTimerRef.current = null;
                      setIntroPlaying(false);
                    }, INTRO_HOLD_MS);
                  }}
                  duration={INTRO_DURATION_MS}
                />
                <button
                  type="button"
                  onClick={skipIntro}
                  className="absolute top-5 right-5 inline-flex items-center gap-2 h-9 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.26em] text-white/85 hover:text-white bg-black/55 hover:bg-black/75 backdrop-blur-md transition-colors z-10"
                >
                  <FastForward className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Skip intro
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── TOP OVERLAY — view count + close (movie-type badge removed) ── */}
          {!introPlaying && (
            <div className="absolute top-5 left-5 right-5 z-20 flex items-center gap-3 flex-wrap">
              <span className={cn(TYPE_META, "text-white/75 tracking-[0.26em]")}>
                <Eye className="h-3 w-3 inline mr-1.5" />{reel.play_count.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto h-10 w-10 rounded-full grid place-items-center bg-black/55 hover:bg-black/75 text-white/95 hover:text-white transition-colors backdrop-blur-md"
                aria-label="Close (Esc)"
                title="Close · Esc"
              >
                <X className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
          )}

          {/* ── BOTTOM OVERLAY — title + creator + actions ── */}
          {!introPlaying && (
            <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-5 sm:px-8 sm:pb-8">
              {/* Title */}
              <h2
                className="font-display italic font-light leading-[0.98] tracking-[-0.012em] text-white max-w-3xl"
                style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.6rem,4vw,3.4rem)", textShadow: "0 4px 24px hsl(0 0% 0% / 0.7)" }}
              >
                {reel.title}
              </h2>

              {/* Creator strip */}
              <div className="mt-3 flex items-center gap-3 text-[12.5px] text-white/85">
                {reel.creator_avatar ? (
                  <img src={reel.creator_avatar} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-white/[0.12] grid place-items-center text-white/95 text-[11px] font-mono">
                    {(reel.creator_name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <Link to={`/c/${reel.creator_id}`} className="font-medium text-white hover:text-accent transition-colors">
                  {reel.creator_name ?? "Anonymous"}
                </Link>
                <span className={cn(TYPE_META, "tracking-[0.26em] text-white/55")}>· {reel.remix_count} REMIXES</span>
              </div>

              {/* Action bar */}
              <div className="mt-5 flex items-center gap-2.5 flex-wrap">
                <ActionPill onClick={() => void toggleLike()} active={liked} activeHue="350 80% 65%" label={likeCount.toLocaleString()} Icon={Heart} />
                <ActionPill onClick={() => setShowCommentsSheet(true)} label={`${comments.length}`} Icon={MessageCircle} />
                <ActionPill onClick={() => void remix()} label="Remix" Icon={Wand2} activeHue="280 70% 65%" highlight />
                <ActionPill onClick={() => void share()} label="Share" Icon={Share2} />

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute (M)" : "Mute (M)"}
                    className="h-10 w-10 rounded-full grid place-items-center bg-black/55 hover:bg-black/75 text-white/95 backdrop-blur-md transition-colors"
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Re-attempt browser fullscreen for users that
                      // denied it on initial open. Targets the root so
                      // overlays stay on top of the video.
                      const el = rootRef.current;
                      if (!el) return;
                      if (document.fullscreenElement === el) {
                        void document.exitFullscreen().catch(() => {});
                      } else {
                        void el.requestFullscreen?.().catch(() => {});
                      }
                    }}
                    aria-label="Toggle fullscreen"
                    className="h-10 w-10 rounded-full grid place-items-center bg-black/55 hover:bg-black/75 text-white/95 backdrop-blur-md transition-colors"
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                </div>

                {next && (
                  <button
                    type="button"
                    onClick={() => onSwitch?.(next)}
                    className="basis-full lg:basis-auto lg:ml-3 inline-flex items-center justify-center gap-2.5 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.24em] text-white/95 backdrop-blur-md transition-all hover:bg-white/[0.10]"
                    style={{ background: "hsl(var(--accent)/0.18)", boxShadow: "inset 0 0 0 1px hsl(var(--accent)/0.40)" }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                    Up next: {next.title.length > 28 ? next.title.slice(0, 27) + "…" : next.title}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── COMMENTS DRAWER — slides in from the right on demand ── */}
          <AnimatePresence>
            {showCommentsSheet && !introPlaying && (
              <motion.aside
                key="comments-drawer"
                initial={reducedMotion ? { opacity: 0 } : { x: "100%" }}
                animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 36 }}
                className="absolute right-0 top-0 bottom-0 z-40 w-full sm:w-[420px] flex flex-col bg-[hsl(220_30%_5%/0.96)] backdrop-blur-2xl"
                style={{ boxShadow: "-32px 0 80px -20px hsl(0 0% 0% / 0.6)" }}
              >
              <header className="px-6 pt-6 pb-3 border-b border-white/[0.05]">
                <div className={cn(TYPE_META, "text-amber-300/85 tracking-[0.36em] inline-flex items-center gap-2")}>
                  <MessageCircle className="h-3 w-3" strokeWidth={1.6} />◆ Comments · {comments.length}
                </div>
                <h3 className="mt-2 font-display italic text-[18px] text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
                  What did you see?
                </h3>
              </header>

              {/* Comment list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {loadingComments ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground/65">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className={cn(TYPE_META, "tracking-[0.22em]")}>Loading…</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-16 text-center">
                    <MessageCircle className="h-6 w-6 mx-auto text-muted-foreground/55" strokeWidth={1.4} />
                    <div className="mt-4 text-[14px] font-display italic text-foreground/95" style={{ fontFamily: "'Fraunces', serif" }}>
                      First take, all yours.
                    </div>
                    <p className="mt-2 text-[12px] text-muted-foreground/65">Be the first to say something.</p>
                  </div>
                ) : (
                  comments.map((c) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      isLiked={commentLikes.has(c.id)}
                      onLike={() => void toggleCommentLike(c.id)}
                    />
                  ))
                )}
              </div>

              {/* Composer */}
              <footer className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.012]">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={composerRef}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitComment(); }
                    }}
                    placeholder={user ? "Say something…" : "Sign in to comment"}
                    disabled={!user || posting}
                    rows={1}
                    maxLength={1000}
                    className="flex-1 resize-none rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] px-4 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-accent/45 min-h-[42px] max-h-[160px]"
                  />
                  <button
                    type="button"
                    onClick={() => void submitComment()}
                    disabled={!user || posting || !composeBody.trim()}
                    className={cn(
                      "h-[42px] w-[42px] grid place-items-center rounded-xl transition-all",
                      composeBody.trim() && user
                        ? "bg-accent text-black hover:bg-accent/85"
                        : "bg-white/[0.04] text-muted-foreground/55"
                    )}
                    aria-label="Post comment"
                  >
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <div className={cn(TYPE_META, "mt-2 text-muted-foreground/45 tracking-[0.22em] flex items-center justify-between")}>
                  <span>↵ to send · ⇧↵ for newline</span>
                  <span>{composeBody.length}/1000</span>
                </div>
              </footer>
              {/* Close (top-right of drawer) */}
              <button
                type="button"
                onClick={() => setShowCommentsSheet(false)}
                className="absolute top-4 right-4 h-9 w-9 rounded-full grid place-items-center bg-white/[0.04] hover:bg-white/[0.10] text-foreground/85 hover:text-foreground transition-colors"
                aria-label="Close comments"
              >
                <X className="h-4 w-4" strokeWidth={1.6} />
              </button>
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Old layout artifacts removed — the single edge-to-edge structure
// above replaces them. Helper components follow below.

function ActionPill({
  Icon, label, onClick, active, activeHue, highlight,
}: {
  Icon: typeof Heart;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeHue?: string;
  highlight?: boolean;
}) {
  const hue = activeHue ?? "var(--accent)";
  const isVar = hue.startsWith("var");
  const color = isVar ? "hsl(var(--accent))" : `hsl(${hue})`;
  const bg = active
    ? (isVar ? "hsl(var(--accent)/0.16)" : `hsla(${hue} / 0.16)`)
    : "hsl(0 0% 100% / 0.04)";
  const ring = active
    ? (isVar ? "hsl(var(--accent)/0.40)" : `hsla(${hue} / 0.40)`)
    : "hsl(0 0% 100% / 0.08)";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-10 px-5 rounded-full text-[12px] font-mono uppercase tracking-[0.24em] backdrop-blur-2xl transition-all",
        active ? "text-foreground" : "text-foreground/85 hover:text-foreground",
      )}
      style={{
        background: bg,
        boxShadow: `inset 0 0 0 1px ${ring}` + (highlight ? `, 0 0 24px -8px ${color}` : ""),
      }}
    >
      <Icon
        className="h-3.5 w-3.5"
        strokeWidth={1.6}
        style={{ color: active || highlight ? color : undefined }}
        fill={active && Icon === Heart ? color : "none"}
      />
      {label}
    </button>
  );
}

function CommentRow({
  comment, isLiked, onLike,
}: {
  comment: Comment;
  isLiked: boolean;
  onLike: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      {comment.author?.avatar_url ? (
        <img src={comment.author.avatar_url} alt="" className="h-8 w-8 rounded-full shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/[0.06] grid place-items-center text-foreground/85 text-[11px] font-mono shrink-0">
          {(comment.author?.display_name?.[0] ?? "?").toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-medium text-foreground/95 truncate">
            {comment.author?.display_name ?? "Anonymous"}
          </span>
          <span className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.18em]")}>
            {relTime(comment.created_at)}
          </span>
        </div>
        <div className="mt-1 text-[13.5px] text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
          {comment.body}
        </div>
        <button
          type="button"
          onClick={onLike}
          className={cn(
            "mt-1.5 inline-flex items-center gap-1.5 text-[11px] transition-colors",
            isLiked ? "text-rose-300" : "text-muted-foreground/60 hover:text-foreground/90",
          )}
        >
          <Heart className="h-3 w-3" fill={isLiked ? "currentColor" : "none"} strokeWidth={1.8} />
          {comment.like_count > 0 ? comment.like_count : ""}
        </button>
      </div>
    </div>
  );
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
