import { useRef, useCallback, useState } from "react";
import { Film, Type, Music, Trash2, ZoomIn, ZoomOut, Lock, Unlock, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineTrack, TimelineClip } from "./types";

interface EditorTimelineProps {
  tracks: TimelineTrack[];
  currentTime: number;
  duration: number;
  zoom: number;
  selectedClipId: string | null;
  onTimeChange: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onReorderClip: (clipId: string, newStart: number) => void;
  onZoomChange: (zoom: number) => void;
  onDeleteClip: (clipId: string) => void;
}

const TRACK_HEIGHT = 48;
const PIXELS_PER_SECOND_BASE = 60;

const trackIcons: Record<string, typeof Film> = {
  video: Film,
  audio: Music,
  text: Type,
};

export const EditorTimeline = ({
  tracks,
  currentTime,
  duration,
  zoom,
  selectedClipId,
  onTimeChange,
  onSelectClip,
  onUpdateClip,
  onReorderClip,
  onZoomChange,
  onDeleteClip,
}: EditorTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    clipId: string;
    startX: number;
    originalStart: number;
    mode: "move" | "trim-left" | "trim-right";
  } | null>(null);

  const pxPerSec = PIXELS_PER_SECOND_BASE * zoom;
  const timelineWidth = Math.max(duration * pxPerSec, 600);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
      const time = Math.max(0, x / pxPerSec);
      onTimeChange(time);
      onSelectClip(null);
    },
    [pxPerSec, onTimeChange, onSelectClip]
  );

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, mode: "move" | "trim-left" | "trim-right") => {
      e.stopPropagation();
      onSelectClip(clip.id);
      setDragging({
        clipId: clip.id,
        startX: e.clientX,
        originalStart: clip.start,
        mode,
      });

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - e.clientX;
        const dt = dx / pxPerSec;

        if (mode === "move") {
          const newStart = Math.max(0, clip.start + dt);
          onUpdateClip(clip.id, {
            start: newStart,
            end: newStart + (clip.end - clip.start),
          });
        } else if (mode === "trim-left") {
          const newStart = Math.max(0, Math.min(clip.end - 0.5, clip.start + dt));
          onUpdateClip(clip.id, { start: newStart });
        } else if (mode === "trim-right") {
          const newEnd = Math.max(clip.start + 0.5, clip.end + dt);
          onUpdateClip(clip.id, { end: newEnd });
        }
      };

      const handleMouseUp = () => {
        setDragging(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [pxPerSec, onSelectClip, onUpdateClip]
  );

  // Generate time markers
  const markers: number[] = [];
  const step = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10;
  for (let t = 0; t <= duration; t += step) {
    markers.push(t);
  }

  return (
    <div className="h-full flex flex-col bg-card border-t border-border">
      {/* Timeline toolbar */}
      <div className="h-8 flex items-center gap-1 px-3 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onZoomChange(Math.min(zoom * 1.5, 10))}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onZoomChange(Math.max(zoom / 1.5, 0.1))}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground ml-1">{Math.round(zoom * 100)}%</span>
        <div className="flex-1" />
        {selectedClipId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={() => onDeleteClip(selectedClipId)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Timeline body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels */}
        <div className="w-28 shrink-0 border-r border-border">
          {/* Ruler header */}
          <div className="h-6 border-b border-border" />
          {tracks.map((track) => {
            const Icon = trackIcons[track.type] || Film;
            return (
              <div
                key={track.id}
                className="flex items-center gap-1.5 px-2 border-b border-border"
                style={{ height: TRACK_HEIGHT }}
              >
                <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium truncate flex-1">{track.name}</span>
                <button
                  className="opacity-50 hover:opacity-100"
                  onClick={() =>
                    onUpdateClip(track.id, {} as any)
                  }
                >
                  {track.muted ? (
                    <VolumeX className="h-2.5 w-2.5" />
                  ) : (
                    <Volume2 className="h-2.5 w-2.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={timelineRef}>
          <div style={{ width: timelineWidth, position: "relative" }}>
            {/* Time ruler */}
            <div className="h-6 border-b border-border relative" onClick={handleTimelineClick}>
              {markers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full flex flex-col justify-end"
                  style={{ left: t * pxPerSec }}
                >
                  <span className="text-[9px] text-muted-foreground px-0.5">
                    {Math.floor(t / 60)}:{(t % 60).toString().padStart(2, "0")}
                  </span>
                  <div className="w-px h-2 bg-border" />
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-border"
                style={{ height: TRACK_HEIGHT }}
                onClick={handleTimelineClick}
              >
                {track.clips.map((clip) => {
                  const left = clip.start * pxPerSec;
                  const width = (clip.end - clip.start) * pxPerSec;
                  const isSelected = clip.id === selectedClipId;

                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        "absolute top-1 rounded-md cursor-grab select-none group",
                        "flex items-center overflow-hidden",
                        clip.type === "video" && "bg-primary/20 border border-primary/40",
                        clip.type === "text" && "bg-accent/20 border border-accent/40",
                        clip.type === "audio" && "bg-secondary/20 border border-secondary/40",
                        isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      )}
                      style={{
                        left,
                        width: Math.max(width, 20),
                        height: TRACK_HEIGHT - 8,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(clip.id);
                      }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                    >
                      {/* Left trim handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 rounded-l-md"
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}
                      />

                      {/* Clip content */}
                      <span className="text-[10px] font-medium px-2 truncate text-foreground/80">
                        {clip.label}
                      </span>

                      {/* Transition indicator */}
                      {clip.effects.some((e) => e.type === "transition") && (
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                      )}

                      {/* Right trim handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 rounded-r-md"
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-right")}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
              style={{ left: currentTime * pxPerSec }}
            >
              <div className="w-2.5 h-3 bg-primary rounded-b-sm -ml-[5px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
