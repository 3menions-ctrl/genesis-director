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
import { ASPECT_RATIOS } from "@/lib/editor/types";
import { selectClip } from "@/lib/editor/store";

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

  // Flatten clips across scenes into a single playable sequence.
  const clips: EditorClip[] = useMemo(
    () => project.scenes.flatMap((s) => s.clips),
    [project],
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
    const onTime = () => setCurrentSec(v.currentTime);
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
  }, [clips.length]);

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
                className="absolute inset-0 w-full h-full object-contain bg-black"
                playsInline
                preload="metadata"
              />
            ) : (
              <EmptyCanvas project={project} hasClips={clips.length > 0} />
            )}

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

          {/* Scrub bar — visually subtle, accent fill for played-through portion */}
          <div className="relative flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent via-accent to-accent/60"
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
