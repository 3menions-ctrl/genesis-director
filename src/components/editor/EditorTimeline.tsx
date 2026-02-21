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

const TRACK_HEIGHT = 56;
const PIXELS_PER_SECOND_BASE = 60;
const SNAP_THRESHOLD_PX = 8;

const trackColors: Record<string, { bg: string; bgSolid: string; border: string; text: string; glow: string; clip: string; accent: string }> = {
  video: { bg: "bg-blue-500/[0.06]", bgSolid: "hsl(220 80% 55% / 0.10)", border: "border-blue-400/15", text: "text-blue-400", glow: "hsl(220 80% 55% / 0.15)", clip: "from-blue-500/25 to-blue-600/10", accent: "blue" },
  audio: { bg: "bg-emerald-500/[0.06]", bgSolid: "hsl(160 60% 45% / 0.10)", border: "border-emerald-400/15", text: "text-emerald-400", glow: "hsl(160 60% 45% / 0.15)", clip: "from-emerald-500/25 to-emerald-600/10", accent: "emerald" },
  text: { bg: "bg-amber-500/[0.06]", bgSolid: "hsl(38 92% 50% / 0.10)", border: "border-amber-400/15", text: "text-amber-400", glow: "hsl(38 92% 50% / 0.15)", clip: "from-amber-500/25 to-amber-600/10", accent: "amber" },
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
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-1.5 px-3 border-b border-border shrink-0 bg-card/80 backdrop-blur-xl relative">
        {/* Accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        
        <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 border border-border">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-all" onClick={() => onZoomChange(Math.min(zoom * 1.5, 10))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <div className="w-12 h-1.5 bg-muted rounded-full relative mx-1">
            <div className="h-full bg-gradient-to-r from-primary/40 to-primary/70 rounded-full transition-all" style={{ width: `${Math.min((Math.log2(zoom) + 3.3) / 6.6 * 100, 100)}%` }} />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-all" onClick={() => onZoomChange(Math.max(zoom / 1.5, 0.1))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
        </div>
        <span className="text-[9px] text-muted-foreground/50 ml-1 tabular-nums font-mono">{Math.round(zoom * 100)}%</span>

        <div className="flex-1" />

        <span className="text-[9px] text-muted-foreground/30 font-mono mr-2">
          {tracks.reduce((sum, t) => sum + t.clips.length, 0)} clips
        </span>

        {selectedClipId && onRippleDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all mr-0.5"
                onClick={() => onRippleDelete(selectedClipId)}>
                <Scissors className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-popover border-border text-foreground">
              Ripple Delete <kbd className="ml-1 text-muted-foreground">⇧Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}

        {selectedClipId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" onClick={() => onDeleteClip(selectedClipId)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-popover border-border text-foreground">
              Delete <kbd className="ml-1 text-muted-foreground">Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels */}
        <div className="w-44 shrink-0 border-r border-border bg-card/80 backdrop-blur-xl">
          <div className="h-7 border-b border-border/50" />
          {tracks.map((track) => {
            const Icon = trackIcons[track.type] || Film;
            const colors = trackColors[track.type] || trackColors.video;
            return (
              <div key={track.id} className="flex items-center gap-2.5 px-3 border-b border-border/30 group hover:bg-secondary/30 transition-colors" style={{ height: TRACK_HEIGHT }}>
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center bg-secondary border border-border")}>
                  <Icon className={cn("h-3 w-3", colors.text)} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground truncate flex-1 tracking-wide">{track.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className={cn("p-1 rounded-md transition-colors", track.muted ? "text-destructive/60 bg-destructive/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary")}
                    onClick={() => onToggleTrackMute?.(track.id)}
                  >
                    {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                  <button
                    className={cn("p-1 rounded-md transition-colors", track.locked ? "text-amber-400/60 bg-amber-500/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary")}
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
            <div className="h-7 border-b border-border relative bg-card/60" onClick={handleTimelineClick}>
              {markers.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col justify-end" style={{ left: m.time * pxPerSec }}>
                  {m.major && (
                    <span className="text-[8px] text-muted-foreground/40 px-0.5 tabular-nums font-mono">
                      {Math.floor(m.time / 60)}:{(Math.floor(m.time) % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                  <div className={cn("w-px", m.major ? "h-2.5 bg-border" : "h-1 bg-border/30")} />
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => {
              const colors = trackColors[track.type] || trackColors.video;
              return (
                <div key={track.id} className="relative border-b border-border/30" style={{ height: TRACK_HEIGHT }} onClick={handleTimelineClick}>
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${pxPerSec - 1}px, hsl(var(--muted)) ${pxPerSec}px)`,
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
                          "absolute top-2 rounded-lg cursor-grab select-none group/clip border transition-all duration-200",
                          "flex items-center overflow-hidden bg-gradient-to-r",
                          colors.clip, colors.border,
                          isSelected && "ring-1 ring-primary/60 border-primary/40 shadow-lg",
                          "hover:brightness-110"
                        )}
                        style={{
                          left, width: Math.max(width, 28), height: TRACK_HEIGHT - 16,
                          boxShadow: isSelected
                            ? `0 0 24px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`
                            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                        onClick={(e) => { e.stopPropagation(); onSelectClip(clip.id); }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                      >
                        {/* Left trim */}
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/15 rounded-l-lg transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}>
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-px h-4 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>

                        {/* Content */}
                        {track.type === "audio" ? (
                          <div className="flex-1 min-w-0 h-full relative">
                            <AudioWaveform clipId={clip.id} width={Math.max(width, 28)} height={TRACK_HEIGHT - 16} color={colors.text} />
                            <span className={cn("absolute bottom-1 left-2.5 text-[8px] font-medium truncate", colors.text, "opacity-60")}>
                              {clip.label}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 min-w-0 flex-1">
                            <span className={cn("text-[9px] font-medium truncate", colors.text, "opacity-80")}>{clip.label}</span>
                          </div>
                        )}

                        {/* Transition indicator */}
                        {hasTransition && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                            <span className="text-[7px] text-muted-foreground font-mono">fade</span>
                          </div>
                        )}

                        {/* Speed badge */}
                        {clip.speed && clip.speed !== 1 && (
                          <div className="absolute top-1 right-2 bg-black/50 rounded-md px-1.5 py-px text-[7px] font-mono text-foreground/70">
                            {clip.speed}x
                          </div>
                        )}

                        {/* Right trim */}
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/15 rounded-r-lg transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-right")}>
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-px h-4 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Snap line */}
            {snapLine !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-primary/80 z-30 pointer-events-none" style={{ left: snapLine * pxPerSec }}>
                <div className="absolute inset-0 w-px bg-primary/40 blur-[3px]" />
              </div>
            )}

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: currentTime * pxPerSec }}>
              <div className="relative -ml-[6px]">
                <div className="w-[12px] h-4 bg-white rounded-b-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }} />
              </div>
              <div className="w-px h-full bg-white/90 ml-[5px]" style={{ boxShadow: '0 0 12px rgba(255,255,255,0.6)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};