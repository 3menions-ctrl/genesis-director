/**
 * VideoPreviewPlayer — Premium cinematic preview with GAPLESS playback
 * Apple-clean aesthetic with blue accent system, scopes, SMPTE timecode
 */

import { useEffect, useRef, useCallback, useState, memo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Repeat, ChevronsLeft, ChevronsRight, MonitorPlay, Sparkles,
  Activity, BarChart3
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
import { AudioLevelMeter } from "@/components/editor/AudioLevelMeter";
import { VideoScopes } from "@/components/editor/VideoScopes";

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

function findActiveClip(tracks: { clips: TimelineClip[] }[], time: number): { clip: TimelineClip; trackIndex: number } | null {
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

function findNextClip(tracks: { clips: TimelineClip[] }[], currentClipId: string): { clip: TimelineClip; trackIndex: number } | null {
  const sorted = getSortedMediaClips(tracks);
  const idx = sorted.findIndex((c) => c.clip.id === currentClipId);
  if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1];
  return null;
}

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

export const VideoPreviewPlayer = memo(function VideoPreviewPlayer({ className }: { className?: string }) {
  const { state, dispatch } = useCustomTimeline();

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
  const [showScopes, setShowScopes] = useState(false);

  const active = findActiveClip(state.tracks, state.playheadTime);
  const isTrackMuted = active ? state.tracks[active.trackIndex]?.muted : false;

  const getActiveVideo = useCallback(() => activeSlot.current === "A" ? videoARef.current : videoBRef.current, []);
  const getPreloadVideo = useCallback(() => activeSlot.current === "A" ? videoBRef.current : videoARef.current, []);

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

  useEffect(() => {
    if (!active?.clip.src) return;
    if (lastClipIdRef.current === active.clip.id) return;
    if (preloadedClipId.current === active.clip.id) {
      activeSlot.current = activeSlot.current === "A" ? "B" : "A";
      setActiveVideoSlot(activeSlot.current);
      preloadedClipId.current = null;
    } else {
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
    setTimeout(preloadNextClip, 100);
  }, [active?.clip.id, active?.clip.src, preloadNextClip]);

  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !active?.clip) return;
    video.playbackRate = active.clip.speed ?? 1;
  }, [active?.clip?.id, active?.clip?.speed, getActiveVideo]);

  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !active?.clip) return;
    const clipVolume = active.clip.volume ?? 1;
    video.volume = isTrackMuted ? 0 : clipVolume;
  }, [active?.clip?.id, active?.clip?.volume, isTrackMuted, getActiveVideo]);

  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !active?.clip || state.isPlaying) return;
    const offset = state.playheadTime - active.clip.start + active.clip.trimStart;
    if (Math.abs(video.currentTime - offset) > 0.1) video.currentTime = Math.max(0, offset);
  }, [state.playheadTime, state.isPlaying, getActiveVideo]);

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
        const clipProgress = clipTime - active.clip.start;
        const clipDuration = active.clip.end - active.clip.start;
        const fadeIn = active.clip.fadeIn ?? 0;
        const fadeOut = active.clip.fadeOut ?? 0;
        let opacity = 1;
        if (fadeIn > 0 && clipProgress < fadeIn) opacity = Math.min(1, clipProgress / fadeIn);
        if (fadeOut > 0 && clipProgress > clipDuration - fadeOut) opacity = Math.min(opacity, Math.max(0, (clipDuration - clipProgress) / fadeOut));
        setFadeOpacity(opacity);
        if (clipProgress > clipDuration - 2) preloadNextClip();
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
      dispatch({ type: "SET_PLAYHEAD", time: sorted[currentIdx + 1].clip.start });
    } else if (state.isLooping) {
      dispatch({ type: "SET_PLAYHEAD", time: 0 });
    } else {
      dispatch({ type: "SET_PLAYING", playing: false });
    }
  }, [state.tracks, active?.clip?.id, state.isLooping, dispatch]);

  const togglePlay = useCallback(() => dispatch({ type: "SET_PLAYING", playing: !state.isPlaying }), [state.isPlaying, dispatch]);
  const skipClip = useCallback((dir: -1 | 1) => {
    const sorted = getSortedMediaClips(state.tracks);
    const currentIdx = sorted.findIndex((c) => c.clip.id === active?.clip.id);
    const nextIdx = currentIdx + dir;
    if (nextIdx >= 0 && nextIdx < sorted.length) dispatch({ type: "SET_PLAYHEAD", time: sorted[nextIdx].clip.start });
  }, [state.tracks, active?.clip?.id, dispatch]);
  const goToStart = useCallback(() => dispatch({ type: "SET_PLAYHEAD", time: 0 }), [dispatch]);
  const goToEnd = useCallback(() => dispatch({ type: "SET_PLAYHEAD", time: state.duration }), [state.duration, dispatch]);
  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);

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

  const toggleLoop = useCallback(() => dispatch({ type: "SET_LOOP", looping: !state.isLooping }), [state.isLooping, dispatch]);
  const toggleFullscreen = useCallback(() => getActiveVideo()?.requestFullscreen?.().catch(() => {}), [getActiveVideo]);
  const handleSeek = useCallback(([v]: number[]) => dispatch({ type: "SET_PLAYHEAD", time: v }), [dispatch]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const frames = Math.floor((s % 1) * state.fps);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  const hasClips = state.tracks.some((t) => t.clips.some((c) => (c.type === "video" || c.type === "image") && c.src));
  const cssFilter = active?.clip ? buildCSSFilter(active.clip) : "none";
  const clipOpacity = fadeOpacity * (active?.clip?.opacity ?? 1);

  return (
    <div className={cn("flex flex-col overflow-hidden", className)} style={{ background: 'hsl(220, 14%, 3%)' }}>
      {/* Video area with audio meters */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Audio Level Meters — Left */}
        <div
          className="shrink-0 flex flex-col items-center justify-center"
          style={{
            background: 'hsl(220, 14%, 4%)',
            borderRight: '1px solid hsla(0, 0%, 100%, 0.04)',
          }}
        >
          <AudioLevelMeter />
        </div>

        {/* Main preview area */}
        <div className="flex-1 min-w-0 flex items-center justify-center relative" style={{ background: 'hsl(0, 0%, 2.5%)' }}>
        {/* Subtle glow border when clips present */}
        {hasClips && (
          <motion.div
            className="absolute inset-2 rounded-xl pointer-events-none"
            style={{ zIndex: 25 }}
            animate={{
              boxShadow: [
                'inset 0 0 30px hsla(215, 100%, 50%, 0.02), 0 0 15px hsla(215, 100%, 50%, 0.01)',
                'inset 0 0 40px hsla(215, 100%, 50%, 0.05), 0 0 25px hsla(215, 100%, 50%, 0.03)',
                'inset 0 0 30px hsla(215, 100%, 50%, 0.02), 0 0 15px hsla(215, 100%, 50%, 0.01)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {!hasClips ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 select-none"
          >
            <div className="relative">
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 20px hsla(215, 100%, 50%, 0)',
                    '0 0 40px hsla(215, 100%, 50%, 0.12)',
                    '0 0 20px hsla(215, 100%, 50%, 0)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-28 h-28 rounded-3xl flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, hsla(215, 100%, 50%, 0.06), hsla(0, 0%, 100%, 0.02))',
                  border: '1px solid hsla(215, 100%, 50%, 0.1)',
                }}
              >
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                  <MonitorPlay className="w-11 h-11 text-[hsla(215,100%,60%,0.3)]" />
                </motion.div>
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} className="absolute inset-0">
                  <Sparkles className="w-4 h-4 text-[hsla(215,100%,60%,0.4)] absolute -top-2 left-1/2 -translate-x-1/2" />
                </motion.div>
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-3xl"
                style={{ border: '1px solid hsla(215, 100%, 50%, 0.15)' }}
              />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[14px] font-semibold text-[hsla(0,0%,100%,0.4)]">Preview</p>
              <p className="text-[11px] text-[hsla(0,0%,100%,0.2)] max-w-[220px] leading-relaxed">
                Add clips to the timeline to start previewing your edit
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {active?.clip.type === "image" ? (
              <img src={active.clip.src} alt={active.clip.name} className="max-w-full max-h-full object-contain transition-opacity duration-75" style={{ opacity: clipOpacity, filter: cssFilter }} />
            ) : (
              <>
                <video ref={videoARef} className="max-w-full max-h-full object-contain absolute inset-0 m-auto" style={{ opacity: activeVideoSlot === "A" ? clipOpacity : 0, filter: activeVideoSlot === "A" ? cssFilter : "none", pointerEvents: activeVideoSlot === "A" ? "auto" : "none", zIndex: activeVideoSlot === "A" ? 2 : 1 }} muted={isMuted || isTrackMuted} playsInline onEnded={activeVideoSlot === "A" ? handleEnded : undefined} />
                <video ref={videoBRef} className="max-w-full max-h-full object-contain absolute inset-0 m-auto" style={{ opacity: activeVideoSlot === "B" ? clipOpacity : 0, filter: activeVideoSlot === "B" ? cssFilter : "none", pointerEvents: activeVideoSlot === "B" ? "auto" : "none", zIndex: activeVideoSlot === "B" ? 2 : 1 }} muted={isMuted || isTrackMuted} playsInline onEnded={activeVideoSlot === "B" ? handleEnded : undefined} />
              </>
            )}
            {/* Text overlays */}
            {state.tracks.flatMap(t => t.clips).filter(c => c.type === "text" && c.text && c.start <= state.playheadTime && c.end > state.playheadTime).map(textClip => (
              <div key={textClip.id} className="absolute left-0 right-0 flex justify-center pointer-events-none px-4" style={{ zIndex: 10, top: textClip.textStyle?.position === "top" ? "8%" : textClip.textStyle?.position === "center" ? "50%" : undefined, bottom: (!textClip.textStyle?.position || textClip.textStyle?.position === "bottom") ? "8%" : undefined, transform: textClip.textStyle?.position === "center" ? "translateY(-50%)" : undefined }}>
                <span className="px-3 py-1.5 rounded-lg" style={{ fontSize: `${(textClip.textStyle?.fontSize ?? 32) * 0.5}px`, fontFamily: textClip.textStyle?.fontFamily || "sans-serif", color: textClip.textStyle?.color || "#ffffff", backgroundColor: textClip.textStyle?.backgroundColor || "rgba(0,0,0,0.5)", textShadow: "0 2px 8px rgba(0,0,0,0.7)", maxWidth: "90%", wordBreak: "break-word", textAlign: "center" }}>
                  {textClip.text}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Aspect ratio + Scopes badges */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5" style={{ zIndex: 20 }}>
          <button
            onClick={() => setShowScopes(prev => !prev)}
            className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-mono font-semibold backdrop-blur-xl transition-all",
              showScopes
                ? "text-[hsl(120,70%,55%)]"
                : "text-[hsla(0,0%,100%,0.45)]"
            )}
            style={{
              background: showScopes ? 'hsla(120,70%,50%,0.12)' : 'hsla(0,0%,0%,0.6)',
              border: showScopes ? '1px solid hsla(120,70%,50%,0.25)' : '1px solid hsla(0,0%,100%,0.08)',
            }}
          >
            <Activity className="w-3 h-3 inline mr-1" />
            Scopes
          </button>
          <div className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold backdrop-blur-xl" style={{ background: 'hsla(0,0%,0%,0.6)', color: 'hsla(0,0%,100%,0.45)', border: '1px solid hsla(0,0%,100%,0.08)' }}>
            {state.aspectRatio}
          </div>
        </div>
        </div>
        </div>

        {/* Scopes panel */}
        <VideoScopes visible={showScopes} />
      </div>

      {/* Seek bar + Transport */}
      <div
        className="shrink-0"
        style={{
          background: 'linear-gradient(180deg, hsla(220, 14%, 6%, 0.85) 0%, hsla(220, 14%, 3%, 0.92) 100%)',
          backdropFilter: 'blur(48px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 hsla(0, 0%, 100%, 0.04)',
        }}
      >
        <div className="px-5 pt-3 pb-1.5">
          <Slider value={[state.playheadTime]} onValueChange={handleSeek} min={0} max={Math.max(state.duration, 0.1)} step={0.05} className="w-full" />
        </div>
        <div className="flex items-center gap-1.5 px-5 h-12">
          <div className="flex items-center gap-0.5">
            <TransportButton onClick={goToStart} tooltip="Start (Home)"><ChevronsLeft className="w-4 h-4" /></TransportButton>
            <TransportButton onClick={() => skipClip(-1)} tooltip="Previous clip"><SkipBack className="w-4 h-4" /></TransportButton>
            <button
              onClick={togglePlay}
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-[1.06] active:scale-[0.96] mx-1.5"
              style={{
                background: state.isPlaying
                  ? 'hsla(0, 0%, 100%, 0.06)'
                  : 'linear-gradient(135deg, hsla(215, 100%, 62%, 0.95) 0%, hsla(215, 100%, 52%, 0.95) 100%)',
                color: state.isPlaying ? 'hsla(0, 0%, 100%, 0.9)' : 'hsl(0, 0%, 100%)',
                boxShadow: state.isPlaying
                  ? 'inset 0 1px 0 hsla(0,0%,100%,0.06), inset 0 0 0 1px hsla(0,0%,100%,0.08)'
                  : 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 0 24px hsla(215, 100%, 55%, 0.45), 0 0 48px hsla(215, 100%, 55%, 0.2)',
              }}
            >
              {state.isPlaying ? <Pause className="w-4 h-4" strokeWidth={1.8} /> : <Play className="w-4 h-4 ml-0.5" strokeWidth={1.8} fill="currentColor" />}
            </button>
            <TransportButton onClick={() => skipClip(1)} tooltip="Next clip"><SkipForward className="w-4 h-4" /></TransportButton>
            <TransportButton onClick={goToEnd} tooltip="End (End)"><ChevronsRight className="w-4 h-4" /></TransportButton>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div
              className="flex items-center gap-2.5 px-4 py-1.5 rounded-full"
              style={{
                background: 'hsla(0,0%,100%,0.025)',
                backdropFilter: 'blur(24px) saturate(160%)',
                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04), inset 0 0 0 1px hsla(0,0%,100%,0.04)',
              }}
            >
              <span className="text-[11px] font-mono font-light text-[hsla(0,0%,100%,0.85)] tabular-nums tracking-[0.06em]">{formatTime(state.playheadTime)}</span>
              <span className="text-[10px] text-[hsla(0,0%,100%,0.18)]">/</span>
              <span className="text-[10px] font-mono font-light text-[hsla(0,0%,100%,0.35)] tabular-nums tracking-[0.06em]">{formatTime(state.duration)}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <TransportButton onClick={toggleLoop} tooltip={state.isLooping ? "Loop: ON" : "Loop: OFF"} active={state.isLooping}><Repeat className="w-4 h-4" /></TransportButton>
            <div className="relative flex items-center" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
              <TransportButton onClick={toggleMute} tooltip={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </TransportButton>
              {showVolumeSlider && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-2xl p-2.5 w-10 h-32"
                  style={{
                    background: 'linear-gradient(180deg, hsla(220,14%,8%,0.88) 0%, hsla(220,14%,5%,0.92) 100%)',
                    backdropFilter: 'blur(32px) saturate(180%)',
                    boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 16px 40px -12px hsla(0,0%,0%,0.7)',
                  }}
                >
                  <Slider orientation="vertical" value={[volume]} onValueChange={handleVolumeChange} min={0} max={100} step={1} className="h-full" />
                </div>
              )}
            </div>
            <TransportButton onClick={toggleFullscreen} tooltip="Fullscreen"><Maximize className="w-4 h-4" /></TransportButton>
          </div>
        </div>
      </div>
    </div>
  );
});

function TransportButton({ onClick, tooltip, active, children }: { onClick: () => void; tooltip: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105",
            active ? "text-[hsl(215,100%,75%)]" : "text-[hsla(0,0%,100%,0.4)] hover:text-[hsla(0,0%,100%,0.85)]"
          )}
          style={{
            background: active ? 'hsla(215,100%,55%,0.1)' : 'transparent',
            boxShadow: active ? 'inset 0 0 0 1px hsla(215,100%,55%,0.18)' : 'none',
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-[9px] font-light tracking-[0.16em] uppercase px-2.5 py-1 rounded-full"
        style={{
          background: 'linear-gradient(180deg, hsla(220,14%,10%,0.92) 0%, hsla(220,14%,6%,0.94) 100%)',
          backdropFilter: 'blur(24px) saturate(160%)',
          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 8px 24px -8px hsla(0,0%,0%,0.6)',
          color: 'hsla(0,0%,100%,0.75)',
        }}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
