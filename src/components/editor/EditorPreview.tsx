import { useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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

  // Find the active video clip at currentTime
  const activeVideoClip = tracks
    .filter((t) => t.type === "video")
    .flatMap((t) => t.clips)
    .find((c) => currentTime >= c.start && currentTime < c.end);

  // Find active text overlays at currentTime
  const activeTextClips = tracks
    .filter((t) => t.type === "text")
    .flatMap((t) => t.clips)
    .filter((c) => currentTime >= c.start && currentTime < c.end);

  // Playback timer
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

  // Sync video element with currentTime
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Video viewport */}
      <div className="flex-1 flex items-center justify-center bg-muted/30 relative overflow-hidden">
        {activeVideoClip ? (
          <video
            ref={videoRef}
            className="max-h-full max-w-full object-contain"
            muted
            playsInline
          />
        ) : (
          <div className="text-muted-foreground text-sm">
            No clip at current time
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
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              {clip.textContent || ""}
            </span>
          </div>
        ))}
      </div>

      {/* Transport controls */}
      <div className="h-12 border-t border-border flex items-center gap-3 px-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onTimeChange(0)}>
          <SkipBack className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onPlayPause}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onTimeChange(duration)}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>

        <span className="text-xs font-mono text-muted-foreground w-24">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.033}
          onValueChange={([v]) => onTimeChange(v)}
          className="flex-1"
        />
      </div>
    </div>
  );
};
