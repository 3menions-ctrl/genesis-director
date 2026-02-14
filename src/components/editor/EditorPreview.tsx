import { useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
    <div className="h-full flex flex-col bg-[hsl(260,15%,5%)]">
      {/* Video viewport with letterbox */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, hsl(260 15% 3% / 0.6) 100%)'
        }} />

        {activeVideoClip ? (
          <video
            ref={videoRef}
            className="max-h-full max-w-full object-contain relative z-0"
            muted
            playsInline
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/20">
            <div className="w-14 h-14 rounded-xl border border-white/[0.06] flex items-center justify-center bg-white/[0.02]">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <span className="text-[11px] tracking-wider uppercase font-medium">No clip at playhead</span>
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

        {/* Safe area indicator (16:9) */}
        <div className="absolute inset-4 border border-dashed border-white/[0.04] rounded pointer-events-none z-10 opacity-0 hover:opacity-100 transition-opacity" />
      </div>

      {/* Transport bar */}
      <div className="bg-[hsl(260,15%,8%)] border-t border-white/[0.06]">
        {/* Scrubber track */}
        <div
          className="h-1.5 bg-white/[0.04] cursor-pointer group relative mx-2 mt-1 rounded-full overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onTimeChange(Math.max(0, Math.min(duration, pct * duration)));
          }}
        >
          {/* Buffered indicator */}
          <div className="absolute inset-0 bg-white/[0.04] rounded-full" />
          {/* Progress */}
          <div
            className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-75 relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_hsl(263,70%,60%,0.5)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2" />
          </div>
        </div>

        {/* Controls */}
        <div className="h-10 flex items-center gap-0.5 px-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all"
                onClick={() => onTimeChange(0)}
              >
                <SkipBack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/[0.08] rounded-lg transition-all mx-0.5"
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
            className="h-7 w-7 text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-md transition-all"
            onClick={() => onTimeChange(duration)}
          >
            <SkipForward className="h-3 w-3" />
          </Button>

          <div className="h-4 w-px bg-white/[0.06] mx-2" />

          {/* Timecode display */}
          <div className="flex items-center gap-1 bg-black/30 rounded px-2 py-0.5 border border-white/[0.04]">
            <span className="text-[11px] font-mono text-primary/90 tabular-nums tracking-wider">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/15 mx-0.5">/</span>
            <span className="text-[11px] font-mono text-white/30 tabular-nums tracking-wider">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/20 hover:text-white/50 hover:bg-white/[0.06] rounded transition-all"
          >
            <Volume2 className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white/20 hover:text-white/50 hover:bg-white/[0.06] rounded transition-all"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
