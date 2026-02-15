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
const PRELOAD_AHEAD_SEC = 1.5; // preload next clip this many seconds before transition
const FRAME_STEP = 1 / 30; // 30fps frame step

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
  // === Refs ===
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActiveClipIdRef = useRef<string | null>(null);
  const preloadedClipIdRef = useRef<string | null>(null);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const playbackSpeedRef = useRef(playbackSpeed);
  const isLoopingRef = useRef(false);

  // Keep refs in sync
  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  playbackSpeedRef.current = playbackSpeed;

  // === State ===
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Sync loop ref
  isLoopingRef.current = isLooping;

  // === Derived: sorted video clips for sequencing ===
  const sortedVideoClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === "video")
      .flatMap((t) => t.clips)
      .sort((a, b) => a.start - b.start);
  }, [tracks]);

  const activeVideoClip = useMemo(() => {
    return sortedVideoClips.find((c) => currentTime >= c.start && currentTime < c.end);
  }, [sortedVideoClips, currentTime]);

  // Check if the active video's track is muted
  const isTrackMuted = useMemo(() => {
    if (!activeVideoClip) return false;
    const track = tracks.find((t) => t.clips.some((c) => c.id === activeVideoClip.id));
    return track?.muted ?? false;
  }, [tracks, activeVideoClip]);

  const nextVideoClip = useMemo(() => {
    if (!activeVideoClip) return null;
    const idx = sortedVideoClips.indexOf(activeVideoClip);
    return idx >= 0 && idx < sortedVideoClips.length - 1 ? sortedVideoClips[idx + 1] : null;
  }, [sortedVideoClips, activeVideoClip]);

  const activeTextClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === "text")
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.start && currentTime < c.end);
  }, [tracks, currentTime]);

  // === Playback clock (RAF) — ref-based to avoid stale closures ===
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTimestamp: number | null = null;
    const tick = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const delta = ((timestamp - lastTimestamp) / 1000) * playbackSpeedRef.current;
      lastTimestamp = timestamp;

      const ct = currentTimeRef.current;
      const dur = durationRef.current;
      const newTime = ct + delta;

      if (newTime >= dur) {
        if (isLoopingRef.current) {
          onTimeChange(0);
        } else {
          onTimeChange(dur);
          return; // Stop the loop — we've reached the end
        }
      } else {
        onTimeChange(newTime);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, onTimeChange]);

  // === Double-buffer: preload next clip ===
  useEffect(() => {
    const preloadVideo = preloadVideoRef.current;
    if (!preloadVideo || !nextVideoClip) return;

    const timeToTransition = activeVideoClip ? activeVideoClip.end - currentTime : Infinity;

    // Start preloading when we're within the threshold
    if (timeToTransition <= PRELOAD_AHEAD_SEC && preloadedClipIdRef.current !== nextVideoClip.id) {
      preloadVideo.src = nextVideoClip.sourceUrl;
      preloadVideo.preload = "auto";
      preloadVideo.currentTime = 0;
      preloadVideo.volume = isMuted ? 0 : volume / 100;
      preloadVideo.muted = isMuted;
      preloadedClipIdRef.current = nextVideoClip.id;
    }
  }, [activeVideoClip, nextVideoClip, currentTime, isMuted, volume]);

  // === Main video sync ===
  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video || !activeVideoClip) return;

    const clipChanged = lastActiveClipIdRef.current !== activeVideoClip.id;
    lastActiveClipIdRef.current = activeVideoClip.id;

    if (clipChanged) {
      // Check if the preload buffer already has this clip ready
      const preloadVideo = preloadVideoRef.current;
      if (preloadVideo && preloadedClipIdRef.current === activeVideoClip.id && preloadVideo.readyState >= 2) {
        // Swap: copy src from preload to active for instant start
        video.src = preloadVideo.src;
        video.currentTime = 0;
      } else {
        video.src = activeVideoClip.sourceUrl;
        video.currentTime = 0;
      }
      preloadedClipIdRef.current = null; // Reset preload state
    }

    video.playbackRate = playbackSpeed;

    // Sync position within clip — tight tolerance for gapless playback
    const clipLocalTime = currentTime - activeVideoClip.start;
    if (!clipChanged && Math.abs(video.currentTime - clipLocalTime) > 0.15) {
      video.currentTime = clipLocalTime;
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [activeVideoClip, currentTime, isPlaying, playbackSpeed]);

  // === Volume sync (respects track mute) ===
  useEffect(() => {
    const effectiveMute = isMuted || isTrackMuted;
    const video = activeVideoRef.current;
    if (video) {
      video.muted = effectiveMute;
      video.volume = volume / 100;
    }
    const preload = preloadVideoRef.current;
    if (preload) {
      preload.muted = effectiveMute;
      preload.volume = volume / 100;
    }
  }, [volume, isMuted, isTrackMuted]);

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          onPlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            // Jump to previous clip boundary
            const prevBoundary = sortedVideoClips
              .map(c => c.start)
              .filter(t => t < currentTime - 0.05)
              .pop();
            onTimeChange(prevBoundary ?? 0);
          } else {
            onTimeChange(Math.max(0, currentTime - FRAME_STEP));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            // Jump to next clip boundary
            const nextBoundary = sortedVideoClips
              .map(c => c.start)
              .find(t => t > currentTime + 0.05);
            onTimeChange(nextBoundary ?? duration);
          } else {
            onTimeChange(Math.min(duration, currentTime + FRAME_STEP));
          }
          break;
        case "Home":
          e.preventDefault();
          onTimeChange(0);
          break;
        case "End":
          e.preventDefault();
          onTimeChange(duration);
          break;
        case "l":
          e.preventDefault();
          setIsLooping(prev => !prev);
          break;
        case "j":
          e.preventDefault();
          onTimeChange(Math.max(0, currentTime - 5));
          break;
        case "k":
          e.preventDefault();
          onPlayPause();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentTime, duration, onPlayPause, onTimeChange, sortedVideoClips]);

  // === Helpers ===
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
  };

  const jumpToPrevClip = useCallback(() => {
    const boundary = sortedVideoClips
      .map(c => c.start)
      .filter(t => t < currentTime - 0.1)
      .pop();
    onTimeChange(boundary ?? 0);
  }, [sortedVideoClips, currentTime, onTimeChange]);

  const jumpToNextClip = useCallback(() => {
    const boundary = sortedVideoClips
      .map(c => c.start)
      .find(t => t > currentTime + 0.1);
    onTimeChange(boundary ?? duration);
  }, [sortedVideoClips, currentTime, duration, onTimeChange]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Clip boundary markers for the scrubber
  const clipMarkers = useMemo(() => {
    if (duration <= 0) return [];
    return sortedVideoClips.map(c => ({
      position: (c.start / duration) * 100,
      id: c.id,
    }));
  }, [sortedVideoClips, duration]);

  return (
    <div className="h-full w-full flex flex-col bg-[hsl(260,15%,4%)] overflow-hidden" style={{ contain: 'strict' }}>
      {/* === Hidden preload video element for gapless transitions === */}
      <video
        ref={preloadVideoRef}
        className="hidden"
        preload="auto"
        playsInline
        muted={isMuted}
      />

      {/* === Video viewport === */}
      <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-3">
          {activeVideoClip ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Ambient glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, hsl(263 70% 50% / 0.04) 0%, transparent 70%)'
              }} />
              <video
                ref={activeVideoRef}
                className="max-h-full max-w-full rounded-lg shadow-2xl shadow-black/50"
                style={{
                  objectFit: 'contain',
                  WebkitTransform: 'translateZ(0)',
                }}
                playsInline
              />
              {/* Frame border */}
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

      {/* === Transport bar === */}
      <div className="shrink-0 bg-[hsl(260,12%,8%)] border-t border-white/[0.06]">
        {/* Scrubber with clip boundary markers */}
        <div
          className="h-2 bg-white/[0.04] cursor-pointer group relative mx-3 mt-1.5 rounded-full overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onTimeChange(Math.max(0, Math.min(duration, pct * duration)));
          }}
        >
          {/* Clip boundary markers */}
          {clipMarkers.map((m) => (
            <div
              key={m.id}
              className="absolute top-0 bottom-0 w-px bg-white/10 z-10"
              style={{ left: `${m.position}%` }}
            />
          ))}

          {/* Progress fill */}
          <div
            className="h-full bg-gradient-to-r from-white/50 to-white/80 rounded-full transition-all duration-75 relative z-20"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2" />
          </div>
        </div>

        {/* Controls */}
        <div className="h-11 flex items-center gap-0.5 px-3">
          {/* Navigation cluster */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
                onClick={() => onTimeChange(0)}
              >
                <SkipBack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">Start</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
                onClick={jumpToPrevClip}
              >
                <FrameBack className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">Prev Clip <kbd className="ml-1 text-white/30">⇧←</kbd></TooltipContent>
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
                onClick={jumpToNextClip}
              >
                <FrameForward className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">Next Clip <kbd className="ml-1 text-white/30">⇧→</kbd></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
                onClick={() => onTimeChange(duration)}
              >
                <SkipForward className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">End</TooltipContent>
          </Tooltip>

          <div className="h-5 w-px bg-white/[0.06] mx-1.5" />

          {/* Timecode */}
          <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1.5 border border-white/[0.06]">
            <span className="text-[12px] font-mono text-white tabular-nums tracking-wider">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/15 mx-0.5">/</span>
            <span className="text-[12px] font-mono text-white/30 tabular-nums tracking-wider">
              {formatTime(duration)}
            </span>
          </div>

          {/* Active clip indicator */}
          {activeVideoClip && (
            <div className="ml-2 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              <span className="text-[9px] text-primary/70 font-medium truncate max-w-[100px] block">
                {activeVideoClip.label}
              </span>
            </div>
          )}

          <div className="flex-1" />

          {/* Loop toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-lg transition-all",
                  isLooping ? "text-primary bg-primary/10" : "text-white/30 hover:text-white hover:bg-white/[0.06]"
                )}
                onClick={() => setIsLooping(!isLooping)}
              >
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(260,20%,12%)] border-white/10">
              Loop <kbd className="ml-1 text-white/30">L</kbd>
            </TooltipContent>
          </Tooltip>

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
