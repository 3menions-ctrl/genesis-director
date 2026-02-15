import { useRef, useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Volume2, VolumeX, Volume1, Gauge } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TimelineTrack } from "./types";
import { cn } from "@/lib/utils";

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

export const EditorPreview = ({
  tracks,
  currentTime,
  isPlaying,
  onPlayPause,
  onTimeChange,
  duration,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
}: EditorPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  const activeVideoClip = tracks
    .filter((t) => t.type === "video")
    .flatMap((t) => t.clips)
    .find((c) => currentTime >= c.start && currentTime < c.end);

  const activeTextClips = tracks
    .filter((t) => t.type === "text")
    .flatMap((t) => t.clips)
    .filter((c) => currentTime >= c.start && currentTime < c.end);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTimestamp: number | null = null;
    const tick = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const delta = ((timestamp - lastTimestamp) / 1000) * playbackSpeed;
      lastTimestamp = timestamp;

      onTimeChange(Math.min(currentTime + delta, duration));
      if (currentTime + delta < duration) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentTime, duration, onTimeChange, playbackSpeed]);

  // Sync video source, time, play state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip) return;

    if (video.src !== activeVideoClip.sourceUrl) {
      video.src = activeVideoClip.sourceUrl;
    }

    video.playbackRate = playbackSpeed;

    const clipLocalTime = currentTime - activeVideoClip.start;
    if (Math.abs(video.currentTime - clipLocalTime) > 0.3) {
      video.currentTime = clipLocalTime;
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [activeVideoClip, currentTime, isPlaying, playbackSpeed]);

  // Sync volume and mute state to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.volume = volume / 100;
  }, [volume, isMuted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-full w-full flex flex-col bg-[hsl(260,15%,4%)] overflow-hidden" style={{ contain: 'strict' }}>
      {/* Video viewport — uses absolute positioning to guarantee containment */}
      <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
        {/* Centered 16:9 aspect container */}
        <div className="absolute inset-0 flex items-center justify-center p-3">
          {activeVideoClip ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Ambient glow behind video */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, hsl(263 70% 50% / 0.04) 0%, transparent 70%)'
              }} />
              <video
                ref={videoRef}
                className="max-h-full max-w-full rounded-lg shadow-2xl shadow-black/50"
                style={{
                  objectFit: 'contain',
                  WebkitTransform: 'translateZ(0)', // Safari GPU acceleration
                }}
                
                playsInline
              />
              {/* Subtle border frame around video */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full max-w-full max-h-full border border-white/[0.04] rounded-lg" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-white/20">
              <div className="w-16 h-16 rounded-2xl border border-white/[0.06] flex items-center justify-center bg-white/[0.02] backdrop-blur-sm">
                <Play className="w-7 h-7 ml-0.5" />
              </div>
              <div className="text-center">
                <span className="text-[12px] tracking-wider uppercase font-medium block">No clip at playhead</span>
                <span className="text-[10px] text-white/10 mt-1 block">Move the playhead over a clip to preview</span>
              </div>
            </div>
          )}

          {/* Text overlays */}
          {activeTextClips.map((clip) => (
            <div
              key={clip.id}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <span
                style={{
                  fontSize: clip.textStyle?.fontSize || 48,
                  color: clip.textStyle?.color || "#FFFFFF",
                  fontWeight: (clip.textStyle?.fontWeight as any) || "bold",
                  textShadow: "0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.4)",
                  letterSpacing: '0.02em',
                }}
              >
                {clip.textContent || ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transport bar — fixed height, never overflows */}
      <div className="shrink-0 bg-[hsl(260,12%,8%)] border-t border-white/[0.06]">
        {/* Scrubber track */}
        <div
          className="h-1.5 bg-white/[0.04] cursor-pointer group relative mx-3 mt-1.5 rounded-full overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onTimeChange(Math.max(0, Math.min(duration, pct * duration)));
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-white/50 to-white/80 rounded-full transition-all duration-75 relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2" />
          </div>
        </div>

        {/* Controls */}
        <div className="h-11 flex items-center gap-1 px-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
                onClick={() => onTimeChange(0)}
              >
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-white hover:text-white hover:bg-white/[0.1] rounded-xl transition-all mx-0.5"
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
            onClick={() => onTimeChange(duration)}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>

          <div className="h-5 w-px bg-white/[0.06] mx-2" />

          {/* Timecode display */}
          <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1.5 border border-white/[0.06]">
            <span className="text-[12px] font-mono text-white tabular-nums tracking-wider">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/15 mx-0.5">/</span>
            <span className="text-[12px] font-mono text-white/30 tabular-nums tracking-wider">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex-1" />

          {/* Speed control */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-[11px] font-mono gap-1.5 rounded-lg transition-all",
                  playbackSpeed !== 1 ? "text-white bg-white/[0.08]" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <Gauge className="h-3.5 w-3.5" />
                {playbackSpeed}x
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2 bg-[hsl(260,20%,10%)] border-white/10" side="top" align="end">
              <div className="grid grid-cols-2 gap-1">
                {SPEED_PRESETS.map((speed) => (
                  <button
                    key={speed}
                    className={cn(
                      "px-2.5 py-2 rounded-lg text-[11px] font-mono transition-all",
                      playbackSpeed === speed
                        ? "bg-white text-black font-semibold"
                        : "text-white/60 hover:text-white hover:bg-white/[0.08]"
                    )}
                    onClick={() => onPlaybackSpeedChange?.(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Volume control */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-lg transition-all",
                  isMuted ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/10" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                )}
                onClick={(e) => {
                  // Simple click toggles mute, popover opens on the trigger
                  if (e.detail === 2) return; // ignore double click
                }}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : volume < 50 ? <Volume1 className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-3 bg-[hsl(260,20%,10%)] border-white/10" side="top" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Volume</span>
                  <button
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded transition-all",
                      isMuted ? "text-red-400 bg-red-500/10" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                    )}
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <VolumeX className="h-3 w-3 text-white/20 shrink-0" />
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => {
                      setVolume(v);
                      if (v > 0 && isMuted) setIsMuted(false);
                      if (v === 0) setIsMuted(true);
                    }}
                    className="flex-1"
                  />
                  <Volume2 className="h-3 w-3 text-white/20 shrink-0" />
                </div>
                <span className="text-[10px] text-white/30 font-mono tabular-nums block text-center">{isMuted ? "Muted" : `${volume}%`}</span>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
