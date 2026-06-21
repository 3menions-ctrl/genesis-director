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
import { Nav } from "@/components/cinema/Nav";
import { Cover } from "@/components/cinema/Cover";
import { Grain } from "@/components/cinema/Grain";
import { HowItWorks, Studio, Portal, FinalCTA } from "@/components/cinema/sections";
import { Engines } from "@/components/cinema/Engines";
import { Showcase } from "@/components/cinema/Showcase";
import { BeforeAfter } from "@/components/cinema/BeforeAfter";
import { FixedBackdrop } from "@/components/cinema/FixedBackdrop";
import { Footer } from "@/components/cinema/Footer";
import { ACCENT } from "@/components/cinema/ui";

export default function Cinema() {
  usePageMeta({ title: "Small Bridges — the AI film studio in a sentence" });
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [flash, setFlash] = useState(false);

  // immersive-video audio control (lifted to page level so it sits above content)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [vphase, setVphase] = useState("cover");
  const showSpeaker = vphase === "playing" || vphase === "immersive" || vphase === "rest";
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

  // Every "start" CTA on the landing leads to the auth page (sign up). Only the
  // content-page links (Tour → /studio-showcase, Blog, Pricing…) stay as-is.
  const handleStart = useCallback(() => {
    setFlash(true);
    window.setTimeout(() => { setFlash(false); navigate("/auth?mode=signup"); }, 260);
  }, [navigate]);
  const handleEnter = useCallback(() => navigate("/studio-showcase"), [navigate]);

  // Lenis smooth scroll (standalone rAF). Off under reduced-motion.
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, [reduced]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#08090c] text-white antialiased">
      <FixedBackdrop onStart={handleStart} videoRef={videoRef} muted={muted} onPhase={setVphase} />

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

      <Nav onStart={handleStart} />

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
