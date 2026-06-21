/**
 * FixedBackdrop — the persistent backdrop behind the page, now a directed
 * sequence:
 *   cover   → epic still + CoverFX, before any scroll.
 *   playing → the immersive film plays ONCE (with a mute/volume control).
 *   climax  → in the final seconds (Hoppy leans in) the film scales to centre
 *             stage and everything else blurs out.
 *   broken  → the screen CRACKS, then a large glowing "Start now" takes over.
 *   rest    → dismissed: film holds on its last frame, page usable again.
 * The cinematic takeover only fires while the viewer is still near the top, so
 * it never hijacks deep-scroll reading.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HERO_VIDEO } from "./assets";
import { CrackOverlay } from "./CrackOverlay";
import { CoverFX } from "./CoverFX";
import { ACCENT } from "./ui";

type Phase = "cover" | "playing" | "immersive" | "broken" | "rest";

function StartNowTakeover({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <div className="relative flex flex-col items-center">
      <motion.button
        type="button"
        onClick={onStart}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 130, damping: 13 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="relative flex h-72 w-72 flex-col items-center justify-center rounded-full sm:h-[22rem] sm:w-[22rem]"
        style={{ boxShadow: `0 0 160px -6px hsl(${ACCENT}), 0 0 70px -8px hsl(${ACCENT}), 0 0 24px -2px hsl(${ACCENT})` }}
      >
        {/* outer breathing glow */}
        <span aria-hidden className="absolute -inset-10 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, hsl(${ACCENT} / 0.55), transparent 70%)`, animation: "spin 8s linear infinite" }} />
        {/* rotating conic halo */}
        <span aria-hidden className="absolute -inset-1 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent, hsl(${ACCENT}), #fff, hsl(${ACCENT}), transparent 70%)`, animation: "spin 5s linear infinite", filter: "blur(3px)" }} />
        <span aria-hidden className="absolute inset-0 rounded-full bg-[#0a0c10]/85 backdrop-blur-xl ring-1 ring-white/20" />
        {/* pulsing rings */}
        {[0, 1, 2].map((i) => (
          <motion.span key={i} aria-hidden className="absolute inset-0 rounded-full border-2" style={{ borderColor: `hsl(${ACCENT})` }} initial={{ opacity: 0.6, scale: 1 }} animate={{ opacity: 0, scale: 1.6 }} transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: "easeOut" }} />
        ))}
        <span className="relative z-10 font-display text-[34px] font-semibold text-white sm:text-[40px]">Start now</span>
        <span className="relative z-10 mt-2 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.32em]" style={{ color: `hsl(${ACCENT})` }}>
          Begin <ArrowRight className="h-4 w-4" />
        </span>
      </motion.button>
      <motion.button type="button" onClick={onDismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 transition-colors hover:text-white/85">
        Keep exploring ↓
      </motion.button>
    </div>
  );
}

export function FixedBackdrop({ onStart, videoRef, muted, onPhase }: { onStart: () => void; videoRef: RefObject<HTMLVideoElement>; muted: boolean; onPhase?: (p: Phase) => void }) {
  const durRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("cover");
  // True once the film is actually rendering frames. Until then we hold a
  // paused poster frame so there's never a dark gap while it buffers.
  const [started, setStarted] = useState(false);
  useEffect(() => { onPhase?.(phase); }, [phase, onPhase]);

  // The film starts ONLY once the visitor has finished scrolling past the
  // first (cover) screen — not before, and not on load.
  useEffect(() => {
    if (phase !== "cover") return;
    const onScroll = () => {
      if (window.scrollY >= window.innerHeight * 0.9) {
        setPhase("playing");
        videoRef.current?.play().catch(() => {});
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase, videoRef]);

  // takeover = the film leaves the background and fills the whole screen
  const takeover = phase === "immersive" || phase === "broken";

  const onTime = () => {
    const v = videoRef.current;
    if (phase === "playing" && durRef.current && durRef.current - v!.currentTime <= 2.0) {
      setPhase("immersive"); // final seconds → go completely immersive
    }
  };
  // when the film finishes: crack the screen, then the Start Now takeover
  const onEnded = () => {
    if (phase === "immersive" || phase === "playing") setPhase("broken");
  };

  return (
    <div className={`fixed inset-0 overflow-hidden ${takeover ? "z-[60]" : "z-0"} bg-[#08090c]`}>
      {/* cover still — slow Ken Burns; fades out once the film takes over */}
      <img
        src="/cinema-assets/cover.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000"
        style={{ opacity: phase === "cover" ? 1 : 0, animation: "cfx-kenburns 34s ease-in-out infinite alternate", transformOrigin: "50% 46%" }}
      />

      {/* the film — always full-bleed; on finish it takes over the whole screen */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          src={HERO_VIDEO}
          poster="/cinema-assets/hero-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: phase === "cover" ? 0 : 1 }}
          muted={muted}
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => { durRef.current = e.currentTarget.duration || 0; }}
          onPlaying={() => setStarted(true)}
          onTimeUpdate={onTime}
          onEnded={onEnded}
        />
        {/* paused poster frame — sits on top of the (still-buffering) video and
            bridges the dark gap until the film actually starts playing, then
            fades away to reveal the live footage. */}
        <img
          src="/cinema-assets/hero-poster.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: phase !== "cover" && !started ? 1 : 0 }}
        />
        {phase === "broken" && <CrackOverlay />}
      </div>

      {/* legibility scrims — fade away as the film goes fully immersive */}
      <div aria-hidden className="absolute inset-0 transition-opacity duration-700" style={{ opacity: takeover ? 0 : 1 }}>
        <div className="absolute inset-0 bg-[#06070a]/38" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06070a]/18 via-[#06070a]/32 to-[#06070a]/80" />
        <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_50%_25%,transparent_45%,rgba(4,5,7,0.6))]" />
      </div>

      {/* grand cover animation — only before playback */}
      {phase === "cover" && (
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <CoverFX />
        </div>
      )}

      {/* START NOW takeover */}
      <AnimatePresence>
        {phase === "broken" && (
          <motion.div className="absolute inset-0 z-[70] grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StartNowTakeover onStart={onStart} onDismiss={() => setPhase("rest")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
