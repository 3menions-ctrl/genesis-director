/**
 * Stage — the cinematic player view. Default landing of the editor.
 *
 * Full-bleed black canvas centered with the project's aspect ratio
 * letterboxed/pillarboxed by the available space. A floating
 * transport bar (play/pause + scrub + timecode) and a slim film-reel
 * strip across the bottom showing every clip in order. No card
 * chrome anywhere.
 *
 * For v1 the player concatenates clips by listening for `ended` and
 * advancing the source — no preloading or gapless cross-fade yet.
 * That's fine for a first-watch experience and lays the data wiring
 * so future commits can swap in WebCodecs / MediaSource for gapless.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Pause, Film, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorClip, EditorProject } from "@/lib/editor/types";
import { ASPECT_RATIOS, getClipProperty } from "@/lib/editor/types";
import { selectClip, setPlayhead } from "@/lib/editor/store";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
}

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30); // assumed 30fps for display
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

export function Stage({ project, selectedClipId }: Props) {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Video clips chain on V1; title clips live on V2 and overlay
  // during their active timeline range.
  const allClips: EditorClip[] = useMemo(
    () => project.scenes.flatMap((s) => s.clips),
    [project],
  );
  const clips: EditorClip[] = useMemo(
    () => allClips.filter((c) => c.kind !== "title"),
    [allClips],
  );
  const titleClips: EditorClip[] = useMemo(
    () => allClips.filter((c) => c.kind === "title"),
    [allClips],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0); // within active clip
  const activeClip = clips[activeIdx];

  // Compute timeline-absolute playhead position for display
  const playheadSec = useMemo(() => {
    if (!activeClip) return 0;
    return activeClip.timelineStartSec + currentSec;
  }, [activeClip, currentSec]);

  // Clamp activeIdx when clips shrink (e.g. user deleted the currently
  // playing clip). Without this, the player jumps to EmptyCanvas and
  // looks like the project broke.
  useEffect(() => {
    if (activeIdx >= clips.length && clips.length > 0) {
      setActiveIdx(Math.max(0, clips.length - 1));
      setCurrentSec(0);
    }
  }, [clips.length, activeIdx]);

  // Sync `activeIdx` with external selection
  useEffect(() => {
    if (!selectedClipId) return;
    const idx = clips.findIndex((c) => c.id === selectedClipId);
    if (idx >= 0 && idx !== activeIdx) {
      setActiveIdx(idx);
      setCurrentSec(0);
    }
  }, [selectedClipId, clips, activeIdx]);

  // Wire video element events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const rel = v.currentTime;

      // CLIP OUT-POINT — each clip declares a durationSec that's
      // almost always SHORTER than the underlying source video.
      // (A 6-second clip on the timeline can reference Sintel's
      // 52s trailer; we only want to play the first 6 seconds.)
      // When the video element's playhead crosses durationSec,
      // treat the clip as ended — advance to the next clip, or
      // pause at the end of the chain.
      if (activeClip && rel >= activeClip.durationSec - 0.05) {
        setActiveIdx((i) => {
          const nextIdx = i + 1;
          if (nextIdx >= clips.length) {
            try {
              v.pause();
            } catch {
              /* ignored */
            }
            setIsPlaying(false);
            return i;
          }
          return nextIdx;
        });
        setCurrentSec(0);
        return;
      }

      setCurrentSec(rel);
      // Push timeline-absolute playhead to the store so Timeline view
      // (and any other consumer) stays in lockstep. clamped to 0.01s
      // by the setter so identical values short-circuit.
      if (activeClip) {
        setPlayhead(activeClip.timelineStartSec + rel);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      // Advance to the next clip
      setActiveIdx((i) => {
        const next = i + 1;
        if (next >= clips.length) {
          setIsPlaying(false);
          return i;
        }
        return next;
      });
      setCurrentSec(0);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
    // CRITICAL: re-bind whenever the active clip changes. Without
    // activeClip in deps the closure stays bound to clips[0]'s
    // durationSec forever — so the out-point cap below would fire at
    // clip[0]'s duration even for clip[1], clip[2], etc. Same for
    // clips identity (drag-reorder changes the array).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, activeClip?.id]);

  // Auto-play next clip when source changes mid-sequence
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      void v.play().catch(() => {
        /* user-gesture required — fall through */
      });
    }
  }, [activeIdx, isPlaying]);

  // Apply per-clip volume to the <video> whenever the active clip
  // changes. Clamped 0..1.5 (HTMLVideoElement caps at 1.0 but we keep
  // the headroom for future audio bus design).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    v.volume = Math.max(0, Math.min(1, getClipProperty(activeClip, "volume")));
  }, [activeClip]);

  // Per-clip CSS opacity + scale — applied to the video element so
  // each clip can fade in/out as a free editorial flourish without
  // affecting subsequent clips.
  const opacityStyle = activeClip
    ? getClipProperty(activeClip, "opacity")
    : 1;
  const scaleStyle = activeClip
    ? getClipProperty(activeClip, "scale")
    : 1;

  // Find which title clip(s) overlap the playhead — used to overlay
  // text on the player.
  const activeTitles = useMemo(
    () =>
      titleClips.filter(
        (t) =>
          playheadSec >= t.timelineStartSec &&
          playheadSec < t.timelineStartSec + t.durationSec,
      ),
    [titleClips, playheadSec],
  );

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {
        /* ignore */
      });
    } else {
      v.pause();
    }
  };

  // Keyboard: space toggles play
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const aspect = ASPECT_RATIOS[project.aspectRatio];
  const totalDur = project.durationSec || 1;
  const playheadPct = (playheadSec / totalDur) * 100;

  return (
    <section className="relative flex flex-col h-full min-h-0">
      {/* CANVAS — the player */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-6 sm:px-10 lg:px-12 pb-6">
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE_PREMIUM }}
          className="relative w-full h-full max-w-[1280px] mx-auto flex items-center justify-center"
        >
          {/* The aspect-locked frame */}
          <div
            className="relative bg-black shadow-[0_50px_120px_-30px_hsl(0_0%_0%/0.8),0_0_0_1px_hsl(0_0%_100%/0.04)]"
            style={{
              aspectRatio: `${aspect.w} / ${aspect.h}`,
              maxHeight: "100%",
              maxWidth: "100%",
              height: `min(100%, calc((100vw - 6rem) * ${aspect.h / aspect.w}))`,
            }}
          >
            {activeClip?.videoUrl ? (
              <video
                ref={videoRef}
                src={activeClip.videoUrl}
                poster={activeClip.thumbnailUrl ?? project.thumbnailUrl ?? undefined}
                className="absolute inset-0 w-full h-full object-contain bg-black transition-[opacity,transform] duration-150"
                style={{
                  opacity: opacityStyle,
                  transform: `scale(${scaleStyle})`,
                }}
                playsInline
                preload="metadata"
              />
            ) : (
              <EmptyCanvas project={project} hasClips={clips.length > 0} />
            )}

            {/* Title overlay — every active title at the playhead
                paints over the video. CSS picks up titleColor so
                future per-title styling is one prop away. */}
            {activeTitles.map((t) => (
              <div
                key={t.id}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  background: t.titleColor
                    ? `linear-gradient(180deg, ${t.titleColor}E0, ${t.titleColor}FF)`
                    : "linear-gradient(180deg, hsl(220 30% 4% / 0.92), hsl(220 30% 4%))",
                }}
              >
                <div className="px-8 text-center">
                  <p
                    className="font-display italic font-light tracking-tight leading-[1.05]"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: "clamp(2rem, 5vw, 4.5rem)",
                      color: "hsl(0 0% 98%)",
                      textShadow: "0 6px 30px hsl(0 0% 0% / 0.55)",
                    }}
                  >
                    {t.titleText || "TITLE"}
                  </p>
                </div>
              </div>
            ))}

            {/* Top-left clip indicator inside the canvas */}
            {activeClip && (
              <div className="absolute top-3 left-3 pointer-events-none">
                <div
                  className={cn(
                    TYPE_META,
                    "text-foreground/65 tracking-[0.32em] mix-blend-difference",
                  )}
                >
                  CLIP {String(activeIdx + 1).padStart(2, "0")} / {String(clips.length).padStart(2, "0")}
                </div>
              </div>
            )}
            {/* Top-right timecode */}
            <div className="absolute top-3 right-3 pointer-events-none">
              <div
                className={cn(
                  TYPE_META,
                  "text-foreground/65 tracking-[0.32em] mix-blend-difference font-mono tabular-nums",
                )}
              >
                {fmtTC(playheadSec)} / {fmtTC(totalDur)}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* TRANSPORT — play/pause + scrub bar */}
      <div className="relative z-10 px-6 sm:px-10 lg:px-12 pb-4">
        <div className="mx-auto w-full max-w-[1280px] flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!activeClip?.videoUrl}
            className={cn(
              "inline-flex items-center justify-center h-11 w-11 rounded-full",
              "border border-white/[0.08] bg-white/[0.04] backdrop-blur-md",
              "transition-all hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.08)]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-foreground" strokeWidth={1.6} />
            ) : (
              <Play className="h-4 w-4 text-foreground ml-0.5" strokeWidth={1.6} />
            )}
          </button>

          {/* Scrub bar — visually subtle, accent fill for played-through portion.
              Click anywhere on the bar to seek. A larger transparent hit-area
              wraps the thin visual track so the 1.5px bar is easy to grab. */}
          <div
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(totalDur)}
            aria-valuenow={Math.round(playheadSec)}
            tabIndex={0}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setPlayhead(pct * totalDur);
            }}
            className="relative flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden cursor-pointer"
          >
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent via-accent to-accent/60 pointer-events-none"
              style={{ width: `${Math.min(100, Math.max(0, playheadPct))}%` }}
            />
            {/* Clip boundary ticks */}
            {clips.length > 1 &&
              clips.slice(1).map((c) => {
                const left = (c.timelineStartSec / totalDur) * 100;
                return (
                  <span
                    key={c.id}
                    className="absolute top-0 bottom-0 w-px bg-white/[0.10]"
                    style={{ left: `${left}%` }}
                  />
                );
              })}
          </div>

          <div className={cn(TYPE_META, "font-mono tabular-nums text-foreground/80 shrink-0")}>
            {fmtTC(playheadSec)}
          </div>
        </div>
      </div>

      {/* FILM-REEL STRIP — every clip as a tiny thumbnail */}
      <FilmStrip
        clips={clips}
        activeIdx={activeIdx}
        onJump={(idx) => {
          setActiveIdx(idx);
          setCurrentSec(0);
          selectClip(clips[idx]?.id ?? null);
        }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyCanvas — shown when there's no playable clip
// ─────────────────────────────────────────────────────────────────────────────
function EmptyCanvas({
  project,
  hasClips,
}: {
  project: EditorProject;
  hasClips: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-cover bg-center"
      style={{
        backgroundImage: project.thumbnailUrl
          ? `linear-gradient(180deg, hsl(220 30% 4% / 0.65), hsl(220 30% 4% / 0.85)), url(${project.thumbnailUrl})`
          : undefined,
      }}
    >
      <div className={cn("text-center px-8")}>
        {hasClips ? (
          <>
            <AlertCircle className="h-7 w-7 text-amber-300/70 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-4 font-display italic text-[22px] font-light text-foreground/90"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              This clip is still rendering.
            </p>
            <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55")}>
              Pick a different clip in the strip below
            </p>
          </>
        ) : (
          <>
            <Film className="h-8 w-8 text-muted-foreground/55 mx-auto" strokeWidth={1.3} />
            <p
              className="mt-4 font-display italic text-[24px] font-light text-foreground/90"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No clips yet.
            </p>
            <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55 max-w-sm mx-auto")}>
              Render clips in Studio to see them play here
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilmStrip — slim row of clip thumbnails at the bottom of the canvas
// ─────────────────────────────────────────────────────────────────────────────
function FilmStrip({
  clips,
  activeIdx,
  onJump,
}: {
  clips: EditorClip[];
  activeIdx: number;
  onJump: (idx: number) => void;
}) {
  if (clips.length === 0) return null;
  return (
    <div className="relative z-10 px-6 sm:px-10 lg:px-12 pb-6 pt-1">
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {clips.map((c, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onJump(i)}
                title={c.prompt}
                className={cn(
                  "group/clip relative shrink-0 overflow-hidden rounded-md",
                  "transition-all duration-200",
                  active
                    ? "ring-1 ring-accent/85 ring-offset-2 ring-offset-transparent"
                    : "ring-1 ring-white/[0.06] hover:ring-white/[0.18]",
                )}
                style={{
                  width: 96,
                  height: 56,
                }}
              >
                {c.thumbnailUrl ? (
                  <img
                    src={c.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/[0.04] flex items-center justify-center">
                    <Film className="h-3 w-3 text-muted-foreground/45" strokeWidth={1.5} />
                  </div>
                )}
                {/* Top: clip index */}
                <span
                  className={cn(
                    "absolute top-1 left-1 font-mono text-[9px] tabular-nums tracking-[0.18em] mix-blend-difference",
                    active ? "text-accent" : "text-foreground/70",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
