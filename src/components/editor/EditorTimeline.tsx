import { useRef, useCallback, useState, useMemo } from "react";
import { Film, Type, Music, Trash2, ZoomIn, ZoomOut, Volume2, VolumeX, Lock, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TimelineTrack, TimelineClip } from "./types";
import { AudioWaveform } from "./AudioWaveform";

interface EditorTimelineProps {
  tracks: TimelineTrack[];
  currentTime: number;
  duration: number;
  zoom: number;
  selectedClipId: string | null;
  snapEnabled?: boolean;
  onTimeChange: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onReorderClip: (clipId: string, newStart: number) => void;
  onZoomChange: (zoom: number) => void;
  onDeleteClip: (clipId: string) => void;
  onRippleDelete?: (clipId: string) => void;
  onMoveClipToTrack?: (clipId: string, targetTrackId: string) => void;
  onToggleTrackMute?: (trackId: string) => void;
  onToggleTrackLock?: (trackId: string) => void;
}

const TRACK_HEIGHT = 52;
const PIXELS_PER_SECOND_BASE = 60;
const SNAP_THRESHOLD_PX = 8;

const trackColors: Record<string, { bg: string; bgSolid: string; border: string; text: string; glow: string; clip: string }> = {
  video: { bg: "bg-blue-500/[0.06]", bgSolid: "hsl(220 80% 55% / 0.10)", border: "border-blue-400/15", text: "text-blue-400", glow: "hsl(220 80% 55% / 0.12)", clip: "from-blue-500/20 to-blue-600/10" },
  audio: { bg: "bg-emerald-500/[0.06]", bgSolid: "hsl(160 60% 45% / 0.10)", border: "border-emerald-400/15", text: "text-emerald-400", glow: "hsl(160 60% 45% / 0.12)", clip: "from-emerald-500/20 to-emerald-600/10" },
  text: { bg: "bg-amber-500/[0.06]", bgSolid: "hsl(38 92% 50% / 0.10)", border: "border-amber-400/15", text: "text-amber-400", glow: "hsl(38 92% 50% / 0.12)", clip: "from-amber-500/20 to-amber-600/10" },
};

const trackIcons: Record<string, typeof Film> = { video: Film, audio: Music, text: Type };

export const EditorTimeline = ({
  tracks, currentTime, duration, zoom, selectedClipId, snapEnabled = true,
  onTimeChange, onSelectClip, onUpdateClip, onReorderClip, onZoomChange, onDeleteClip, onRippleDelete, onMoveClipToTrack,
  onToggleTrackMute, onToggleTrackLock,
}: EditorTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ clipId: string; startX: number; originalStart: number; mode: "move" | "trim-left" | "trim-right" } | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);

  const pxPerSec = PIXELS_PER_SECOND_BASE * zoom;
  const timelineWidth = Math.max(duration * pxPerSec, 800);

  const snapPoints = useMemo(() => {
    const points: number[] = [0, currentTime];
    for (const track of tracks) {
      for (const clip of track.clips) {
        points.push(clip.start, clip.end);
      }
    }
    return [...new Set(points)].sort((a, b) => a - b);
  }, [tracks, currentTime]);

  const snapToNearest = useCallback((time: number, excludeClipId?: string): number => {
    if (!snapEnabled) return time;
    const threshold = SNAP_THRESHOLD_PX / pxPerSec;
    let closest = time;
    let minDist = Infinity;
    for (const p of snapPoints) {
      const d = Math.abs(time - p);
      if (d < minDist && d < threshold) {
        minDist = d;
        closest = p;
      }
    }
    setSnapLine(closest !== time ? closest : null);
    return closest;
  }, [snapEnabled, snapPoints, pxPerSec]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
    onTimeChange(Math.max(0, x / pxPerSec));
    onSelectClip(null);
  }, [pxPerSec, onTimeChange, onSelectClip]);

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clip: TimelineClip, mode: "move" | "trim-left" | "trim-right") => {
    e.stopPropagation();
    onSelectClip(clip.id);
    setDragging({ clipId: clip.id, startX: e.clientX, originalStart: clip.start, mode });

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - e.clientX;
      const dt = dx / pxPerSec;
      if (mode === "move") {
        let newStart = Math.max(0, clip.start + dt);
        newStart = snapToNearest(newStart, clip.id);
        const newEnd = snapToNearest(newStart + (clip.end - clip.start), clip.id);
        const adjustedStart = newEnd - (clip.end - clip.start);
        onUpdateClip(clip.id, { start: adjustedStart >= 0 ? adjustedStart : newStart, end: adjustedStart >= 0 ? newEnd : newStart + (clip.end - clip.start) });
      } else if (mode === "trim-left") {
        let newStart = Math.max(0, Math.min(clip.end - 0.5, clip.start + dt));
        newStart = snapToNearest(newStart, clip.id);
        onUpdateClip(clip.id, { start: newStart });
      } else {
        let newEnd = Math.max(clip.start + 0.5, clip.end + dt);
        newEnd = snapToNearest(newEnd, clip.id);
        onUpdateClip(clip.id, { end: newEnd });
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setSnapLine(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [pxPerSec, onSelectClip, onUpdateClip, snapToNearest]);

  const markers = useMemo(() => {
    const result: { time: number; major: boolean }[] = [];
    const majorStep = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10;
    const subStep = majorStep / 5;
    for (let t = 0; t <= duration; t += subStep) {
      result.push({ time: t, major: t % majorStep < 0.001 });
    }
    return result;
  }, [zoom, duration]);

  return (
    <div className="h-full flex flex-col bg-[hsl(0,0%,6%)]">
      {/* Toolbar */}
      <div className="h-8 flex items-center gap-1 px-2.5 border-b border-white/[0.06] shrink-0 bg-[hsl(0,0%,8%)]">
        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5 border border-white/[0.06]">
          <Button variant="ghost" size="icon" className="h-5 w-5 text-white/50 hover:text-white hover:bg-white/[0.1] rounded-sm transition-all" onClick={() => onZoomChange(Math.min(zoom * 1.5, 10))}>
            <ZoomIn className="h-2.5 w-2.5" />
          </Button>
          <div className="w-10 h-1 bg-white/[0.06] rounded-full relative mx-0.5">
            <div className="h-full bg-white/30 rounded-full transition-all" style={{ width: `${Math.min((Math.log2(zoom) + 3.3) / 6.6 * 100, 100)}%` }} />
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-white/50 hover:text-white hover:bg-white/[0.1] rounded-sm transition-all" onClick={() => onZoomChange(Math.max(zoom / 1.5, 0.1))}>
            <ZoomOut className="h-2.5 w-2.5" />
          </Button>
        </div>
        <span className="text-[9px] text-white/20 ml-1 tabular-nums font-mono">{Math.round(zoom * 100)}%</span>

        <div className="flex-1" />

        <span className="text-[8px] text-white/15 font-mono mr-2">
          {tracks.reduce((sum, t) => sum + t.clips.length, 0)} clips
        </span>

        {selectedClipId && onRippleDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon"
                className="h-6 w-6 text-white/40 hover:text-white hover:bg-white/[0.1] rounded-md transition-all mr-0.5"
                onClick={() => onRippleDelete(selectedClipId)}>
                <Scissors className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">
              Ripple Delete <kbd className="ml-1 text-white/30">⇧Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}

        {selectedClipId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all" onClick={() => onDeleteClip(selectedClipId)}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">
              Delete <kbd className="ml-1 text-white/30">Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels */}
        <div className="w-36 shrink-0 border-r border-white/[0.06] bg-[hsl(0,0%,7%)]">
          <div className="h-6 border-b border-white/[0.04]" />
          {tracks.map((track) => {
            const Icon = trackIcons[track.type] || Film;
            const colors = trackColors[track.type] || trackColors.video;
            return (
              <div key={track.id} className="flex items-center gap-2 px-3 border-b border-white/[0.03] group hover:bg-white/[0.02] transition-colors" style={{ height: TRACK_HEIGHT }}>
                <div className={cn("w-5 h-5 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/[0.06]")}>
                  <Icon className={cn("h-3 w-3", colors.text)} />
                </div>
                <span className="text-[10px] font-medium text-white/50 truncate flex-1 tracking-wide">{track.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className={cn("p-0.5 rounded transition-colors", track.muted ? "text-red-400/60" : "text-white/25 hover:text-white/60")}
                    onClick={() => onToggleTrackMute?.(track.id)}
                  >
                    {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                  <button
                    className={cn("p-0.5 rounded transition-colors", track.locked ? "text-amber-400/60" : "text-white/25 hover:text-white/60")}
                    onClick={() => onToggleTrackLock?.(track.id)}
                  >
                    <Lock className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={timelineRef}>
          <div style={{ width: timelineWidth, position: "relative" }}>
            {/* Ruler */}
            <div className="h-6 border-b border-white/[0.06] relative bg-[hsl(0,0%,7%)]" onClick={handleTimelineClick}>
              {markers.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col justify-end" style={{ left: m.time * pxPerSec }}>
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
                <div key={track.id} className="relative border-b border-white/[0.03]" style={{ height: TRACK_HEIGHT }} onClick={handleTimelineClick}>
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${pxPerSec - 1}px, hsl(0 0% 15% / 0.3) ${pxPerSec}px)`,
                  }} />

                  {track.clips.map((clip) => {
                    const left = clip.start * pxPerSec;
                    const width = (clip.end - clip.start) * pxPerSec;
                    const isSelected = clip.id === selectedClipId;
                    const hasTransition = clip.effects.some((e) => e.type === "transition");

                    return (
                      <div
                        key={clip.id}
                        className={cn(
                          "absolute top-1.5 rounded-md cursor-grab select-none group/clip border transition-all duration-150",
                          "flex items-center overflow-hidden bg-gradient-to-r",
                          colors.clip, colors.border,
                          isSelected && "ring-1 ring-white/50 border-white/30",
                          "hover:brightness-110"
                        )}
                        style={{
                          left, width: Math.max(width, 28), height: TRACK_HEIGHT - 12,
                          boxShadow: isSelected
                            ? `0 0 20px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
                            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                        onClick={(e) => { e.stopPropagation(); onSelectClip(clip.id); }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                      >
                        {/* Left trim */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/15 rounded-l-md transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}>
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-px h-3 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>

                        {/* Content */}
                        {track.type === "audio" ? (
                          <div className="flex-1 min-w-0 h-full relative">
                            <AudioWaveform clipId={clip.id} width={Math.max(width, 28)} height={TRACK_HEIGHT - 12} color={colors.text} />
                            <span className={cn("absolute bottom-0.5 left-2 text-[8px] font-medium truncate", colors.text, "opacity-60")}>
                              {clip.label}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 min-w-0 flex-1">
                            <span className={cn("text-[9px] font-medium truncate", colors.text, "opacity-80")}>{clip.label}</span>
                          </div>
                        )}

                        {/* Transition indicator — HLS crossfade */}
                        {hasTransition && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                            <span className="text-[7px] text-white/40 font-mono">fade</span>
                          </div>
                        )}

                        {/* Speed badge */}
                        {clip.speed && clip.speed !== 1 && (
                          <div className="absolute top-0.5 right-1.5 bg-black/50 rounded px-1 py-px text-[7px] font-mono text-white/70">
                            {clip.speed}x
                          </div>
                        )}

                        {/* Right trim */}
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/15 rounded-r-md transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-right")}>
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-px h-3 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Snap line */}
            {snapLine !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-white/60 z-30 pointer-events-none" style={{ left: snapLine * pxPerSec }}>
                <div className="absolute inset-0 w-px bg-white/30 blur-[2px]" />
              </div>
            )}

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: currentTime * pxPerSec }}>
              <div className="relative -ml-[5px]">
                <div className="w-[10px] h-3.5 bg-white rounded-b-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }} />
              </div>
              <div className="w-px h-full bg-white/90 ml-[4px]" style={{ boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
