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

/**
 * EditorPreview - Direct MP4 playback with HLS-style seamless transition config
 * 
 * Uses the same gapless/overlap strategy as the HLS stitcher:
 * - Pre-loads next clip while current plays (like #EXT-X-DISCONTINUITY buffering)
 * - Zero-gap transitions between clips (no black frames)
 * - Overlap-ready: clips can share timeline positions
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
// HLS-style config: pre-buffer threshold before clip end to preload next
const PRELOAD_THRESHOLD_SEC = 0.5;

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
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const isLoopingRef = useRef(false);
  const isSyncingRef = useRef(false);
  const activeClipIdRef = useRef<string | null>(null);
  const activeSlotRef = useRef<'A' | 'B'>('A');
  const preloadedClipIdRef = useRef<string | null>(null);

  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');

  isLoopingRef.current = isLooping;

  // === Sorted video clips ===
  const sortedVideoClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === "video")
      .flatMap((t) => t.clips)
      .sort((a, b) => a.start - b.start);
  }, [tracks]);

  const activeVideoClip = useMemo(() => {
    return sortedVideoClips.find((c) => currentTime >= c.start && currentTime < c.end);
  }, [sortedVideoClips, currentTime]);

  const nextVideoClip = useMemo(() => {
    if (!activeVideoClip) return null;
    return sortedVideoClips.find((c) => c.start >= activeVideoClip.end - 0.01);
  }, [sortedVideoClips, activeVideoClip]);

  const activeTextClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === "text")
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.start && currentTime < c.end);
  }, [tracks, currentTime]);

  const getActiveVideo = useCallback(() => {
    return activeSlotRef.current === 'A' ? videoARef.current : videoBRef.current;
  }, []);

  const getPreloadVideo = useCallback(() => {
    return activeSlotRef.current === 'A' ? videoBRef.current : videoARef.current;
  }, []);

  // === HLS-style preloading ===
  useEffect(() => {
    if (!nextVideoClip || !activeVideoClip) return;
    if (preloadedClipIdRef.current === nextVideoClip.id) return;

    const timeToEnd = activeVideoClip.end - currentTime;
    if (timeToEnd <= PRELOAD_THRESHOLD_SEC && timeToEnd > 0) {
      const preloadVideo = getPreloadVideo();
      if (preloadVideo && preloadVideo.src !== nextVideoClip.sourceUrl) {
        preloadVideo.src = nextVideoClip.sourceUrl;
        preloadVideo.load();
        preloadVideo.currentTime = nextVideoClip.trimStart || 0;
        preloadedClipIdRef.current = nextVideoClip.id;
      }
    }
  }, [currentTime, activeVideoClip, nextVideoClip, getPreloadVideo]);

  // === Source switching with HLS-style seamless swap ===
  useEffect(() => {
    const video = getActiveVideo();
    if (!video) return;

    if (!activeVideoClip) {
      if (!video.paused) video.pause();
      activeClipIdRef.current = null;
      setVideoReady(false);
      return;
    }

    if (activeClipIdRef.current !== activeVideoClip.id) {
      activeClipIdRef.current = activeVideoClip.id;
      isSyncingRef.current = true;

      // HLS-style seamless swap
      if (preloadedClipIdRef.current === activeVideoClip.id) {
        const newSlot = activeSlotRef.current === 'A' ? 'B' : 'A';
        activeSlotRef.current = newSlot;
        setActiveSlot(newSlot);
        preloadedClipIdRef.current = null;

        const swappedVideo = newSlot === 'A' ? videoARef.current : videoBRef.current;
        if (swappedVideo) {
          const clipLocalTime = currentTime - activeVideoClip.start + (activeVideoClip.trimStart || 0);
          swappedVideo.currentTime = clipLocalTime;
          setVideoReady(true);
          if (isPlaying) swappedVideo.play().catch(() => {});
          isSyncingRef.current = false;
          const oldVideo = newSlot === 'A' ? videoBRef.current : videoARef.current;
          if (oldVideo && !oldVideo.paused) oldVideo.pause();
        }
        return;
      }

      // Standard load
      const clipLocalTime = currentTime - activeVideoClip.start + (activeVideoClip.trimStart || 0);
      video.src = activeVideoClip.sourceUrl;
      video.load();

      const onCanPlay = () => {
        video.currentTime = clipLocalTime;
        setVideoReady(true);
        if (isPlaying) video.play().catch(() => {});
        isSyncingRef.current = false;
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
    } else {
      const clipLocalTime = currentTime - activeVideoClip.start + (activeVideoClip.trimStart || 0);
      if (!isPlaying && Math.abs(video.currentTime - clipLocalTime) > 0.15) {
        video.currentTime = clipLocalTime;
      }
    }
  }, [activeVideoClip?.id, currentTime, isPlaying, getActiveVideo]);

  // Play/pause sync
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !activeVideoClip || !videoReady) return;
    if (isPlaying && video.paused) video.play().catch(() => {});
    else if (!isPlaying && !video.paused) video.pause();
  }, [isPlaying, videoReady, activeVideoClip, getActiveVideo]);

  // Speed sync
  useEffect(() => {
    [videoARef.current, videoBRef.current].forEach(v => {
      if (v) v.playbackRate = playbackSpeed;
    });
  }, [playbackSpeed]);

  // Volume sync
  useEffect(() => {
    [videoARef.current, videoBRef.current].forEach(v => {
      if (!v) return;
      v.muted = isMuted;
      v.volume = volume / 100;
    });
  }, [volume, isMuted]);

  // RAF loop
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const video = getActiveVideo();
      if (!video || isSyncingRef.current || !activeVideoClip) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const clipStart = activeVideoClip.start;
      const editorTime = clipStart + video.currentTime - (activeVideoClip.trimStart || 0);

      if (Math.abs(editorTime - currentTime) > 0.03) {
        onTimeChange(Math.min(editorTime, duration));
      }

      const clipDuration = activeVideoClip.end - activeVideoClip.start;
      if (video.currentTime >= clipDuration + (activeVideoClip.trimStart || 0) - 0.05) {
        const nextClip = sortedVideoClips.find((c) => c.start >= activeVideoClip.end - 0.01);
        if (nextClip) {
          onTimeChange(nextClip.start);
        } else if (isLoopingRef.current) {
          onTimeChange(0);
        } else {
          onTimeChange(duration);
          onPlayPause();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, activeVideoClip, sortedVideoClips, duration, onTimeChange, onPlayPause, currentTime, getActiveVideo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ": e.preventDefault(); onPlayPause(); break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            const prevBoundary = sortedVideoClips.map(c => c.start).filter(t => t < currentTime - 0.05).pop();
            onTimeChange(prevBoundary ?? 0);
          } else onTimeChange(Math.max(0, currentTime - FRAME_STEP));
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            const nextBoundary = sortedVideoClips.map(c => c.start).find(t => t > currentTime + 0.05);
            onTimeChange(nextBoundary ?? duration);
          } else onTimeChange(Math.min(duration, currentTime + FRAME_STEP));
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
    <div className="h-full w-full flex flex-col bg-[hsl(0,0%,5%)] overflow-hidden" style={{ contain: 'strict' }}>
      {/* Video viewport */}
      <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {hasClips ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Dual-video for HLS-style seamless transitions */}
              <div className="max-h-full max-w-full w-full h-full rounded-lg shadow-2xl shadow-black/60 overflow-hidden relative border border-white/[0.04]">
                <video
                  ref={videoARef}
                  className={cn(
                    "absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-75",
                    activeSlot === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  )}
                  muted={isMuted}
                  playsInline
                  preload="auto"
                />
                <video
                  ref={videoBRef}
                  className={cn(
                    "absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-75",
                    activeSlot === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  )}
                  muted={isMuted}
                  playsInline
                  preload="auto"
                />
              </div>
              
              {!activeVideoClip && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg z-20">
                  <div className="text-center">
                    <span className="text-[12px] tracking-wider uppercase font-medium text-white/30 block">Gap in timeline</span>
                    <span className="text-[10px] text-white/15 mt-1 block">Move the playhead over a clip</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-white/20">
              <div className="w-16 h-16 rounded-2xl border border-white/[0.08] flex items-center justify-center bg-white/[0.02]">
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
      <div className="shrink-0 bg-[hsl(0,0%,8%)] border-t border-white/[0.08]">
        {/* Scrubber */}
        <div
          className="h-2 bg-white/[0.04] cursor-pointer group relative mx-3 mt-1.5 rounded-full overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onTimeChange(Math.max(0, Math.min(duration, pct * duration)));
          }}
        >
          {clipMarkers.map((m) => (
            <div key={m.id} className="absolute top-0 bottom-0 w-px bg-white/10 z-10" style={{ left: `${m.position}%` }} />
          ))}
          <div
            className="h-full bg-gradient-to-r from-white/40 to-white/70 rounded-full transition-all duration-75 relative z-20"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2" />
          </div>
        </div>

        {/* Controls — WHITE BUTTONS */}
        <div className="h-11 flex items-center gap-0.5 px-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all" onClick={() => onTimeChange(0)}>
                <SkipBack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">Start</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all" onClick={jumpToPrevClip}>
                <FrameBack className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">Prev Clip</TooltipContent>
          </Tooltip>

          {/* Play/Pause — White filled button */}
          <button
            className="h-10 w-10 rounded-xl bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all mx-0.5 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all" onClick={jumpToNextClip}>
                <FrameForward className="h-2.5 w-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">Next Clip</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all" onClick={() => onTimeChange(duration)}>
                <SkipForward className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">End</TooltipContent>
          </Tooltip>

          <div className="h-5 w-px bg-white/[0.08] mx-1.5" />

          {/* Timecode */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-1.5 border border-white/[0.06]">
            <span className="text-[12px] font-mono text-white tabular-nums tracking-wider">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/15 mx-0.5">/</span>
            <span className="text-[12px] font-mono text-white/30 tabular-nums tracking-wider">
              {formatTime(duration)}
            </span>
          </div>

          {activeVideoClip && (
            <div className="ml-2 px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
              <span className="text-[9px] text-white/50 font-medium truncate max-w-[100px] block">
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
                className={cn("h-7 w-7 rounded-lg transition-all", isLooping ? "text-white bg-white/[0.12]" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
                onClick={() => setIsLooping(!isLooping)}
              >
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">Loop <kbd className="ml-1 text-white/30">L</kbd></TooltipContent>
          </Tooltip>

          {/* Speed */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("h-7 px-2.5 text-[11px] font-mono gap-1.5 rounded-lg transition-all", playbackSpeed !== 1 ? "text-white bg-white/[0.1]" : "text-white/50 hover:text-white hover:bg-white/[0.06]")}>
                <Gauge className="h-3.5 w-3.5" />
                {playbackSpeed}x
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-2 bg-[hsl(0,0%,10%)] border-white/10">
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {SPEED_PRESETS.map((speed) => (
                  <Button
                    key={speed}
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2.5 text-[10px] font-mono rounded-md transition-all",
                      playbackSpeed === speed ? "bg-white text-black font-bold" : "text-white/40 hover:text-white hover:bg-white/[0.08]"
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
          <div className="flex items-center gap-1 ml-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
                  onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-3.5 w-3.5" /> :
                    volume > 50 ? <Volume2 className="h-3.5 w-3.5" /> : <Volume1 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] bg-[hsl(0,0%,12%)] border-white/10 text-white">{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
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
