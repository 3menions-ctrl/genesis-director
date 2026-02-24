/**
 * VideoPreviewPlayer — Native HTML5 video player synced to custom timeline.
 * Features: seekable progress bar, loop toggle, go-to-start/end, playback rate display.
 */

import { useEffect, useRef, useCallback, useState, memo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Repeat, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTimeline, TimelineClip } from "@/hooks/useCustomTimeline";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function findActiveClip(
  tracks: { clips: TimelineClip[] }[],
  time: number
): { clip: TimelineClip; trackIndex: number } | null {
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    for (const clip of track.clips) {
      if (clip.type === "video" && clip.start <= time && clip.end > time && clip.src) {
        return { clip, trackIndex: i };
      }
    }
  }
  for (let i = 0; i < tracks.length; i++) {
    for (const clip of tracks[i].clips) {
      if (clip.type === "video" && clip.src) {
        return { clip, trackIndex: i };
      }
    }
  }
  return null;
}

export const VideoPreviewPlayer = memo(function VideoPreviewPlayer({
  className,
}: {
  className?: string;
}) {
  const { state, dispatch } = useCustomTimeline();
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const lastClipIdRef = useRef<string | null>(null);

  const active = findActiveClip(state.tracks, state.playheadTime);

  // Load clip source when active clip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.clip.src) return;
    if (lastClipIdRef.current === active.clip.id) return;

    lastClipIdRef.current = active.clip.id;
    video.src = active.clip.src;
    video.load();

    const offset = state.playheadTime - active.clip.start + active.clip.trimStart;
    video.currentTime = Math.max(0, offset);
  }, [active?.clip.id, active?.clip.src]);

  // Sync playhead → video currentTime when scrubbing (not playing)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.clip || state.isPlaying) return;

    const offset = state.playheadTime - active.clip.start + active.clip.trimStart;
    if (Math.abs(video.currentTime - offset) > 0.1) {
      video.currentTime = Math.max(0, offset);
    }
  }, [state.playheadTime, state.isPlaying]);

  // Play/pause sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (state.isPlaying && active?.clip) {
      video.play().catch(() => {});

      const tick = () => {
        if (!videoRef.current || !active?.clip) return;
        const clipTime = videoRef.current.currentTime - active.clip.trimStart + active.clip.start;
        dispatch({ type: "SET_PLAYHEAD", time: clipTime });
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state.isPlaying, active?.clip?.id]);

  const handleEnded = useCallback(() => {
    const allClips = state.tracks
      .flatMap((t) => t.clips)
      .filter((c) => c.type === "video" && c.src)
      .sort((a, b) => a.start - b.start);

    const currentIdx = allClips.findIndex((c) => c.id === active?.clip.id);
    if (currentIdx >= 0 && currentIdx < allClips.length - 1) {
      const next = allClips[currentIdx + 1];
      dispatch({ type: "SET_PLAYHEAD", time: next.start });
    } else if (state.isLooping) {
      dispatch({ type: "SET_PLAYHEAD", time: 0 });
    } else {
      dispatch({ type: "SET_PLAYING", playing: false });
    }
  }, [state.tracks, active?.clip?.id, state.isLooping, dispatch]);

  const togglePlay = useCallback(() => {
    dispatch({ type: "SET_PLAYING", playing: !state.isPlaying });
  }, [state.isPlaying, dispatch]);

  const skipClip = useCallback((dir: -1 | 1) => {
    const allClips = state.tracks
      .flatMap((t) => t.clips)
      .filter((c) => c.type === "video" && c.src)
      .sort((a, b) => a.start - b.start);

    const currentIdx = allClips.findIndex((c) => c.id === active?.clip.id);
    const nextIdx = currentIdx + dir;
    if (nextIdx >= 0 && nextIdx < allClips.length) {
      dispatch({ type: "SET_PLAYHEAD", time: allClips[nextIdx].start });
    }
  }, [state.tracks, active?.clip?.id, dispatch]);

  const goToStart = useCallback(() => {
    dispatch({ type: "SET_PLAYHEAD", time: 0 });
  }, [dispatch]);

  const goToEnd = useCallback(() => {
    dispatch({ type: "SET_PLAYHEAD", time: state.duration });
  }, [state.duration, dispatch]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const handleVolumeChange = useCallback(([v]: number[]) => {
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v / 100;
      if (v > 0 && videoRef.current.muted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, []);

  const toggleLoop = useCallback(() => {
    dispatch({ type: "SET_LOOP", looping: !state.isLooping });
  }, [state.isLooping, dispatch]);

  const toggleFullscreen = useCallback(() => {
    videoRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  // Seekable progress bar
  const handleSeek = useCallback(([v]: number[]) => {
    dispatch({ type: "SET_PLAYHEAD", time: v });
  }, [dispatch]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const hasClips = state.tracks.some((t) => t.clips.some((c) => c.type === "video" && c.src));
  const progress = state.duration > 0 ? (state.playheadTime / state.duration) * 100 : 0;

  return (
    <div className={cn("flex flex-col bg-[hsl(240,28%,4%)] overflow-hidden", className)}>
      {/* Video area */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black relative">
        {!hasClips ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30 select-none">
            <Play className="w-10 h-10" />
            <p className="text-xs">Add clips to the timeline to preview</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="max-w-full max-h-full object-contain"
            muted={isMuted}
            playsInline
            onEnded={handleEnded}
          />
        )}

        {/* Aspect ratio badge */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/50 text-[9px] text-muted-foreground/50 font-mono">
          {state.aspectRatio}
        </div>
      </div>

      {/* Seekable progress bar */}
      <div className="shrink-0 px-3 pt-1" style={{ background: 'hsl(240, 25%, 5%)' }}>
        <Slider
          value={[state.playheadTime]}
          onValueChange={handleSeek}
          min={0}
          max={Math.max(state.duration, 0.1)}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Transport bar */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 h-9"
        style={{
          background: 'hsl(240, 25%, 5%)',
          borderTop: '1px solid hsla(263, 84%, 58%, 0.05)',
        }}
      >
        {/* Go to start */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={goToStart} className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Go to start (Home)</TooltipContent>
        </Tooltip>

        <button onClick={() => skipClip(-1)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button onClick={togglePlay} className="text-foreground hover:text-primary transition-colors">
          {state.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button onClick={() => skipClip(1)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Go to end */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={goToEnd} className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Go to end (End)</TooltipContent>
        </Tooltip>

        {/* Timecode */}
        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums min-w-[80px]">
          {formatTime(state.playheadTime)} / {formatTime(state.duration)}
        </span>

        <div className="flex-1" />

        {/* Loop toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleLoop}
              className={cn(
                "transition-colors p-0.5 rounded",
                state.isLooping
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground/40 hover:text-foreground"
              )}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">
            {state.isLooping ? "Loop: ON" : "Loop: OFF"}
          </TooltipContent>
        </Tooltip>

        {/* Volume with hover slider */}
        <div
          className="relative flex items-center"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button onClick={toggleMute} className="text-muted-foreground/50 hover:text-foreground transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          {showVolumeSlider && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border/20 rounded-lg p-2 shadow-xl w-8 h-24">
              <Slider
                orientation="vertical"
                value={[volume]}
                onValueChange={handleVolumeChange}
                min={0}
                max={100}
                step={1}
                className="h-full"
              />
            </div>
          )}
        </div>

        <button onClick={toggleFullscreen} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
