import { useRef, useCallback, useState } from "react";
import { Film, Type, Music, Trash2, ZoomIn, ZoomOut, Volume2, VolumeX, Lock, Eye } from "lucide-react";
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
  onMoveClipToTrack?: (clipId: string, targetTrackId: string) => void;
}

const TRACK_HEIGHT = 48;
const PIXELS_PER_SECOND_BASE = 60;

const trackColors: Record<string, { bg: string; bgSolid: string; border: string; text: string; glow: string }> = {
  video: {
    bg: "bg-primary/[0.08]",
    bgSolid: "hsl(263 70% 58% / 0.12)",
    border: "border-primary/20",
    text: "text-primary",
    glow: "hsl(263 70% 58% / 0.15)",
  },
  audio: {
    bg: "bg-emerald-500/[0.08]",
    bgSolid: "hsl(160 60% 45% / 0.12)",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    glow: "hsl(160 60% 45% / 0.15)",
  },
  text: {
    bg: "bg-amber-500/[0.08]",
    bgSolid: "hsl(38 92% 50% / 0.12)",
    border: "border-amber-500/20",
    text: "text-amber-400",
    glow: "hsl(38 92% 50% / 0.15)",
  },
};

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
  onMoveClipToTrack,
}: EditorTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    clipId: string;
    startX: number;
    originalStart: number;
    mode: "move" | "trim-left" | "trim-right";
  } | null>(null);

  const pxPerSec = PIXELS_PER_SECOND_BASE * zoom;
  const timelineWidth = Math.max(duration * pxPerSec, 800);

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

  // Generate time markers with sub-divisions
  const markers: { time: number; major: boolean }[] = [];
  const majorStep = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10;
  const subStep = majorStep / 5;
  for (let t = 0; t <= duration; t += subStep) {
    markers.push({ time: t, major: t % majorStep < 0.001 });
  }

  return (
    <div className="h-full flex flex-col bg-[hsl(260,15%,5%)]">
      {/* Timeline toolbar */}
      <div className="h-8 flex items-center gap-1 px-2.5 border-b border-white/[0.06] shrink-0 bg-[hsl(260,15%,8%)]">
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded p-0.5 border border-white/[0.04]">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-white/30 hover:text-white/70 hover:bg-white/[0.08] rounded-sm transition-all"
            onClick={() => onZoomChange(Math.min(zoom * 1.5, 10))}
          >
            <ZoomIn className="h-2.5 w-2.5" />
          </Button>
          <div className="w-10 h-0.5 bg-white/[0.06] rounded-full relative mx-0.5">
            <div
              className="h-full bg-primary/50 rounded-full"
              style={{ width: `${Math.min((Math.log2(zoom) + 3.3) / 6.6 * 100, 100)}%` }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-white/30 hover:text-white/70 hover:bg-white/[0.08] rounded-sm transition-all"
            onClick={() => onZoomChange(Math.max(zoom / 1.5, 0.1))}
          >
            <ZoomOut className="h-2.5 w-2.5" />
          </Button>
        </div>
        <span className="text-[9px] text-white/20 ml-1 tabular-nums font-mono">{Math.round(zoom * 100)}%</span>

        <div className="flex-1" />

        {selectedClipId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
            onClick={() => onDeleteClip(selectedClipId)}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>

      {/* Timeline body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels */}
        <div className="w-32 shrink-0 border-r border-white/[0.06] bg-[hsl(260,15%,7%)]">
          {/* Ruler header spacer */}
          <div className="h-6 border-b border-white/[0.04]" />
          {tracks.map((track) => {
            const Icon = trackIcons[track.type] || Film;
            const colors = trackColors[track.type] || trackColors.video;
            return (
              <div
                key={track.id}
                className="flex items-center gap-1.5 px-2 border-b border-white/[0.03] group hover:bg-white/[0.02] transition-colors"
                style={{ height: TRACK_HEIGHT }}
              >
                <div className={cn("w-4 h-4 rounded flex items-center justify-center", colors.bg)}>
                  <Icon className={cn("h-2.5 w-2.5", colors.text)} />
                </div>
                <span className="text-[10px] font-medium text-white/50 truncate flex-1 tracking-wide">
                  {track.name}
                </span>
                <div className="flex items-center gap-px opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-0.5 text-white/20 hover:text-white/50 transition-colors">
                    {track.muted ? (
                      <VolumeX className="h-2.5 w-2.5" />
                    ) : (
                      <Volume2 className="h-2.5 w-2.5" />
                    )}
                  </button>
                  <button className="p-0.5 text-white/20 hover:text-white/50 transition-colors">
                    <Lock className="h-2 w-2" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={timelineRef}>
          <div style={{ width: timelineWidth, position: "relative" }}>
            {/* Time ruler */}
            <div
              className="h-6 border-b border-white/[0.06] relative bg-[hsl(260,15%,7%)]"
              onClick={handleTimelineClick}
            >
              {markers.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex flex-col justify-end"
                  style={{ left: m.time * pxPerSec }}
                >
                  {m.major && (
                    <span className="text-[8px] text-white/25 px-0.5 tabular-nums font-mono">
                      {Math.floor(m.time / 60)}:{(Math.floor(m.time) % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                  <div className={cn("w-px", m.major ? "h-2 bg-white/15" : "h-1 bg-white/[0.06]")} />
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => {
              const colors = trackColors[track.type] || trackColors.video;
              return (
                <div
                  key={track.id}
                  className="relative border-b border-white/[0.03]"
                  style={{ height: TRACK_HEIGHT }}
                  onClick={handleTimelineClick}
                >
                  {/* Track background pattern */}
                  <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${pxPerSec - 1}px, hsl(260 15% 15% / 0.3) ${pxPerSec}px)`,
                  }} />

                  {track.clips.map((clip) => {
                    const left = clip.start * pxPerSec;
                    const width = (clip.end - clip.start) * pxPerSec;
                    const isSelected = clip.id === selectedClipId;

                    return (
                      <div
                        key={clip.id}
                        className={cn(
                          "absolute top-1.5 rounded-[4px] cursor-grab select-none group/clip border transition-all duration-150",
                          "flex items-center overflow-hidden",
                          colors.bg,
                          colors.border,
                          isSelected && "ring-1 ring-primary/60 border-primary/40"
                        )}
                        style={{
                          left,
                          width: Math.max(width, 28),
                          height: TRACK_HEIGHT - 12,
                          boxShadow: isSelected
                            ? `0 0 16px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
                            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip.id);
                        }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                      >
                        {/* Left trim handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 rounded-l-[4px] transition-colors z-10"
                          onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}
                        >
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-px h-3 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>

                        {/* Clip content */}
                        <div className="flex items-center gap-1.5 px-2.5 min-w-0 flex-1">
                          <span className={cn("text-[9px] font-medium truncate", colors.text, "opacity-80")}>
                            {clip.label}
                          </span>
                        </div>

                        {/* Transition indicator */}
                        {clip.effects.some((e) => e.type === "transition") && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                          </div>
                        )}

                        {/* Right trim handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 rounded-r-[4px] transition-colors z-10"
                          onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-right")}
                        >
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-px h-3 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: currentTime * pxPerSec }}
            >
              {/* Head */}
              <div className="relative -ml-[5px]">
                <div className="w-[10px] h-3 bg-primary rounded-b-sm" style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
                }} />
              </div>
              {/* Line */}
              <div className="w-px h-full bg-primary/80 ml-[4px]" style={{
                boxShadow: '0 0 6px hsl(263 70% 58% / 0.4)',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};