import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Maximize2,
  Volume2, VolumeX, Volume1, Gauge, Repeat, SkipBack as FrameBack, SkipForward as FrameForward,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TimelineTrack, TimelineClip } from "./types";
import { cn } from "@/lib/utils";
import { useGaplessPlayback } from "./useGaplessPlayback";

/**
 * EditorPreview - Cinematic preview with rock-solid gapless playback
 */

interface EditorPreviewProps {
  tracks: TimelineTrack[];
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onTimeChange: (time: number) => void;
  duration: number;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
}

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 8, 16];
const FRAME_STEP = 1 / 30;

export const EditorPreview = ({
  tracks, currentTime, isPlaying, onPlayPause, onTimeChange, duration,
  playbackSpeed = 1, onPlaybackSpeedChange,
}: EditorPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // ── Gapless playback engine ──
  const {
    videoARef,
    videoBRef,
    activeSlot,
    activeClip: activeVideoClip,
    videoReady,
    sortedVideoClips,
    activeTextClips,
  } = useGaplessPlayback(
    tracks, currentTime, isPlaying, duration,
    playbackSpeed, volume, isMuted, isLooping,
    onTimeChange, onPlayPause,
  );

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ": e.preventDefault(); onPlayPause(); break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) { const prev = sortedVideoClips.map(c => c.start).filter(t => t < currentTime - 0.05).pop(); onTimeChange(prev ?? 0); }
          else onTimeChange(Math.max(0, currentTime - FRAME_STEP));
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) { const next = sortedVideoClips.map(c => c.start).find(t => t > currentTime + 0.05); onTimeChange(next ?? duration); }
          else onTimeChange(Math.min(duration, currentTime + FRAME_STEP));
          break;
        case "Home": e.preventDefault(); onTimeChange(0); break;
        case "End": e.preventDefault(); onTimeChange(duration); break;
        case "l": e.preventDefault(); setIsLooping(prev => !prev); break;
        case "j": e.preventDefault(); onTimeChange(Math.max(0, currentTime - 5)); break;
        case "k": e.preventDefault(); onPlayPause(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentTime, duration, onPlayPause, onTimeChange, sortedVideoClips]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
  };

  const jumpToPrevClip = useCallback(() => {
    const boundary = sortedVideoClips.map(c => c.start).filter(t => t < currentTime - 0.1).pop();
    onTimeChange(boundary ?? 0);
  }, [sortedVideoClips, currentTime, onTimeChange]);

  const jumpToNextClip = useCallback(() => {
    const boundary = sortedVideoClips.map(c => c.start).find(t => t > currentTime + 0.1);
    onTimeChange(boundary ?? duration);
  }, [sortedVideoClips, currentTime, duration, onTimeChange]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const clipMarkers = useMemo(() => {
    if (duration <= 0) return [];
    return sortedVideoClips.map(c => ({ position: (c.start / duration) * 100, id: c.id }));
  }, [sortedVideoClips, duration]);

  const hasClips = sortedVideoClips.length > 0;

  return (
    <div className="h-full w-full flex flex-col bg-[hsl(0,0%,4%)] overflow-hidden" style={{ contain: 'strict' }}>
      {/* Video viewport */}
      <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
        {/* Ambient glow behind video */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-primary/[0.03] blur-[100px]" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-5">
          {hasClips ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Cinematic video frame */}
              <div className="max-h-full max-w-full w-full h-full rounded-2xl shadow-2xl shadow-black/80 overflow-hidden relative border border-white/[0.06]">
                <video ref={videoARef}
                  className={cn("absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-75", activeSlot === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0')}
                  muted={isMuted} playsInline preload="auto" />
                <video ref={videoBRef}
                  className={cn("absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-75", activeSlot === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0')}
                  muted={isMuted} playsInline preload="auto" />
                
                {/* Cinematic letterbox effect */}
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/30 to-transparent pointer-events-none z-20" />
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-20" />
              </div>
              
              {!activeVideoClip && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl z-20">
                  <div className="text-center">
                    <span className="text-[12px] tracking-wider uppercase font-medium text-white/30 block">Gap in timeline</span>
                    <span className="text-[10px] text-white/15 mt-1 block">Move the playhead over a clip</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 text-white/15">
              <div className="w-20 h-20 rounded-3xl border border-white/[0.06] flex items-center justify-center bg-white/[0.02] relative">
                <Play className="w-8 h-8 ml-1" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent" />
              </div>
              <div className="text-center">
                <span className="text-[13px] tracking-wider uppercase font-medium block text-white/25">No clip at playhead</span>
                <span className="text-[10px] text-white/10 mt-1.5 block">Move the playhead over a clip to preview</span>
              </div>
            </div>
          )}

          {/* Text overlays */}
          {activeTextClips.map((clip) => (
            <div key={clip.id} className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span style={{
                fontSize: clip.textStyle?.fontSize || 48,
                color: clip.textStyle?.color || "#FFFFFF",
                fontWeight: (clip.textStyle?.fontWeight as any) || "bold",
                textShadow: "0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.4)",
                letterSpacing: '0.02em',
              }}>
                {clip.textContent || ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transport bar */}
      <div className="shrink-0 bg-[hsl(0,0%,6%)]/80 backdrop-blur-xl border-t border-white/[0.06]">
        {/* Scrubber */}
        <div
          className="h-2.5 bg-white/[0.03] cursor-pointer group relative mx-4 mt-2 rounded-full overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onTimeChange(Math.max(0, Math.min(duration, pct * duration)));
          }}
        >
          {clipMarkers.map((m) => (
            <div key={m.id} className="absolute top-0 bottom-0 w-px bg-white/[0.08] z-10" style={{ left: `${m.position}%` }} />
          ))}
          <div
            className="h-full bg-gradient-to-r from-primary/60 via-primary to-white/80 rounded-full transition-all duration-75 relative z-20"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.6)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2 border-2 border-white" />
          </div>
        </div>

        {/* Controls */}
        <div className="h-12 flex items-center gap-1 px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all" onClick={() => onTimeChange(0)}>
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,8%)] border-white/[0.08] text-white rounded-xl">Start</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all" onClick={jumpToPrevClip}>
                <FrameBack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,8%)] border-white/[0.08] text-white rounded-xl">Prev Clip</TooltipContent>
          </Tooltip>

          {/* Play/Pause — Premium white button */}
          <button
            className="h-11 w-11 rounded-2xl bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all mx-1 shadow-[0_0_30px_rgba(255,255,255,0.12)] hover:shadow-[0_0_50px_rgba(255,255,255,0.18)] hover:scale-105 active:scale-95"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all" onClick={jumpToNextClip}>
                <FrameForward className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,8%)] border-white/[0.08] text-white rounded-xl">Next Clip</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all" onClick={() => onTimeChange(duration)}>
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,8%)] border-white/[0.08] text-white rounded-xl">End</TooltipContent>
          </Tooltip>

          <div className="h-5 w-px bg-white/[0.06] mx-2" />

          {/* Timecode display — premium glass */}
          <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-4 py-2 border border-white/[0.05]">
            <span className="text-[13px] font-mono text-white tabular-nums tracking-wider font-medium">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/10 mx-0.5">/</span>
            <span className="text-[12px] font-mono text-white/25 tabular-nums tracking-wider">
              {formatTime(duration)}
            </span>
          </div>

          {activeVideoClip && (
            <div className="ml-2 px-3 py-1 rounded-xl bg-primary/[0.06] border border-primary/[0.12]">
              <span className="text-[9px] text-primary/70 font-medium truncate max-w-[100px] block">
                {activeVideoClip.label}
              </span>
            </div>
          )}

          <div className="flex-1" />

          {/* Loop */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className={cn("h-8 w-8 rounded-xl transition-all", isLooping ? "text-white bg-white/[0.10]" : "text-white/25 hover:text-white hover:bg-white/[0.05]")}
                onClick={() => setIsLooping(!isLooping)}
              >
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,8%)] border-white/[0.08] text-white rounded-xl">Loop <kbd className="ml-1 text-white/30">L</kbd></TooltipContent>
          </Tooltip>

          {/* Speed */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("h-8 px-3 text-[11px] font-mono gap-1.5 rounded-xl transition-all", playbackSpeed !== 1 ? "text-white bg-white/[0.08]" : "text-white/30 hover:text-white hover:bg-white/[0.05]")}>
                <Gauge className="h-3.5 w-3.5" />
                {playbackSpeed}x
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-2 bg-[hsl(0,0%,6%)]/95 backdrop-blur-xl border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50">
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {SPEED_PRESETS.map((speed) => (
                  <Button key={speed} variant="ghost" size="sm"
                    className={cn("h-7 px-2.5 text-[10px] font-mono rounded-lg transition-all",
                      playbackSpeed === speed ? "bg-white text-black font-bold" : "text-white/30 hover:text-white hover:bg-white/[0.06]"
                    )}
                    onClick={() => onPlaybackSpeedChange?.(speed)}
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Volume */}
          <div className="flex items-center gap-1.5 ml-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all"
                  onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-3.5 w-3.5" /> :
                    volume > 50 ? <Volume2 className="h-3.5 w-3.5" /> : <Volume1 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,8%)] border-white/[0.08] text-white rounded-xl">{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
            </Tooltip>
            <div className="w-16">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={(v) => { setVolume(v[0]); if (v[0] > 0) setIsMuted(false); }}
                className="h-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
