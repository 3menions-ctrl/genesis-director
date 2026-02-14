import { useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineTrack } from "./types";

interface EditorPreviewProps {
  tracks: TimelineTrack[];
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onTimeChange: (time: number) => void;
  duration: number;
}

export const EditorPreview = ({
  tracks,
  currentTime,
  isPlaying,
  onPlayPause,
  onTimeChange,
  duration,
}: EditorPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

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
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      onTimeChange(Math.min(currentTime + delta, duration));
      if (currentTime + delta < duration) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentTime, duration, onTimeChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoClip) return;

    if (video.src !== activeVideoClip.sourceUrl) {
      video.src = activeVideoClip.sourceUrl;
    }

    const clipLocalTime = currentTime - activeVideoClip.start;
    if (Math.abs(video.currentTime - clipLocalTime) > 0.3) {
      video.currentTime = clipLocalTime;
    }

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [activeVideoClip, currentTime, isPlaying]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * 30);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-surface-1">
      {/* Video viewport */}
      <div className="flex-1 flex items-center justify-center bg-background relative overflow-hidden">
        {activeVideoClip ? (
          <video
            ref={videoRef}
            className="max-h-full max-w-full object-contain"
            muted
            playsInline
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
            <Play className="w-10 h-10" />
            <span className="text-xs tracking-wide">No clip at playhead</span>
          </div>
        )}

        {/* Text overlays */}
        {activeTextClips.map((clip) => (
          <div
            key={clip.id}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <span
              style={{
                fontSize: clip.textStyle?.fontSize || 48,
                color: clip.textStyle?.color || "#FFFFFF",
                fontWeight: (clip.textStyle?.fontWeight as any) || "bold",
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {clip.textContent || ""}
            </span>
          </div>
        ))}
      </div>

      {/* Transport bar */}
      <div className="bg-surface-2 border-t border-border">
        {/* Scrubber track */}
        <div
          className="h-1 bg-surface-3 cursor-pointer group relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onTimeChange(Math.max(0, Math.min(duration, pct * duration)));
          }}
        >
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            style={{ left: `${progress}%`, marginLeft: -5 }}
          />
        </div>

        {/* Controls */}
        <div className="h-10 flex items-center gap-1 px-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-surface-3"
            onClick={() => onTimeChange(0)}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-foreground hover:bg-surface-3"
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-surface-3"
            onClick={() => onTimeChange(duration)}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-border mx-1.5" />

          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[11px] text-muted-foreground/40 mx-1">/</span>
          <span className="text-[11px] font-mono text-muted-foreground/60 tabular-nums">
            {formatTime(duration)}
          </span>

          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
};
