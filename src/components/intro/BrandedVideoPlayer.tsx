/**
 * BrandedVideoPlayer — v3 (Immersive Premium)
 *
 * Every consumer-facing video on Small Bridges runs through this. The
 * player carries:
 *
 *   • Intro pre-roll (Small Bridges brand reveal, once per asset per
 *     session) via the IntroOverlay component.
 *   • HLS adaptive streaming (hls.js everywhere, native on Safari/iOS),
 *     with MP4 fallback when the manifest itself fails.
 *   • Premium glass-blur controls — see PremiumControls component.
 *   • Click-to-IMMERSIVE behaviour: a single click on the video portals
 *     it to a fixed full-viewport overlay (z-9999) and auto-plays. The
 *     close button (X), Escape key, or the immersive toggle exits back
 *     to the inline view.
 *   • Mobile swipe gestures inside immersive: horizontal swipe seeks
 *     ±10s × distance; vertical swipe adjusts volume.
 *   • Keyboard shortcuts:
 *       Space / K  play / pause
 *       ← / →      seek ±10s
 *       ↑ / ↓      volume ±10%
 *       M          mute
 *       F          native fullscreen
 *       I          immersive toggle
 *       P          picture-in-picture
 *       C          cycle captions
 *       0–9        seek to 0–90%
 *       Esc        exit immersive
 *   • Quality picker driven by hls.js levels.
 *   • Caption picker driven by <track> elements.
 *   • Real error UI (instead of silent freeze) with Retry.
 *   • Analytics events on `document`:
 *       branded-video:play, :ended, :error, :quality, :immersed
 *
 * The imperative handle exposes play / pause / el so existing
 * consumers (Theater action rail, etc.) keep operating on the
 * underlying <video> element directly.
 */
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Download, RotateCcw, X } from "lucide-react";
import Hls from "hls.js";
import { IntroOverlay } from "@/components/intro/IntroOverlay";
import { PremiumControls } from "@/components/intro/PremiumControls";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface CaptionTrack {
  src: string;
  srcLang: string;
  label: string;
  default?: boolean;
}

export interface BrandedVideoPlayerProps {
  /** Direct media URL. Either `src` or `projectId` is required. */
  src?: string;
  /** Resolve src from `movie_projects.video_url` for this project id. */
  projectId?: string;
  poster?: string;
  /** Session-scoped key. If omitted, a stable hash of `src` is used. */
  playerKey?: string;
  title?: string;
  skipIntro?: boolean;
  forceIntro?: boolean;
  captions?: CaptionTrack[];
  /** Native browser <video controls> bar. We default this off because
   *  the premium overlay provides better controls. Set true to fall
   *  back to native UA controls (e.g. for embedded share contexts). */
  controls?: boolean;
  /** Legacy alias of `controls=false`. Kept for drop-in replacement of
   *  the older SimpleVideoPlayer / UniversalVideoPlayer call shapes. */
  showControls?: boolean;
  /** Legacy — ignored. The premium overlay auto-hides on inactivity. */
  controlsVisibility?: "hover" | "always" | "none";
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  /** When true (default), clicking the inline video opens immersive mode. */
  clickToImmerse?: boolean;
  /** When provided, renders the player inside a full-viewport modal and
   *  exits when the user clicks close. Drop-in replacement for the old
   *  UniversalVideoPlayer `mode="fullscreen"` + `onClose` pattern. */
  open?: boolean;
  /** Render the player as a fullscreen modal. Equivalent to setting open=true. */
  mode?: "inline" | "fullscreen" | "thumbnail";
  className?: string;
  style?: React.CSSProperties;
  objectFit?: "contain" | "cover" | "fill";
  crossOrigin?: "anonymous" | "use-credentials";
  preload?: "none" | "metadata" | "auto";
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onClose?: () => void;
  onDownload?: () => void;
  onCanPlay?: () => void;
  onError?: (message: string) => void;
  /** Either signature is accepted:
   *  - `(t: number, d: number) => void` (SimpleVideoPlayer-style)
   *  - `(e: React.SyntheticEvent<HTMLVideoElement>) => void` (event-style)
   *
   *  We detect by inspecting `fn.length` at call time. */
  onTimeUpdate?:
    | ((currentTime: number, duration: number) => void)
    | ((e: React.SyntheticEvent<HTMLVideoElement>) => void);
}

export interface BrandedVideoHandle {
  play: () => Promise<void> | void;
  pause: () => void;
  seek: (time: number) => void;
  el: () => HTMLVideoElement | null;
  /** Alias of `el()` for legacy SimpleVideoPlayer-style consumers. */
  getVideoElement: () => HTMLVideoElement | null;
  enterImmersive: () => void;
  exitImmersive: () => void;
}

// Compatibility re-exports so old imports keep resolving while we burn
// the legacy player components out of the tree.
export type BrandedVideoPlayerHandle = BrandedVideoHandle;

const SEEN_PREFIX = 'sb.video_intro_seen.';

function isHlsManifest(src: string): boolean {
  return src.includes(".m3u8") || src.includes("application/vnd.apple.mpegurl");
}
function canPlayHlsNatively(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────

export const BrandedVideoPlayer = memo(
  forwardRef<BrandedVideoHandle, BrandedVideoPlayerProps>(function BrandedVideoPlayer(
    {
      src: srcProp,
      projectId,
      poster,
      playerKey: playerKeyProp,
      title,
      // Default to skipping the per-video intro. The brand intro plays once
      // at session start via AuthLandingIntro; replaying it on every video
      // makes the player feel broken (the 7.5s overlay blocks the video
      // and browser autoplay rejection can leave the user stuck). Set
      // `forceIntro` to re-enable the per-video intro for branded download
      // pre-rolls and similar surfaces that genuinely need it.
      skipIntro = true,
      forceIntro = false,
      captions,
      controls = false,
      showControls,
      controlsVisibility: _controlsVisibility, // accepted for compat, intentionally unused
      autoPlay = true,
      muted = false,
      loop = false,
      playsInline = true,
      clickToImmerse = true,
      open,
      mode,
      className,
      style,
      objectFit,
      crossOrigin,
      preload = "auto",
      onPlay,
      onPause,
      onEnded,
      onClose,
      onDownload,
      onCanPlay,
      onError,
      onTimeUpdate,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // ── Resolve src — optionally fetch from movie_projects.video_url ──
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(srcProp ?? null);
    useEffect(() => {
      if (srcProp) { setResolvedSrc(srcProp); return; }
      if (!projectId) { setResolvedSrc(null); return; }
      let cancelled = false;
      (async () => {
        const { data } = await supabase
          .from("movie_projects")
          .select("video_url")
          .eq("id", projectId)
          .maybeSingle();
        if (!cancelled) setResolvedSrc((data as { video_url?: string } | null)?.video_url ?? null);
      })();
      return () => { cancelled = true; };
    }, [srcProp, projectId]);

    // ── Stable playerKey: prefer the prop, else hash the src ──
    const playerKey = useMemo(() => {
      if (playerKeyProp) return playerKeyProp;
      const seed = projectId ?? resolvedSrc ?? srcProp ?? "anonymous";
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      return `auto-${Math.abs(h).toString(36)}`;
    }, [playerKeyProp, projectId, resolvedSrc, srcProp]);

    // ── Resolved controls behaviour ──
    const useNativeControls = controls === true || showControls === true;

    // ── Fullscreen-modal mode (BrandedVideoPlayer compat) ──
    const isModal = mode === "fullscreen" || open === true;

    const [introOpen, setIntroOpen] = useState(false);
    const [revealVideo, setRevealVideo] = useState(false);
    const [error, setError] = useState<{ code?: string; message: string } | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const [immersive, setImmersive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);

    // Quality / captions ───────────────────────────────────────────────
    const [levels, setLevels] = useState<QualityLevel[]>([]);
    const [activeLevel, setActiveLevel] = useState<number>(-1);
    const [activeCaption, setActiveCaption] = useState<number>(-1);

    // ── Intro gating ──
    useEffect(() => {
      if (skipIntro) { setIntroOpen(false); setRevealVideo(true); return; }
      let seen = false;
      try { seen = sessionStorage.getItem(SEEN_PREFIX + playerKey) === "1"; } catch { /* ignore */ }
      if (seen && !forceIntro) { setIntroOpen(false); setRevealVideo(true); return; }
      setIntroOpen(true); setRevealVideo(false);
    }, [playerKey, skipIntro, forceIntro]);

    const completeIntro = useCallback(() => {
      try { sessionStorage.setItem(SEEN_PREFIX + playerKey, "1"); } catch { /* ignore */ }
      setIntroOpen(false);
      setRevealVideo(true);
      if (autoPlay) {
        requestAnimationFrame(() => {
          videoRef.current?.play()?.catch(() => { /* autoplay rejection */ });
        });
      }
    }, [playerKey, autoPlay]);

    // ── HLS / MP4 attach ──
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !resolvedSrc) return;
      setError(null);
      setLevels([]);
      setActiveLevel(-1);

      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }

      if (!isHlsManifest(resolvedSrc)) {
        video.src = resolvedSrc;
        return;
      }
      if (canPlayHlsNatively(video)) {
        video.src = resolvedSrc;
        return;
      }
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1,
          enableWorker: true,
        });
        hlsRef.current = hls;
        hls.loadSource(resolvedSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const ls: QualityLevel[] = hls.levels.map((lvl, i) => ({
            index: i, height: lvl.height, bitrate: lvl.bitrate,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}kbps`,
          })).filter((l) => l.height || l.bitrate);
          setLevels(ls);
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          setActiveLevel(hls.autoLevelEnabled ? -1 : data.level);
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          console.warn("[BrandedVideoPlayer] HLS fatal", data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const mp4Guess = resolvedSrc.replace(/\.m3u8.*$/, ".mp4");
            if (mp4Guess !== resolvedSrc) {
              try {
                hls.destroy();
                hlsRef.current = null;
                video.src = mp4Guess;
                return;
              } catch { /* ignore */ }
            }
          }
          setError({ code: data.details, message: "Couldn't load the manifest" });
          document.dispatchEvent(new CustomEvent("branded-video:error", {
            detail: { playerKey, code: data.details, message: data.error?.message ?? data.details },
          }));
        });
      } else {
        setError({ message: "HLS isn't supported in this browser." });
      }

      return () => {
        if (hlsRef.current) {
          try { hlsRef.current.destroy(); } catch { /* ignore */ }
          hlsRef.current = null;
        }
      };
    }, [resolvedSrc, retryNonce, playerKey]);

    // ── Buffering indicator + onCanPlay propagation ──
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      const handleWaiting = () => setIsBuffering(true);
      const handleCanPlay = () => { setIsBuffering(false); onCanPlay?.(); };
      const handlePlaying = () => setIsBuffering(false);
      v.addEventListener("waiting", handleWaiting);
      v.addEventListener("canplay", handleCanPlay);
      v.addEventListener("playing", handlePlaying);
      return () => {
        v.removeEventListener("waiting", handleWaiting);
        v.removeEventListener("canplay", handleCanPlay);
        v.removeEventListener("playing", handlePlaying);
      };
    }, [onCanPlay]);

    // ── Native fullscreen state sync ──
    useEffect(() => {
      const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", onFsChange);
      return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    // ── Quality + captions ──
    const setQuality = useCallback((index: number) => {
      const hls = hlsRef.current;
      if (!hls) return;
      hls.currentLevel = index === -1 ? -1 : index;
      setActiveLevel(index === -1 ? -1 : index);
      document.dispatchEvent(new CustomEvent("branded-video:quality", { detail: { playerKey, level: index } }));
    }, [playerKey]);

    const setCaption = useCallback((index: number) => {
      const video = videoRef.current;
      if (!video) return;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) tracks[i].mode = i === index ? "showing" : "disabled";
      setActiveCaption(index);
    }, []);

    // ── Imperative handle ──
    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      seek: (time: number) => { if (videoRef.current) videoRef.current.currentTime = time; },
      el: () => videoRef.current,
      getVideoElement: () => videoRef.current,
      enterImmersive: () => setImmersive(true),
      exitImmersive: () => setImmersive(false),
    }), []);

    // ── Click on the video surface ──
    // Behaviour:
    //   • Always toggle play/pause first. This is what every user expects
    //     when clicking a video — and it satisfies the browser's
    //     "user-activated" gesture requirement so autoplay-blocked videos
    //     start without the user having to find the center play button.
    //   • If clickToImmerse is on AND the video is currently paused (i.e.,
    //     the click just started playback), also enter immersive mode so
    //     the user gets the cinematic surface on the first click instead
    //     of needing a second tap.
    const onContentClick = useCallback((e: React.MouseEvent) => {
      // Ignore clicks that land on a button / control / link descendant —
      // those handle their own actions and shouldn't trigger play/pause.
      if ((e.target as HTMLElement).closest("button, a, input")) return;
      const v = videoRef.current;
      if (!v) return;
      const wasPaused = v.paused;
      if (wasPaused) {
        void v.play().catch(() => { /* autoplay rejection — center play stays visible */ });
      } else {
        v.pause();
      }
      if (clickToImmerse && wasPaused && !immersive) {
        setImmersive(true);
        document.dispatchEvent(new CustomEvent("branded-video:immersed", { detail: { playerKey } }));
      }
    }, [clickToImmerse, immersive, playerKey]);

    // ── Esc closes immersive; F toggles fullscreen; etc. ──
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!immersive) return;
        if (e.key === "Escape") setImmersive(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [immersive]);

    // ── Global keyboard shortcuts when player has focus ──
    useEffect(() => {
      const root = wrapperRef.current;
      const video = videoRef.current;
      if (!root || !video) return;
      const onKey = (e: KeyboardEvent) => {
        // Only act when the player wrapper contains focus, OR we're in immersive.
        if (!immersive && !root.contains(document.activeElement)) return;
        if ((e.target as HTMLElement | null)?.tagName === "INPUT" || (e.target as HTMLElement | null)?.tagName === "TEXTAREA") return;
        switch (e.key) {
          case " ":
          case "k":
            e.preventDefault();
            if (video.paused) void video.play(); else video.pause();
            break;
          case "ArrowLeft":
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 10);
            break;
          case "ArrowRight":
            e.preventDefault();
            video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
            break;
          case "ArrowUp":
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            break;
          case "ArrowDown":
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            break;
          case "m":
            e.preventDefault();
            video.muted = !video.muted;
            break;
          case "f":
            e.preventDefault();
            toggleFullscreen();
            break;
          case "i":
            e.preventDefault();
            setImmersive((v) => !v);
            break;
          case "p": {
            e.preventDefault();
            const doc = document as unknown as { pictureInPictureElement?: Element; exitPictureInPicture?: () => Promise<void> };
            const vid = video as unknown as { requestPictureInPicture?: () => Promise<unknown> };
            if (doc.pictureInPictureElement) void doc.exitPictureInPicture?.();
            else void vid.requestPictureInPicture?.();
            break;
          }
          case "c":
            e.preventDefault();
            if (captions && captions.length > 0) {
              const next = activeCaption + 1 >= captions.length ? -1 : activeCaption + 1;
              setCaption(next);
            }
            break;
          default:
            if (/^[0-9]$/.test(e.key) && video.duration > 0) {
              const pct = parseInt(e.key, 10) / 10;
              video.currentTime = video.duration * pct;
            }
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [immersive, captions, activeCaption]);

    // ── Mobile swipe gestures (only when immersive) ──
    const gestureRef = useRef<{ x: number; y: number; t: number; mode: "none" | "seek" | "volume" } | null>(null);
    const onTouchStart = (e: React.TouchEvent) => {
      const t = e.touches[0];
      gestureRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), mode: "none" };
    };
    const onTouchMove = (e: React.TouchEvent) => {
      if (!immersive) return;
      const g = gestureRef.current;
      const v = videoRef.current;
      if (!g || !v) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (g.mode === "none") {
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
          g.mode = Math.abs(dx) > Math.abs(dy) ? "seek" : "volume";
        }
      }
      if (g.mode === "seek") {
        const newTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (dx / 8)));
        v.currentTime = newTime;
        g.x = t.clientX; // chunk the gesture so we apply deltas
      } else if (g.mode === "volume") {
        const next = Math.max(0, Math.min(1, v.volume - dy / 200));
        v.volume = next;
        g.y = t.clientY;
      }
    };
    const onTouchEnd = () => { gestureRef.current = null; };

    // ── Helpers ──
    const toggleFullscreen = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void v.requestFullscreen?.();
    };

    const handlePlay = useCallback(() => {
      onPlay?.();
      document.dispatchEvent(new CustomEvent("branded-video:play", { detail: { playerKey, t: videoRef.current?.currentTime ?? 0 } }));
    }, [onPlay, playerKey]);

    const handlePause = useCallback(() => {
      onPause?.();
    }, [onPause]);

    const handleEnded = useCallback(() => {
      onEnded?.();
      document.dispatchEvent(new CustomEvent("branded-video:ended", { detail: { playerKey, t: videoRef.current?.duration ?? 0 } }));
    }, [onEnded, playerKey]);

    const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
      const err = (e.currentTarget as HTMLVideoElement).error;
      if (!err) return;
      const codeMap: Record<number, string> = { 1: "MEDIA_ERR_ABORTED", 2: "MEDIA_ERR_NETWORK", 3: "MEDIA_ERR_DECODE", 4: "MEDIA_ERR_SRC_NOT_SUPPORTED" };
      const code = codeMap[err.code] ?? `MEDIA_ERR_${err.code}`;
      const message = err.message || "Playback error";
      setError({ code, message });
      onError?.(message);
      document.dispatchEvent(new CustomEvent("branded-video:error", { detail: { playerKey, code, message } }));
    }, [playerKey, onError]);

    /** Wraps the prop onTimeUpdate so we can support both signatures.
     *  Callers wrote either `(t, d) => ...` or `(e) => ...`; we detect by
     *  function arity and dispatch accordingly. */
    const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!onTimeUpdate) return;
      if ((onTimeUpdate as (...args: unknown[]) => void).length >= 2) {
        const v = e.currentTarget;
        (onTimeUpdate as (t: number, d: number) => void)(v.currentTime, v.duration);
      } else {
        (onTimeUpdate as (e: React.SyntheticEvent<HTMLVideoElement>) => void)(e);
      }
    }, [onTimeUpdate]);

    const retry = useCallback(() => {
      setError(null);
      setRetryNonce((n) => n + 1);
    }, []);

    // ── Render ──

    const playerSurface = (
      <div
        ref={wrapperRef}
        tabIndex={-1}
        onClick={onContentClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          "relative w-full h-full focus:outline-none overflow-hidden",
          immersive && "bg-black",
        )}
        style={style}
      >
        <video
          ref={videoRef}
          poster={poster}
          autoPlay={autoPlay && revealVideo}
          muted={muted}
          loop={loop}
          playsInline={playsInline}
          controls={useNativeControls}
          crossOrigin={crossOrigin}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
          className={cn(
            "w-full h-full transition-opacity duration-500 bg-black",
            revealVideo ? "opacity-100" : "opacity-0",
            objectFit === "cover" && "object-cover",
            objectFit === "fill" && "object-fill",
            (!objectFit || objectFit === "contain") && "object-contain",
          )}
          preload={preload}
          // @ts-expect-error - Safari-only AirPlay opt-in attribute
          x-webkit-airplay="allow"
        >
          {(captions ?? []).map((t, i) => (
            <track
              key={`cap-${i}`}
              kind="subtitles"
              src={t.src}
              srcLang={t.srcLang}
              label={t.label}
              default={t.default}
            />
          ))}
        </video>

        {/* Premium controls — only render once the intro completed and we
            haven't fallen back to native browser controls. */}
        {revealVideo && !useNativeControls && !error && (
          <PremiumControls
            videoRef={videoRef}
            title={title}
            immersive={immersive}
            onImmersiveChange={setImmersive}
            isFullscreen={isFullscreen}
            onFullscreenToggle={toggleFullscreen}
            qualityLevels={levels}
            activeLevel={activeLevel}
            onSetLevel={setQuality}
            captionTracks={captions}
            activeCaption={activeCaption}
            onSetCaption={setCaption}
            isBuffering={isBuffering}
          />
        )}

        {/* Error overlay */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="err"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-md"
            >
              <div className="text-center max-w-sm px-6">
                <AlertCircle className="w-7 h-7 mx-auto mb-3 text-rose-300" />
                <h3 className="text-[15px] text-white mb-1 font-light">Couldn&rsquo;t load this video</h3>
                <p className="text-[11px] text-rose-200/80 font-mono uppercase tracking-[0.22em] mb-5">
                  {error.code ?? "Playback error"}
                </p>
                <p className="text-[12px] text-white/55 mb-6 leading-relaxed">{error.message}</p>
                <button
                  onClick={retry}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
                  style={{
                    background: "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                    boxShadow: "0 0 18px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.10)",
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Brand intro overlay — sits ABOVE the controls so it always wins
            until it completes / is skipped. */}
        <IntroOverlay
          open={introOpen}
          onComplete={completeIntro}
          skipAvailableAfterMs={1000}
        />
      </div>
    );

    // ── Top-right floating actions for modal / immersive mode ──
    // Close + Download buttons are rendered as a layer above the surface
    // so they're available regardless of control bar visibility.
    const overlayActions = (
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
        {onDownload && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/85 hover:text-white hover:border-white/30 transition-colors"
            aria-label="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/85 hover:text-white hover:border-white/30 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );

    // Modal mode (BrandedVideoPlayer compat: `mode="fullscreen"`).
    // The player is portalled into a fixed full-viewport overlay, the
    // close button calls onClose, and we wire Esc to close as well.
    useEffect(() => {
      if (!isModal || !onClose) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [isModal, onClose]);

    if (isModal && typeof document !== "undefined") {
      return createPortal(
        <motion.div
          key="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] bg-black"
        >
          {playerSurface}
          {overlayActions}
        </motion.div>,
        document.body,
      );
    }

    // In immersive mode, portal the whole thing to <body> so it sits over
    // every layout container and uses the actual viewport dimensions.
    if (immersive && typeof document !== "undefined") {
      return (
        <>
          {/* Original slot keeps its dimensions so the layout doesn't shift
              behind the user. We render a translucent placeholder. */}
          <div className={cn("relative w-full h-full bg-black/40 backdrop-blur-sm", className)} style={style}>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase tracking-[0.32em] text-white/30">
              Playing in immersive…
            </div>
          </div>
          {createPortal(
            <motion.div
              key="immersive-overlay"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[9999] bg-black"
            >
              {playerSurface}
              {overlayActions}
            </motion.div>,
            document.body,
          )}
        </>
      );
    }

    return (
      <div className={cn("relative w-full h-full", className)} style={style}>
        {playerSurface}
        {(onClose || onDownload) && overlayActions}
      </div>
    );
  }),
);
