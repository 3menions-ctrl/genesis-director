/**
 * Cinema — the immersive landing, now the single home page at "/". Its own
 * module (src/components/cinema/*); /cinema redirects here. Direction: cinematic
 * dark & refined, single blue accent, restrained glass, subtle & premium motion.
 * Keeps the spec: glass, white CTAs, WebGL refraction, galleries, real editor
 * screenshots, Enter Studio portal, Start Now → business/personal onboarding.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import Lenis from "lenis";
import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Cover } from "@/components/cinema/Cover";
import { Grain } from "@/components/cinema/Grain";
import { HowItWorks, Studio, Portal, FinalCTA } from "@/components/cinema/sections";
import { Engines } from "@/components/cinema/Engines";
import { Showcase } from "@/components/cinema/Showcase";
import { BeforeAfter } from "@/components/cinema/BeforeAfter";
import { FixedBackdrop } from "@/components/cinema/FixedBackdrop";
import { Footer } from "@/components/cinema/Footer";
import { ACCENT } from "@/components/cinema/ui";
import { ErrorBoundary } from "@/components/ui/error-boundary";

/** Static cover backdrop — the guaranteed fallback if the film ever fails. */
function CoverFallback() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 bg-[#08090c]">
      <img src="/cinema-assets/cover-park-bridge.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-[#06070a]/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06070a]/20 via-[#06070a]/35 to-[#06070a]/85" />
    </div>
  );
}

export default function Cinema() {
  usePageMeta({ title: "Small Bridges — the AI film studio in a sentence" });
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [flash, setFlash] = useState(false);

  // immersive-video audio control (lifted to page level so it sits above content)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [vphase, setVphase] = useState("cover");
  const [videoFailed, setVideoFailed] = useState(false);
  const showSpeaker = !videoFailed && (vphase === "playing" || vphase === "climax");
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next) {
      if (v.ended) v.currentTime = 0;
      if (v.paused) v.play().catch(() => {});
    }
  }, []);

  // ── Faint background score: "In the Hall of the Mountain King" (music box) ──
  // Rides in with the film's sound, stays whisper-soft, and is time-locked to
  // the film so it's always in sync with the speech.
  const musicRef = useRef<HTMLAudioElement>(null);
  const musicFadeRef = useRef(0);

  const fadeMusic = useCallback((to: number, ms: number, then?: () => void) => {
    const a = musicRef.current;
    if (!a) return;
    cancelAnimationFrame(musicFadeRef.current);
    const from = a.volume, t0 = performance.now();
    const tick = (t: number) => {
      const k = ms <= 0 ? 1 : Math.min(1, (t - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) musicFadeRef.current = requestAnimationFrame(tick);
      else then?.();
    };
    musicFadeRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const a = musicRef.current;
    if (!a) return;
    // Whisper-quiet music-box score. It plays through the film and SWELLS as the
    // film ends (climax), then stops at the takeover. Only "playing"/"climax"
    // mean genuine playback, so the score can never play without the film.
    const active = !muted && (vphase === "playing" || vphase === "climax");
    if (active) {
      if (a.paused) {
        // Start from the film's CURRENT position so it's in sync no matter when
        // the viewer turns sound on.
        const v = videoRef.current;
        if (v && Number.isFinite(v.currentTime)) { try { a.currentTime = v.currentTime; } catch { /* noop */ } }
        a.volume = 0; a.play().catch(() => {});
      }
      fadeMusic(vphase === "climax" ? 0.13 : 0.03, vphase === "climax" ? 1800 : 4500);
    } else {
      fadeMusic(0, 600, () => { try { musicRef.current?.pause(); } catch { /* noop */ } });
    }
  }, [muted, vphase, fadeMusic]);

  // Keep the score in sync with the film WITHOUT seeking (seeking clicks/glitches).
  // We gently nudge playbackRate to converge on the film's clock; only a large
  // desync from a real stall triggers a single hard resync.
  useEffect(() => {
    if (muted || (vphase !== "playing" && vphase !== "climax")) return;
    const id = window.setInterval(() => {
      const m = musicRef.current, v = videoRef.current;
      if (!m || !v || v.paused || m.paused) return;
      const drift = m.currentTime - v.currentTime;
      if (Math.abs(drift) > 1.5) {
        try { m.currentTime = v.currentTime; } catch { /* noop */ }
        m.playbackRate = 1;
      } else if (Math.abs(drift) > 0.2) {
        m.playbackRate = drift > 0 ? 0.97 : 1.03; // ease toward the film, no seek
      } else if (m.playbackRate !== 1) {
        m.playbackRate = 1;
      }
    }, 500);
    return () => {
      window.clearInterval(id);
      const m = musicRef.current;
      if (m) m.playbackRate = 1;
    };
  }, [muted, vphase]);

  useEffect(() => () => { cancelAnimationFrame(musicFadeRef.current); try { musicRef.current?.pause(); } catch { /* noop */ } }, []);

  // Every "start" CTA on the landing leads to the auth page (sign up). Only the
  // content-page links (Tour → /studio-showcase, Blog, Pricing…) stay as-is.
  const handleStart = useCallback(() => {
    setFlash(true);
    window.setTimeout(() => { setFlash(false); navigate("/auth?mode=signup"); }, 260);
  }, [navigate]);
  const handleEnter = useCallback(() => navigate("/studio-showcase"), [navigate]);

  // Lenis smooth scroll (standalone rAF). Off under reduced-motion. Guarded so a
  // Lenis failure can never break the page — native scroll just takes over.
  useEffect(() => {
    if (reduced) return;
    let lenis: Lenis | null = null;
    let raf = 0;
    try {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      const loop = (t: number) => { lenis?.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    } catch { /* native scroll fallback */ }
    return () => { cancelAnimationFrame(raf); try { lenis?.destroy(); } catch { /* noop */ } };
  }, [reduced]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#08090c] text-white antialiased">
      <ErrorBoundary fallback={<CoverFallback />}>
        <FixedBackdrop onStart={handleStart} videoRef={videoRef} muted={muted} onPhase={setVphase} onFail={() => setVideoFailed(true)} />
      </ErrorBoundary>

      {/* Faint background score, controlled by the effect above. */}
      <audio ref={musicRef} src="/cinema-assets/mountainking.mp3" preload="auto" />


      {/* Speaker / mute control for the immersive film — page-level so it sits above content */}
      <AnimatePresence>
        {showSpeaker && (
          <motion.button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute film" : "Mute film"}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="group fixed bottom-6 right-6 z-[55] flex items-center gap-2.5 rounded-full bg-black/45 py-2.5 pl-3.5 pr-4 text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/70"
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
              {muted && <span aria-hidden className="absolute -inset-2 animate-ping rounded-full ring-1" style={{ borderColor: `hsl(${ACCENT})`, opacity: 0.4 }} />}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/85">{muted ? "Tap for sound" : "Sound on"}</span>
          </motion.button>
        )}
      </AnimatePresence>
      <Grain />

      {/* subtle, brief Start-now flash (single accent) */}
      <AnimatePresence>
        {flash && (
          <motion.div className="pointer-events-none fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.26 }}>
            <div className="absolute inset-0" style={{ background: `hsl(${ACCENT} / 0.14)`, transform: "translateX(-5px)", mixBlendMode: "screen" }} />
            <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.08)", transform: "translateX(5px)", mixBlendMode: "screen" }} />
            <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.05) 3px)" }} />
          </motion.div>
        )}
      </AnimatePresence>

      <MarketingHeader showProgress />

      <main className="relative z-[3]">
        <Cover onEnter={handleEnter} />
        <Engines />
        <Showcase onStart={handleStart} />
        <BeforeAfter />
        <HowItWorks />
        <Studio onStart={handleStart} />
        <Portal onEnter={handleEnter} onStart={handleStart} />
        <FinalCTA />
        <Footer />
      </main>

    </div>
  );
}
