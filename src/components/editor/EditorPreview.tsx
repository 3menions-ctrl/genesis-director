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
 * EditorPreview - Direct MP4 clip-by-clip playback
 * 
 * Uses direct <video> element with MP4 source URLs for reliable playback.
 * HLS blob-based playlists were removed because they fail silently when
 * referencing cross-origin MP4s from CDNs (Replicate, Supabase Storage).
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
  
  // Refs that mirror memo values — used inside event handlers to avoid stale closures
  const activeVideoClipRef = useRef<TimelineClip | null>(null);
  const sortedVideoClipsRef = useRef<TimelineClip[]>([]);

  // Keep ref in sync with prop
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

  // Check if the audio track is muted (controls embedded video audio)
  const audioTrackMuted = useMemo(() => {
    const audioTrack = tracks.find((t) => t.type === 'audio');
    return audioTrack?.muted ?? false;
  }, [tracks]);

  // Get the active audio clip's volume (for per-clip volume control)
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

      // Reset & load new source
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
        // Clear transition lock now that new clip is loaded
        isTransitioningRef.current = false;
        // Only auto-play if user has pressed play (use ref for fresh value)
        if (isPlayingRef.current) {
          safePlay(video).catch(() => {});
        }
        video.removeEventListener('canplay', handleReady);
        video.removeEventListener('loadeddata', handleReady);
      };
      video.addEventListener('canplay', handleReady);
      video.addEventListener('loadeddata', handleReady);

      // Fallback if events never fire
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
    // Only re-run when clip ID changes
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
      // Always set up a canplay fallback first, so if play() fails we retry
      const onReady = () => {
        if (!isPlayingRef.current) return;
        video.play().catch(() => {});
        video.removeEventListener('canplay', onReady);
      };
      video.addEventListener('canplay', onReady);
      onReadyCleanup = () => video.removeEventListener('canplay', onReady);

      // Attempt play immediately — works if video is already loaded
      video.play().catch(() => {
        // Silently fail — the canplay listener above will retry
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

  // ── Volume sync (combines UI volume, audio track mute, and per-clip volume) ──
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
  // Uses REFS not closure values to avoid stale closure bounce-back
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const clip = activeVideoClipRef.current;
    if (!video || !clip || !isPlayingRef.current || isScrubbing.current) return;
    
    // Skip timeupdate events while transitioning to prevent bounce-back
    if (isTransitioningRef.current) return;

    // Verify this video element is actually playing the clip we think it is
    // If activeClipIdRef doesn't match, we're in a stale state
    if (activeClipIdRef.current !== clip.id) return;

    const timelineTime = clip.start + video.currentTime - (clip.trimStart || 0);
    onTimeChange(timelineTime);

    // Auto-advance to next clip
    if (timelineTime >= clip.end - 0.05) {
      const clips = sortedVideoClipsRef.current;
      const nextClip = clips.find(c => c.start >= clip.end - 0.01);
      if (nextClip) {
        // Mark transitioning — cleared when new clip source loads
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
  // Minimal deps — all real values read from refs
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

  // Scrub handler — also clears transition lock since user is manually seeking
  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, pct * duration));
    isScrubbing.current = true;
    isTransitioningRef.current = false; // User override
    onTimeChange(newTime);
    setTimeout(() => { isScrubbing.current = false; }, 100);
  }, [duration, onTimeChange]);

  // Handle video ended event — advance to next clip
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
    <div className="h-full w-full flex flex-col bg-black overflow-hidden" style={{ contain: 'strict' }}>
      {/* Video viewport */}
      <div ref={containerRef} className="flex-1 relative min-h-0 overflow-hidden">
        {/* Cinematic ambient glow — deep violet + warm edge */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] rounded-full blur-[160px] opacity-60"
            style={{ background: 'radial-gradient(ellipse, hsl(263 70% 30% / 0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-[40%] blur-[100px] opacity-40"
            style={{ background: 'linear-gradient(to top, hsl(263 50% 20% / 0.15), transparent)' }} />
          {/* Film grain texture */}
          <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-5">
          {hasClips ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Direct MP4 video frame with live filter from active clip */}
              <div
                className="max-h-full max-w-full w-full h-full rounded-xl shadow-[0_8px_60px_rgba(0,0,0,0.9),0_0_80px_hsl(263_70%_30%/0.08)] overflow-hidden relative border border-white/[0.04]"
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
                
                {/* Cinematic letterbox — deep black bars for theater feel */}
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-20" />
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none z-20" />
                {/* Edge vignette */}
                <div className="absolute inset-0 pointer-events-none z-20" style={{ boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4)' }} />
              </div>
              
              {!activeVideoClip && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl z-20 backdrop-blur-sm">
                  <div className="text-center">
                    <span className="text-[12px] tracking-wider uppercase font-medium text-muted-foreground block">Gap in timeline</span>
                    <span className="text-[10px] text-muted-foreground/50 mt-1 block">Move the playhead over a clip</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 text-muted-foreground/40">
              <div className="w-20 h-20 rounded-3xl border border-border flex items-center justify-center bg-card relative">
                <Play className="w-8 h-8 ml-1" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent" />
              </div>
              <div className="text-center">
                <span className="text-[13px] tracking-wider uppercase font-medium block text-muted-foreground">No clip at playhead</span>
                <span className="text-[10px] text-muted-foreground/40 mt-1.5 block">Move the playhead over a clip to preview</span>
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

      {/* Transport bar — cinematic dark glass */}
      <div className="shrink-0 bg-black/90 backdrop-blur-2xl border-t border-white/[0.03]">
        {/* Cinematic accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        
        {/* Scrubber — cinematic progress bar */}
        <div
          className="h-1.5 bg-white/[0.04] cursor-pointer group relative mx-5 mt-3 rounded-full overflow-hidden"
          onClick={handleScrub}
        >
          {clipMarkers.map((m) => (
            <div key={m.id} className="absolute top-0 bottom-0 w-px bg-white/[0.06] z-10" style={{ left: `${m.position}%` }} />
          ))}
          <div
            className="h-full bg-gradient-to-r from-primary/80 via-primary to-primary/60 rounded-full transition-all duration-75 relative z-20"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer effect on progress */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-cinema-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5),0_0_6px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 transition-all translate-x-1/2 border border-white/80 scale-0 group-hover:scale-100" />
          </div>
        </div>

        {/* Controls */}
        <div className="h-14 flex items-center gap-1.5 px-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/25 hover:text-white/70 hover:bg-white/[0.04] rounded-xl transition-all" onClick={() => onTimeChange(0)}>
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">Start</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/25 hover:text-white/70 hover:bg-white/[0.04] rounded-xl transition-all" onClick={jumpToPrevClip}>
                <FrameBack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">Prev Clip</TooltipContent>
          </Tooltip>

          {/* Play/Pause — Cinematic glowing button */}
          <button
            className="h-12 w-12 rounded-2xl bg-white text-black hover:bg-white/95 flex items-center justify-center transition-all duration-200 mx-2 shadow-[0_0_40px_rgba(255,255,255,0.15),0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25),0_8px_30px_rgba(0,0,0,0.5)] hover:scale-[1.08] active:scale-95"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/25 hover:text-white/70 hover:bg-white/[0.04] rounded-xl transition-all" onClick={jumpToNextClip}>
                <FrameForward className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">Next Clip</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/25 hover:text-white/70 hover:bg-white/[0.04] rounded-xl transition-all" onClick={() => onTimeChange(duration)}>
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">End</TooltipContent>
          </Tooltip>

          <div className="h-5 w-px bg-white/[0.06] mx-3" />

          {/* Timecode display — cinematic monospace */}
          <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-4 py-2 border border-white/[0.04]">
            <span className="text-[14px] font-mono text-white/90 tabular-nums tracking-[0.08em] font-medium">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/15 mx-0.5">/</span>
            <span className="text-[12px] font-mono text-white/30 tabular-nums tracking-[0.08em]">
              {formatTime(duration)}
            </span>
          </div>

          {activeVideoClip && (
            <div className="ml-3 px-3 py-1.5 rounded-lg bg-primary/[0.06] border border-primary/[0.10]">
              <span className="text-[9px] text-primary/80 font-medium truncate max-w-[100px] block tracking-wide">
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
                className={cn("h-8 w-8 rounded-xl transition-all", isLooping ? "text-primary bg-primary/10" : "text-white/20 hover:text-white/60 hover:bg-white/[0.04]")}
                onClick={() => setIsLooping(!isLooping)}
              >
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">Loop <kbd className="ml-1 text-white/30">L</kbd></TooltipContent>
          </Tooltip>

          {/* Speed */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("h-8 px-3 text-[11px] font-mono gap-1.5 rounded-xl transition-all", playbackSpeed !== 1 ? "text-primary bg-primary/10" : "text-white/20 hover:text-white/60 hover:bg-white/[0.04]")}>
                <Gauge className="h-3.5 w-3.5" />
                {playbackSpeed}x
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-2 bg-[#111115]/95 backdrop-blur-2xl border-white/[0.06] rounded-xl shadow-2xl shadow-black/70">
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {SPEED_PRESETS.map((speed) => (
                  <Button key={speed} variant="ghost" size="sm"
                    className={cn("h-7 px-2.5 text-[10px] font-mono rounded-lg transition-all",
                      playbackSpeed === speed ? "bg-white text-black font-bold" : "text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/20 hover:text-white/60 hover:bg-white/[0.04] rounded-xl transition-all"
                  onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-3.5 w-3.5" /> :
                    volume > 50 ? <Volume2 className="h-3.5 w-3.5" /> : <Volume1 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] bg-[#1a1a1f] border-white/[0.06] text-white/80 rounded-lg">{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
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
