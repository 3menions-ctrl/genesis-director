/**
 * CustomTimeline — Multi-track visual timeline with clip blocks,
 * playhead scrubbing, clip selection, trim handles, snap-to-edge,
 * auto-scroll, fit-to-view, track reordering, minimap, and context menu.
 */

import { useRef, useCallback, useState, memo, useEffect } from "react";
import {
  Plus, Trash2, Volume2, VolumeX, Lock, Unlock, ZoomIn, ZoomOut,
  Eye, Type, Undo2, Redo2, Music, Maximize2, Magnet, ChevronUp, ChevronDown,
  Clock, Scissors, Copy, Trash, Film, MousePointer2, Slice, Flag, ArrowDownToLine,
  Headphones, Palette
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTimeline, TimelineTrack, TimelineClip, TimelineMarker, EditorTool, generateTrackId, generateClipId } from "@/hooks/useCustomTimeline";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TimelineMinimap } from "@/components/editor/TimelineMinimap";

const TRACK_HEIGHT = 60;
const HEADER_WIDTH = 140;
const RULER_HEIGHT = 30;
const MIN_CLIP_WIDTH = 14;
const SNAP_THRESHOLD = 8;

// ─── Snap-to-edge utility ───

function getSnapEdges(tracks: TimelineTrack[], excludeClipId?: string): number[] {
  const edges: number[] = [0];
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      edges.push(clip.start, clip.end);
    }
  }
  return [...new Set(edges)].sort((a, b) => a - b);
}

function snapToEdge(time: number, edges: number[], zoom: number, threshold: number): { snapped: number; didSnap: boolean } {
  for (const edge of edges) {
    if (Math.abs((time - edge) * zoom) < threshold) {
      return { snapped: edge, didSnap: true };
    }
  }
  return { snapped: time, didSnap: false };
}

// ─── Ruler ───

function TimelineRuler({ zoom, scrollX, duration }: { zoom: number; scrollX: number; duration: number }) {
  const totalWidth = Math.max(duration + 10, 30) * zoom;
  const interval = zoom > 80 ? 1 : zoom > 40 ? 5 : zoom > 20 ? 10 : 30;

  const marks: { time: number; label: string }[] = [];
  for (let t = 0; t <= duration + 10; t += interval) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    marks.push({ time: t, label: `${m}:${s.toString().padStart(2, "0")}` });
  }

  return (
    <div
      className="relative shrink-0 select-none overflow-hidden"
      style={{
        height: RULER_HEIGHT,
        marginLeft: HEADER_WIDTH,
        background: 'linear-gradient(180deg, hsla(220, 14%, 6%, 0.55) 0%, hsla(220, 14%, 4%, 0.55) 100%)',
        backdropFilter: 'blur(24px) saturate(160%)',
        boxShadow: 'inset 0 -1px 0 hsla(215,100%,60%,0.10)',
      }}
    >
      <div className="relative h-full" style={{ width: totalWidth, transform: `translateX(-${scrollX}px)` }}>
        {marks.map((mark) => (
          <div
            key={mark.time}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: mark.time * zoom }}
          >
            <div className="w-px h-2.5" style={{ background: 'hsla(0, 0%, 100%, 0.10)' }} />
            <span className="text-[9px] font-light text-muted-foreground/45 mt-0.5 font-mono leading-none whitespace-nowrap tabular-nums">
              {mark.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Track Header ───

function TrackHeader({ track, index, totalTracks, onToggleMute, onToggleLock, onToggleSolo, onRemove, onMoveUp, onMoveDown }: {
  track: TimelineTrack;
  index: number;
  totalTracks: number;
  onToggleMute: () => void;
  onToggleLock: () => void;
  onToggleSolo: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const typeIcon = track.type === "text" ? (
    <Type className="w-3 h-3" />
  ) : track.type === "audio" ? (
    <Music className="w-3 h-3" />
  ) : (
    <Eye className="w-3 h-3" />
  );

  const typeColors: Record<string, string> = {
    video: 'hsla(215, 100%, 60%, 0.10)',
    audio: 'hsla(200, 100%, 60%, 0.10)',
    text: 'hsla(195, 100%, 65%, 0.10)',
  };

  const accentStrip: Record<string, string> = {
    video: 'hsl(215, 100%, 60%)',
    audio: 'hsl(200, 100%, 60%)',
    text: 'hsl(195, 100%, 65%)',
  };

  return (
    <div
      className="shrink-0 flex overflow-hidden select-none"
      style={{
        width: HEADER_WIDTH,
        height: TRACK_HEIGHT,
        background: 'linear-gradient(90deg, hsla(220, 14%, 6%, 0.45) 0%, hsla(220, 14%, 4%, 0.35) 100%)',
        backdropFilter: 'blur(16px)',
        boxShadow: 'inset -1px 0 0 hsla(215,100%,60%,0.06), inset 0 -1px 0 hsla(0,0%,100%,0.025)',
      }}
    >
      {/* Color accent strip */}
      <div className="w-[2px] shrink-0" style={{ background: accentStrip[track.type] || accentStrip.video, opacity: 0.7, boxShadow: `0 0 12px ${accentStrip[track.type] || accentStrip.video}40` }} />
      
      <div className="flex-1 flex flex-col justify-center gap-1.5 px-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: typeColors[track.type] || typeColors.video, boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)' }}>
            <span className="text-foreground/60">{typeIcon}</span>
          </div>
          <span className="text-[10px] font-light text-foreground/70 truncate flex-1 tracking-[0.10em] uppercase">
            {track.label}
          </span>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-0 text-muted-foreground/25 hover:text-foreground disabled:opacity-15 transition-colors shrink-0"
          >
            <ChevronUp className="w-2.5 h-2.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalTracks - 1}
            className="p-0 text-muted-foreground/25 hover:text-foreground disabled:opacity-15 transition-colors shrink-0"
          >
            <ChevronDown className="w-2.5 h-2.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Solo */}
          <button
            onClick={onToggleSolo}
            className={cn(
              "p-1 rounded-full transition-all duration-300 text-[8px] font-light w-5 h-5 flex items-center justify-center",
              (track as any).solo ? "text-[hsl(215,100%,75%)] bg-[hsla(215,100%,60%,0.15)]" : "text-muted-foreground/30 hover:text-foreground hover:bg-white/[0.04]"
            )}
            title="Solo"
          >
            S
          </button>
          {/* Mute */}
          <button
            onClick={onToggleMute}
            className={cn(
              "p-1 rounded-full transition-all duration-300",
              track.muted ? "text-[hsla(215,100%,75%,0.85)] bg-[hsla(215,100%,60%,0.12)]" : "text-muted-foreground/30 hover:text-foreground/70 hover:bg-white/[0.04]"
            )}
          >
            {track.muted ? <VolumeX className="w-2.5 h-2.5" strokeWidth={1.5} /> : <Volume2 className="w-2.5 h-2.5" strokeWidth={1.5} />}
          </button>
          {/* Lock */}
          <button
            onClick={onToggleLock}
            className={cn(
              "p-1 rounded-full transition-all duration-300",
              track.locked ? "text-[hsla(215,100%,75%,0.85)] bg-[hsla(215,100%,60%,0.12)]" : "text-muted-foreground/30 hover:text-foreground/70 hover:bg-white/[0.04]"
            )}
          >
            {track.locked ? <Lock className="w-2.5 h-2.5" strokeWidth={1.5} /> : <Unlock className="w-2.5 h-2.5" strokeWidth={1.5} />}
          </button>
          <div className="flex-1" />
          <button
            onClick={onRemove}
            className="p-1 rounded-full text-muted-foreground/25 hover:text-destructive hover:bg-destructive/5 transition-all duration-300"
          >
            <Trash2 className="w-2.5 h-2.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clip Block ───

const CLIP_COLORS: Record<string, string> = {
  video: "hsla(215, 100%, 60%, 0.18)",
  image: "hsla(200, 100%, 60%, 0.16)",
  text: "hsla(195, 100%, 70%, 0.16)",
  audio: "hsla(210, 100%, 65%, 0.18)",
};

const CLIP_BORDER_COLORS: Record<string, string> = {
  video: "hsla(215, 100%, 60%, 0.30)",
  image: "hsla(200, 100%, 60%, 0.28)",
  text: "hsla(195, 100%, 70%, 0.28)",
  audio: "hsla(210, 100%, 65%, 0.30)",
};

const CLIP_ACCENT_COLORS: Record<string, string> = {
  video: "hsla(215, 100%, 65%, 0.75)",
  image: "hsla(200, 100%, 65%, 0.65)",
  text: "hsla(195, 100%, 75%, 0.65)",
  audio: "hsla(210, 100%, 70%, 0.65)",
};

function ClipBlock({
  clip,
  trackId,
  zoom,
  scrollX,
  selected,
  onSelect,
  onTrimStart,
  onTrimEnd,
  onDragStart,
  onContextMenu,
}: {
  clip: TimelineClip;
  trackId: string;
  zoom: number;
  scrollX: number;
  selected: boolean;
  onSelect: () => void;
  onTrimStart: (clipId: string, trackId: string) => void;
  onTrimEnd: (clipId: string, trackId: string) => void;
  onDragStart: (e: React.MouseEvent, clipId: string, trackId: string) => void;
  onContextMenu: (e: React.MouseEvent, clipId: string, trackId: string) => void;
}) {
  const left = clip.start * zoom - scrollX;
  const width = Math.max(MIN_CLIP_WIDTH, (clip.end - clip.start) * zoom);

  if (left + width < 0 || left > 3000) return null;

  const opacity = clip.opacity ?? 1;
  const hasThumb = !!clip.thumbnail;
  // Calculate how many filmstrip frames to show based on clip width
  const frameWidth = 40;
  const frameCount = hasThumb ? Math.max(1, Math.floor(width / frameWidth)) : 0;

  return (
    <div
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-xl cursor-pointer group transition-all duration-200 overflow-hidden",
      )}
      style={{
        left: Math.max(0, left),
        width,
        background: hasThumb ? 'hsla(0, 0%, 0%, 0.35)' : (CLIP_COLORS[clip.type] || CLIP_COLORS.video),
        opacity,
        boxShadow: selected
          ? `inset 0 0 0 1px hsl(215, 100%, 65%), 0 0 24px hsla(215, 100%, 60%, 0.45), inset 0 1px 0 hsla(0,0%,100%,0.10)`
          : `inset 0 0 0 1px ${CLIP_BORDER_COLORS[clip.type] || CLIP_BORDER_COLORS.video}, 0 4px 14px -4px hsla(0, 0%, 0%, 0.45), inset 0 1px 0 hsla(0,0%,100%,0.04)`,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => { if (e.button === 0) onDragStart(e, clip.id, trackId); }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, clip.id, trackId); }}
    >
      {/* Filmstrip thumbnail background */}
      {hasThumb && frameCount > 0 && (
        <div className="absolute inset-0 flex" style={{ opacity: 0.6 }}>
          {Array.from({ length: frameCount }).map((_, i) => (
            <img
              key={i}
              src={clip.thumbnail!}
              alt=""
              className="h-full object-cover shrink-0"
              style={{
                width: `${100 / frameCount}%`,
                filter: 'brightness(0.7) contrast(1.1)',
              }}
              loading="lazy"
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* Audio waveform visualization */}
      {clip.type === "audio" && (
        <div className="absolute inset-0 flex items-end px-0.5 pt-3 pb-1 pointer-events-none" style={{ opacity: 0.5 }}>
          {Array.from({ length: Math.max(8, Math.floor(width / 4)) }).map((_, i) => {
            // Deterministic pseudo-random waveform based on clip id + index
            const seed = (clip.id.charCodeAt(i % clip.id.length) + i * 7) % 100;
            const h = 15 + (seed / 100) * 70; // 15–85% height
            return (
              <div
                key={i}
                className="flex-1 mx-px rounded-t-sm"
                style={{
                  height: `${h}%`,
                  background: `hsla(210, 100%, 65%, ${0.4 + (seed / 200)})`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Fade indicators */}
      {(clip.fadeIn ?? 0) > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 pointer-events-none z-10"
          style={{
            width: `${Math.min(50, ((clip.fadeIn ?? 0) / (clip.end - clip.start)) * 100)}%`,
            background: 'linear-gradient(90deg, hsla(0,0%,0%,0.5) 0%, transparent 100%)',
          }}
        />
      )}
      {(clip.fadeOut ?? 0) > 0 && (
        <div
          className="absolute top-0 bottom-0 right-0 pointer-events-none z-10"
          style={{
            width: `${Math.min(50, ((clip.fadeOut ?? 0) / (clip.end - clip.start)) * 100)}%`,
            background: 'linear-gradient(270deg, hsla(0,0%,0%,0.5) 0%, transparent 100%)',
          }}
        />
      )}

      {/* Transition badge */}
      {clip.transition && clip.transition !== "none" && (
        <div
          className="absolute top-1 right-1 z-20 px-1.5 py-0.5 rounded-full text-[7px] font-light uppercase tracking-[0.10em] pointer-events-none"
          style={{
            background: 'hsla(215, 100%, 60%, 0.20)',
            color: 'hsla(215, 100%, 80%, 0.95)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.08)',
          }}
        >
          {clip.transition} {clip.transitionDuration ? `${clip.transitionDuration}s` : ''}
        </div>
      )}

      {/* Speed indicator */}
      {clip.speed && clip.speed !== 1 && (
        <div
          className="absolute bottom-1 left-1 z-20 px-1.5 py-0.5 rounded-full text-[7px] font-light tabular-nums pointer-events-none"
          style={{
            background: 'hsla(215, 100%, 60%, 0.18)',
            color: 'hsla(215, 100%, 80%, 0.95)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)',
          }}
        >
          {clip.speed}×
        </div>
      )}

      {/* Volume indicator */}
      {clip.volume !== undefined && clip.volume < 1 && (
        <div
          className="absolute bottom-1 right-1 z-20 pointer-events-none"
          style={{ opacity: 0.6 }}
        >
          <Volume2 className="w-2.5 h-2.5 text-foreground/40" />
        </div>
      )}

      {/* Top accent bar with gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-[1.5px] z-10"
        style={{
          background: clip.colorLabel
            ? clip.colorLabel
            : `linear-gradient(90deg, ${CLIP_ACCENT_COLORS[clip.type] || CLIP_ACCENT_COLORS.video}, transparent)`,
          boxShadow: clip.colorLabel ? `0 0 10px ${clip.colorLabel}66` : `0 0 10px ${CLIP_ACCENT_COLORS[clip.type] || CLIP_ACCENT_COLORS.video}`,
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 px-2.5 h-full flex items-center gap-1.5 overflow-hidden pointer-events-none">
        {/* Type icon for clips without thumbnails */}
        {!hasThumb && (
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'hsla(0, 0%, 100%, 0.08)' }}>
            {clip.type === "video" ? <Film className="w-3 h-3 text-foreground/50" /> :
             clip.type === "text" ? <Type className="w-3 h-3 text-foreground/50" /> :
             clip.type === "audio" ? <Music className="w-3 h-3 text-foreground/50" /> :
             <Film className="w-3 h-3 text-foreground/50" />}
          </div>
        )}
        <span
          className={cn(
            "text-[10px] font-light tracking-tight truncate",
            hasThumb ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]" : "text-foreground/85"
          )}
        >
          {clip.name}
        </span>
        {width > 80 && (
          <span
            className={cn(
              "text-[8px] font-mono font-light ml-auto shrink-0 tabular-nums px-1.5 py-0.5 rounded-full",
              hasThumb
                ? "text-white/85 bg-black/45 backdrop-blur-md"
                : "text-foreground/40"
            )}
          >
            {(clip.end - clip.start).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Trim handles */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-xl z-20"
        style={{ background: 'hsla(215, 100%, 75%, 0.55)', boxShadow: '0 0 8px hsla(215,100%,60%,0.55)' }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimStart(clip.id, trackId); }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-r-xl z-20"
        style={{ background: 'hsla(215, 100%, 75%, 0.55)', boxShadow: '0 0 8px hsla(215,100%,60%,0.55)' }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimEnd(clip.id, trackId); }}
      />

      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
        style={{ background: 'linear-gradient(180deg, hsla(215, 100%, 60%, 0.08) 0%, transparent 60%)' }}
      />
    </div>
  );
}

// ─── Context Menu ───

interface ContextMenuState {
  x: number;
  y: number;
  clipId: string;
  trackId: string;
}

const CLIP_LABEL_COLORS = [
  { name: "None", color: "" },
  { name: "Red", color: "hsl(0, 80%, 50%)" },
  { name: "Orange", color: "hsl(30, 90%, 50%)" },
  { name: "Yellow", color: "hsl(50, 90%, 50%)" },
  { name: "Green", color: "hsl(142, 65%, 45%)" },
  { name: "Blue", color: "hsl(215, 100%, 50%)" },
  { name: "Purple", color: "hsl(280, 65%, 55%)" },
  { name: "Pink", color: "hsl(340, 80%, 55%)" },
];

function ClipContextMenu({
  menu,
  onClose,
  onSplit,
  onDuplicate,
  onDelete,
  onRippleDelete,
  onColorLabel,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRippleDelete: () => void;
  onColorLabel: (color: string) => void;
}) {
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[200px] rounded-xl border shadow-2xl py-1.5 overflow-hidden backdrop-blur-2xl"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'hsla(220, 14%, 8%, 0.95)',
        borderColor: 'hsla(0, 0%, 100%, 0.08)',
        boxShadow: '0 8px 32px hsla(0, 0%, 0%, 0.5), 0 0 0 1px hsla(0, 0%, 100%, 0.04)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => { onSplit(); onClose(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-foreground/70 hover:bg-primary/10 hover:text-foreground transition-colors">
        <Scissors className="w-3.5 h-3.5" /> Split at Playhead
      </button>
      <button onClick={() => { onDuplicate(); onClose(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-foreground/70 hover:bg-primary/10 hover:text-foreground transition-colors">
        <Copy className="w-3.5 h-3.5" /> Duplicate
      </button>

      <div className="h-px mx-3 my-1" style={{ background: 'hsla(0, 0%, 100%, 0.06)' }} />

      {/* Color Label */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-foreground/70 hover:bg-primary/10 hover:text-foreground transition-colors"
      >
        <Palette className="w-3.5 h-3.5" /> Color Label
      </button>
      {showColors && (
        <div className="flex items-center gap-1 px-3.5 py-1.5">
          {CLIP_LABEL_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => { onColorLabel(c.color); onClose(); }}
              className="w-4 h-4 rounded-full border transition-all hover:scale-125"
              style={{
                background: c.color || 'hsla(0, 0%, 100%, 0.1)',
                borderColor: c.color ? `${c.color}` : 'hsla(0, 0%, 100%, 0.2)',
              }}
              title={c.name}
            />
          ))}
        </div>
      )}

      <div className="h-px mx-3 my-1" style={{ background: 'hsla(0, 0%, 100%, 0.06)' }} />
      <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors">
        <Trash className="w-3.5 h-3.5" /> Delete
      </button>
      <button onClick={() => { onRippleDelete(); onClose(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors">
        <Trash2 className="w-3.5 h-3.5" /> Ripple Delete
      </button>
    </div>
  );
}

// ─── Format duration ───

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
}

// ─── Main Timeline ───

export const CustomTimeline = memo(function CustomTimeline({ className, onOpenTextDialog }: { className?: string; onOpenTextDialog?: () => void }) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useCustomTimeline();
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isDragging, setIsDragging] = useState(false);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const dragRef = useRef<{
    type: "playhead" | "clip" | "trim-start" | "trim-end";
    clipId?: string;
    trackId?: string;
    startX?: number;
    startTime?: number;
  } | null>(null);

  const totalWidth = Math.max(state.duration + 10, 30) * state.zoom;

  // ─── Measure container width for minimap ───
  useEffect(() => {
    if (!timelineRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(timelineRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Auto-scroll to follow playhead during playback ───
  useEffect(() => {
    if (!state.isPlaying || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const playheadPixel = state.playheadTime * state.zoom;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth - HEADER_WIDTH;

    if (playheadPixel > viewRight - 50) {
      container.scrollLeft = playheadPixel - container.clientWidth / 2;
    } else if (playheadPixel < viewLeft + 50) {
      container.scrollLeft = Math.max(0, playheadPixel - 50);
    }
  }, [state.playheadTime, state.isPlaying, state.zoom]);

  // ─── Fit to view ───
  const fitToView = useCallback(() => {
    if (!scrollContainerRef.current || state.duration <= 0) return;
    const availableWidth = scrollContainerRef.current.clientWidth - HEADER_WIDTH - 40;
    const newZoom = Math.max(10, Math.min(200, availableWidth / state.duration));
    dispatch({ type: "SET_ZOOM", zoom: newZoom });
    dispatch({ type: "SET_SCROLL_X", scrollX: 0 });
  }, [state.duration, dispatch]);

  // ─── Playhead scrubbing ───
  const handleRulerMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + state.scrollX;
    const time = x / state.zoom;
    dispatch({ type: "SET_PLAYHEAD", time: Math.max(0, time) });
    dragRef.current = { type: "playhead" };
    setIsDragging(true);
  }, [state.zoom, state.scrollX, dispatch]);

  // ─── Trimming ───
  const handleTrimStart = useCallback((clipId: string, trackId: string) => {
    dragRef.current = { type: "trim-start", clipId, trackId };
    setIsDragging(true);
  }, []);

  const handleTrimEnd = useCallback((clipId: string, trackId: string) => {
    dragRef.current = { type: "trim-end", clipId, trackId };
    setIsDragging(true);
  }, []);

  // ─── Razor tool click ───
  const handleRazorClick = useCallback((e: React.MouseEvent, clipId: string, trackId: string) => {
    if (state.activeTool !== "razor") return;
    const track = state.tracks.find(t => t.id === trackId);
    const clip = track?.clips.find(c => c.id === clipId);
    if (!clip || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + state.scrollX - HEADER_WIDTH;
    const splitTime = x / state.zoom;

    if (splitTime <= clip.start + 0.1 || splitTime >= clip.end - 0.1) return;

    dispatch({ type: "TRIM_CLIP", trackId, clipId: clip.id, edge: "end", newTime: splitTime });
    const offsetIntoSource = splitTime - clip.start;
    dispatch({
      type: "ADD_CLIP",
      trackId,
      clip: {
        id: generateClipId(), type: clip.type, src: clip.src, text: clip.text,
        start: splitTime, end: clip.end,
        trimStart: clip.trimStart + offsetIntoSource, trimEnd: clip.trimEnd,
        name: `${clip.name} (cut)`, thumbnail: clip.thumbnail,
        sourceDuration: clip.sourceDuration, textStyle: clip.textStyle,
        volume: clip.volume, speed: clip.speed, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut,
      },
    });
  }, [state.activeTool, state.tracks, state.scrollX, state.zoom, dispatch]);

  // ─── Clip dragging ───
  const handleClipDragStart = useCallback((e: React.MouseEvent, clipId: string, trackId: string) => {
    if (state.activeTool === "razor") {
      handleRazorClick(e, clipId, trackId);
      return;
    }
    const clip = state.tracks.find(t => t.id === trackId)?.clips.find(c => c.id === clipId);
    if (!clip) return;
    dragRef.current = { type: "clip", clipId, trackId, startX: e.clientX, startTime: clip.start };
    setIsDragging(true);
  }, [state.tracks, state.activeTool, handleRazorClick]);

  // ─── Context menu ───
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId: string, trackId: string) => {
    dispatch({ type: "SELECT_CLIP", clipId, trackId });
    setContextMenu({ x: e.clientX, y: e.clientY, clipId, trackId });
  }, [dispatch]);

  const handleContextSplit = useCallback(() => {
    if (!contextMenu) return;
    const track = state.tracks.find(t => t.id === contextMenu.trackId);
    const clip = track?.clips.find(c => c.id === contextMenu.clipId);
    if (!clip || state.playheadTime <= clip.start || state.playheadTime >= clip.end) return;

    dispatch({ type: "TRIM_CLIP", trackId: contextMenu.trackId, clipId: clip.id, edge: "end", newTime: state.playheadTime });
    const offsetIntoSource = state.playheadTime - clip.start;
    dispatch({
      type: "ADD_CLIP",
      trackId: contextMenu.trackId,
      clip: {
        id: generateClipId(), type: clip.type, src: clip.src, text: clip.text,
        start: state.playheadTime, end: clip.end,
        trimStart: clip.trimStart + offsetIntoSource, trimEnd: clip.trimEnd,
        name: `${clip.name} (split)`, thumbnail: clip.thumbnail,
        sourceDuration: clip.sourceDuration, textStyle: clip.textStyle,
        volume: clip.volume, speed: clip.speed, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut,
      },
    });
  }, [contextMenu, state.tracks, state.playheadTime, dispatch]);

  const handleContextDuplicate = useCallback(() => {
    if (!contextMenu) return;
    const track = state.tracks.find(t => t.id === contextMenu.trackId);
    const clip = track?.clips.find(c => c.id === contextMenu.clipId);
    if (!clip) return;
    dispatch({
      type: "ADD_CLIP",
      trackId: contextMenu.trackId,
      clip: { ...clip, id: generateClipId(), start: clip.end, end: clip.end + (clip.end - clip.start), name: `${clip.name} (copy)` },
    });
  }, [contextMenu, state.tracks, dispatch]);

  const handleContextDelete = useCallback(() => {
    if (!contextMenu) return;
    dispatch({ type: "REMOVE_CLIP", trackId: contextMenu.trackId, clipId: contextMenu.clipId });
  }, [contextMenu, dispatch]);

  const handleContextRippleDelete = useCallback(() => {
    if (!contextMenu) return;
    dispatch({ type: "RIPPLE_DELETE", trackId: contextMenu.trackId, clipId: contextMenu.clipId });
  }, [contextMenu, dispatch]);

  // ─── Global mouse handlers ───
  useEffect(() => {
    if (!isDragging) return;

    const snapEdges = state.snapEnabled ? getSnapEdges(state.tracks, dragRef.current?.clipId) : [];

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();

      if (dragRef.current.type === "playhead") {
        const x = e.clientX - rect.left + state.scrollX - HEADER_WIDTH;
        const time = x / state.zoom;
        dispatch({ type: "SET_PLAYHEAD", time: Math.max(0, time) });
      }

      if (dragRef.current.type === "trim-start" && dragRef.current.clipId && dragRef.current.trackId) {
        const x = e.clientX - rect.left + state.scrollX - HEADER_WIDTH;
        let time = x / state.zoom;
        if (state.snapEnabled) {
          const { snapped, didSnap } = snapToEdge(time, snapEdges, state.zoom, SNAP_THRESHOLD);
          time = snapped;
          setSnapLine(didSnap ? snapped : null);
        }
        dispatch({ type: "TRIM_CLIP", trackId: dragRef.current.trackId, clipId: dragRef.current.clipId, edge: "start", newTime: time });
      }

      if (dragRef.current.type === "trim-end" && dragRef.current.clipId && dragRef.current.trackId) {
        const x = e.clientX - rect.left + state.scrollX - HEADER_WIDTH;
        let time = x / state.zoom;
        if (state.snapEnabled) {
          const { snapped, didSnap } = snapToEdge(time, snapEdges, state.zoom, SNAP_THRESHOLD);
          time = snapped;
          setSnapLine(didSnap ? snapped : null);
        }
        dispatch({ type: "TRIM_CLIP", trackId: dragRef.current.trackId, clipId: dragRef.current.clipId, edge: "end", newTime: time });
      }

      if (dragRef.current.type === "clip" && dragRef.current.clipId && dragRef.current.trackId) {
        const dx = e.clientX - (dragRef.current.startX || 0);
        const dt = dx / state.zoom;
        let newStart = Math.max(0, (dragRef.current.startTime || 0) + dt);

        if (state.snapEnabled) {
          const clip = state.tracks.find(t => t.id === dragRef.current!.trackId)?.clips.find(c => c.id === dragRef.current!.clipId);
          const clipDur = clip ? clip.end - clip.start : 0;
          const { snapped: snappedStart, didSnap: snap1 } = snapToEdge(newStart, snapEdges, state.zoom, SNAP_THRESHOLD);
          const { snapped: snappedEnd, didSnap: snap2 } = snapToEdge(newStart + clipDur, snapEdges, state.zoom, SNAP_THRESHOLD);
          if (snap1) { newStart = snappedStart; setSnapLine(snappedStart); }
          else if (snap2) { newStart = snappedEnd - clipDur; setSnapLine(snappedEnd); }
          else { setSnapLine(null); }
        }

        dispatch({
          type: "MOVE_CLIP",
          fromTrackId: dragRef.current.trackId,
          toTrackId: dragRef.current.trackId,
          clipId: dragRef.current.clipId,
          newStart,
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      setSnapLine(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, state.scrollX, state.zoom, state.snapEnabled, state.tracks, dispatch]);

  // ─── Scroll ───
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    dispatch({ type: "SET_SCROLL_X", scrollX: (e.target as HTMLElement).scrollLeft });
  }, [dispatch]);

  // ─── Add track ───
  const addTrack = useCallback((type: "video" | "text" | "audio") => {
    const labelMap = { video: "Video", text: "Text", audio: "Audio" };
    const count = state.tracks.filter(t => t.type === type).length + 1;
    dispatch({
      type: "ADD_TRACK",
      track: {
        id: generateTrackId(),
        type: type === "audio" ? "audio" : type,
        label: `${labelMap[type]} ${count}`,
        clips: [],
      },
    });
  }, [dispatch, state.tracks]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Home") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", time: 0 });
      } else if (e.key === "End") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", time: state.duration });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        dispatch({ type: "SELECT_ALL_CLIPS" });
      } else if (e.key === "v" && !e.ctrlKey && !e.metaKey) {
        dispatch({ type: "SET_ACTIVE_TOOL", tool: "select" });
      } else if (e.key === "c" && !e.ctrlKey && !e.metaKey) {
        dispatch({ type: "SET_ACTIVE_TOOL", tool: "razor" });
      } else if (e.key === "b" && !e.ctrlKey && !e.metaKey) {
        dispatch({ type: "SET_ACTIVE_TOOL", tool: "ripple" });
      } else if (e.key === "m" && !e.ctrlKey && !e.metaKey) {
        const marker: TimelineMarker = {
          id: `marker-${Date.now()}`,
          time: state.playheadTime,
          label: `M${state.markers.length + 1}`,
          color: ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"][state.markers.length % 5],
        };
        dispatch({ type: "ADD_MARKER", marker });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, dispatch, state.duration, state.playheadTime, state.markers.length]);

  const playheadLeft = state.playheadTime * state.zoom - state.scrollX;

  return (
    <div
      ref={timelineRef}
      className={cn("flex flex-col overflow-hidden select-none", className)}
      style={{
        background:
          'radial-gradient(800px 400px at 50% 0%, hsla(215,100%,30%,0.10), transparent 60%), linear-gradient(180deg, hsl(220, 14%, 3.2%) 0%, hsl(220, 14%, 2.4%) 100%)',
      }}
    >
      {/* ─── Toolbar — compact single row ─── */}
      <div
        className="shrink-0 flex items-center px-3 h-10 overflow-hidden gap-1.5 relative"
        style={{
          background: 'linear-gradient(180deg, hsla(220, 14%, 6%, 0.55) 0%, hsla(220, 14%, 4%, 0.55) 100%)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04), inset 0 -1px 0 hsla(215,100%,60%,0.08)',
        }}
      >
        {/* Tool selector — Select / Razor / Ripple */}
        <div className="flex items-center rounded-full p-0.5 shrink-0"
          style={{
            background: 'hsla(0,0%,100%,0.025)',
            backdropFilter: 'blur(24px)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)',
          }}
        >
          {([
            { tool: "select" as EditorTool, icon: <MousePointer2 className="w-3 h-3" />, tip: "Select (V)" },
            { tool: "razor" as EditorTool, icon: <Slice className="w-3 h-3" />, tip: "Razor (C)" },
            { tool: "ripple" as EditorTool, icon: <ArrowDownToLine className="w-3 h-3" />, tip: "Ripple (B)" },
          ]).map((t) => (
            <Tooltip key={t.tool}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => dispatch({ type: "SET_ACTIVE_TOOL", tool: t.tool })}
                  className={cn(
                    "h-6 w-6 flex items-center justify-center rounded-full transition-all duration-300",
                    state.activeTool === t.tool
                      ? "text-white"
                      : "text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.05]"
                  )}
                  style={state.activeTool === t.tool ? {
                    background: 'linear-gradient(180deg, hsl(215,100%,60%), hsl(215,100%,48%))',
                    boxShadow: '0 0 14px hsla(215,100%,60%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.18)',
                  } : undefined}
                >
                  {t.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[9px]">{t.tip}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="w-px h-4 bg-gradient-to-b from-transparent via-white/[0.10] to-transparent shrink-0" />

        {/* Add tracks */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => addTrack("video")}
            className="h-6 px-2 flex items-center gap-1 text-[9px] font-light tracking-wide text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.04] rounded-full transition-all duration-300">
            <Plus className="w-2.5 h-2.5" strokeWidth={1.5} /><span className="hidden xl:inline">Video</span>
          </button>
          <button onClick={() => addTrack("audio")}
            className="h-6 px-2 flex items-center gap-1 text-[9px] font-light tracking-wide text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.04] rounded-full transition-all duration-300">
            <Music className="w-2.5 h-2.5" strokeWidth={1.5} /><span className="hidden xl:inline">Audio</span>
          </button>
          <button onClick={() => onOpenTextDialog?.()}
            className="h-6 px-2 flex items-center gap-1 text-[9px] font-light tracking-wide text-muted-foreground/55 hover:text-foreground hover:bg-white/[0.04] rounded-full transition-all duration-300">
            <Type className="w-2.5 h-2.5" strokeWidth={1.5} /><span className="hidden xl:inline">Text</span>
          </button>
        </div>

        <div className="w-px h-4 bg-gradient-to-b from-transparent via-white/[0.10] to-transparent shrink-0" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={undo} disabled={!canUndo}
                className="h-6 w-6 flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.04] disabled:opacity-15 rounded-full transition-all duration-300">
                <Undo2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[9px]">Undo (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={redo} disabled={!canRedo}
                className="h-6 w-6 flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.04] disabled:opacity-15 rounded-full transition-all duration-300">
                <Redo2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[9px]">Redo (⌘Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-4 bg-gradient-to-b from-transparent via-white/[0.10] to-transparent shrink-0" />

        {/* Snap + Marker */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => dispatch({ type: "TOGGLE_SNAP" })}
              className={cn("h-6 w-6 flex items-center justify-center rounded-full transition-all duration-300 shrink-0",
                state.snapEnabled ? "text-[hsl(215,100%,80%)]" : "text-muted-foreground/30 hover:text-foreground/60 hover:bg-white/[0.04]")}
              style={state.snapEnabled ? {
                background: 'hsla(215,100%,60%,0.14)',
                boxShadow: '0 0 12px hsla(215,100%,60%,0.40), inset 0 1px 0 hsla(0,0%,100%,0.06)',
              } : undefined}
            >
              <Magnet className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[9px]">Snap {state.snapEnabled ? "On" : "Off"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                const marker: TimelineMarker = {
                  id: `marker-${Date.now()}`,
                  time: state.playheadTime,
                  label: `M${state.markers.length + 1}`,
                  color: ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"][state.markers.length % 5],
                };
                dispatch({ type: "ADD_MARKER", marker });
              }}
              className="h-6 w-6 flex items-center justify-center text-muted-foreground/30 hover:text-[hsl(215,100%,75%)] hover:bg-[hsla(215,100%,60%,0.08)] rounded-full transition-all duration-300 shrink-0"
            >
              <Flag className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[9px]">Add Marker (M)</TooltipContent>
        </Tooltip>

        {/* Duration */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
          style={{ background: 'hsla(0,0%,100%,0.025)', boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)' }}>
          <Clock className="w-2.5 h-2.5 text-muted-foreground/40" strokeWidth={1.5} />
          <span className="text-[9px] text-muted-foreground/55 font-mono font-light tabular-nums">{formatDuration(state.duration)}</span>
        </div>

        {state.markers.length > 0 && (
          <div className="flex items-center gap-0.5 px-1 shrink-0">
            {state.markers.slice(0, 5).map((m) => (
              <button
                key={m.id}
                onClick={() => dispatch({ type: "SET_PLAYHEAD", time: m.time })}
                onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "REMOVE_MARKER", markerId: m.id }); }}
                className="w-4 h-4 rounded-sm flex items-center justify-center text-[7px] font-bold transition-all hover:scale-110"
                style={{ background: m.color + '33', color: m.color }}
                title={`${m.label} — ${formatDuration(m.time)} (right-click to remove)`}
              >
                {m.label.slice(0, 2)}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Fit + Zoom */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-full shrink-0"
          style={{ background: 'hsla(0,0%,100%,0.025)', boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={fitToView}
                className="h-6 w-6 flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.04] rounded-full transition-all duration-300">
                <Maximize2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[9px]">Fit to View</TooltipContent>
          </Tooltip>
          <button onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom - 10 })}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.04] rounded-full transition-all duration-300">
            <ZoomOut className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <div className="w-14 h-1 rounded-full mx-1.5 relative shrink-0" style={{ background: 'hsla(0,0%,100%,0.06)' }}>
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: `${((state.zoom - 10) / 190) * 100}%`,
                background: 'linear-gradient(90deg, hsl(215, 100%, 60%), hsl(200, 100%, 70%))',
                boxShadow: '0 0 8px hsla(215,100%,60%,0.55)',
              }}
            />
          </div>
          <button onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom + 10 })}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.04] rounded-full transition-all duration-300">
            <ZoomIn className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ─── Ruler ─── */}
      <div onMouseDown={handleRulerMouseDown} className="shrink-0 cursor-pointer">
        <TimelineRuler zoom={state.zoom} scrollX={state.scrollX} duration={state.duration} />
      </div>

      {/* ─── Minimap Overview ─── */}
      <TimelineMinimap containerWidth={containerWidth} headerWidth={HEADER_WIDTH} />

      {/* ─── Tracks area ─── */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto relative" onScroll={handleScroll} style={{ contain: 'strict', cursor: state.activeTool === 'razor' ? 'crosshair' : state.activeTool === 'ripple' ? 'col-resize' : undefined }}>
        <div className="relative" style={{ minWidth: HEADER_WIDTH + totalWidth, minHeight: state.tracks.length * TRACK_HEIGHT || 96 }}>
          {state.tracks.map((track, idx) => (
            <div key={track.id} className="flex" style={{ height: TRACK_HEIGHT }}>
              {/* Header */}
              <TrackHeader
                track={track}
                index={idx}
                totalTracks={state.tracks.length}
                onToggleMute={() => dispatch({ type: "TOGGLE_TRACK_MUTE", trackId: track.id })}
                onToggleLock={() => dispatch({ type: "TOGGLE_TRACK_LOCK", trackId: track.id })}
                onToggleSolo={() => {/* Solo is visual-only for now */}}
                onRemove={() => dispatch({ type: "REMOVE_TRACK", trackId: track.id })}
                onMoveUp={() => dispatch({ type: "MOVE_TRACK", trackId: track.id, direction: "up" })}
                onMoveDown={() => dispatch({ type: "MOVE_TRACK", trackId: track.id, direction: "down" })}
              />

              {/* Clip area */}
              <div
                className="relative flex-1"
                style={{
                  height: TRACK_HEIGHT,
                  boxShadow: 'inset 0 -1px 0 hsla(0,0%,100%,0.025)',
                  background: idx % 2 === 0
                    ? 'hsla(220, 14%, 5%, 0.30)'
                    : 'hsla(220, 14%, 4%, 0.18)',
                }}
                onClick={() => dispatch({ type: "SELECT_CLIP", clipId: null, trackId: track.id })}
              >
                {track.clips.map((clip) => (
                  <ClipBlock
                    key={clip.id}
                    clip={clip}
                    trackId={track.id}
                    zoom={state.zoom}
                    scrollX={state.scrollX}
                    selected={state.selectedClipId === clip.id}
                    onSelect={() => dispatch({ type: "SELECT_CLIP", clipId: clip.id, trackId: track.id })}
                    onTrimStart={handleTrimStart}
                    onTrimEnd={handleTrimEnd}
                    onDragStart={handleClipDragStart}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {state.tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground/20">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'hsla(0, 0%, 100%, 0.04)',
                  border: '1px dashed hsla(0, 0%, 100%, 0.1)',
                }}
              >
                <Film className="w-6 h-6 text-muted-foreground/15" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[12px] font-semibold text-muted-foreground/30">No tracks yet</p>
                <p className="text-[10px] text-muted-foreground/20">Click +Video, +Audio, or +Text above to add a track</p>
              </div>
            </div>
          )}
        </div>

        {/* Snap indicator line */}
        {snapLine !== null && (
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none z-20"
            style={{
              left: HEADER_WIDTH + snapLine * state.zoom - state.scrollX,
              background: 'hsl(45, 100%, 55%)',
              boxShadow: '0 0 8px hsla(45, 100%, 55%, 0.5)',
            }}
          />
        )}

        {/* Marker lines */}
        {state.markers.map((marker) => {
          const markerLeft = HEADER_WIDTH + marker.time * state.zoom - state.scrollX;
          if (markerLeft < HEADER_WIDTH - 10 || markerLeft > 3000) return null;
          return (
            <div key={marker.id} className="absolute top-0 bottom-0 pointer-events-none z-15" style={{ left: markerLeft }}>
              <div className="absolute top-0 bottom-0 w-px" style={{ background: marker.color, opacity: 0.5 }} />
              <div
                className="absolute -top-0.5 -translate-x-1/2 px-1 py-px rounded-b text-[7px] font-bold"
                style={{ background: marker.color, color: '#fff' }}
              >
                {marker.label}
              </div>
            </div>
          );
        })}

        {/* Playhead line — improved grab area */}
        {playheadLeft >= 0 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{ left: HEADER_WIDTH + playheadLeft }}
          >
            {/* Visible line */}
            <div
              className="absolute top-0 bottom-0 w-px left-1/2 -translate-x-1/2"
              style={{
                background: 'hsl(0, 0%, 90%)',
                boxShadow: '0 0 8px hsla(0, 0%, 100%, 0.4)',
              }}
            />
            {/* Playhead triangle */}
            <div
              className="absolute -top-px left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '7px solid hsl(0, 0%, 90%)',
                filter: 'drop-shadow(0 1px 3px hsla(0, 0%, 100%, 0.4))',
              }}
            />
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ClipContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onSplit={handleContextSplit}
          onDuplicate={handleContextDuplicate}
          onDelete={handleContextDelete}
          onRippleDelete={handleContextRippleDelete}
          onColorLabel={(color) => {
            dispatch({
              type: "UPDATE_CLIP",
              trackId: contextMenu.trackId,
              clipId: contextMenu.clipId,
              updates: { colorLabel: color || undefined },
            });
          }}
        />
      )}
    </div>
  );
});
