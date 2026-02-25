/**
 * CustomTimeline — Multi-track visual timeline with clip blocks,
 * playhead scrubbing, clip selection, trim handles, snap-to-edge,
 * auto-scroll, fit-to-view, track reordering, and context menu.
 */

import { useRef, useCallback, useState, memo, useEffect } from "react";
import {
  Plus, Trash2, Volume2, VolumeX, Lock, Unlock, ZoomIn, ZoomOut,
  Eye, Type, Undo2, Redo2, Music, Maximize2, Magnet, ChevronUp, ChevronDown,
  Clock, Scissors, Copy, Trash, Film
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTimeline, TimelineTrack, TimelineClip, generateTrackId, generateClipId } from "@/hooks/useCustomTimeline";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        background: 'linear-gradient(180deg, hsl(240 18% 7%) 0%, hsl(240 22% 5.5%) 100%)',
        borderBottom: '1px solid hsla(0, 0%, 100%, 0.06)',
      }}
    >
      <div className="relative h-full" style={{ width: totalWidth, transform: `translateX(-${scrollX}px)` }}>
        {marks.map((mark) => (
          <div
            key={mark.time}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: mark.time * zoom }}
          >
            <div className="w-px h-3" style={{ background: 'hsla(0, 0%, 100%, 0.12)' }} />
            <span className="text-[9px] text-muted-foreground/40 mt-0.5 font-mono leading-none whitespace-nowrap">
              {mark.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Track Header ───

function TrackHeader({ track, index, totalTracks, onToggleMute, onToggleLock, onRemove, onMoveUp, onMoveDown }: {
  track: TimelineTrack;
  index: number;
  totalTracks: number;
  onToggleMute: () => void;
  onToggleLock: () => void;
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
    video: 'hsla(0, 0%, 100%, 0.08)',
    audio: 'hsla(190, 70%, 55%, 0.12)',
    text: 'hsla(170, 70%, 50%, 0.12)',
  };

  return (
    <div
      className="shrink-0 flex flex-col justify-center gap-1.5 px-3 select-none overflow-hidden"
      style={{
        width: HEADER_WIDTH,
        height: TRACK_HEIGHT,
        background: 'linear-gradient(90deg, hsl(240 18% 7%) 0%, hsl(240 22% 5.5%) 100%)',
        borderRight: '1px solid hsla(0, 0%, 100%, 0.05)',
        borderBottom: '1px solid hsla(0, 0%, 100%, 0.04)',
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: typeColors[track.type] || typeColors.video }}>
          <span className="text-foreground/60">{typeIcon}</span>
        </div>
        <span className="text-[10px] font-bold text-foreground/65 truncate flex-1 tracking-wide">
          {track.label}
        </span>
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-0 text-muted-foreground/25 hover:text-foreground disabled:opacity-15 transition-colors shrink-0"
        >
          <ChevronUp className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalTracks - 1}
          className="p-0 text-muted-foreground/25 hover:text-foreground disabled:opacity-15 transition-colors shrink-0"
        >
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMute}
          className={cn(
            "p-1 rounded-md transition-all",
            track.muted ? "text-amber-400/60 bg-amber-400/10" : "text-muted-foreground/30 hover:text-foreground/60 hover:bg-white/[0.04]"
          )}
        >
          {track.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
        </button>
        <button
          onClick={onToggleLock}
          className={cn(
            "p-1 rounded-md transition-all",
            track.locked ? "text-primary/60 bg-primary/10" : "text-muted-foreground/30 hover:text-foreground/60 hover:bg-white/[0.04]"
          )}
        >
          {track.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
        </button>
        <div className="flex-1" />
        <button
          onClick={onRemove}
          className="p-1 rounded-md text-muted-foreground/25 hover:text-destructive hover:bg-destructive/5 transition-all"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Clip Block ───

const CLIP_COLORS: Record<string, string> = {
  video: "hsla(210, 50%, 55%, 0.22)",
  image: "hsla(45, 85%, 55%, 0.22)",
  text: "hsla(170, 65%, 50%, 0.22)",
  audio: "hsla(190, 65%, 55%, 0.22)",
};

const CLIP_BORDER_COLORS: Record<string, string> = {
  video: "hsla(210, 50%, 55%, 0.4)",
  image: "hsla(45, 85%, 55%, 0.4)",
  text: "hsla(170, 65%, 50%, 0.4)",
  audio: "hsla(190, 65%, 55%, 0.4)",
};

const CLIP_ACCENT_COLORS: Record<string, string> = {
  video: "hsla(210, 50%, 55%, 0.6)",
  image: "hsla(45, 85%, 55%, 0.6)",
  text: "hsla(170, 65%, 50%, 0.6)",
  audio: "hsla(190, 65%, 55%, 0.6)",
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

  return (
    <div
      className={cn(
        "absolute top-2 bottom-2 rounded-lg cursor-pointer group transition-all duration-150",
        selected && "ring-1 ring-primary/70"
      )}
      style={{
        left: Math.max(0, left),
        width,
        background: CLIP_COLORS[clip.type] || CLIP_COLORS.video,
        border: `1px solid ${selected ? 'hsl(var(--primary))' : (CLIP_BORDER_COLORS[clip.type] || CLIP_BORDER_COLORS.video)}`,
        opacity,
        boxShadow: selected ? `0 0 20px hsla(0, 0%, 100%, 0.1)` : 'none',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => { if (e.button === 0) onDragStart(e, clip.id, trackId); }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, clip.id, trackId); }}
    >
      {/* Type accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg"
        style={{ background: clip.colorLabel || (CLIP_ACCENT_COLORS[clip.type] || CLIP_ACCENT_COLORS.video) }}
      />
      
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg"
        style={{ background: 'hsla(0, 0%, 100%, 0.4)' }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimStart(clip.id, trackId); }}
      />
      <div className="px-2.5 h-full flex items-center gap-1.5 overflow-hidden pointer-events-none">
        {clip.thumbnail && width > 60 && (
          <img src={clip.thumbnail} alt="" className="w-8 h-8 rounded-md object-cover shrink-0 border border-white/[0.08]" />
        )}
        <span className="text-[10px] text-foreground/80 font-semibold truncate">{clip.name}</span>
        {width > 80 && (
          <span className="text-[8px] text-foreground/35 font-mono ml-auto shrink-0 tabular-nums">
            {(clip.end - clip.start).toFixed(1)}s
          </span>
        )}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r-lg"
        style={{ background: 'hsla(0, 0%, 100%, 0.4)' }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimEnd(clip.id, trackId); }}
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

function ClipContextMenu({
  menu,
  onClose,
  onSplit,
  onDuplicate,
  onDelete,
  onRippleDelete,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRippleDelete: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[170px] rounded-xl border shadow-2xl py-1.5 overflow-hidden backdrop-blur-xl"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'hsla(240, 22%, 8%, 0.95)',
        borderColor: 'hsla(0, 0%, 100%, 0.1)',
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

  // ─── Clip dragging ───
  const handleClipDragStart = useCallback((e: React.MouseEvent, clipId: string, trackId: string) => {
    const clip = state.tracks.find(t => t.id === trackId)?.clips.find(c => c.id === clipId);
    if (!clip) return;
    dragRef.current = { type: "clip", clipId, trackId, startX: e.clientX, startTime: clip.start };
    setIsDragging(true);
  }, [state.tracks]);

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
        if ((e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
          e.preventDefault();
          dispatch({ type: "SELECT_ALL_CLIPS" });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, dispatch, state.duration]);

  const playheadLeft = state.playheadTime * state.zoom - state.scrollX;

  return (
    <div
      ref={timelineRef}
      className={cn("flex flex-col overflow-hidden select-none", className)}
      style={{ background: 'hsl(240, 25%, 4%)' }}
    >
      {/* ─── Toolbar ─── */}
      <div
        className="shrink-0 flex items-center gap-1 px-3 h-11 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(240 18% 7%) 0%, hsl(240 22% 5.5%) 100%)',
          borderBottom: '1px solid hsla(0, 0%, 100%, 0.06)',
        }}
      >
        {/* Left: Add track buttons — grouped */}
        <div
          className="flex items-center gap-0.5 shrink-0 px-0.5 py-0.5 rounded-lg"
          style={{ background: 'hsla(0,0%,100%,0.02)', border: '1px solid hsla(0,0%,100%,0.04)' }}
        >
          <Button variant="ghost" size="sm" onClick={() => addTrack("video")}
            className="h-7 px-2.5 text-[10px] gap-1.5 text-muted-foreground/60 hover:text-foreground font-semibold whitespace-nowrap rounded-md">
            <Plus className="w-3 h-3" /> Video
          </Button>
          <div className="w-px h-4 bg-white/[0.05]" />
          <Button variant="ghost" size="sm" onClick={() => addTrack("audio")}
            className="h-7 px-2.5 text-[10px] gap-1.5 text-muted-foreground/60 hover:text-foreground font-semibold whitespace-nowrap rounded-md">
            <Music className="w-3 h-3" /> Audio
          </Button>
          <div className="w-px h-4 bg-white/[0.05]" />
          <Button variant="ghost" size="sm" onClick={() => onOpenTextDialog?.()}
            className="h-7 px-2.5 text-[10px] gap-1.5 text-muted-foreground/60 hover:text-foreground font-semibold whitespace-nowrap rounded-md">
            <Type className="w-3 h-3" /> Text
          </Button>
        </div>

        <div className="w-px h-5 bg-white/[0.05] shrink-0 mx-1" />

        {/* Undo / Redo — grouped */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}
                className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 rounded-lg">
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">Undo (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}
                className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 rounded-lg">
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">Redo (⌘Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-5 bg-white/[0.05] shrink-0 mx-1" />

        {/* Snap toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "TOGGLE_SNAP" })}
              className={cn("h-7 w-7 p-0 transition-colors rounded-lg", state.snapEnabled ? "text-primary bg-primary/10" : "text-muted-foreground/30")}>
              <Magnet className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">
            Snap to edges: {state.snapEnabled ? "ON" : "OFF"}
          </TooltipContent>
        </Tooltip>

        {/* Duration display */}
        <div
          className="flex items-center gap-1.5 mx-2 shrink-0 px-2 py-1 rounded-md"
          style={{ background: 'hsla(0,0%,100%,0.02)' }}
        >
          <Clock className="w-3 h-3 text-muted-foreground/30" />
          <span className="text-[10px] text-muted-foreground/45 font-mono font-medium whitespace-nowrap tabular-nums">
            {formatDuration(state.duration)}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Fit to view */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={fitToView}
              className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground rounded-lg">
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Fit to view</TooltipContent>
        </Tooltip>

        {/* Zoom controls — grouped */}
        <div
          className="flex items-center gap-0.5 shrink-0 px-0.5 rounded-lg"
          style={{ background: 'hsla(0,0%,100%,0.02)', border: '1px solid hsla(0,0%,100%,0.04)' }}
        >
          <Button variant="ghost" size="sm"
            onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom - 10 })}
            className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground rounded-md">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[9px] text-muted-foreground/45 font-mono w-8 text-center shrink-0 font-semibold tabular-nums">
            {Math.round(state.zoom)}x
          </span>
          <Button variant="ghost" size="sm"
            onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom + 10 })}
            className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground rounded-md">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Ruler ─── */}
      <div onMouseDown={handleRulerMouseDown} className="shrink-0 cursor-pointer">
        <TimelineRuler zoom={state.zoom} scrollX={state.scrollX} duration={state.duration} />
      </div>

      {/* ─── Tracks area ─── */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto relative" onScroll={handleScroll} style={{ contain: 'strict' }}>
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
                onRemove={() => dispatch({ type: "REMOVE_TRACK", trackId: track.id })}
                onMoveUp={() => dispatch({ type: "MOVE_TRACK", trackId: track.id, direction: "up" })}
                onMoveDown={() => dispatch({ type: "MOVE_TRACK", trackId: track.id, direction: "down" })}
              />

              {/* Clip area */}
              <div
                className="relative flex-1"
                style={{
                  height: TRACK_HEIGHT,
                  borderBottom: '1px solid hsla(0, 0%, 100%, 0.04)',
                  background: idx % 2 === 0
                    ? 'hsla(240, 25%, 6%, 0.5)'
                    : 'hsla(240, 25%, 5%, 0.3)',
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
        />
      )}
    </div>
  );
});
