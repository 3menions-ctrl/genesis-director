/**
 * PremiumControls — the transparent, glassmorphic control surface that
 * floats over every Small Bridges video player.
 *
 * Two visual layers:
 *
 *   1. TOP BAR  — close, title, settings (speed, captions, AirPlay).
 *   2. BOTTOM   — progress bar with hover thumbnail, time, transport
 *                (back 10, play, fwd 10), volume, PiP, immerse/exit,
 *                fullscreen.
 *
 * Behaviour:
 *
 *   • Auto-hide after 2.5s of inactivity (3s on touch). Wake on
 *     mousemove, touch, focus-within.
 *   • Cursor hides with the controls in immersive mode.
 *   • All buttons are translucent black/35 + backdrop-blur — work over
 *     any frame without losing readability.
 *   • Mobile: hit targets scale up to 48px minimum.
 *   • Keyboard handled by the parent player (BrandedVideoPlayer).
 *
 * The component is "controlled" — it reads/writes state through props
 * so the parent can stay the single source of truth.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2,
  Minimize2, Settings, X, PictureInPicture2, Captions, Loader2, Cast,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptionTrack {
  label: string;
  srcLang: string;
}

interface PremiumControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Optional title displayed top-left. */
  title?: string;
  /** When true, render with the immersive top-bar (close button + larger sizes). */
  immersive: boolean;
  /** Called when the user requests immersive in (false → true) or out (true → false). */
  onImmersiveChange: (next: boolean) => void;
  /** Native browser fullscreen state. */
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  /** Quality + captions integration. */
  qualityLevels?: { index: number; label: string }[];
  activeLevel?: number;
  onSetLevel?: (i: number) => void;
  captionTracks?: CaptionTrack[];
  activeCaption?: number;
  onSetCaption?: (i: number) => void;
  /** Optional buffering indicator. */
  isBuffering?: boolean;
}

const AUTOHIDE_MS = 2500;
const AUTOHIDE_TOUCH_MS = 3000;
const SEEK_STEP = 10;
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ─────────────────────────────────────────────────────────────────────

export const PremiumControls = memo(function PremiumControls({
  videoRef,
  title,
  immersive,
  onImmersiveChange,
  isFullscreen,
  onFullscreenToggle,
  qualityLevels,
  activeLevel,
  onSetLevel,
  captionTracks,
  activeCaption,
  onSetCaption,
  isBuffering,
}: PremiumControlsProps) {
  const [visible, setVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState<"speed" | "quality" | "captions" | null>(null);
  const [hoverProgress, setHoverProgress] = useState<{ pct: number; time: number; x: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const hideTimerRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Sync local state with the <video> element ──
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolume = () => { setVolume(v.volume); setIsMuted(v.muted); };
    const onRate = () => setSpeed(v.playbackRate);
    const onBuffer = () => {
      const b = v.buffered;
      setBufferedEnd(b.length ? b.end(b.length - 1) : 0);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("ratechange", onRate);
    v.addEventListener("progress", onBuffer);
    onDur(); onVolume(); onRate(); onBuffer();
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("ratechange", onRate);
      v.removeEventListener("progress", onBuffer);
    };
  }, [videoRef]);

  // ── Auto-hide controls ──
  const wake = useCallback((touch = false) => {
    setVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (!isPlaying || settingsOpen || scrubbing) return;
      setVisible(false);
    }, touch ? AUTOHIDE_TOUCH_MS : AUTOHIDE_MS);
  }, [isPlaying, settingsOpen, scrubbing]);

  useEffect(() => { wake(); }, [wake]);
  useEffect(() => () => { if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current); }, []);

  // ── Preview thumbnail seek ──
  // We keep an offscreen <video> wired to the same source. When the user
  // hovers the progress bar, we seek the preview, paint a frame to a
  // canvas, and float that canvas above the bar.
  useEffect(() => {
    const main = videoRef.current;
    const prev = previewVideoRef.current;
    if (!main || !prev) return;
    if (!main.currentSrc) return;
    if (prev.src !== main.currentSrc) {
      prev.src = main.currentSrc;
      prev.muted = true;
      prev.preload = "metadata";
    }
  }, [videoRef, currentTime]);

  useEffect(() => {
    if (!hoverProgress) return;
    const prev = previewVideoRef.current;
    const canvas = previewCanvasRef.current;
    if (!prev || !canvas) return;
    prev.currentTime = hoverProgress.time;
    const onSeeked = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try { ctx.drawImage(prev, 0, 0, canvas.width, canvas.height); } catch { /* ignore */ }
    };
    prev.addEventListener("seeked", onSeeked, { once: true });
    return () => prev.removeEventListener("seeked", onSeeked);
  }, [hoverProgress]);

  // ── Controls ──
  const v = videoRef.current;
  const playPause = useCallback(() => {
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
    wake();
  }, [v, wake]);

  const seekBy = useCallback((delta: number) => {
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    wake();
  }, [v, wake]);

  const toggleMute = useCallback(() => {
    if (!v) return;
    v.muted = !v.muted;
    if (v.muted === false && v.volume === 0) v.volume = 0.5;
    wake();
  }, [v, wake]);

  const setVol = useCallback((next: number) => {
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, next));
    if (v.volume > 0) v.muted = false;
  }, [v]);

  const setRate = useCallback((rate: number) => {
    if (!v) return;
    v.playbackRate = rate;
    setSettingsOpen(null);
    wake();
  }, [v, wake]);

  const togglePip = useCallback(() => {
    if (!v) return;
    const doc = document as unknown as { pictureInPictureElement?: Element; exitPictureInPicture?: () => Promise<void> };
    const vid = v as unknown as { requestPictureInPicture?: () => Promise<unknown> };
    if (doc.pictureInPictureElement) void doc.exitPictureInPicture?.();
    else void vid.requestPictureInPicture?.();
    wake();
  }, [v, wake]);

  // ── Progress bar interaction ──
  const onProgressMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverProgress({ pct, time: pct * duration, x: e.clientX - rect.left });
  };
  const onProgressLeave = () => setHoverProgress(null);
  const onProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
    wake();
  };

  const onScrubStart = () => {
    setScrubbing(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  };
  const onScrubEnd = () => {
    setScrubbing(false);
    wake();
  };

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const supportsPip = typeof document !== "undefined" && "pictureInPictureEnabled" in document && (document as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled;

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 pointer-events-none",
        visible && "cursor-default",
        !visible && isPlaying && "cursor-none",
      )}
      onMouseMove={() => wake(false)}
      onTouchStart={() => wake(true)}
    >
      {/* TOP GRADIENT WASH — improves readability */}
      <div
        aria-hidden
        className={cn(
          "absolute top-0 left-0 right-0 h-32 pointer-events-none transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
      />
      {/* BOTTOM GRADIENT WASH */}
      <div
        aria-hidden
        className={cn(
          "absolute bottom-0 left-0 right-0 h-44 pointer-events-none transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
      />

      {/* TOP BAR */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="top-bar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-4 left-4 right-4 flex items-center gap-3 pointer-events-auto"
          >
            {immersive && (
              <GlassButton onClick={() => onImmersiveChange(false)} title="Close immersive (Esc)" aria-label="Close">
                <X className="w-3.5 h-3.5" />
              </GlassButton>
            )}
            {title && (
              <div className="flex-1 min-w-0 text-white/85 font-light tracking-tight truncate text-[14px] md:text-[16px]">
                {title}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {/* AirPlay (Safari only) */}
              <AirPlayButton videoRef={videoRef} />
              {captionTracks && captionTracks.length > 0 && (
                <div className="relative">
                  <GlassButton
                    onClick={() => setSettingsOpen(settingsOpen === "captions" ? null : "captions")}
                    title="Captions"
                    aria-label="Captions"
                    active={typeof activeCaption === "number" && activeCaption >= 0}
                  >
                    <Captions className="w-3.5 h-3.5" />
                  </GlassButton>
                  <AnimatePresence>
                    {settingsOpen === "captions" && (
                      <SettingsPanel align="right">
                        <PanelRow label="Off" active={activeCaption === -1} onClick={() => { onSetCaption?.(-1); setSettingsOpen(null); }} />
                        {captionTracks.map((cap, i) => (
                          <PanelRow key={`cap-${i}`} label={cap.label} active={activeCaption === i} onClick={() => { onSetCaption?.(i); setSettingsOpen(null); }} />
                        ))}
                      </SettingsPanel>
                    )}
                  </AnimatePresence>
                </div>
              )}
              <div className="relative">
                <GlassButton
                  onClick={() => setSettingsOpen(settingsOpen === "speed" ? null : "speed")}
                  title="Settings"
                  aria-label="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </GlassButton>
                <AnimatePresence>
                  {settingsOpen === "speed" && (
                    <SettingsPanel align="right">
                      <PanelHeading>Playback speed</PanelHeading>
                      {SPEED_OPTIONS.map((rate) => (
                        <PanelRow
                          key={`rate-${rate}`}
                          label={`${rate}×`}
                          active={Math.abs(speed - rate) < 0.01}
                          onClick={() => setRate(rate)}
                        />
                      ))}
                      {qualityLevels && qualityLevels.length > 1 && onSetLevel && (
                        <>
                          <PanelHeading>Quality</PanelHeading>
                          <PanelRow label="Auto" active={activeLevel === -1} onClick={() => { onSetLevel(-1); setSettingsOpen(null); }} />
                          {qualityLevels.map((lvl) => (
                            <PanelRow key={`q-${lvl.index}`} label={lvl.label} active={activeLevel === lvl.index} onClick={() => { onSetLevel(lvl.index); setSettingsOpen(null); }} />
                          ))}
                        </>
                      )}
                    </SettingsPanel>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CENTER PLAY BUTTON (when paused) + BUFFERING SPINNER */}
      <AnimatePresence>
        {(!isPlaying || isBuffering) && (
          <motion.div
            key="center-play"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <button
              type="button"
              onClick={playPause}
              className={cn(
                "w-16 h-16 md:w-20 md:h-20 rounded-full backdrop-blur-2xl border border-white/[0.15] flex items-center justify-center text-white pointer-events-auto transition-transform hover:scale-105 active:scale-95",
              )}
              style={{
                background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                boxShadow:
                  "0 0 32px hsla(215,100%,60%,0.35)," +
                  "0 0 80px hsla(215,100%,55%,0.20)," +
                  "inset 0 1px 0 hsla(0,0%,100%,0.15)",
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <Loader2 className="w-7 h-7 md:w-8 md:h-8 animate-spin text-[hsl(215,100%,75%)]" />
              ) : (
                <Play className="w-7 h-7 md:w-8 md:h-8 fill-white text-white drop-shadow-[0_0_12px_hsla(215,100%,60%,0.6)]" />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM CONTROL BAR */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="bottom-bar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 left-0 right-0 px-4 pb-3 md:px-6 md:pb-5 pointer-events-auto"
          >
            {/* Progress bar */}
            <div className="relative mb-3">
              {/* Hover thumbnail preview */}
              {hoverProgress && duration > 0 && (
                <div
                  className="absolute bottom-full mb-3 pointer-events-none"
                  style={{
                    left: hoverProgress.x,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className="rounded-lg overflow-hidden border border-white/[0.12] shadow-2xl"
                    style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      width={160}
                      height={90}
                      className="block"
                      style={{ width: 160, height: 90, background: "black" }}
                    />
                    <div className="text-center text-[10px] font-mono text-white/85 py-1">
                      {fmtTime(hoverProgress.time)}
                    </div>
                  </div>
                </div>
              )}

              <div
                ref={progressBarRef}
                onMouseMove={onProgressMove}
                onMouseLeave={onProgressLeave}
                onClick={onProgressClick}
                onMouseDown={onScrubStart}
                onMouseUp={onScrubEnd}
                onTouchStart={onScrubStart}
                onTouchEnd={onScrubEnd}
                className="relative h-1.5 md:h-1 hover:h-2 transition-all rounded-full bg-white/[0.15] cursor-pointer group/bar"
              >
                {/* Buffered range */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/[0.25]"
                  style={{ width: `${bufferedPct}%` }}
                />
                {/* Played range */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${playedPct}%`,
                    background: "linear-gradient(90deg, hsla(195,100%,75%,1), hsla(215,100%,60%,1))",
                    boxShadow: "0 0 8px hsla(215,100%,60%,0.55)",
                  }}
                />
                {/* Scrub thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover/bar:opacity-100 transition-opacity"
                  style={{
                    left: `${playedPct}%`,
                    boxShadow: "0 0 0 4px hsla(215,100%,60%,0.35), 0 0 16px hsla(215,100%,60%,0.6)",
                  }}
                />
              </div>
            </div>

            {/* Transport row */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <GlassButton onClick={() => seekBy(-SEEK_STEP)} title="Back 10s" aria-label="Back 10 seconds">
                <SkipBack className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </GlassButton>
              <GlassButton onClick={playPause} title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"} large>
                {isPlaying
                  ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-white" />
                  : <Play className="w-4 h-4 md:w-5 md:h-5 fill-white" />}
              </GlassButton>
              <GlassButton onClick={() => seekBy(+SEEK_STEP)} title="Forward 10s" aria-label="Forward 10 seconds">
                <SkipForward className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </GlassButton>

              {/* Volume cluster */}
              <div className="ml-1 hidden md:flex items-center gap-2 group/vol">
                <GlassButton onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} aria-label={isMuted ? "Unmute" : "Mute"}>
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </GlassButton>
                <div
                  className="relative h-1 w-20 rounded-full bg-white/[0.15] cursor-pointer overflow-hidden"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setVol((e.clientX - r.left) / r.width);
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(isMuted ? 0 : volume) * 100}%`,
                      background: "linear-gradient(90deg, hsla(195,100%,75%,1), hsla(215,100%,60%,1))",
                    }}
                  />
                </div>
              </div>

              {/* Time */}
              <div className="ml-2 md:ml-3 font-mono text-[10px] md:text-[12px] text-white/75 tabular-nums">
                {fmtTime(currentTime)} <span className="text-white/30 mx-1">/</span> {fmtTime(duration)}
              </div>

              <div className="flex-1" />

              {/* Speed pill */}
              <button
                onClick={() => setSettingsOpen(settingsOpen === "speed" ? null : "speed")}
                className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-black/35 backdrop-blur-xl border border-white/[0.10] hover:border-white/30 text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 hover:text-white transition-colors"
                aria-label="Playback speed"
              >
                {speed === 1 ? "1×" : `${speed}×`}
              </button>

              {supportsPip && (
                <GlassButton onClick={togglePip} title="Picture in Picture" aria-label="Picture in Picture">
                  <PictureInPicture2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </GlassButton>
              )}
              <GlassButton
                onClick={() => onImmersiveChange(!immersive)}
                title={immersive ? "Exit immersive" : "Immersive mode"}
                aria-label={immersive ? "Exit immersive" : "Immersive mode"}
                active={immersive}
              >
                {immersive ? <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Maximize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              </GlassButton>
              <GlassButton onClick={onFullscreenToggle} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label="Fullscreen">
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Maximize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offscreen preview <video> for the hover thumbnail seek */}
      <video
        ref={previewVideoRef}
        muted
        preload="metadata"
        playsInline
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        aria-hidden
      />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────
// Small reusable glass surfaces
// ─────────────────────────────────────────────────────────────────────

function GlassButton({
  children, onClick, title, active, large, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; large?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center rounded-full backdrop-blur-xl border transition-colors text-white/85 hover:text-white",
        large ? "w-11 h-11 md:w-12 md:h-12" : "w-9 h-9 md:w-10 md:h-10",
        active
          ? "border-primary/50 bg-primary/15"
          : "border-white/[0.10] hover:border-white/30 bg-black/35 hover:bg-black/50",
      )}
    >
      {children}
    </button>
  );
}

function SettingsPanel({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "absolute top-full mt-2 rounded-xl border border-white/[0.10] bg-black/75 backdrop-blur-xl p-1 min-w-[180px] shadow-2xl",
        align === "right" ? "right-0" : "left-0",
      )}
      style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.7)" }}
    >
      {children}
    </motion.div>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.32em] text-white/40 border-b border-white/[0.06] mb-1">
      {children}
    </div>
  );
}

function PanelRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 h-8 rounded-lg text-[11px] font-mono uppercase tracking-[0.22em] transition-colors flex items-center justify-between",
        active
          ? "bg-primary/15 text-primary"
          : "text-white/75 hover:bg-glass-hover hover:text-white",
      )}
    >
      <span>{label}</span>
      {active && <span className="text-primary">●</span>}
    </button>
  );
}

function AirPlayButton({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Safari AirPlay API is non-standard; feature-detect via vendor flag.
    const w = window as unknown as { WebKitPlaybackTargetAvailabilityEvent?: unknown };
    if (typeof w.WebKitPlaybackTargetAvailabilityEvent !== "undefined") {
      setSupported(true);
    }
  }, [videoRef]);
  if (!supported) return null;
  const onClick = () => {
    const v = videoRef.current as unknown as { webkitShowPlaybackTargetPicker?: () => void } | null;
    v?.webkitShowPlaybackTargetPicker?.();
  };
  return (
    <GlassButton onClick={onClick} title="AirPlay" aria-label="AirPlay">
      <Cast className="w-3.5 h-3.5" />
    </GlassButton>
  );
}

function fmtTime(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
