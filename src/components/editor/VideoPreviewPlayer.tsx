/**
 * VideoPreviewPlayer — Premium cinematic preview with GAPLESS playback
 * Uses dual <video> elements for zero-gap clip transitions.
 */

import { useEffect, useRef, useCallback, useState, memo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Repeat, ChevronsLeft, ChevronsRight, MonitorPlay, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomTimeline, TimelineClip } from "@/hooks/useCustomTimeline";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Get all media clips sorted by start time */
function getSortedMediaClips(tracks: { clips: TimelineClip[] }[]): { clip: TimelineClip; trackIndex: number }[] {
  const result: { clip: TimelineClip; trackIndex: number }[] = [];
  for (let i = 0; i < tracks.length; i++) {
    for (const clip of tracks[i].clips) {
      if ((clip.type === "video" || clip.type === "image") && clip.src) {
        result.push({ clip, trackIndex: i });
      }
    }
  }
  return result.sort((a, b) => a.clip.start - b.clip.start);
}

function findActiveClip(
  tracks: { clips: TimelineClip[] }[],
  time: number
): { clip: TimelineClip; trackIndex: number } | null {
  // Priority: video first, then image
  for (const type of ["video", "image"] as const) {
    for (let i = 0; i < tracks.length; i++) {
      for (const clip of tracks[i].clips) {
        if (clip.type === type && clip.start <= time && clip.end > time && clip.src) {
          return { clip, trackIndex: i };
        }
      }
    }
  }
  return null;
}

/** Find the next clip after the current one */
function findNextClip(
  tracks: { clips: TimelineClip[] }[],
  currentClipId: string
): { clip: TimelineClip; trackIndex: number } | null {
  const sorted = getSortedMediaClips(tracks);
  const idx = sorted.findIndex((c) => c.clip.id === currentClipId);
  if (idx >= 0 && idx < sorted.length - 1) {
    return sorted[idx + 1];
  }
  return null;
}

/** Build CSS filter string from clip color grading properties */
function buildCSSFilter(clip: TimelineClip): string {
  const b = (clip.brightness ?? 0) / 100;
  const c = (clip.contrast ?? 0) / 100;
  const s = (clip.saturation ?? 0) / 100;
  const parts: string[] = [];
  if (b !== 0) parts.push(`brightness(${1 + b})`);
  if (c !== 0) parts.push(`contrast(${1 + c})`);
  if (s !== 0) parts.push(`saturate(${1 + s})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

export const VideoPreviewPlayer = memo(function VideoPreviewPlayer({
  className,
}: {
  className?: string;
}) {
  const { state, dispatch } = useCustomTimeline();

  // Dual video elements for gapless transitions
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeSlot = useRef<"A" | "B">("A");
  const preloadedClipId = useRef<string | null>(null);

  const animFrameRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const lastClipIdRef = useRef<string | null>(null);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [activeVideoSlot, setActiveVideoSlot] = useState<"A" | "B">("A");

  const active = findActiveClip(state.tracks, state.playheadTime);
  const isTrackMuted = active ? state.tracks[active.trackIndex]?.muted : false;

  const getActiveVideo = useCallback(() => {
    return activeSlot.current === "A" ? videoARef.current : videoBRef.current;
  }, []);

  const getPreloadVideo = useCallback(() => {
    return activeSlot.current === "A" ? videoBRef.current : videoARef.current;
  }, []);

  // Preload next clip into the inactive video element
  const preloadNextClip = useCallback(() => {
    if (!active?.clip) return;
    const next = findNextClip(state.tracks, active.clip.id);
    if (!next || next.clip.type !== "video" || preloadedClipId.current === next.clip.id) return;

    const preloadEl = getPreloadVideo();
    if (!preloadEl) return;

    preloadEl.src = next.clip.src!;
    preloadEl.currentTime = next.clip.trimStart;
    preloadEl.preload = "auto";
    preloadEl.load();
    preloadedClipId.current = next.clip.id;
  }, [active?.clip?.id, state.tracks, getPreloadVideo]);

  // Load clip source when active clip changes
  useEffect(() => {
    if (!active?.clip.src) return;
    if (lastClipIdRef.current === active.clip.id) return;

    // Check if the next clip was preloaded — if so, swap slots
    if (preloadedClipId.current === active.clip.id) {
      // The preload video already has this clip loaded — swap!
      activeSlot.current = activeSlot.current === "A" ? "B" : "A";
      setActiveVideoSlot(activeSlot.current);
      preloadedClipId.current = null;
    } else {
      // Load into active slot normally
      const video = getActiveVideo();
      if (!video) return;
      video.src = active.clip.src;
      video.load();
    }

    lastClipIdRef.current = active.clip.id;

    const video = activeSlot.current === "A" ? videoARef.current : videoBRef.current;
    if (video) {
      const offset = state.playheadTime - active.clip.start + active.clip.trimStart;
      video.currentTime = Math.max(0, offset);
    }

    // Start preloading the next clip
    setTimeout(preloadNextClip, 100);
  }, [active?.clip.id, active?.clip.src, preloadNextClip]);

  // Apply clip-level speed
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !active?.clip) return;
    video.playbackRate = active.clip.speed ?? 1;
  }, [active?.clip?.id, active?.clip?.speed, getActiveVideo]);

  // Apply clip-level volume + track mute
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !active?.clip) return;
    const clipVolume = active.clip.volume ?? 1;
    video.volume = isTrackMuted ? 0 : clipVolume;
  }, [active?.clip?.id, active?.clip?.volume, isTrackMuted, getActiveVideo]);

  // Seek when scrubbing (not playing)
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !active?.clip || state.isPlaying) return;

    const offset = state.playheadTime - active.clip.start + active.clip.trimStart;
    if (Math.abs(video.currentTime - offset) > 0.1) {
      video.currentTime = Math.max(0, offset);
    }
  }, [state.playheadTime, state.isPlaying, getActiveVideo]);

  // Play/pause + playhead sync with fade opacity
  useEffect(() => {
    const video = getActiveVideo();
    if (!video) return;

    if (state.isPlaying && active?.clip) {
      video.play().catch(() => {});

      const tick = () => {
        const currentVideo = activeSlot.current === "A" ? videoARef.current : videoBRef.current;
        if (!currentVideo || !active?.clip) return;
        const clipTime = currentVideo.currentTime - active.clip.trimStart + active.clip.start;
        dispatch({ type: "SET_PLAYHEAD", time: clipTime });

        // Calculate fade opacity
        const clipProgress = clipTime - active.clip.start;
        const clipDuration = active.clip.end - active.clip.start;
        const fadeIn = active.clip.fadeIn ?? 0;
        const fadeOut = active.clip.fadeOut ?? 0;
        let opacity = 1;
        if (fadeIn > 0 && clipProgress < fadeIn) {
          opacity = Math.min(1, clipProgress / fadeIn);
        }
        if (fadeOut > 0 && clipProgress > clipDuration - fadeOut) {
          opacity = Math.min(opacity, Math.max(0, (clipDuration - clipProgress) / fadeOut));
        }
        setFadeOpacity(opacity);

        // Preload when within 2 seconds of clip end
        if (clipProgress > clipDuration - 2) {
          preloadNextClip();
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      cancelAnimationFrame(animFrameRef.current);
      setFadeOpacity(1);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state.isPlaying, active?.clip?.id, getActiveVideo, preloadNextClip]);

  const handleEnded = useCallback(() => {
    const sorted = getSortedMediaClips(state.tracks);
    const currentIdx = sorted.findIndex((c) => c.clip.id === active?.clip.id);

    if (currentIdx >= 0 && currentIdx < sorted.length - 1) {
      const next = sorted[currentIdx + 1];
      // Immediately jump — the preloaded video will be swapped in via the useEffect
      dispatch({ type: "SET_PLAYHEAD", time: next.clip.start });
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
    const sorted = getSortedMediaClips(state.tracks);
    const currentIdx = sorted.findIndex((c) => c.clip.id === active?.clip.id);
    const nextIdx = currentIdx + dir;
    if (nextIdx >= 0 && nextIdx < sorted.length) {
      dispatch({ type: "SET_PLAYHEAD", time: sorted[nextIdx].clip.start });
    }
  }, [state.tracks, active?.clip?.id, dispatch]);

  const goToStart = useCallback(() => {
    dispatch({ type: "SET_PLAYHEAD", time: 0 });
  }, [dispatch]);

  const goToEnd = useCallback(() => {
    dispatch({ type: "SET_PLAYHEAD", time: state.duration });
  }, [state.duration, dispatch]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Sync mute to both video elements
  useEffect(() => {
    if (videoARef.current) videoARef.current.muted = isMuted || isTrackMuted;
    if (videoBRef.current) videoBRef.current.muted = isMuted || isTrackMuted;
  }, [isMuted, isTrackMuted]);

  const handleVolumeChange = useCallback(([v]: number[]) => {
    setVolume(v);
    const vol = v / 100;
    if (videoARef.current) videoARef.current.volume = vol;
    if (videoBRef.current) videoBRef.current.volume = vol;
    if (v > 0 && isMuted) setIsMuted(false);
  }, [isMuted]);

  const toggleLoop = useCallback(() => {
    dispatch({ type: "SET_LOOP", looping: !state.isLooping });
  }, [state.isLooping, dispatch]);

  const toggleFullscreen = useCallback(() => {
    getActiveVideo()?.requestFullscreen?.().catch(() => {});
  }, [getActiveVideo]);

  const handleSeek = useCallback(([v]: number[]) => {
    dispatch({ type: "SET_PLAYHEAD", time: v });
  }, [dispatch]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const hasClips = state.tracks.some((t) => t.clips.some((c) => (c.type === "video" || c.type === "image") && c.src));
  const cssFilter = active?.clip ? buildCSSFilter(active.clip) : "none";
  const clipOpacity = fadeOpacity * (active?.clip?.opacity ?? 1);

  return (
    <div className={cn("flex flex-col overflow-hidden", className)} style={{ background: 'hsl(240 28% 3%)' }}>
      {/* Video area */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative" style={{ background: 'hsl(0 0% 3%)' }}>
        {!hasClips ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 text-muted-foreground/20 select-none"
          >
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, hsla(0, 0%, 100%, 0.06), hsla(0, 0%, 100%, 0.02))',
                border: '1px solid hsla(0, 0%, 100%, 0.08)',
                boxShadow: '0 8px 32px hsla(0, 0%, 0%, 0.2)',
              }}
            >
              <MonitorPlay className="w-10 h-10 text-muted-foreground/25" />
              <Sparkles className="w-4 h-4 text-muted-foreground/20 absolute -top-1.5 -right-1.5" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[14px] font-semibold text-muted-foreground/35">Preview</p>
              <p className="text-[11px] text-muted-foreground/20 max-w-[200px] leading-relaxed">
                Add clips to the timeline to start previewing your edit
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {active?.clip.type === "image" ? (
              <img
                src={active.clip.src}
                alt={active.clip.name}
                className="max-w-full max-h-full object-contain transition-opacity duration-75"
                style={{ opacity: clipOpacity, filter: cssFilter }}
              />
            ) : (
              <>
                {/* Dual video elements for gapless playback */}
                <video
                  ref={videoARef}
                  className="max-w-full max-h-full object-contain absolute inset-0 m-auto"
                  style={{
                    opacity: activeVideoSlot === "A" ? clipOpacity : 0,
                    filter: activeVideoSlot === "A" ? cssFilter : "none",
                    pointerEvents: activeVideoSlot === "A" ? "auto" : "none",
                    zIndex: activeVideoSlot === "A" ? 2 : 1,
                  }}
                  muted={isMuted || isTrackMuted}
                  playsInline
                  onEnded={activeVideoSlot === "A" ? handleEnded : undefined}
                />
                <video
                  ref={videoBRef}
                  className="max-w-full max-h-full object-contain absolute inset-0 m-auto"
                  style={{
                    opacity: activeVideoSlot === "B" ? clipOpacity : 0,
                    filter: activeVideoSlot === "B" ? cssFilter : "none",
                    pointerEvents: activeVideoSlot === "B" ? "auto" : "none",
                    zIndex: activeVideoSlot === "B" ? 2 : 1,
                  }}
                  muted={isMuted || isTrackMuted}
                  playsInline
                  onEnded={activeVideoSlot === "B" ? handleEnded : undefined}
                />
              </>
            )}
            {/* Text overlay rendering */}
            {state.tracks.flatMap(t => t.clips).filter(c =>
              c.type === "text" && c.text && c.start <= state.playheadTime && c.end > state.playheadTime
            ).map(textClip => (
              <div
                key={textClip.id}
                className="absolute left-0 right-0 flex justify-center pointer-events-none px-4"
                style={{
                  zIndex: 10,
                  top: textClip.textStyle?.position === "top" ? "8%" : textClip.textStyle?.position === "center" ? "50%" : undefined,
                  bottom: (!textClip.textStyle?.position || textClip.textStyle?.position === "bottom") ? "8%" : undefined,
                  transform: textClip.textStyle?.position === "center" ? "translateY(-50%)" : undefined,
                }}
              >
                <span
                  className="px-3 py-1.5 rounded-lg"
                  style={{
                    fontSize: `${(textClip.textStyle?.fontSize ?? 32) * 0.5}px`,
                    fontFamily: textClip.textStyle?.fontFamily || "sans-serif",
                    color: textClip.textStyle?.color || "#ffffff",
                    backgroundColor: textClip.textStyle?.backgroundColor || "rgba(0,0,0,0.5)",
                    textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                    maxWidth: "90%",
                    wordBreak: "break-word",
                    textAlign: "center",
                  }}
                >
                  {textClip.text}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Aspect ratio badge */}
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold backdrop-blur-xl"
          style={{
            background: 'hsla(0,0%,0%,0.6)',
            color: 'hsla(0,0%,100%,0.45)',
            border: '1px solid hsla(0,0%,100%,0.08)',
            zIndex: 20,
          }}
        >
          {state.aspectRatio}
        </div>
      </div>

      {/* Seek bar + Transport */}
      <div
        className="shrink-0"
        style={{
          background: 'linear-gradient(180deg, hsl(240 18% 7%) 0%, hsl(240 22% 5%) 100%)',
          borderTop: '1px solid hsla(0, 0%, 100%, 0.06)',
        }}
      >
        {/* Seek slider */}
        <div className="px-4 pt-2.5 pb-1">
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
        <div className="flex items-center gap-1.5 px-4 h-11">
          {/* Left: transport buttons */}
          <div className="flex items-center gap-0.5">
            <TransportButton onClick={goToStart} tooltip="Start (Home)">
              <ChevronsLeft className="w-4 h-4" />
            </TransportButton>
            <TransportButton onClick={() => skipClip(-1)} tooltip="Previous clip">
              <SkipBack className="w-4 h-4" />
            </TransportButton>

            {/* Play button — hero */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 mx-1"
              style={{
                background: state.isPlaying
                  ? 'hsla(0, 0%, 100%, 0.12)'
                  : 'hsla(0, 0%, 100%, 0.9)',
                border: state.isPlaying
                  ? '1px solid hsla(0, 0%, 100%, 0.2)'
                  : '1px solid hsla(0, 0%, 100%, 0.3)',
                color: state.isPlaying ? 'hsla(0, 0%, 100%, 0.9)' : 'hsla(0, 0%, 0%, 0.9)',
                boxShadow: state.isPlaying ? 'none' : '0 4px 16px hsla(0, 0%, 100%, 0.15)',
              }}
            >
              {state.isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
            </button>

            <TransportButton onClick={() => skipClip(1)} tooltip="Next clip">
              <SkipForward className="w-4 h-4" />
            </TransportButton>
            <TransportButton onClick={goToEnd} tooltip="End (End)">
              <ChevronsRight className="w-4 h-4" />
            </TransportButton>
          </div>

          {/* Center: timecode */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg"
              style={{ background: 'hsla(0,0%,100%,0.04)', border: '1px solid hsla(0,0%,100%,0.06)' }}
            >
              <span className="text-[12px] font-mono font-bold text-foreground/75 tabular-nums tracking-tight">
                {formatTime(state.playheadTime)}
              </span>
              <span className="text-[10px] text-muted-foreground/25 font-medium">/</span>
              <span className="text-[11px] font-mono text-muted-foreground/40 tabular-nums">
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
              <Repeat className="w-4 h-4" />
            </TransportButton>

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <TransportButton onClick={toggleMute} tooltip={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </TransportButton>
              {showVolumeSlider && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-xl p-2.5 shadow-2xl w-9 h-28"
                  style={{
                    background: 'hsl(240 20% 8%)',
                    border: '1px solid hsla(0, 0%, 100%, 0.1)',
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
              <Maximize className="w-4 h-4" />
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
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150",
            active
              ? "text-foreground/90"
              : "text-muted-foreground/40 hover:text-foreground/70"
          )}
          style={{
            background: active ? 'hsla(0,0%,100%,0.08)' : 'transparent',
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-[10px] px-2.5 py-1 rounded-lg"
        style={{
          background: 'hsl(240 15% 12%)',
          border: '1px solid hsla(0,0%,100%,0.1)',
          color: 'hsla(0,0%,100%,0.8)',
        }}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
