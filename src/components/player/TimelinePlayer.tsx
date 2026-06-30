/**
 * TimelinePlayer — a render-free, client-side player that plays an
 * edited project's clips back-to-back in sequence, applying each clip's
 * effects (color grade / filter / transform / opacity) live in the
 * browser. Lets users WATCH their multi-clip edit with effects without
 * paying for a render/stitch.
 *
 * Seamless playback: two stacked <video> elements (A/B). While the
 * active one plays, the other preloads the NEXT clip; at the boundary we
 * cross-swap which is visible and start the preloaded one — so there's
 * no black flash / reload gap between clips ("stitched" feel).
 *
 * Read-only and self-contained: it takes a flat clip list and knows
 * nothing about the editor store. The caller computes per-clip CSS (via
 * clip-css.ts) and hands it over.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlayerClip {
  id: string;
  videoUrl: string;
  durationSec: number;
  /** Precomputed CSS — see lib/editor/clip-css.ts */
  filter?: string;
  transform?: string;
  opacity?: number;
  speed?: number;
  muted?: boolean;
  volume?: number;
}

interface Props {
  clips: PlayerClip[];
  poster?: string | null;
  className?: string;
  autoPlay?: boolean;
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Load a clip's source + effects onto a <video>. Idempotent per clip. */
function mount(v: HTMLVideoElement | null, clip: PlayerClip | undefined, muted: boolean) {
  if (!v || !clip) return;
  if (v.getAttribute("data-clip") !== clip.id) {
    v.setAttribute("data-clip", clip.id);
    v.src = clip.videoUrl;
    v.load();
  }
  v.playbackRate = clip.speed ?? 1;
  v.muted = muted || !!clip.muted;
  v.volume = clip.volume ?? 1;
  v.style.filter = clip.filter || "";
  v.style.transform = clip.transform || "";
  v.style.opacity = String(clip.opacity ?? 1);
}

export function TimelinePlayer({ clips, poster, className, autoPlay = false }: Props) {
  const aRef = useRef<HTMLVideoElement | null>(null);
  const bRef = useRef<HTMLVideoElement | null>(null);
  const [activeKey, setActiveKey] = useState<"a" | "b">("a");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // muted so autoplay is allowed
  const [globalTime, setGlobalTime] = useState(0);
  const [ended, setEnded] = useState(false);
  const pendingSeekRef = useRef<number | null>(null);

  const starts: number[] = [];
  let acc = 0;
  for (const c of clips) { starts.push(acc); acc += Math.max(0.1, c.durationSec || 0); }
  const total = acc;

  const activeRef = activeKey === "a" ? aRef : bRef;
  const bufferRef = activeKey === "a" ? bRef : aRef;

  // Keep the active element mounted on the current clip and the buffer
  // element preloading the next one.
  useEffect(() => {
    mount(activeRef.current, clips[index], muted);
    mount(bufferRef.current, clips[index + 1], muted);
    if (playing) {
      const v = activeRef.current;
      const p = v?.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* autoplay blocked */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, activeKey, muted, clips]);

  useEffect(() => { if (autoPlay) setPlaying(true); }, [autoPlay]);

  // Drive play/pause on the active element.
  useEffect(() => {
    const v = activeRef.current;
    if (!v) return;
    if (playing) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeKey]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= clips.length - 1) {
        setPlaying(false);
        setEnded(true);
        return i;
      }
      // Cross-swap: the buffer already holds clip i+1, preloaded.
      setActiveKey((k) => (k === "a" ? "b" : "a"));
      const nextV = (i % 2 === 0 ? bRef : aRef).current; // the soon-to-be-active
      if (nextV) { try { nextV.currentTime = 0; } catch { /* not ready */ } }
      return i + 1;
    });
  }, [clips.length]);

  const onActiveTime = (which: "a" | "b") => {
    if (which !== activeKey) return; // only the visible element drives time
    const v = activeRef.current;
    const clip = clips[index];
    if (!v || !clip) return;
    if (clip.durationSec > 0 && v.currentTime >= clip.durationSec - 0.05) {
      advance();
      return;
    }
    setGlobalTime((starts[index] ?? 0) + v.currentTime);
  };

  const onLoaded = (which: "a" | "b") => {
    if (which !== activeKey) return;
    const v = activeRef.current;
    if (!v) return;
    if (pendingSeekRef.current !== null) {
      v.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
    if (playing) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  };

  const togglePlay = () => {
    if (ended) {
      pendingSeekRef.current = 0;
      setGlobalTime(0);
      setEnded(false);
      setActiveKey("a");
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const seekToGlobal = (t: number) => {
    const clamped = Math.max(0, Math.min(total - 0.05, t));
    let target = 0;
    for (let i = clips.length - 1; i >= 0; i--) {
      if (clamped >= (starts[i] ?? 0)) { target = i; break; }
    }
    const offset = clamped - (starts[target] ?? 0);
    setGlobalTime(clamped);
    setEnded(false);
    if (target === index) {
      const v = activeRef.current;
      if (v) v.currentTime = offset;
    } else {
      pendingSeekRef.current = offset;
      // Keep the active element; just re-point it at the target clip.
      setIndex(target);
    }
  };

  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekToGlobal(ratio * total);
  };

  if (clips.length === 0) return null;

  return (
    <div className={cn("relative w-full bg-black overflow-hidden group/tp", className)}>
      {/* Stacked A/B buffers. The inactive one is hidden but preloaded. */}
      {(["a", "b"] as const).map((key) => (
        <video
          key={key}
          ref={key === "a" ? aRef : bRef}
          poster={key === activeKey ? poster ?? undefined : undefined}
          playsInline
          preload="auto"
          onEnded={() => key === activeKey && advance()}
          // P1-9: a dead/expired clip URL used to freeze the whole reel (no
          // spinner, no skip). Skip to the next clip on error instead of hanging.
          onError={() => key === activeKey && advance()}
          onLoadedData={() => onLoaded(key)}
          onTimeUpdate={() => onActiveTime(key)}
          onClick={togglePlay}
          className={cn(
            "absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-150",
            key === activeKey ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none",
          )}
        />
      ))}

      {/* Spacer to give the absolutely-positioned videos a box to fill. */}
      <div className="invisible w-full h-full" aria-hidden />

      {/* Center play affordance when paused */}
      {!playing && (
        <button
          onClick={togglePlay}
          aria-label={ended ? "Replay" : "Play"}
          className="absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.07] backdrop-blur-2xl ring-1 ring-inset ring-white/20 [&>svg]:drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)] transition-transform group-hover/tp:scale-105">
            {ended ? <RotateCcw className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white translate-x-0.5" fill="currentColor" />}
          </span>
        </button>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover/tp:opacity-100 focus-within:opacity-100 transition-opacity">
        <div
          onClick={onScrub}
          className="h-1.5 w-full rounded-full bg-white/20 cursor-pointer mb-2"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(globalTime)}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${total > 0 ? (globalTime / total) * 100 : 0}%` }} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/80 hover:text-white bg-transparent hover:bg-white/[0.10] hover:backdrop-blur-md ring-1 ring-inset ring-transparent hover:ring-white/[0.18] transition-all duration-200 hover:scale-[1.08] active:scale-95 [&>svg]:drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
            {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/80 hover:text-white bg-transparent hover:bg-white/[0.10] hover:backdrop-blur-md ring-1 ring-inset ring-transparent hover:ring-white/[0.18] transition-all duration-200 hover:scale-[1.08] active:scale-95 [&>svg]:drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <span className="text-[11px] font-mono tabular-nums text-white/80">{fmt(globalTime)} / {fmt(total)}</span>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">
            Clip {Math.min(index + 1, clips.length)}/{clips.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TimelinePlayer;
