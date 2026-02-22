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
import { EFFECT_PRESETS, FILTER_PRESETS } from "./types";
import { cn } from "@/lib/utils";
import { safePlay } from "@/lib/video/safeVideoOperations";

/**
 * EditorPreview - Organic Fluid Design
 * Bioluminescent aurora aesthetic with green-purple-cyan palette
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeClipIdRef = useRef<string | null>(null);
  const isScrubbing = useRef(false);
  const isTransitioningRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  
  const activeVideoClipRef = useRef<TimelineClip | null>(null);
  const sortedVideoClipsRef = useRef<TimelineClip[]>([]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // ── Derived clip data ──
  const sortedVideoClips = useMemo(() => {
    const sorted = tracks
      .filter((t) => t.type === 'video')
      .flatMap((t) => t.clips)
      .sort((a, b) => a.start - b.start);
    sortedVideoClipsRef.current = sorted;
    return sorted;
  }, [tracks]);

  const activeVideoClip = useMemo(() => {
    const clip = sortedVideoClips.find((c) => currentTime >= c.start && currentTime < c.end) || null;
    activeVideoClipRef.current = clip;
    return clip;
  }, [sortedVideoClips, currentTime]);

  const activeTextClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === 'text')
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.start && currentTime < c.end);
  }, [tracks, currentTime]);

  const audioTrackMuted = useMemo(() => {
    const audioTrack = tracks.find((t) => t.type === 'audio');
    return audioTrack?.muted ?? false;
  }, [tracks]);

  const activeAudioClipVolume = useMemo(() => {
    const audioTrack = tracks.find((t) => t.type === 'audio');
    if (!audioTrack) return 100;
    const activeAudio = audioTrack.clips.find(
      (c) => currentTime >= c.start && currentTime < c.end
    );
    return activeAudio?.volume ?? 100;
  }, [tracks, currentTime]);

  // ── Load new clip source when active clip changes ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip) {
      activeClipIdRef.current = null;
      return;
    }

    if (activeClipIdRef.current !== activeVideoClip.id) {
      activeClipIdRef.current = activeVideoClip.id;
      const src = activeVideoClip.sourceUrl;
      console.log('[EditorPreview] Loading clip:', activeVideoClip.label, src?.substring(0, 80));

      video.pause();
      video.crossOrigin = 'anonymous';
      video.src = src;
      video.preload = 'auto';
      video.load();

      const localTime = currentTime - activeVideoClip.start + (activeVideoClip.trimStart || 0);
      const clipId = activeVideoClip.id;

      const handleReady = () => {
        if (activeClipIdRef.current !== clipId) return;
        video.currentTime = Math.max(0, localTime);
        isTransitioningRef.current = false;
        if (isPlayingRef.current) {
          safePlay(video).catch(() => {});
        }
        video.removeEventListener('canplay', handleReady);
        video.removeEventListener('loadeddata', handleReady);
      };
      video.addEventListener('canplay', handleReady);
      video.addEventListener('loadeddata', handleReady);

      const fallback = setTimeout(() => {
        if (activeClipIdRef.current !== clipId) return;
        video.removeEventListener('canplay', handleReady);
        video.removeEventListener('loadeddata', handleReady);
        isTransitioningRef.current = false;
        if (video.readyState >= 1) {
          video.currentTime = Math.max(0, localTime);
          if (isPlayingRef.current) {
            safePlay(video).catch(() => {});
          }
        }
      }, 3000);

      return () => {
        clearTimeout(fallback);
        video.removeEventListener('canplay', handleReady);
        video.removeEventListener('loadeddata', handleReady);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoClip?.id]);

  // ── Sync scrub position ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip || isPlaying) return;
    if (activeClipIdRef.current !== activeVideoClip.id) return;

    const localTime = currentTime - activeVideoClip.start + (activeVideoClip.trimStart || 0);
    const diff = Math.abs(video.currentTime - localTime);
    if (diff > 0.1) {
      video.currentTime = Math.max(0, localTime);
    }
  }, [currentTime, activeVideoClip, isPlaying]);

  // ── Play/pause sync ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let onReadyCleanup: (() => void) | null = null;
    
    if (isPlaying) {
      const onReady = () => {
        if (!isPlayingRef.current) return;
        video.play().catch(() => {});
        video.removeEventListener('canplay', onReady);
      };
      video.addEventListener('canplay', onReady);
      onReadyCleanup = () => video.removeEventListener('canplay', onReady);

      video.play().catch(() => {
        console.debug('[EditorPreview] Initial play deferred to canplay event');
      });
    } else {
      video.pause();
    }
    
    return () => {
      onReadyCleanup?.();
    };
  }, [isPlaying]);

  // ── Playback speed sync ──
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // ── Volume sync ──
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const clipVolScale = activeAudioClipVolume / 100;
      const uiVolScale = volume / 100;
      video.volume = Math.min(1, clipVolScale * uiVolScale);
      video.muted = isMuted || audioTrackMuted;
    }
  }, [volume, isMuted, audioTrackMuted, activeAudioClipVolume]);

  // ── Time update from video → timeline ──
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const clip = activeVideoClipRef.current;
    if (!video || !clip || !isPlayingRef.current || isScrubbing.current) return;
    if (isTransitioningRef.current) return;
    if (activeClipIdRef.current !== clip.id) return;

    const timelineTime = clip.start + video.currentTime - (clip.trimStart || 0);
    onTimeChange(timelineTime);

    if (timelineTime >= clip.end - 0.05) {
      const clips = sortedVideoClipsRef.current;
      const nextClip = clips.find(c => c.start >= clip.end - 0.01);
      if (nextClip) {
        isTransitioningRef.current = true;
        onTimeChange(nextClip.start);
      } else if (isLooping) {
        isTransitioningRef.current = true;
        onTimeChange(0);
      } else {
        onTimeChange(duration);
        onPlayPause();
      }
    }
  }, [onTimeChange, isLooping, duration, onPlayPause]);

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

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, pct * duration));
    isScrubbing.current = true;
    isTransitioningRef.current = false;
    onTimeChange(newTime);
    setTimeout(() => { isScrubbing.current = false; }, 100);
  }, [duration, onTimeChange]);

  const handleVideoEnded = useCallback(() => {
    const clip = activeVideoClipRef.current;
    if (!clip || !isPlayingRef.current) return;
    if (isTransitioningRef.current) return;

    const clips = sortedVideoClipsRef.current;
    const nextClip = clips.find(c => c.start >= clip.end - 0.01);
    if (nextClip) {
      isTransitioningRef.current = true;
      onTimeChange(nextClip.start);
    } else if (isLooping) {
      isTransitioningRef.current = true;
      onTimeChange(0);
    } else {
      onTimeChange(duration);
      onPlayPause();
    }
  }, [onTimeChange, isLooping, duration, onPlayPause]);

  return (
    <div className="h-full w-full flex flex-col bg-[#040d08] overflow-hidden" style={{ contain: 'strict' }}>
      {/* Video viewport */}
      <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
        {/* Bioluminescent ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
          <div className="absolute top-1/4 left-1/3 w-[40%] h-[40%] rounded-full bg-cyan-500/[0.02] blur-[80px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[30%] h-[30%] rounded-full bg-purple-500/[0.015] blur-[100px]" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-5">
          {hasClips ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <div
                className="max-h-full max-w-full w-full h-full rounded-3xl shadow-2xl shadow-emerald-900/30 overflow-hidden relative border border-emerald-400/[0.08]"
                style={{
                  filter: (() => {
                    if (!activeVideoClip?.filter) return undefined;
                    const effectPreset = EFFECT_PRESETS.find(e => e.id === activeVideoClip.filter);
                    if (effectPreset && 'css' in effectPreset && effectPreset.css && effectPreset.css !== 'none') return effectPreset.css;
                    const filterPreset = FILTER_PRESETS.find(f => f.id === activeVideoClip.filter);
                    if (filterPreset?.css) return filterPreset.css;
                    return undefined;
                  })(),
                  transform: (() => {
                    if (!activeVideoClip?.filter) return undefined;
                    const effectPreset = EFFECT_PRESETS.find(e => e.id === activeVideoClip.filter);
                    if (effectPreset && 'transform' in effectPreset) return (effectPreset as any).transform;
                    return undefined;
                  })(),
                  transition: 'filter 0.3s ease, transform 0.3s ease',
                }}
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain bg-black"
                  crossOrigin="anonymous"
                  playsInline
                  preload="auto"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  onError={(e) => {
                    const vid = e.currentTarget;
                    const err = vid?.error;
                    console.warn('[EditorPreview] Video error:', err?.code, err?.message, 'src:', vid?.src?.substring(0, 80));
                  }}
                />
                
                {/* Organic vignette */}
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-20" />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-20" />
              </div>
              
              {!activeVideoClip && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#040d08]/80 rounded-3xl z-20 backdrop-blur-sm">
                  <div className="text-center">
                    <span className="text-[12px] tracking-wider uppercase font-medium text-emerald-300/40 block">Gap in timeline</span>
                    <span className="text-[10px] text-emerald-400/20 mt-1 block">Move the playhead over a clip</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 text-emerald-400/30">
              <div className="w-20 h-20 rounded-3xl border border-emerald-400/10 flex items-center justify-center bg-emerald-400/[0.03] relative">
                <Play className="w-8 h-8 ml-1" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-emerald-400/[0.04] to-transparent" />
              </div>
              <div className="text-center">
                <span className="text-[13px] tracking-wider uppercase font-medium block text-emerald-300/30">No clip at playhead</span>
                <span className="text-[10px] text-emerald-400/15 mt-1.5 block">Move the playhead over a clip to preview</span>
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

      {/* Transport bar — Organic Fluid */}
      <div className="shrink-0 bg-[#060f0b]/90 backdrop-blur-xl border-t border-emerald-400/[0.08]">
        {/* Aurora accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/25 via-40% to-cyan-400/15 to-transparent" />
        
        {/* Scrubber */}
        <div
          className="h-3 bg-emerald-400/[0.04] cursor-pointer group relative mx-4 mt-2 rounded-full overflow-hidden border border-emerald-400/[0.06]"
          onClick={handleScrub}
        >
          {clipMarkers.map((m) => (
            <div key={m.id} className="absolute top-0 bottom-0 w-px bg-emerald-400/10 z-10" style={{ left: `${m.position}%` }} />
          ))}
          <div
            className="h-full bg-gradient-to-r from-emerald-400/50 via-cyan-400/60 to-purple-400/40 rounded-full transition-all duration-75 relative z-20"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.6)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2 border-2 border-emerald-200" />
          </div>
        </div>

        {/* Controls */}
        <div className="h-12 flex items-center gap-1 px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-xl transition-all" onClick={() => onTimeChange(0)}>
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">Start</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-xl transition-all" onClick={jumpToPrevClip}>
                <FrameBack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">Prev Clip</TooltipContent>
          </Tooltip>

          {/* Play/Pause — Bioluminescent orb */}
          <button
            className="h-11 w-11 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#040d08] hover:from-emerald-300 hover:to-cyan-300 flex items-center justify-center transition-all mx-1 shadow-[0_0_30px_rgba(52,211,153,0.2)] hover:shadow-[0_0_50px_rgba(52,211,153,0.35)] hover:scale-105 active:scale-95"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-xl transition-all" onClick={jumpToNextClip}>
                <FrameForward className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">Next Clip</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-xl transition-all" onClick={() => onTimeChange(duration)}>
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">End</TooltipContent>
          </Tooltip>

          <div className="h-5 w-px bg-emerald-400/10 mx-2" />

          {/* Timecode display */}
          <div className="flex items-center gap-2 bg-emerald-400/[0.04] rounded-xl px-4 py-2 border border-emerald-400/[0.08]">
            <span className="text-[13px] font-mono text-emerald-200/80 tabular-nums tracking-wider font-medium">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-emerald-400/20 mx-0.5">/</span>
            <span className="text-[12px] font-mono text-emerald-300/30 tabular-nums tracking-wider">
              {formatTime(duration)}
            </span>
          </div>

          {activeVideoClip && (
            <div className="ml-2 px-3 py-1 rounded-xl bg-emerald-400/[0.06] border border-emerald-400/[0.1]">
              <span className="text-[9px] text-emerald-300/60 font-medium truncate max-w-[100px] block">
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
                className={cn("h-8 w-8 rounded-xl transition-all", isLooping ? "text-emerald-300 bg-emerald-400/[0.12] shadow-[0_0_12px_rgba(52,211,153,0.1)]" : "text-emerald-300/25 hover:text-emerald-200/70 hover:bg-emerald-400/[0.08]")}
                onClick={() => setIsLooping(!isLooping)}
              >
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">Loop <kbd className="ml-1 text-emerald-300/40">L</kbd></TooltipContent>
          </Tooltip>

          {/* Speed */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("h-8 px-3 text-[11px] font-mono gap-1.5 rounded-xl transition-all", playbackSpeed !== 1 ? "text-emerald-300 bg-emerald-400/[0.12]" : "text-emerald-300/25 hover:text-emerald-200/70 hover:bg-emerald-400/[0.08]")}>
                <Gauge className="h-3.5 w-3.5" />
                {playbackSpeed}x
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-2 bg-[#0a1a14]/95 backdrop-blur-xl border-emerald-400/[0.12] rounded-2xl shadow-2xl shadow-emerald-900/30">
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {SPEED_PRESETS.map((speed) => (
                  <Button key={speed} variant="ghost" size="sm"
                    className={cn("h-7 px-2.5 text-[10px] font-mono rounded-xl transition-all",
                      playbackSpeed === speed ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#040d08] font-bold" : "text-emerald-300/40 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08]"
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-300/30 hover:text-emerald-200/80 hover:bg-emerald-400/[0.08] rounded-xl transition-all"
                  onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-3.5 w-3.5" /> :
                    volume > 50 ? <Volume2 className="h-3.5 w-3.5" /> : <Volume1 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] bg-[#0a1a14]/95 border-emerald-400/[0.12] text-emerald-100 rounded-xl">{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
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
