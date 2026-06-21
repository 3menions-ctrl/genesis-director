/**
 * TimelineMonitorPIP — the floating playback monitor shown over the
 * Timeline view. Replaces the static top-right PIP.
 *
 *   • Draggable by the title bar; position persists to localStorage
 *   • Stays inside viewport bounds even as the user resizes the window
 *   • Video fills 100% of the inner container (object-contain)
 *   • Transport bar (play/pause + scrub + time) fades in only when the
 *     cursor enters the PIP. Title bar stays visible so the user can
 *     always grab the handle.
 *   • All controls actually function — play/pause via the editor
 *     store's setIsPlaying, scrub via setPlayhead, drag handles via
 *     pointer-capture so mid-drag the cursor can leave the bar.
 *
 * This is intentionally NOT a wrapper around PlayerCanvas (which is
 * the heavy full-resolution player with its own transport). It uses
 * StitchedPlayer directly + a minimal overlay so the picture-in-
 * picture stays light and focused.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, X as CloseIcon, GripVertical, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import type { EditorProject, EditorClip } from "@/lib/editor/types";
import { getClipProperty } from "@/lib/editor/types";
import { StitchedPlayer, type StitchedPlayerHandle } from "./StitchedPlayer";
import { TextOverlayLayer } from "@/components/editor/TextOverlayLayer";
import { EffectsOverlay } from "@/components/editor/effects/EffectsOverlay";
import { useEditor } from "@/hooks/editor/useEditor";
import { gradeToCss } from "@/lib/editor/color-grade-filters";
import { getLut } from "@/lib/editor/lut-library";

const STORAGE_KEY = "smallbridges.editor.monitorPIP.v2";
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 220;
const MAX_WIDTH = 900;
const MARGIN = 12;
const TITLE_BAR_H = 28; // h-7

interface PIPState {
  x: number;
  y: number;
  /** Width — height is derived from 16:9 + title bar. */
  width: number;
}

function readState(): PIPState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PIPState;
    if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.width === "number") return parsed;
    return null;
  } catch { return null; }
}
function writeState(s: PIPState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

interface Props {
  project: EditorProject;
  playheadSec: number;
  selectedClipId: string | null;
  onOpenFullStage: () => void;
}

export function TimelineMonitorPIP({
  project, playheadSec, selectedClipId, onOpenFullStage,
}: Props) {
  void selectedClipId;
  const { isPlaying, setIsPlaying, setPlayhead } = useEditor();
  const playerRef = useRef<StitchedPlayerHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Position + size state — default top-right, restored from localStorage.
  const [pos, setPos] = useState<PIPState>(() => {
    const stored = readState();
    if (stored) return stored;
    if (typeof window === "undefined") return { x: 12, y: 12, width: DEFAULT_WIDTH };
    return { x: window.innerWidth - DEFAULT_WIDTH - 360 - MARGIN, y: MARGIN + 80, width: DEFAULT_WIDTH };
  });

  // Keep the PIP inside viewport when the window resizes.
  useEffect(() => {
    const clamp = () => {
      setPos((p) => {
        const w = p.width;
        const h = (w * 9) / 16 + TITLE_BAR_H;
        const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
        const maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
        const next = {
          x: Math.max(MARGIN, Math.min(maxX, p.x)),
          y: Math.max(MARGIN, Math.min(maxY, p.y)),
          width: w,
        };
        if (next.x !== p.x || next.y !== p.y) writeState(next);
        return next;
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  // Drag handle on the title bar
  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initial = { ...pos };
    const w = initial.width;
    const h = (w * 9) / 16 + TITLE_BAR_H;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
      const maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
      setPos({
        x: Math.max(MARGIN, Math.min(maxX, initial.x + dx)),
        y: Math.max(MARGIN, Math.min(maxY, initial.y + dy)),
        width: initial.width,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPos((p) => { writeState(p); return p; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Bottom-right resize handle — scales the width (height locked to 16:9).
  const onResizePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initial = { ...pos };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const wantedW = initial.width + dx;
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, wantedW));
      // Also clamp against viewport right edge so we never push the
      // PIP past the screen.
      const maxW = window.innerWidth - initial.x - MARGIN;
      const w = Math.min(clamped, Math.max(MIN_WIDTH, maxW));
      // And clamp against viewport bottom (height grows with width).
      const h = (w * 9) / 16 + TITLE_BAR_H;
      const maxH = window.innerHeight - initial.y - MARGIN;
      const fitH = h <= maxH ? w : ((maxH - TITLE_BAR_H) * 16) / 9;
      setPos({ x: initial.x, y: initial.y, width: Math.max(MIN_WIDTH, fitH) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPos((p) => { writeState(p); return p; });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Play/pause through the store
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
    } else {
      void playerRef.current?.play().then(() => setIsPlaying(true));
    }
  }, [isPlaying, setIsPlaying]);

  // Clip math — memoized so the StitchedPlayer prop reference stays
  // stable across renders that don't actually touch the scene list.
  // Was rebuilding on every render, causing StitchedPlayer's effects
  // to re-bind on every playhead tick.
  const clips: EditorClip[] = useMemo(
    () => project.scenes.flatMap((s) => s.clips).filter((c) => c.kind !== "title"),
    [project.scenes],
  );
  const totalSec = useMemo(
    () => clips.reduce((sum, c) => sum + c.durationSec, 0),
    [clips],
  );

  // Active clip + filter chain — mirrors PlayerCanvas's filterStyle so
  // the PIP reflects color grades + legacy CSS filters live. Without
  // this, clicking a LUT in the right-rail updates state but the
  // monitor shows the raw video.
  const activeIdx = clips.findIndex(
    (c) => playheadSec >= c.timelineStartSec && playheadSec < c.timelineStartSec + c.durationSec,
  );
  const activeClip: EditorClip | undefined = clips[activeIdx >= 0 ? activeIdx : clips.length - 1];
  const filterStyle = (() => {
    if (!activeClip) return "";
    const legacy = getClipProperty(activeClip, "filter") ?? "";
    const grade  = activeClip.properties?.colorGrade ?? null;
    if (!grade) return legacy;
    const lut = grade.lutId ? getLut(grade.lutId) ?? null : null;
    const gradeCss = gradeToCss(grade, lut);
    if (!gradeCss) return legacy;
    return legacy ? `${legacy} ${gradeCss}` : gradeCss;
  })();

  return (
    <div
      ref={containerRef}
      style={{ left: pos.x, top: pos.y, width: pos.width }}
      className={cn(
        "group/pip absolute z-30 rounded-lg overflow-hidden",
        "ring-1 ring-inset ring-white/[0.10]",
        "shadow-[0_18px_44px_-12px_hsla(0_0%_0%/0.75)]",
        "bg-[hsl(220_30%_4%/0.92)] backdrop-blur",
      )}
    >
      {/* Title bar — draggable */}
      <div
        onPointerDown={onTitlePointerDown}
        className="flex items-center justify-between px-2.5 h-7 border-b border-white/[0.06] cursor-grab active:cursor-grabbing select-none"
      >
        <span className="inline-flex items-center gap-1.5 text-amber-300/85">
          <GripVertical className="h-3 w-3 text-muted-foreground/55" strokeWidth={1.5} />
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className={cn(TYPE_META, "tracking-[0.28em]")}>Monitor</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenFullStage}
            title="Open full Stage view (1)"
            className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground/65 hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* Video — fills container at 16:9. Pure StitchedPlayer + the
          text-overlay SVG layer; no transport baked in. */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
        <StitchedPlayer
          ref={playerRef}
          clips={clips}
          playheadSec={playheadSec}
          filter={filterStyle || undefined}
          posterFallback={project.thumbnailUrl ?? undefined}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(timelineSec) => setPlayhead(timelineSec)}
          onClipEnded={(clipId) => {
            const idx = clips.findIndex((c) => c.id === clipId);
            const next = clips[idx + 1];
            if (next) setPlayhead(next.timelineStartSec);
            else {
              setIsPlaying(false);
              playerRef.current?.pause();
            }
          }}
        />
        <EffectsOverlay
          clip={activeClip ?? null}
          clipRelativeSec={Math.max(0, playheadSec - (activeClip?.timelineStartSec ?? 0))}
        />
        <TextOverlayLayer
          overlays={project.textOverlays}
          playheadSec={playheadSec}
        />

        {/* Hover-only transport overlay. The whole overlay is a
            pointer-events container so children stay clickable; the
            bg uses CSS to fade in on PIP hover. */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 px-2 pt-6 pb-2",
            "bg-gradient-to-t from-[hsl(220_30%_4%/0.92)] via-[hsl(220_30%_4%/0.6)] to-transparent",
            "opacity-0 group-hover/pip:opacity-100 transition-opacity duration-200",
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white text-[hsl(220_30%_4%)] shadow-md hover:scale-105 active:scale-95 transition-transform"
            >
              {isPlaying
                ? <Pause className="h-3.5 w-3.5" strokeWidth={2.2} />
                : <Play className="h-3.5 w-3.5 translate-x-0.5" strokeWidth={2.2} />}
            </button>

            {/* Scrub bar — click anywhere to seek */}
            <ScrubBar
              playheadSec={playheadSec}
              totalSec={totalSec}
              onSeek={(sec) => {
                setPlayhead(sec);
                playerRef.current?.seek(sec);
              }}
            />

            <span className={cn(TYPE_META, "shrink-0 text-foreground/85 tabular-nums tracking-[0.18em]")}>
              {fmtTC(playheadSec)} / {fmtTC(totalSec)}
            </span>
          </div>
        </div>
      </div>

      {/* Resize handle — bottom-right corner. Width drives height
          via the 16:9 aspect ratio so the video stays correctly
          framed regardless of the user's drag direction. */}
      <div
        onPointerDown={onResizePointerDown}
        title="Drag to resize"
        aria-label="Resize monitor"
        className={cn(
          "absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize",
          "opacity-0 group-hover/pip:opacity-100 transition-opacity",
          "after:absolute after:right-1 after:bottom-1 after:w-2 after:h-2",
          "after:border-r-2 after:border-b-2 after:border-white/70",
        )}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScrubBar — click-and-drag horizontal scrub
// ─────────────────────────────────────────────────────────────────────────────
function ScrubBar({
  playheadSec, totalSec, onSeek,
}: {
  playheadSec: number;
  totalSec: number;
  onSeek: (sec: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seekFromEvent = (clientX: number) => {
    const el = ref.current;
    if (!el || totalSec <= 0) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(frac * totalSec);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    seekFromEvent(e.clientX);
    const move = (ev: PointerEvent) => seekFromEvent(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const pct = totalSec > 0 ? (playheadSec / totalSec) * 100 : 0;
  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="flex-1 h-1.5 rounded-full bg-white/[0.10] relative cursor-pointer"
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent/85" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-[0_2px_6px_-1px_hsla(0_0%_0%/0.75)]"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function fmtTC(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
