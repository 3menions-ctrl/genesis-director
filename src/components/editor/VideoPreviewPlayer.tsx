/**
 * VideoPreviewPlayer — Premium CapCut-style video preview
 * Refined transport controls, elegant seek bar, cinematic empty state
 */

import { useEffect, useRef, useCallback, useState, memo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Repeat, ChevronsLeft, ChevronsRight, MonitorPlay
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

  const handleSeek = useCallback(([v]: number[]) => {
    dispatch({ type: "SET_PLAYHEAD", time: v });
  }, [dispatch]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const hasClips = state.tracks.some((t) => t.clips.some((c) => c.type === "video" && c.src));

  return (
    <div className={cn("flex flex-col overflow-hidden", className)} style={{ background: 'hsl(240 28% 3%)' }}>
      {/* Video area */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative" style={{ background: 'hsl(0 0% 3%)' }}>
        {!hasClips ? (
          <div className="flex flex-col items-center gap-4 text-muted-foreground/20 select-none">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'hsla(263, 70%, 58%, 0.06)', border: '1px solid hsla(263, 70%, 58%, 0.08)' }}
            >
              <MonitorPlay className="w-9 h-9" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[13px] font-medium text-muted-foreground/30">Preview</p>
              <p className="text-[11px] text-muted-foreground/20">Add clips to the timeline to start</p>
            </div>
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
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-mono font-medium backdrop-blur-md"
          style={{ background: 'hsla(0,0%,0%,0.5)', color: 'hsla(0,0%,100%,0.4)', border: '1px solid hsla(255,255,255,0.06)' }}
        >
          {state.aspectRatio}
        </div>
      </div>

      {/* Seek bar + Transport */}
      <div
        className="shrink-0"
        style={{
          background: 'linear-gradient(180deg, hsl(240 20% 6%) 0%, hsl(240 25% 5%) 100%)',
          borderTop: '1px solid hsla(263, 70%, 58%, 0.06)',
        }}
      >
        {/* Seek slider */}
        <div className="px-4 pt-2 pb-1">
          <Slider
            value={[state.playheadTime]}
            onValueChange={handleSeek}
            min={0}
            max={Math.max(state.duration, 0.1)}
            step={0.05}
            className="w-full"
          />
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-1 px-4 h-10">
          {/* Left: transport buttons */}
          <div className="flex items-center gap-0.5">
            <TransportButton onClick={goToStart} tooltip="Start (Home)">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </TransportButton>
            <TransportButton onClick={() => skipClip(-1)} tooltip="Previous clip">
              <SkipBack className="w-3.5 h-3.5" />
            </TransportButton>

            {/* Play button — hero element */}
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: state.isPlaying
                  ? 'hsla(263, 70%, 58%, 0.15)'
                  : 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 70% 55%))',
                border: state.isPlaying
                  ? '1px solid hsla(263, 70%, 58%, 0.25)'
                  : '1px solid hsla(263, 70%, 58%, 0.3)',
                color: state.isPlaying ? 'hsl(var(--primary))' : 'white',
                boxShadow: state.isPlaying ? 'none' : '0 2px 12px hsla(263, 70%, 58%, 0.25)',
              }}
            >
              {state.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <TransportButton onClick={() => skipClip(1)} tooltip="Next clip">
              <SkipForward className="w-3.5 h-3.5" />
            </TransportButton>
            <TransportButton onClick={goToEnd} tooltip="End (End)">
              <ChevronsRight className="w-3.5 h-3.5" />
            </TransportButton>
          </div>

          {/* Center: timecode */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg"
              style={{ background: 'hsla(0,0%,100%,0.03)', border: '1px solid hsla(0,0%,100%,0.04)' }}
            >
              <span className="text-[11px] font-mono font-semibold text-foreground/70 tabular-nums tracking-tight">
                {formatTime(state.playheadTime)}
              </span>
              <span className="text-[9px] text-muted-foreground/25">/</span>
              <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                {formatTime(state.duration)}
              </span>
            </div>
          </div>

          {/* Right: utility controls */}
          <div className="flex items-center gap-0.5">
            <TransportButton
              onClick={toggleLoop}
              tooltip={state.isLooping ? "Loop: ON" : "Loop: OFF"}
              active={state.isLooping}
            >
              <Repeat className="w-3.5 h-3.5" />
            </TransportButton>

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <TransportButton onClick={toggleMute} tooltip={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </TransportButton>
              {showVolumeSlider && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-xl p-2.5 shadow-2xl w-9 h-28"
                  style={{
                    background: 'hsl(240 20% 8%)',
                    border: '1px solid hsla(263, 70%, 58%, 0.12)',
                  }}
                >
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

            <TransportButton onClick={toggleFullscreen} tooltip="Fullscreen">
              <Maximize className="w-3.5 h-3.5" />
            </TransportButton>
          </div>
        </div>
      </div>
    </div>
  );
});

/** Reusable transport button */
function TransportButton({
  onClick,
  tooltip,
  active,
  children,
}: {
  onClick: () => void;
  tooltip: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150",
            active
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/45 hover:text-foreground/80 hover:bg-white/[0.04]"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
