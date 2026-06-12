/**
 * VerticalReelFeed — TikTok-grade mobile lobby experience.
 *
 * Full-bleed, scroll-snap vertical feed where each reel occupies the
 * viewport. Swipe up / down (or arrow-key) moves to the next/previous
 * reel. The active reel autoplays muted; tapping unmutes. Tap-and-hold
 * opens the reel actions tray.
 *
 * Only mounted at < md breakpoint — desktop keeps the grid Lobby. This
 * component is intentionally presentational; the parent owns the data.
 */
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { sfx } from "@/lib/sound";

interface FeedReel {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  caption?: string | null;
  creator_handle?: string | null;
  like_count?: number;
  comment_count?: number;
}

interface Props {
  reels: FeedReel[];
  /** Currently visible index — controlled. */
  active?: number;
  onActiveChange?: (i: number) => void;
  onLike?: (reel: FeedReel) => void;
  onShare?: (reel: FeedReel) => void;
  onOpenComments?: (reel: FeedReel) => void;
}

export function VerticalReelFeed({
  reels,
  active,
  onActiveChange,
  onLike,
  onShare,
  onOpenComments,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(active ?? 0);
  const [muted, setMuted] = useState(true);

  // Scroll-snap observation: whichever child intersects the viewport >
  // 70% wins.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            const idx = Number((entry.target as HTMLElement).dataset.idx ?? "0");
            setActiveIdx(idx);
            onActiveChange?.(idx);
          }
        }
      },
      { root, threshold: [0.5, 0.7, 0.9] },
    );
    const children = Array.from(root.children) as HTMLElement[];
    for (const c of children) observer.observe(c);
    return () => observer.disconnect();
  }, [reels.length, onActiveChange]);

  // Keyboard navigation: arrows + page-up/down jump between reels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      let next: number | null = null;
      if (e.key === "ArrowDown" || e.key === "PageDown") next = activeIdx + 1;
      if (e.key === "ArrowUp" || e.key === "PageUp")     next = activeIdx - 1;
      if (next === null) return;
      next = Math.max(0, Math.min(reels.length - 1, next));
      const child = root.children[next] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "smooth", block: "start" });
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, reels.length]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory bg-black"
      style={{ scrollBehavior: "smooth", overscrollBehavior: "contain" }}
    >
      {reels.map((reel, idx) => (
        <article
          key={reel.id}
          data-idx={idx}
          className="snap-start relative h-[100dvh] w-full flex items-center justify-center"
        >
          {/* Background — thumbnail blurred + full-bleed playback when active */}
          {reel.thumbnail_url && (
            <img
              src={reel.thumbnail_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50"
            />
          )}

          {reel.video_url ? (
            <video
              src={idx === activeIdx ? reel.video_url : undefined}
              poster={reel.thumbnail_url ?? undefined}
              autoPlay={idx === activeIdx}
              muted={muted}
              loop
              playsInline
              preload={Math.abs(idx - activeIdx) <= 1 ? "metadata" : "none"}
              className="relative max-h-[100dvh] w-full object-contain"
            />
          ) : reel.thumbnail_url ? (
            <img src={reel.thumbnail_url} alt={reel.title ?? "Reel"} className="max-h-[100dvh] w-full object-contain" />
          ) : (
            <div className="text-white/55 text-sm">No preview</div>
          )}

          {/* Top bar — mute + handle */}
          <header className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2 text-xs font-medium drop-shadow">
              <span className="opacity-80">@{reel.creator_handle ?? "director"}</span>
            </div>
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={!muted}
              onClick={() => { setMuted(m => !m); sfx.play("click"); }}
              className="h-9 w-9 grid place-items-center rounded-full bg-black/55 backdrop-blur-md text-white"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </header>

          {/* Caption */}
          <footer className="absolute bottom-24 left-4 right-20 text-white drop-shadow-lg">
            {reel.title && (
              <div className="text-base font-semibold leading-snug">{reel.title}</div>
            )}
            {reel.caption && (
              <div className="text-sm text-white/80 mt-1 line-clamp-3">{reel.caption}</div>
            )}
          </footer>

          {/* Action rail */}
          <aside className="absolute bottom-24 right-4 flex flex-col items-center gap-5 text-white">
            <button
              type="button"
              onClick={() => { onLike?.(reel); sfx.play("tip"); }}
              className="grid place-items-center"
              aria-label="Like this reel"
            >
              <Heart className="w-7 h-7" />
              {reel.like_count !== undefined && (
                <span className="text-xs mt-1 tabular-nums">{reel.like_count}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { onOpenComments?.(reel); sfx.play("open"); }}
              className="grid place-items-center"
              aria-label="Open comments"
            >
              <MessageCircle className="w-7 h-7" />
              {reel.comment_count !== undefined && (
                <span className="text-xs mt-1 tabular-nums">{reel.comment_count}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { onShare?.(reel); sfx.play("click"); }}
              className="grid place-items-center"
              aria-label="Share"
            >
              <Share2 className="w-7 h-7" />
            </button>
          </aside>
        </article>
      ))}
    </div>
  );
}
