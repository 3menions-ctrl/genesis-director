import { useRef, useCallback, useState, useMemo } from "react";
import { Film, Type, Music, Trash2, ZoomIn, ZoomOut, Volume2, VolumeX, Lock, Scissors, ArrowRightLeft, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TimelineTrack, TimelineClip, TimelineMarker } from "./types";
import { RealAudioWaveform } from "./RealAudioWaveform";

interface EditorTimelineProps {
  tracks: TimelineTrack[];
  currentTime: number;
  duration: number;
  zoom: number;
  selectedClipId: string | null;
  selectedClipIds?: string[];
  snapEnabled?: boolean;
  onTimeChange: (time: number) => void;
  onSelectClip: (clipId: string | null, additive?: boolean) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onReorderClip: (clipId: string, newStart: number) => void;
  onZoomChange: (zoom: number) => void;
  onDeleteClip: (clipId: string) => void;
  onRippleDelete?: (clipId: string) => void;
  onMoveClipToTrack?: (clipId: string, targetTrackId: string) => void;
  onToggleTrackMute?: (trackId: string) => void;
  onToggleTrackLock?: (trackId: string) => void;
  onDeleteSelected?: () => void;
  onClearTrack?: (trackId: string) => void;
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
  tracks, currentTime, duration, zoom, selectedClipId, selectedClipIds = [], snapEnabled = true,
  onTimeChange, onSelectClip, onUpdateClip, onReorderClip, onZoomChange, onDeleteClip, onRippleDelete, onMoveClipToTrack,
  onToggleTrackMute, onToggleTrackLock, onDeleteSelected, onClearTrack,
}: EditorTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ clipId: string; startX: number; originalStart: number; mode: "move" | "trim-left" | "trim-right" } | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [crossTrackDrag, setCrossTrackDrag] = useState<{ clipId: string; sourceTrackId: string; targetTrackId: string | null } | null>(null);
  const [scrubPreview, setScrubPreview] = useState<{ time: number; x: number; y: number } | null>(null);

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
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onSelectClip(null);
    }
  }, [pxPerSec, onTimeChange, onSelectClip]);

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clip: TimelineClip, mode: "move" | "trim-left" | "trim-right") => {
    e.stopPropagation();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    onSelectClip(clip.id, additive);
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
    <div className="h-full flex flex-col bg-[#08080c]">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-1.5 px-3 border-b border-white/[0.04] shrink-0 bg-[#0c0c12]/90 backdrop-blur-2xl relative">
        {/* Cinematic accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.04]">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white/25 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all" onClick={() => onZoomChange(Math.min(zoom * 1.5, 10))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <div className="w-12 h-1 bg-white/[0.04] rounded-full relative mx-1">
            <div className="h-full bg-gradient-to-r from-primary/50 to-primary/80 rounded-full transition-all" style={{ width: `${Math.min((Math.log2(zoom) + 3.3) / 6.6 * 100, 100)}%` }} />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white/25 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all" onClick={() => onZoomChange(Math.max(zoom / 1.5, 0.1))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
        </div>
        <span className="text-[9px] text-white/20 ml-1 tabular-nums font-mono">{Math.round(zoom * 100)}%</span>

        <div className="flex-1" />

        <span className="text-[9px] text-white/15 font-mono mr-2 tracking-wider">
          {tracks.reduce((sum, t) => sum + t.clips.length, 0)} clips
        </span>

        {selectedClipId && onRippleDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon"
                className="h-6 w-6 text-white/25 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-all mr-0.5"
                onClick={() => onRippleDelete(selectedClipId)}>
                <Scissors className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">
              Ripple Delete <kbd className="ml-1 text-white/30">⇧Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}

        {selectedClipId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" onClick={() => onDeleteClip(selectedClipId)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">
              Delete <kbd className="ml-1 text-white/30">Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels — cinematic dark */}
        <div className="w-44 shrink-0 border-r border-white/[0.03] bg-[#0a0a10]/90 backdrop-blur-2xl">
          <div className="h-7 border-b border-white/[0.03]" />
          {tracks.map((track) => {
            const Icon = trackIcons[track.type] || Film;
            const colors = trackColors[track.type] || trackColors.video;
            return (
              <div key={track.id} className="flex items-center gap-2.5 px-3 border-b border-white/[0.02] group hover:bg-white/[0.02] transition-colors" style={{ height: TRACK_HEIGHT }}>
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.04]")}>
                  <Icon className={cn("h-3 w-3", colors.text)} />
                </div>
                <span className="text-[10px] font-medium text-white/30 truncate flex-1 tracking-wide">{track.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className={cn("p-1 rounded-md transition-colors", track.muted ? "text-red-400/60 bg-red-400/10" : "text-white/20 hover:text-white/60 hover:bg-white/[0.04]")}
                    onClick={() => onToggleTrackMute?.(track.id)}
                  >
                    {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                  <button
                    className={cn("p-1 rounded-md transition-colors", track.locked ? "text-amber-400/60 bg-amber-500/10" : "text-white/20 hover:text-white/60 hover:bg-white/[0.04]")}
                    onClick={() => onToggleTrackLock?.(track.id)}
                  >
                    <Lock className="h-2.5 w-2.5" />
                  </button>
                  {track.clips.length > 0 && onClearTrack && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 rounded-md transition-colors text-white/20 hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => onClearTrack(track.id)}
                        >
                          <XCircle className="h-2.5 w-2.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">
                        Clear all clips from track
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={timelineRef}>
          <div style={{ width: timelineWidth, position: "relative" }}>
            {/* Ruler — cinematic */}
            <div className="h-7 border-b border-white/[0.03] relative bg-[#0c0c12]/80" onClick={handleTimelineClick}>
              {markers.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col justify-end" style={{ left: m.time * pxPerSec }}>
                  {m.major && (
                    <span className="text-[8px] text-white/20 px-0.5 tabular-nums font-mono">
                      {Math.floor(m.time / 60)}:{(Math.floor(m.time) % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                  <div className={cn("w-px", m.major ? "h-2.5 bg-white/[0.08]" : "h-1 bg-white/[0.03]")} />
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => {
              const colors = trackColors[track.type] || trackColors.video;
              return (
                <div key={track.id} className="relative border-b border-white/[0.02]" style={{ height: TRACK_HEIGHT }} onClick={handleTimelineClick}>
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${pxPerSec - 1}px, hsl(0 0% 100% / 0.03) ${pxPerSec}px)`,
                  }} />

               {track.clips.map((clip, clipIndex) => {
                     const left = clip.start * pxPerSec;
                     const width = (clip.end - clip.start) * pxPerSec;
                     const isSelected = clip.id === selectedClipId || selectedClipIds.includes(clip.id);
                     const hasTransition = clip.effects.some((e) => e.type === "transition");
                     // Check for adjacent clip (transition zone)
                     const nextClip = track.clips
                       .filter(c => c.start >= clip.end - 0.1 && c.id !== clip.id)
                       .sort((a, b) => a.start - b.start)[0];
                     const hasTransitionZone = nextClip && Math.abs(nextClip.start - clip.end) < 0.5;

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
                        onClick={(e) => { e.stopPropagation(); onSelectClip(clip.id, e.shiftKey || e.ctrlKey || e.metaKey); }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                      >
                        {/* Left trim */}
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/15 rounded-l-lg transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}>
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-px h-4 bg-white/20 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>

                        {/* Content */}
                        {track.type === "video" ? (
                          <div className="flex-1 min-w-0 h-full relative overflow-hidden">
                            {/* Film strip pattern – solid colored segments with tick marks */}
                            <div className="absolute inset-0 flex">
                              {Array.from({ length: Math.max(1, Math.floor(width / 32)) }, (_, i) => (
                                <div
                                  key={i}
                                  className="h-full flex-1 border-r border-blue-300/10 last:border-r-0"
                                  style={{
                                    background: i % 2 === 0
                                      ? 'linear-gradient(180deg, hsl(220 70% 50% / 0.18) 0%, hsl(220 70% 40% / 0.10) 100%)'
                                      : 'linear-gradient(180deg, hsl(220 70% 50% / 0.12) 0%, hsl(220 70% 40% / 0.06) 100%)',
                                  }}
                                />
                              ))}
                            </div>
                            {/* Film icon at start */}
                            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 opacity-30">
                              <Film className="h-3 w-3 text-blue-300" />
                            </div>
                            {/* Gradient overlay for readability */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-blue-500/5 pointer-events-none" />
                            <span className={cn("absolute bottom-1 left-6 right-1 text-[8px] font-medium truncate z-10 text-blue-200 drop-shadow-md")}>
                              {clip.label}
                            </span>
                            {/* Duration badge */}
                            {width > 60 && (
                              <span className="absolute top-1 right-1.5 text-[7px] font-mono text-blue-300/50 z-10">
                                {(clip.end - clip.start).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        ) : track.type === "audio" ? (
                          <div className="flex-1 min-w-0 h-full relative">
                            <RealAudioWaveform clipId={clip.id} width={Math.max(width, 28)} height={TRACK_HEIGHT - 16} color={colors.text} />
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

            {/* Playhead — premium cinematic */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: currentTime * pxPerSec }}>
              <div className="relative -ml-[6px]">
                <div className="w-[12px] h-4 bg-white rounded-b-sm shadow-[0_2px_8px_rgba(255,255,255,0.3)]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }} />
              </div>
              <div className="w-px h-full bg-white/80 ml-[5px]" style={{ boxShadow: '0 0 16px rgba(255,255,255,0.5), 0 0 4px rgba(255,255,255,0.8)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};