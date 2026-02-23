/**
 * CustomTimeline — Multi-track visual timeline with clip blocks,
 * playhead scrubbing, clip selection, and trim handles.
 */

import { useRef, useCallback, useState, memo, useEffect } from "react";
import {
  Plus, Trash2, Volume2, VolumeX, Lock, Unlock, ZoomIn, ZoomOut,
  Eye, EyeOff, GripVertical, Type
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTimeline, TimelineTrack, TimelineClip, generateTrackId, generateClipId } from "@/hooks/useCustomTimeline";
import { Button } from "@/components/ui/button";

const TRACK_HEIGHT = 48;
const HEADER_WIDTH = 120;
const RULER_HEIGHT = 28;
const MIN_CLIP_WIDTH = 8;

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
      className="relative shrink-0 select-none border-b"
      style={{
        height: RULER_HEIGHT,
        marginLeft: HEADER_WIDTH,
        background: 'hsl(240, 25%, 5%)',
        borderColor: 'hsla(263, 84%, 58%, 0.08)',
      }}
    >
      <div className="relative" style={{ width: totalWidth, transform: `translateX(-${scrollX}px)` }}>
        {marks.map((mark) => (
          <div
            key={mark.time}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: mark.time * zoom }}
          >
            <div className="w-px h-2" style={{ background: 'hsla(263, 84%, 58%, 0.2)' }} />
            <span className="text-[9px] text-muted-foreground/40 mt-0.5 font-mono">
              {mark.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Track Header ───

function TrackHeader({ track, onToggleMute, onToggleLock, onRemove }: {
  track: TimelineTrack;
  onToggleMute: () => void;
  onToggleLock: () => void;
  onRemove: () => void;
}) {
  const typeIcon = track.type === "text" ? (
    <Type className="w-3 h-3" />
  ) : track.type === "audio" ? (
    <Volume2 className="w-3 h-3" />
  ) : (
    <Eye className="w-3 h-3" />
  );

  return (
    <div
      className="shrink-0 flex flex-col justify-center gap-0.5 px-2 border-r border-b select-none"
      style={{
        width: HEADER_WIDTH,
        height: TRACK_HEIGHT,
        background: 'hsl(240, 25%, 6%)',
        borderColor: 'hsla(263, 84%, 58%, 0.08)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground/50">{typeIcon}</span>
        <span className="text-[10px] font-medium text-muted-foreground/70 truncate flex-1">
          {track.label}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={onToggleMute}
          className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
          title={track.muted ? "Unmute" : "Mute"}
        >
          {track.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
        </button>
        <button
          onClick={onToggleLock}
          className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
          title={track.locked ? "Unlock" : "Lock"}
        >
          {track.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
        </button>
        <button
          onClick={onRemove}
          className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors ml-auto"
          title="Remove track"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Clip Block ───

const CLIP_COLORS: Record<string, string> = {
  video: "hsla(263, 70%, 58%, 0.35)",
  image: "hsla(45, 90%, 55%, 0.35)",
  text: "hsla(170, 70%, 50%, 0.35)",
  audio: "hsla(190, 70%, 55%, 0.35)",
};

const CLIP_BORDER_COLORS: Record<string, string> = {
  video: "hsla(263, 70%, 58%, 0.6)",
  image: "hsla(45, 90%, 55%, 0.6)",
  text: "hsla(170, 70%, 50%, 0.6)",
  audio: "hsla(190, 70%, 55%, 0.6)",
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
}) {
  const left = clip.start * zoom - scrollX;
  const width = Math.max(MIN_CLIP_WIDTH, (clip.end - clip.start) * zoom);

  if (left + width < 0 || left > 2000) return null; // off-screen culling

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded-md cursor-pointer group transition-shadow",
        selected && "ring-2 ring-primary shadow-lg"
      )}
      style={{
        left: Math.max(0, left),
        width,
        background: CLIP_COLORS[clip.type] || CLIP_COLORS.video,
        border: `1px solid ${selected ? 'hsl(263, 84%, 58%)' : (CLIP_BORDER_COLORS[clip.type] || CLIP_BORDER_COLORS.video)}`,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => { if (e.button === 0) onDragStart(e, clip.id, trackId); }}
    >
      {/* Trim handle — left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-l-md"
        style={{ background: 'hsla(263, 84%, 58%, 0.6)' }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimStart(clip.id, trackId); }}
      />

      {/* Clip label */}
      <div className="px-2 py-0.5 truncate text-[10px] text-foreground/80 font-medium pointer-events-none h-full flex items-center">
        {clip.thumbnail && width > 60 && (
          <img src={clip.thumbnail} alt="" className="w-6 h-6 rounded object-cover mr-1.5 shrink-0" />
        )}
        <span className="truncate">{clip.name}</span>
      </div>

      {/* Trim handle — right */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md"
        style={{ background: 'hsla(263, 84%, 58%, 0.6)' }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimEnd(clip.id, trackId); }}
      />
    </div>
  );
}

// ─── Main Timeline ───

export const CustomTimeline = memo(function CustomTimeline({ className }: { className?: string }) {
  const { state, dispatch } = useCustomTimeline();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    type: "playhead" | "clip" | "trim-start" | "trim-end";
    clipId?: string;
    trackId?: string;
    startX?: number;
    startTime?: number;
  } | null>(null);

  const totalWidth = Math.max(state.duration + 10, 30) * state.zoom;

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

  // ─── Global mouse handlers ───
  useEffect(() => {
    if (!isDragging) return;

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
        const time = x / state.zoom;
        dispatch({ type: "TRIM_CLIP", trackId: dragRef.current.trackId, clipId: dragRef.current.clipId, edge: "start", newTime: time });
      }

      if (dragRef.current.type === "trim-end" && dragRef.current.clipId && dragRef.current.trackId) {
        const x = e.clientX - rect.left + state.scrollX - HEADER_WIDTH;
        const time = x / state.zoom;
        dispatch({ type: "TRIM_CLIP", trackId: dragRef.current.trackId, clipId: dragRef.current.clipId, edge: "end", newTime: time });
      }

      if (dragRef.current.type === "clip" && dragRef.current.clipId && dragRef.current.trackId) {
        const dx = e.clientX - (dragRef.current.startX || 0);
        const dt = dx / state.zoom;
        const newStart = Math.max(0, (dragRef.current.startTime || 0) + dt);
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
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, state.scrollX, state.zoom, dispatch]);

  // ─── Scroll ───
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    dispatch({ type: "SET_SCROLL_X", scrollX: (e.target as HTMLElement).scrollLeft });
  }, [dispatch]);

  // ─── Add track ───
  const addTrack = useCallback((type: "video" | "text") => {
    dispatch({
      type: "ADD_TRACK",
      track: {
        id: generateTrackId(),
        type,
        label: type === "text" ? `Text ${state.tracks.filter(t => t.type === "text").length + 1}` : `Video ${state.tracks.filter(t => t.type === "video").length + 1}`,
        clips: [],
      },
    });
  }, [dispatch, state.tracks]);

  // Playhead position
  const playheadLeft = state.playheadTime * state.zoom - state.scrollX;

  return (
    <div
      ref={timelineRef}
      className={cn("flex flex-col overflow-hidden select-none", className)}
      style={{ background: 'hsl(240, 28%, 4%)' }}
    >
      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center gap-1 px-2 h-8 border-b"
        style={{
          background: 'hsl(240, 25%, 5%)',
          borderColor: 'hsla(263, 84%, 58%, 0.08)',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addTrack("video")}
          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground/60 hover:text-foreground"
        >
          <Plus className="w-3 h-3" /> Video Track
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addTrack("text")}
          className="h-6 px-2 text-[10px] gap-1 text-muted-foreground/60 hover:text-foreground"
        >
          <Type className="w-3 h-3" /> Text Track
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom - 10 })}
          className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground"
        >
          <ZoomOut className="w-3 h-3" />
        </Button>
        <span className="text-[9px] text-muted-foreground/40 font-mono w-8 text-center">
          {Math.round(state.zoom)}x
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "SET_ZOOM", zoom: state.zoom + 10 })}
          className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground"
        >
          <ZoomIn className="w-3 h-3" />
        </Button>
      </div>

      {/* Ruler */}
      <div onMouseDown={handleRulerMouseDown}>
        <TimelineRuler zoom={state.zoom} scrollX={state.scrollX} duration={state.duration} />
      </div>

      {/* Tracks area */}
      <div className="flex-1 min-h-0 overflow-auto relative" onScroll={handleScroll}>
        <div className="relative" style={{ minWidth: HEADER_WIDTH + totalWidth }}>
          {state.tracks.map((track) => (
            <div key={track.id} className="flex" style={{ height: TRACK_HEIGHT }}>
              {/* Header */}
              <TrackHeader
                track={track}
                onToggleMute={() => dispatch({ type: "TOGGLE_TRACK_MUTE", trackId: track.id })}
                onToggleLock={() => dispatch({ type: "TOGGLE_TRACK_LOCK", trackId: track.id })}
                onRemove={() => dispatch({ type: "REMOVE_TRACK", trackId: track.id })}
              />

              {/* Clip area */}
              <div
                className="relative flex-1 border-b"
                style={{
                  height: TRACK_HEIGHT,
                  borderColor: 'hsla(263, 84%, 58%, 0.05)',
                  background: track.muted ? 'hsla(0, 0%, 100%, 0.02)' : 'transparent',
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
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {state.tracks.length === 0 && (
            <div className="flex items-center justify-center h-24 text-muted-foreground/30 text-xs">
              Add a track to get started
            </div>
          )}
        </div>

        {/* Playhead line */}
        {playheadLeft >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
            style={{
              left: HEADER_WIDTH + playheadLeft,
              background: 'hsl(263, 84%, 58%)',
              boxShadow: '0 0 6px hsla(263, 84%, 58%, 0.5)',
            }}
          >
            {/* Playhead handle */}
            <div
              className="absolute -top-0.5 -left-1.5 w-3 h-2 rounded-b"
              style={{ background: 'hsl(263, 84%, 58%)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
});
