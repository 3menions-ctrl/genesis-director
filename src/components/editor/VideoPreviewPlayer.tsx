/**
 * VideoPreviewPlayer — Native HTML5 video player synced to custom timeline.
 * Shows the currently active clip based on playhead position.
 */

import { useEffect, useRef, useCallback, useState, memo } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTimeline, TimelineClip } from "@/hooks/useCustomTimeline";

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
  // If nothing at current time, return first video clip
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

    // Seek to correct position within clip
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

      // Drive playhead from video time
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
    // Find next clip
    const allClips = state.tracks
      .flatMap((t) => t.clips)
      .filter((c) => c.type === "video" && c.src)
      .sort((a, b) => a.start - b.start);

    const currentIdx = allClips.findIndex((c) => c.id === active?.clip.id);
    if (currentIdx >= 0 && currentIdx < allClips.length - 1) {
      const next = allClips[currentIdx + 1];
      dispatch({ type: "SET_PLAYHEAD", time: next.start });
    } else {
      dispatch({ type: "SET_PLAYING", playing: false });
    }
  }, [state.tracks, active?.clip?.id, dispatch]);

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

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    videoRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const hasClips = state.tracks.some((t) => t.clips.some((c) => c.type === "video" && c.src));

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
      </div>

      {/* Transport bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 h-10"
        style={{
          background: 'hsl(240, 25%, 5%)',
          borderTop: '1px solid hsla(263, 84%, 58%, 0.1)',
        }}
      >
        <button onClick={() => skipClip(-1)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button onClick={togglePlay} className="text-foreground hover:text-primary transition-colors">
          {state.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={() => skipClip(1)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <span className="text-xs text-muted-foreground/50 font-mono tabular-nums min-w-[90px]">
          {formatTime(state.playheadTime)} / {formatTime(state.duration)}
        </span>

        <div className="flex-1" />

        <button onClick={toggleMute} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={toggleFullscreen} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
