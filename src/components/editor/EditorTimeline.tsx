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

// Organic Fluid palette — bioluminescent colors
const trackColors: Record<string, { bg: string; bgSolid: string; border: string; text: string; glow: string; clip: string; accent: string }> = {
  video: { bg: "bg-cyan-500/[0.06]", bgSolid: "hsl(180 70% 45% / 0.10)", border: "border-cyan-400/15", text: "text-cyan-300", glow: "hsl(180 70% 50% / 0.15)", clip: "from-cyan-500/20 to-emerald-500/10", accent: "cyan" },
  audio: { bg: "bg-emerald-500/[0.06]", bgSolid: "hsl(160 60% 45% / 0.10)", border: "border-emerald-400/15", text: "text-emerald-300", glow: "hsl(160 60% 45% / 0.15)", clip: "from-emerald-500/20 to-green-500/10", accent: "emerald" },
  text: { bg: "bg-purple-500/[0.06]", bgSolid: "hsl(270 60% 55% / 0.10)", border: "border-purple-400/15", text: "text-purple-300", glow: "hsl(270 60% 55% / 0.15)", clip: "from-purple-500/20 to-pink-500/10", accent: "purple" },
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
    <div className="h-full flex flex-col bg-[#040d08]">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-1.5 px-3 border-b border-emerald-400/[0.06] shrink-0 bg-[#060f0b]/90 backdrop-blur-xl relative">
        {/* Aurora accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent" />
        
        <div className="flex items-center gap-0.5 bg-emerald-400/[0.04] rounded-xl p-0.5 border border-emerald-400/[0.08]">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-lg transition-all" onClick={() => onZoomChange(Math.min(zoom * 1.5, 10))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <div className="w-12 h-1.5 bg-emerald-400/[0.06] rounded-full relative mx-1">
            <div className="h-full bg-gradient-to-r from-emerald-400/30 to-cyan-400/50 rounded-full transition-all" style={{ width: `${Math.min((Math.log2(zoom) + 3.3) / 6.6 * 100, 100)}%` }} />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-lg transition-all" onClick={() => onZoomChange(Math.max(zoom / 1.5, 0.1))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
        </div>
        <span className="text-[9px] text-emerald-300/25 ml-1 tabular-nums font-mono">{Math.round(zoom * 100)}%</span>

        <div className="flex-1" />

        <span className="text-[9px] text-emerald-300/20 font-mono mr-2">
          {tracks.reduce((sum, t) => sum + t.clips.length, 0)} clips
        </span>

        {selectedClipId && onRippleDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon"
                className="h-6 w-6 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-xl transition-all mr-0.5"
                onClick={() => onRippleDelete(selectedClipId)}>
                <Scissors className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">
              Ripple Delete <kbd className="ml-1 text-emerald-300/40">⇧Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}

        {selectedClipId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all" onClick={() => onDeleteClip(selectedClipId)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">
              Delete <kbd className="ml-1 text-emerald-300/40">Del</kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels */}
        <div className="w-44 shrink-0 border-r border-emerald-400/[0.06] bg-[#060f0b]/90 backdrop-blur-xl">
          <div className="h-7 border-b border-emerald-400/[0.04]" />
          {tracks.map((track) => {
            const Icon = trackIcons[track.type] || Film;
            const colors = trackColors[track.type] || trackColors.video;
            return (
              <div key={track.id} className="flex items-center gap-2.5 px-3 border-b border-emerald-400/[0.04] group hover:bg-emerald-400/[0.03] transition-colors" style={{ height: TRACK_HEIGHT }}>
                <div className={cn("w-6 h-6 rounded-xl flex items-center justify-center bg-emerald-400/[0.04] border border-emerald-400/[0.08]")}>
                  <Icon className={cn("h-3 w-3", colors.text)} />
                </div>
                <span className="text-[10px] font-medium text-emerald-300/30 truncate flex-1 tracking-wide">{track.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className={cn("p-1 rounded-lg transition-colors", track.muted ? "text-red-400/50 bg-red-500/10" : "text-emerald-300/25 hover:text-emerald-200/70 hover:bg-emerald-400/[0.08]")}
                    onClick={() => onToggleTrackMute?.(track.id)}
                  >
                    {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>
                  <button
                    className={cn("p-1 rounded-lg transition-colors", track.locked ? "text-amber-400/50 bg-amber-500/10" : "text-emerald-300/25 hover:text-emerald-200/70 hover:bg-emerald-400/[0.08]")}
                    onClick={() => onToggleTrackLock?.(track.id)}
                  >
                    <Lock className="h-2.5 w-2.5" />
                  </button>
                  {track.clips.length > 0 && onClearTrack && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 rounded-lg transition-colors text-emerald-300/25 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => onClearTrack(track.id)}
                        >
                          <XCircle className="h-2.5 w-2.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">
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
            {/* Ruler */}
            <div className="h-7 border-b border-emerald-400/[0.06] relative bg-[#060f0b]/60" onClick={handleTimelineClick}>
              {markers.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col justify-end" style={{ left: m.time * pxPerSec }}>
                  {m.major && (
                    <span className="text-[8px] text-emerald-300/25 px-0.5 tabular-nums font-mono">
                      {Math.floor(m.time / 60)}:{(Math.floor(m.time) % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                  <div className={cn("w-px", m.major ? "h-2.5 bg-emerald-400/15" : "h-1 bg-emerald-400/[0.06]")} />
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => {
              const colors = trackColors[track.type] || trackColors.video;
              return (
                <div key={track.id} className="relative border-b border-emerald-400/[0.04]" style={{ height: TRACK_HEIGHT }} onClick={handleTimelineClick}>
                  <div className="absolute inset-0 opacity-15" style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${pxPerSec - 1}px, hsl(160 30% 20% / 0.15) ${pxPerSec}px)`,
                  }} />

               {track.clips.map((clip, clipIndex) => {
                     const left = clip.start * pxPerSec;
                     const width = (clip.end - clip.start) * pxPerSec;
                     const isSelected = clip.id === selectedClipId || selectedClipIds.includes(clip.id);
                     const hasTransition = clip.effects.some((e) => e.type === "transition");
                     const nextClip = track.clips
                       .filter(c => c.start >= clip.end - 0.1 && c.id !== clip.id)
                       .sort((a, b) => a.start - b.start)[0];
                     const hasTransitionZone = nextClip && Math.abs(nextClip.start - clip.end) < 0.5;

                    return (
                      <div
                        key={clip.id}
                        className={cn(
                          "absolute top-2 rounded-2xl cursor-grab select-none group/clip border transition-all duration-200",
                          "flex items-center overflow-hidden bg-gradient-to-r",
                          colors.clip, colors.border,
                          isSelected && "ring-1 ring-emerald-400/40 border-emerald-400/30 shadow-lg",
                          "hover:brightness-110"
                        )}
                        style={{
                          left, width: Math.max(width, 28), height: TRACK_HEIGHT - 16,
                          boxShadow: isSelected
                            ? `0 0 24px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
                            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                        }}
                        onClick={(e) => { e.stopPropagation(); onSelectClip(clip.id, e.shiftKey || e.ctrlKey || e.metaKey); }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                      >
                        {/* Left trim */}
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-300/10 rounded-l-2xl transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-left")}>
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-px h-4 bg-emerald-300/15 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>

                        {/* Content */}
                        {track.type === "video" ? (
                          <div className="flex-1 min-w-0 h-full relative overflow-hidden">
                            {/* Organic bioluminescent film strip */}
                            <div className="absolute inset-0 flex">
                              {Array.from({ length: Math.max(1, Math.floor(width / 32)) }, (_, i) => (
                                <div
                                  key={i}
                                  className="h-full flex-1 border-r border-cyan-300/[0.06] last:border-r-0"
                                  style={{
                                    background: i % 2 === 0
                                      ? 'linear-gradient(180deg, hsl(180 50% 45% / 0.12) 0%, hsl(160 50% 35% / 0.06) 100%)'
                                      : 'linear-gradient(180deg, hsl(180 50% 45% / 0.08) 0%, hsl(160 50% 35% / 0.03) 100%)',
                                  }}
                                />
                              ))}
                            </div>
                            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 opacity-25">
                              <Film className="h-3 w-3 text-cyan-300" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/8 via-transparent to-emerald-400/4 pointer-events-none" />
                            <span className={cn("absolute bottom-1 left-6 right-1 text-[8px] font-medium truncate z-10 text-cyan-200/60 drop-shadow-md")}>
                              {clip.label}
                            </span>
                            {width > 60 && (
                              <span className="absolute top-1 right-1.5 text-[7px] font-mono text-cyan-300/30 z-10">
                                {(clip.end - clip.start).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        ) : track.type === "audio" ? (
                          <div className="flex-1 min-w-0 h-full relative">
                            <RealAudioWaveform clipId={clip.id} width={Math.max(width, 28)} height={TRACK_HEIGHT - 16} color={colors.text} />
                            <span className={cn("absolute bottom-1 left-2.5 text-[8px] font-medium truncate", colors.text, "opacity-50")}>
                              {clip.label}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 min-w-0 flex-1">
                            <span className={cn("text-[9px] font-medium truncate", colors.text, "opacity-70")}>{clip.label}</span>
                          </div>
                        )}

                        {/* Transition indicator */}
                        {hasTransition && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
                            <span className="text-[7px] text-emerald-300/30 font-mono">fade</span>
                          </div>
                        )}

                        {/* Speed badge */}
                        {clip.speed && clip.speed !== 1 && (
                          <div className="absolute top-1 right-2 bg-[#040d08]/60 rounded-lg px-1.5 py-px text-[7px] font-mono text-emerald-200/50">
                            {clip.speed}x
                          </div>
                        )}

                        {/* Right trim */}
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-emerald-300/10 rounded-r-2xl transition-colors z-10" onMouseDown={(e) => handleClipMouseDown(e, clip, "trim-right")}>
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-px h-4 bg-emerald-300/15 opacity-0 group-hover/clip:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Snap line */}
            {snapLine !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-emerald-400/60 z-30 pointer-events-none" style={{ left: snapLine * pxPerSec }}>
                <div className="absolute inset-0 w-px bg-emerald-400/30 blur-[3px]" />
              </div>
            )}

            {/* Playhead — bioluminescent */}
            <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: currentTime * pxPerSec }}>
              <div className="relative -ml-[6px]">
                <div className="w-[12px] h-4 bg-gradient-to-b from-emerald-300 to-cyan-400 rounded-b-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }} />
              </div>
              <div className="w-px h-full bg-emerald-300/80 ml-[5px]" style={{ boxShadow: '0 0 16px rgba(52,211,153,0.5), 0 0 4px rgba(52,211,153,0.8)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
