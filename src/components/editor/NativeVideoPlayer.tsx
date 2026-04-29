/**
 * NativeVideoPlayer — replaces the SDK canvas with a standard HTML5 <video> player.
 * Reads clips from the timeline context and plays the active one based on playhead position.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineClip {
  id: string;
  src: string;
  start: number; // seconds on timeline
  end: number;   // seconds on timeline
  name?: string;
}

interface NativeVideoPlayerProps {
  /** Timeline context's `present` object (ProjectJSON) */
  timelineData: any;
  className?: string;
}

function extractClipsFromTimeline(present: any): TimelineClip[] {
  if (!present?.tracks) return [];
  const clips: TimelineClip[] = [];
  for (const track of present.tracks) {
    for (const el of track.elements || []) {
      if (el.type === "video" && el.props?.src) {
        clips.push({
          id: el.id || `${el.s}-${el.e}`,
          src: el.props.src,
          start: el.s ?? 0,
          end: el.e ?? (el.s + 6),
          name: el.props?.name || el.name,
        });
      }
    }
  }
  return clips.sort((a, b) => a.start - b.start);
}

export function NativeVideoPlayer({ timelineData, className }: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeClipIndex, setActiveClipIndex] = useState(0);

  const clips = useMemo(() => extractClipsFromTimeline(timelineData), [timelineData]);
  const activeClip = clips[activeClipIndex] || null;
  const totalDuration = clips.length > 0
    ? Math.max(...clips.map(c => c.end))
    : 0;

  // Switch clip source when activeClipIndex changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    video.src = activeClip.src;
    video.load();
    if (isPlaying) {
      video.play().catch(() => {});
    }
  }, [activeClipIndex, activeClip?.src]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, activeClip]);

  const skipNext = useCallback(() => {
    if (activeClipIndex < clips.length - 1) {
      setActiveClipIndex(prev => prev + 1);
    }
  }, [activeClipIndex, clips.length]);

  const skipPrev = useCallback(() => {
    if (activeClipIndex > 0) {
      setActiveClipIndex(prev => prev - 1);
    }
  }, [activeClipIndex]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const handleEnded = useCallback(() => {
    // Auto-advance to next clip
    if (activeClipIndex < clips.length - 1) {
      setActiveClipIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [activeClipIndex, clips.length]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen().catch(() => {});
    }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Empty state
  if (clips.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-[hsl(240,28%,4%)] text-muted-foreground/40 select-none",
        className
      )}>
        <Play className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-xs">Drag clips to the timeline to preview</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col overflow-hidden", className)} style={{ background: 'hsl(220, 14%, 3%)' }}>
      {/* Video area */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative" style={{ background: 'hsl(0, 0%, 1.5%)' }}>
        <video
          ref={videoRef}
          className="max-w-full max-h-full object-contain"
          muted={isMuted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {/* Transport controls */}
      <div
        className="shrink-0 flex items-center gap-3 px-5 h-11"
        style={{
          background: 'linear-gradient(180deg, hsla(220,14%,6%,0.85) 0%, hsla(220,14%,3%,0.92) 100%)',
          backdropFilter: 'blur(48px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
        }}
      >
        {/* Clip nav */}
        <button onClick={skipPrev} disabled={activeClipIndex === 0} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.05] disabled:opacity-20 transition-all duration-300">
          <SkipBack className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-[1.06] active:scale-95"
          style={{
            background: isPlaying
              ? 'hsla(0,0%,100%,0.06)'
              : 'linear-gradient(135deg, hsla(215,100%,62%,0.95) 0%, hsla(215,100%,52%,0.95) 100%)',
            color: isPlaying ? 'hsla(0,0%,100%,0.9)' : 'hsl(0,0%,100%)',
            boxShadow: isPlaying
              ? 'inset 0 0 0 1px hsla(0,0%,100%,0.08)'
              : 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 0 20px hsla(215,100%,55%,0.4)',
          }}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" strokeWidth={1.8} /> : <Play className="w-3.5 h-3.5 ml-0.5" strokeWidth={1.8} fill="currentColor" />}
        </button>
        <button onClick={skipNext} disabled={activeClipIndex === clips.length - 1} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.05] disabled:opacity-20 transition-all duration-300">
          <SkipForward className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {/* Time display */}
        <span className="text-[10px] font-mono font-light text-muted-foreground/55 tabular-nums tracking-[0.06em] min-w-[90px]">
          {formatTime(currentTime)} / {activeClip ? formatTime(activeClip.end - activeClip.start) : "0:00"}
        </span>

        {/* Clip indicator */}
        <span className="text-[10px] font-light tracking-[0.14em] uppercase text-muted-foreground/40 truncate flex-1 text-center">
          {activeClip?.name || `Clip ${activeClipIndex + 1}`} — {activeClipIndex + 1}/{clips.length}
        </span>

        {/* Volume + Fullscreen */}
        <button onClick={toggleMute} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.05] transition-all duration-300">
          {isMuted ? <VolumeX className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
        </button>
        <button onClick={toggleFullscreen} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/45 hover:text-foreground hover:bg-white/[0.05] transition-all duration-300">
          <Maximize className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
