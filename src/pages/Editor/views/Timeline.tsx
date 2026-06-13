/**
 * Timeline — the workhorse view.
 *
 * Magnetic, ripple-by-default. Clips render as horizontally-arranged
 * blocks sized by their durationSec * pxPerSec. Drag a clip body to
 * reorder (framer-motion's Reorder gives the magnetic feel for free).
 * Drag a clip's left/right edge to trim (pointer-events, clamped to
 * 0.5s minimum, ripples every later clip's timelineStartSec). Click
 * an empty stretch of track to scrub the playhead. Wheel-cmd zooms.
 *
 * Keyboard:
 *   +  /  -  · zoom in / out
 *   Delete   · ripple-delete selected clip
 *   ← / →    · step playhead 1s (Shift = 0.1s, Alt = 5s)
 *
 * The playhead is driven by editor-store.playheadSec, which Stage
 * pushes to whenever its <video> fires timeupdate. So switching
 * Stage→Timeline mid-play keeps the position; switching back finds
 * the same frame.
 *
 * This file is intentionally one screen. Sub-components are small
 * and tightly coupled to the timeline's pointer math.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useReducedMotion,
} from "framer-motion";
import { Film, ZoomIn, ZoomOut, Trash2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, EASE_PREMIUM } from "@/lib/design-system";
import type { EditorClip, EditorProject } from "@/lib/editor/types";
import {
  moveClip as moveClipMut,
  trimClip as trimClipMut,
  deleteClip as deleteClipMut,
  setPlayhead,
  setPxPerSec,
  selectClip,
} from "@/lib/editor/store";

interface Props {
  project: EditorProject;
  selectedClipId: string | null;
  playheadSec: number;
  pxPerSec: number;
}

const TRACK_HEIGHT = 88;
const TRACK_PADDING_PX = 32;
const TRIM_HANDLE_PX = 10;
const MIN_CLIP_PX = 22;

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ff = Math.floor((sec - Math.floor(sec)) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

export function Timeline({
  project,
  selectedClipId,
  playheadSec,
  pxPerSec,
}: Props) {
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Live hover state — floating timecode + faint shadow line while
  // the mouse is over the track. Null when not hovering.
  const [hoverSec, setHoverSec] = useState<number | null>(null);

  const clips: EditorClip[] = useMemo(
    () => project.scenes.flatMap((s) => s.clips),
    [project],
  );
  const totalSec = project.durationSec || 1;
  const trackWidthPx = Math.max(totalSec * pxPerSec, 320);
  const playheadPx = playheadSec * pxPerSec;

  // Reorder via framer-motion: feed it the full clip array, write back
  // the new order via moveClip per-clip moves derived from the diff.
  const [localOrder, setLocalOrder] = useState<EditorClip[]>(clips);
  useEffect(() => {
    setLocalOrder(clips);
  }, [clips]);

  const onReorder = (next: EditorClip[]) => {
    setLocalOrder(next); // optimistic — frame-motion drives the visual
    // Compute first-difference move and commit.
    for (let i = 0; i < next.length; i++) {
      if (next[i].id !== clips[i]?.id) {
        moveClipMut(next[i].id, i);
        return;
      }
    }
  };

  // Click on empty track scrubs
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setPlayhead(Math.max(0, x / pxPerSec));
  };

  // Live hover: floating timecode + shadow line on the track
  const onTrackMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverSec(Math.max(0, x / pxPerSec));
  };
  const onTrackLeave = () => setHoverSec(null);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setPxPerSec(pxPerSec * 1.25);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setPxPerSec(pxPerSec / 1.25);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          deleteClipMut(selectedClipId);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 0.1 : e.altKey ? 5 : 1;
        const next = e.key === "ArrowLeft"
          ? Math.max(0, playheadSec - step)
          : Math.min(totalSec, playheadSec + step);
        setPlayhead(next);
      } else if (e.key === "," || e.key === ".") {
        // Frame-step at the project's assumed 30fps. Pro editors
        // need this all day; the keys are unshifted so it's
        // ergonomic for repeated taps.
        e.preventDefault();
        const frame = 1 / 30;
        const next = e.key === ","
          ? Math.max(0, playheadSec - frame)
          : Math.min(totalSec, playheadSec + frame);
        setPlayhead(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pxPerSec, playheadSec, totalSec, selectedClipId]);

  // Wheel + cmd/ctrl zooms; pinned to cursor position
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      setPxPerSec(pxPerSec * factor);
    },
    [pxPerSec],
  );

  // Auto-scroll horizontal scroller to keep playhead in view during play
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const visibleLeft = scroller.scrollLeft;
    const visibleRight = visibleLeft + scroller.clientWidth;
    if (playheadPx < visibleLeft + 80) {
      scroller.scrollTo({ left: Math.max(0, playheadPx - 80), behavior: "smooth" });
    } else if (playheadPx > visibleRight - 120) {
      scroller.scrollTo({ left: playheadPx - scroller.clientWidth + 120, behavior: "smooth" });
    }
  }, [playheadPx]);

  return (
    <section className="relative flex-1 flex flex-col min-h-0">
      <TimelineHeader
        clipCount={clips.length}
        totalSec={totalSec}
        pxPerSec={pxPerSec}
        selectedClipId={selectedClipId}
      />

      {clips.length === 0 ? (
        <EmptyTimeline />
      ) : (
        <div
          ref={scrollerRef}
          className="relative flex-1 overflow-x-auto overflow-y-hidden"
          onWheel={onWheel}
          style={{ scrollbarWidth: "thin" }}
        >
          <div
            className="relative"
            style={{
              width: `${trackWidthPx + TRACK_PADDING_PX * 2}px`,
              paddingLeft: TRACK_PADDING_PX,
              paddingRight: TRACK_PADDING_PX,
            }}
          >
            <TimelineRuler totalSec={totalSec} pxPerSec={pxPerSec} />

            <div
              ref={trackRef}
              data-track
              onClick={onTrackClick}
              onMouseMove={onTrackMove}
              onMouseLeave={onTrackLeave}
              className={cn(
                "relative mt-3",
                "bg-white/[0.015] rounded-lg",
              )}
              style={{ height: TRACK_HEIGHT, width: trackWidthPx }}
            >
              <Reorder.Group
                axis="x"
                values={localOrder}
                onReorder={onReorder}
                className="relative flex items-stretch h-full px-1 gap-0"
                as="div"
              >
                <AnimatePresence initial={false}>
                  {localOrder.map((clip) => (
                    <Reorder.Item
                      key={clip.id}
                      value={clip}
                      as="div"
                      data-clip
                      data-clip-id={clip.id}
                      style={{
                        width: Math.max(MIN_CLIP_PX, clip.durationSec * pxPerSec),
                        height: "100%",
                        flexShrink: 0,
                      }}
                      whileDrag={{ scale: 1.02, zIndex: 5 }}
                      transition={{
                        type: "spring",
                        stiffness: 480,
                        damping: 38,
                      }}
                      className="relative cursor-grab active:cursor-grabbing"
                    >
                      <ClipBlock
                        clip={clip}
                        pxPerSec={pxPerSec}
                        isActive={clip.id === selectedClipId}
                        reducedMotion={reducedMotion ?? false}
                      />
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>

              <Playhead positionPx={playheadPx + 1} trackHeight={TRACK_HEIGHT} />

              {/* Hover shadow line + floating timecode chip */}
              {hoverSec !== null && (
                <HoverIndicator
                  positionPx={hoverSec * pxPerSec}
                  sec={hoverSec}
                  trackHeight={TRACK_HEIGHT}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <TimelineFooter
        playheadSec={playheadSec}
        totalSec={totalSec}
        selectedClipId={selectedClipId}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header — floating, no card
// ─────────────────────────────────────────────────────────────────────────────
function TimelineHeader({
  clipCount,
  totalSec,
  pxPerSec,
  selectedClipId,
}: {
  clipCount: number;
  totalSec: number;
  pxPerSec: number;
  selectedClipId: string | null;
}) {
  return (
    <header className="relative z-10 px-6 sm:px-10 lg:px-12 pt-2 pb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div>
        <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2")}>
          <Scissors className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
          <span>◆ Timeline</span>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <h2
            className="font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              {clipCount} {clipCount === 1 ? "clip" : "clips"}.
            </span>
          </h2>
          <span className={cn(TYPE_META, "text-muted-foreground/55 tabular-nums")}>
            {fmtTC(totalSec)} runtime
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Zoom */}
        <div className="flex items-center gap-2 text-foreground/80">
          <button
            type="button"
            onClick={() => setPxPerSec(pxPerSec / 1.25)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <span className={cn(TYPE_META, "font-mono tabular-nums text-muted-foreground/70 min-w-[64px] text-center")}>
            {Math.round(pxPerSec)} px/s
          </span>
          <button
            type="button"
            onClick={() => setPxPerSec(pxPerSec * 1.25)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.04] transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Delete selected */}
        <button
          type="button"
          onClick={() => selectedClipId && deleteClipMut(selectedClipId)}
          disabled={!selectedClipId}
          className={cn(
            "inline-flex items-center gap-2 text-[12.5px] transition-colors",
            "disabled:opacity-35 disabled:cursor-not-allowed",
            selectedClipId
              ? "text-rose-300/85 hover:text-rose-300"
              : "text-muted-foreground/45",
          )}
          aria-label="Ripple-delete selected clip"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Delete</span>
          <span className={cn(TYPE_META, "text-muted-foreground/40 font-mono tabular-nums")}>⌫</span>
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruler — time marks every N seconds based on zoom
// ─────────────────────────────────────────────────────────────────────────────
function TimelineRuler({
  totalSec,
  pxPerSec,
}: {
  totalSec: number;
  pxPerSec: number;
}) {
  // Pick a tick interval whose pixel spacing is comfortable.
  const targetPx = 80;
  const tickSec = (() => {
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    for (const c of candidates) {
      if (c * pxPerSec >= targetPx) return c;
    }
    return 300;
  })();
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec + tickSec; t += tickSec) ticks.push(t);

  return (
    <div className="relative h-6" style={{ width: totalSec * pxPerSec }}>
      {ticks.map((t) => {
        const x = t * pxPerSec;
        return (
          <div
            key={t}
            className="absolute top-0 bottom-0 flex flex-col items-start"
            style={{ left: x }}
          >
            <span className="h-2 w-px bg-white/[0.10]" />
            <span
              className={cn(
                TYPE_META,
                "mt-0.5 font-mono tabular-nums text-muted-foreground/45",
              )}
            >
              {fmtTimecodeShort(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function fmtTimecodeShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
  if (Number.isInteger(sec)) return `${s}s`;
  return `${sec.toFixed(1)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ClipBlock — the visual atom. Thumbnail wash, hover lift, trim edges.
// ─────────────────────────────────────────────────────────────────────────────
function ClipBlock({
  clip,
  pxPerSec,
  isActive,
  reducedMotion,
}: {
  clip: EditorClip;
  pxPerSec: number;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const [trimming, setTrimming] = useState<null | "left" | "right">(null);
  const [trimDelta, setTrimDelta] = useState(0); // signed seconds, live during trim
  const draftDurationRef = useRef<number>(clip.durationSec);

  const onClipPointerDown = (e: React.PointerEvent) => {
    // Only handle selection on a left-click; reorder is handled by Reorder.Item.
    if (e.button !== 0) return;
    selectClip(clip.id);
  };

  // Trim with pointer events. We capture the pointer and update the
  // clip's draft duration on move. Commit on up.
  const onTrimPointerDown = (
    e: React.PointerEvent,
    side: "left" | "right",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    selectClip(clip.id);
    setTrimming(side);
    draftDurationRef.current = clip.durationSec;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startDur = clip.durationSec;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = dx / pxPerSec;
      const next = side === "right"
        ? startDur + deltaSec
        : startDur - deltaSec;
      const clamped = Math.max(0.5, next);
      draftDurationRef.current = clamped;
      setTrimDelta(clamped - startDur);
      trimClipMut(clip.id, clamped);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setTrimming(null);
      setTrimDelta(0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const widthPx = Math.max(MIN_CLIP_PX, clip.durationSec * pxPerSec);

  const blockStyle: CSSProperties = clip.thumbnailUrl
    ? {
        backgroundImage: `linear-gradient(180deg, hsl(220 30% 4% / 0.55), hsl(220 30% 4% / 0.85)), url(${clip.thumbnailUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background:
          "linear-gradient(180deg, hsl(220 28% 8%) 0%, hsl(220 32% 6%) 100%)",
      };

  return (
    <motion.div
      onPointerDown={onClipPointerDown}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: EASE_PREMIUM }}
      className={cn(
        "group/clip relative h-full overflow-hidden select-none",
        "rounded-md transition-shadow",
        "ring-1 ring-inset",
        isActive
          ? "ring-accent/85 shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.6)]"
          : "ring-white/[0.08] hover:ring-white/[0.20]",
      )}
      style={blockStyle}
    >
      {/* Left trim handle */}
      <span
        onPointerDown={(e) => onTrimPointerDown(e, "left")}
        className={cn(
          "absolute top-0 bottom-0 left-0 cursor-col-resize z-10",
          "transition-colors",
          trimming === "left"
            ? "bg-accent/40"
            : "bg-transparent hover:bg-accent/25",
        )}
        style={{ width: TRIM_HANDLE_PX }}
      />
      {/* Right trim handle */}
      <span
        onPointerDown={(e) => onTrimPointerDown(e, "right")}
        className={cn(
          "absolute top-0 bottom-0 right-0 cursor-col-resize z-10",
          "transition-colors",
          trimming === "right"
            ? "bg-accent/40"
            : "bg-transparent hover:bg-accent/25",
        )}
        style={{ width: TRIM_HANDLE_PX }}
      />

      {/* Index */}
      <div
        className="absolute top-1.5 left-2 mix-blend-difference pointer-events-none"
        style={{ opacity: widthPx > 60 ? 1 : 0 }}
      >
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums tracking-[0.24em]",
            isActive ? "text-accent" : "text-foreground/70",
          )}
        >
          {String(clip.index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Duration */}
      <div
        className="absolute bottom-1.5 right-2 mix-blend-difference pointer-events-none"
        style={{ opacity: widthPx > 64 ? 1 : 0 }}
      >
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            isActive ? "text-accent" : "text-foreground/75",
          )}
        >
          {clip.durationSec.toFixed(1)}s
        </span>
      </div>

      {/* Optional tiny film icon when block is too narrow for any text */}
      {widthPx <= 60 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Film className="h-3 w-3 text-foreground/55" strokeWidth={1.4} />
        </div>
      )}

      {/* Trim delta chip — appears mid-trim, floats on the edge being
          dragged so the user reads "+0.5s" / "-1.2s" without looking
          at the duration label. */}
      {trimming && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-7 z-30",
            trimming === "right" ? "right-0" : "left-0",
            "px-1.5 py-0.5 rounded",
            "border border-accent/45 bg-[hsl(220_30%_4%/0.92)] backdrop-blur",
            "font-mono text-[10.5px] tabular-nums whitespace-nowrap",
            trimDelta > 0 ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {trimDelta > 0 ? "+" : ""}
          {trimDelta.toFixed(2)}s · {draftDurationRef.current.toFixed(1)}s total
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HoverIndicator — faint vertical line + floating mono timecode chip
// that follows the mouse over the track. Read-only; the playhead
// commits on click.
// ─────────────────────────────────────────────────────────────────────────────
function HoverIndicator({
  positionPx,
  sec,
  trackHeight,
}: {
  positionPx: number;
  sec: number;
  trackHeight: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-10"
      style={{ left: positionPx, height: trackHeight }}
    >
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{
          background: "hsl(var(--foreground) / 0.35)",
        }}
      />
      <div
        className={cn(
          "absolute -top-6 left-2",
          "px-1.5 py-0.5 rounded",
          "border border-white/[0.10] bg-[hsl(220_30%_4%/0.92)] backdrop-blur",
          "font-mono text-[10px] tabular-nums text-foreground/95",
          "shadow-[0_8px_20px_-8px_hsl(0_0%_0%/0.6)]",
          "whitespace-nowrap",
        )}
      >
        {fmtTC(sec)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playhead — vertical line with handle
// ─────────────────────────────────────────────────────────────────────────────
function Playhead({
  positionPx,
  trackHeight,
}: {
  positionPx: number;
  trackHeight: number;
}) {
  return (
    <div
      aria-hidden
      className="absolute top-0 pointer-events-none z-20"
      style={{
        left: positionPx,
        height: trackHeight,
      }}
    >
      {/* Triangle handle */}
      <div
        className="absolute -top-2 -translate-x-1/2"
        style={{ left: 0 }}
      >
        <div
          className="w-3 h-3"
          style={{
            background: "hsl(var(--accent))",
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
          }}
        />
      </div>
      {/* Vertical line */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{
          background: "hsl(var(--accent))",
          boxShadow: "0 0 10px hsl(var(--accent) / 0.6), 0 0 20px hsl(var(--accent) / 0.25)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer transport
// ─────────────────────────────────────────────────────────────────────────────
function TimelineFooter({
  playheadSec,
  totalSec,
  selectedClipId,
}: {
  playheadSec: number;
  totalSec: number;
  selectedClipId: string | null;
}) {
  return (
    <footer className="relative z-10 px-6 sm:px-10 lg:px-12 py-5 flex items-center justify-between gap-4">
      <div className={cn(TYPE_META, "font-mono tabular-nums text-foreground/85")}>
        {fmtTC(playheadSec)}{" "}
        <span className="text-muted-foreground/45">/ {fmtTC(totalSec)}</span>
      </div>
      <div className={cn(TYPE_META, "text-muted-foreground/45 tracking-[0.30em] hidden md:block")}>
        {selectedClipId
          ? "drag clip body to reorder · drag edges to trim · , . step a frame"
          : "click a clip to select · ⌘+scroll to zoom · , . step a frame"}
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyTimeline() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <Scissors className="h-7 w-7 text-muted-foreground/55 mx-auto" strokeWidth={1.4} />
        <p
          className="mt-5 font-display italic text-[22px] font-light text-foreground/90"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Nothing on the timeline yet.
        </p>
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55 max-w-md mx-auto")}>
          Render clips in Studio to populate the timeline
        </p>
      </div>
    </div>
  );
}
