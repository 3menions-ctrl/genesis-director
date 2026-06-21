/**
 * BridgeIntro — Lottie-powered brand ident.
 *
 * Why this component exists:
 *
 *   Browser-native SVG / CSS / Framer-Motion can only get you to a
 *   "decent" intro animation. To deliver the Apple / Netflix / A24
 *   tier of brand-ident quality, the industry workflow is:
 *
 *     After Effects (or Cavalry/Rive) → Bodymovin export → .json/.lottie
 *
 *   This component plays whatever Lottie file you drop in at
 *   `INTRO_SRC` below. Replace that one line and the entire intro
 *   upgrades to whatever the motion designer shipped.
 *
 *   Until a real asset exists, this component falls back to a clean
 *   typographic placeholder driven by Framer Motion — minimal, tasteful,
 *   doesn't pretend to be photoreal.
 *
 * Drop-in workflow (when you have a Lottie):
 *
 *   1. Save the JSON at `src/assets/intros/small-bridges-ident.json`
 *      (or upload to a CDN and reference by URL).
 *   2. Set `INTRO_SRC` below to the import path or URL.
 *   3. That's it. The component handles loading, autoplay,
 *      onComplete, and skip.
 *
 * The Lottie wrapper accepts a known-finite duration (default 7.5s).
 * If the underlying animation reports a different duration, the
 * wrapper uses the LOTTIE'S OWN length and ignores the prop. The
 * outer `onComplete` fires whichever happens first: animation
 * "complete" event OR the cap, so the caller never gets stuck.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { motion, type Variants } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — point this at your final Lottie file when ready
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Path to the Lottie JSON for the brand ident.
 *
 *   • null      → fall back to the built-in typographic placeholder
 *   • string    → URL (CDN-hosted) or import path
 *   • object    → imported JSON (e.g. `import data from "./ident.json"`)
 *
 * Example after dropping an asset in:
 *
 *   import IdentJson from "@/assets/intros/small-bridges-ident.json";
 *   const INTRO_SRC: IntroSrc = IdentJson;
 */
type IntroSrc = string | object | null;
const INTRO_SRC: IntroSrc = null;

interface Props {
  isPlaying: boolean;
  onComplete?: () => void;
  /**
   * Maximum length in ms. The component fires `onComplete` whichever
   * comes first: the Lottie animation's natural end OR this cap.
   * Default 7500.
   */
  duration?: number;
}

const DEFAULT_DURATION = 7500;

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────
export const BridgeIntro = memo(function BridgeIntro({
  isPlaying, onComplete, duration = DEFAULT_DURATION,
}: Props) {
  // Hard cap — fires `onComplete` if the Lottie hasn't already.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!isPlaying) return;
    firedRef.current = false;
    const t = window.setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete?.();
      }
    }, duration);
    return () => window.clearTimeout(t);
  }, [isPlaying, duration, onComplete]);

  const fireOnce = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onComplete?.();
  };

  return (
    <div className="absolute inset-0 overflow-hidden select-none pointer-events-none bg-black" aria-hidden>
      {INTRO_SRC ? (
        <LottiePlayer src={INTRO_SRC} isPlaying={isPlaying} onComplete={fireOnce} />
      ) : (
        <TypographicPlaceholder isPlaying={isPlaying} duration={duration} onComplete={fireOnce} />
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LottiePlayer — thin wrapper around lottie-react
// ─────────────────────────────────────────────────────────────────────────────
function LottiePlayer({
  src, isPlaying, onComplete,
}: {
  src: string | object;
  isPlaying: boolean;
  onComplete: () => void;
}) {
  const ref = useRef<LottieRefCurrentProps | null>(null);
  const [animationData, setAnimationData] = useState<object | null>(
    typeof src === "string" ? null : src,
  );

  // If src is a URL, fetch it. If already an object (imported JSON), use directly.
  useEffect(() => {
    if (typeof src !== "string") {
      setAnimationData(src);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`fetch ${src} ${res.status}`);
        const json = await res.json();
        if (!cancelled) setAnimationData(json);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[BridgeIntro] Lottie fetch failed:", e);
        // Bail to onComplete so the caller doesn't hang.
        if (!cancelled) onComplete();
      }
    })();
    return () => { cancelled = true; };
  }, [src, onComplete]);

  // Stop / start animation in sync with isPlaying so reel switches
  // restart cleanly.
  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    if (isPlaying) {
      r.goToAndPlay(0, true);
    } else {
      r.stop();
    }
  }, [isPlaying, animationData]);

  if (!animationData) return null;
  return (
    <Lottie
      lottieRef={ref}
      animationData={animationData}
      loop={false}
      autoplay={isPlaying}
      onComplete={onComplete}
      rendererSettings={{
        preserveAspectRatio: "xMidYMid slice", // fill viewport
        progressiveLoad: false,
      }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TypographicPlaceholder — kinetic studio-entrance brand ident.
//
// STORY (7.5 s):
//
//   00.0 – 00.5s   THE STAGE
//     Pure black studio. A faint warm spotlight wakes at center.
//     Ambient light beams begin a slow drift behind the curtain.
//
//   00.5 – 04.1s   THE BUILDUP
//     Each letter of "Small Bridges" reveals one at a time with
//     spring physics. "Small" appears softer and gentler. A
//     dramatic pause before "Bridges" — anticipation. Then each
//     letter of "Bridges" lands with more energy, more glow, more
//     scale. The stage spotlight grows brighter with every letter.
//     The camera (Ken Burns) pushes in subtly.
//
//   04.1 – 04.7s   THE CLIMAX
//     The period "." lands with a white flash, scale overshoot,
//     a particle burst exploding from center, and six light rays
//     sweeping outward. The wordmark briefly scales up then settles.
//
//   04.7 – 06.0s   THE LANDING
//     A specular sheen sweeps across the wordmark. The hairline
//     rule draws itself led by a glowing comet. The tagline types
//     itself character-by-character. A blinking caret lands at the
//     end of the tagline.
//
//   06.0 – 07.5s   THE HOLD
//     Sustained perpetual breath on the wordmark. Drift settles.
//     A gentle wash hands off cleanly to the video.
// ─────────────────────────────────────────────────────────────────────────────
function TypographicPlaceholder({
  isPlaying, duration, onComplete,
}: {
  isPlaying: boolean;
  duration: number;
  onComplete: () => void;
}) {
  const u = duration / 7500;
  const t = (ms: number) => (ms * u) / 1000;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setTimeout(onComplete, duration);
    return () => window.clearTimeout(id);
  }, [isPlaying, duration, onComplete]);

  // ── PER-LETTER TIMING ──────────────────────────────────────────
  // Slow, deliberate buildup. "Small" letters arrive gently; pause
  // before "B" creates anticipation; "Bridges" accelerates and
  // intensifies; the period is the climax beat.
  const WORDMARK = "Small Bridges.";
  const CLIMAX_AT = 4100; // ms when the period lands
  const LETTER_DELAY_MS = [
    500,   // S
    800,   // m
    1080,  // a
    1340,  // l
    1580,  // l
    1580,  // " " (no anim, just placeholder)
    2050,  // B   ← dramatic pause then "Bridges" begins
    2330,  // r
    2600,  // i
    2870,  // d
    3130,  // g
    3380,  // e
    3630,  // s
    CLIMAX_AT, // .  ← THE CLIMAX
  ];
  // Drives entry distance + spring chaos per letter
  const LETTER_ENERGY = [
    0.45, 0.45, 0.45, 0.45, 0.45, // "Small" — soft
    0,                              // " "
    0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, // "Bridges" — louder
    1.0,                            // "." — climax
  ];

  // Subtle drifting dust motes — ambient stage atmosphere
  const dust = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      bot:  Math.random() * 70,
      delay: Math.random() * 4,
      dur:   9 + Math.random() * 7,
      size:  1.0 + Math.random() * 2.4,
    })), [],
  );

  // Particle burst — explodes outward from center at the climax
  const burst = useMemo(
    () => Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.2;
      const dist = 220 + Math.random() * 280;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: 1.4 + Math.random() * 2.8,
        dur: 0.8 + Math.random() * 0.5,
      };
    }), [],
  );

  // Slow vertical light beams drifting behind the type
  const beams = useMemo(
    () => Array.from({ length: 4 }, (_, i) => ({
      x: 15 + i * 22 + Math.random() * 6,
      delay: Math.random() * 2,
    })), [],
  );

  // Tagline reveal — typewriter character-by-character after climax
  const TAGLINE = "◆ Tonight's room";
  const tagContainer: Variants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.022, delayChildren: t(4700) } },
  };
  const tagLetter: Variants = {
    hidden:  { opacity: 0, x: -6, filter: "blur(3px)" },
    visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 600, damping: 30 } },
  };

  return (
    <div className="absolute inset-0 grid place-items-center bg-black overflow-hidden">
      {/* ─── STUDIO BACKDROP ─────────────────────────────────────
         Dark cinematic stage matching the app's editor aesthetic:
         deep midnight base, warm bottom glow, soft ink vignette. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            // Soft ink-black vignette wrap
            "radial-gradient(140% 100% at 50% 50%, transparent 0%, transparent 40%, hsla(220 70% 1% / 0.6) 80%, hsla(220 80% 0% / 0.9) 100%)",
            // Warm bottom glow (stage floor light)
            "radial-gradient(70% 40% at 50% 90%, hsla(28 80% 18% / 0.45) 0%, transparent 70%)",
            // Subtle cool glow at top (stage rafters)
            "radial-gradient(80% 50% at 50% 12%, hsla(220 80% 14% / 0.5) 0%, transparent 70%)",
            // Twilight midnight base
            "linear-gradient(180deg, hsl(220 70% 2%) 0%, hsl(220 55% 4%) 40%, hsl(218 50% 5%) 80%, hsl(28 35% 5%) 100%)",
          ].join(", "),
        }}
      />

      {/* ─── AMBIENT STAGE SPOTLIGHT — grows brighter with each letter ─── */}
      <motion.div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: "92vw",
          height: "70vh",
          background: "radial-gradient(ellipse 55% 55% at 50% 50%, hsla(48 90% 80% / 0.18), hsla(48 85% 70% / 0.08) 35%, transparent 70%)",
          filter: "blur(8px)",
        }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={isPlaying ? {
          opacity: [0, 0.15, 0.3, 0.5, 0.7, 1, 1.3, 1.0],
          scale:   [0.7, 0.78, 0.85, 0.92, 1.0, 1.08, 1.18, 1.1],
        } : { opacity: 0, scale: 0.7 }}
        transition={{
          delay: t(0),
          duration: t(CLIMAX_AT + 700),
          times: [0, 0.12, 0.27, 0.42, 0.58, 0.78, 0.88, 1],
          ease: "easeIn",
        }}
      />

      {/* ─── AMBIENT VERTICAL LIGHT BEAMS ─── */}
      {beams.map((b, i) => (
        <motion.div
          key={`beam-${i}`}
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: `${b.x}%`,
            top: 0,
            width: "12vw",
            height: "100%",
            background: "linear-gradient(180deg, transparent 0%, hsla(48 90% 80% / 0.04) 30%, hsla(48 95% 75% / 0.08) 60%, transparent 100%)",
            transform: "skewX(-6deg)",
            filter: "blur(14px)",
          }}
          initial={{ opacity: 0, y: -40 }}
          animate={isPlaying ? { opacity: [0, 0.7, 0.5], y: [-40, 40, 20] } : { opacity: 0 }}
          transition={{
            delay: t(400) + b.delay,
            duration: t(6500),
            times: [0, 0.4, 1],
            ease: "easeOut",
          }}
        />
      ))}

      {/* ─── DRIFTING DUST MOTES ─── */}
      {dust.map((d) => (
        <motion.span
          key={d.id}
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            left:   `${d.left}%`,
            bottom: `${d.bot}%`,
            width:  d.size,
            height: d.size,
            background: "hsl(45 90% 80% / 0.55)",
            filter: "blur(0.4px)",
          }}
          animate={isPlaying ? {
            y: [-0, -160, -320],
            opacity: [0, 0.85, 0],
          } : {}}
          transition={{
            delay: d.delay,
            duration: d.dur,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {/* ─── CLIMAX: WHITE FLASH ─── */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, hsl(48 100% 96%), hsla(48 100% 88% / 0.4) 35%, transparent 70%)",
          mixBlendMode: "screen",
        }}
        initial={{ opacity: 0 }}
        animate={isPlaying ? { opacity: [0, 0.9, 0] } : { opacity: 0 }}
        transition={{ delay: t(CLIMAX_AT - 50), duration: t(700), times: [0, 0.18, 1], ease: "easeOut" }}
      />

      {/* ─── CLIMAX: PARTICLE BURST FROM CENTER ─── */}
      {burst.map((p, i) => (
        <motion.span
          key={`burst-${i}`}
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            width:  p.size,
            height: p.size,
            background: "hsl(48 100% 92%)",
            boxShadow: "0 0 8px 1px hsla(48 100% 80% / 0.7)",
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={isPlaying ? {
            x: [0, p.dx],
            y: [0, p.dy],
            opacity: [0, 1, 0],
            scale: [0.4, 1, 0.6],
          } : { opacity: 0 }}
          transition={{
            delay: t(CLIMAX_AT + 50),
            duration: p.dur,
            times: [0, 0.5, 1],
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}

      {/* ─── CLIMAX: LIGHT RAYS SWEEPING OUTWARD ─── */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <motion.div
          key={`ray-${i}`}
          aria-hidden
          className="absolute left-1/2 top-1/2 pointer-events-none origin-center"
          style={{
            width: 2,
            height: "80vh",
            background: "linear-gradient(180deg, hsla(48 100% 90% / 0.85), transparent 70%)",
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            filter: "blur(1.2px)",
            mixBlendMode: "screen",
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={isPlaying ? { scaleY: [0, 1, 0.6], opacity: [0, 0.85, 0] } : { opacity: 0 }}
          transition={{
            delay: t(CLIMAX_AT + 60),
            duration: t(800),
            times: [0, 0.45, 1],
            ease: "easeOut",
          }}
        />
      ))}

      {/* ─── THE WORDMARK ───────────────────────────────────────── */}
      <div className="relative flex flex-col items-center px-6" style={{ perspective: 1400 }}>
        <motion.h1
          className="relative font-display italic font-light leading-[0.95] tracking-[-0.012em] text-center flex flex-wrap justify-center"
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(3rem, 9vw, 8rem)",
          }}
          aria-label={WORDMARK}
          // Cinematic Ken-Burns push during buildup, settles after climax
          initial={{ scale: 0.96 }}
          animate={isPlaying ? {
            scale: [0.96, 1.0, 1.04, 1.08, 1.0],
          } : { scale: 0.96 }}
          transition={{
            delay: t(0),
            duration: t(5800),
            times: [0, 0.3, 0.55, 0.71, 1],
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {WORDMARK.split("").map((ch, i) => {
            const energy = LETTER_ENERGY[i];
            const isClimax = i === WORDMARK.length - 1;
            return (
              <motion.span
                key={`w-${i}`}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  background: "linear-gradient(180deg, hsl(48 100% 96%) 0%, hsl(46 96% 82%) 35%, hsl(38 82% 58%) 75%, hsl(32 68% 42%) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: isClimax
                    ? "0 8px 60px hsla(45 100% 70% / 0.55), 0 0 30px hsla(48 100% 80% / 0.5)"
                    : "0 6px 40px hsla(45 95% 60% / 0.30)",
                  transformOrigin: "center bottom",
                }}
                initial={{
                  opacity: 0,
                  y: 20 + energy * 40,
                  scale: 1 - energy * 0.35,
                  rotateX: -20 - energy * 50,
                  filter: `blur(${4 + energy * 12}px)`,
                }}
                animate={isPlaying ? {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  rotateX: 0,
                  filter: "blur(0px)",
                } : {}}
                transition={{
                  delay: t(LETTER_DELAY_MS[i]),
                  type: "spring",
                  stiffness: 240 + energy * 90,
                  damping: 20 - energy * 8,
                  mass: 0.85,
                }}
              >
                {ch === " " ? " " : ch}
              </motion.span>
            );
          })}

          {/* Sustained perpetual breath after the wordmark lands */}
          <motion.span
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            animate={isPlaying ? {
              scale: [1, 1.015, 1],
              filter: [
                "drop-shadow(0 0 0px transparent)",
                "drop-shadow(0 0 26px hsla(45 95% 70% / 0.4))",
                "drop-shadow(0 0 0px transparent)",
              ],
            } : {}}
            transition={{ delay: t(4900), duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Specular sheen sweep after climax */}
          <motion.span
            aria-hidden
            className="absolute inset-0 pointer-events-none flex justify-center"
            style={{
              background: "linear-gradient(115deg, transparent 38%, hsla(48 100% 96% / 0.95) 50%, transparent 62%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "'Fraunces', serif",
              fontStyle: "italic",
              fontWeight: 300,
            }}
            initial={{ x: "-130%", opacity: 0 }}
            animate={isPlaying ? { x: ["-130%", "130%"], opacity: [0, 1, 0] } : { opacity: 0 }}
            transition={{
              delay: t(4500),
              duration: t(1000),
              times: [0, 0.5, 1],
              ease: [0.25, 1, 0.5, 1],
            }}
          >
            {WORDMARK}
          </motion.span>
        </motion.h1>

        {/* ─── HAIRLINE — drawn by a glowing comet AFTER climax ─── */}
        <div className="relative mt-7" style={{ width: "min(56vw, 540px)", height: 1 }}>
          <motion.div
            className="absolute inset-y-0 left-0 right-0"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(45 90% 75% / 0.75), transparent)",
              transformOrigin: "left",
            }}
            initial={{ scaleX: 0 }}
            animate={isPlaying ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ delay: t(4600), duration: t(800), ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 8,
              height: 8,
              background: "hsl(48 100% 92%)",
              boxShadow: "0 0 16px 4px hsla(45 100% 70% / 0.85), 0 0 40px 12px hsla(45 100% 60% / 0.45)",
            }}
            initial={{ left: 0, opacity: 0, scale: 0 }}
            animate={isPlaying ? {
              left: ["0%", "100%"],
              opacity: [0, 1, 1, 0],
              scale:   [0, 1, 1, 0.5],
            } : { opacity: 0 }}
            transition={{
              delay: t(4600),
              duration: t(800),
              times: [0, 0.1, 0.9, 1],
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </div>

        {/* ─── TAGLINE — typewriter character-by-character ─── */}
        <motion.div
          className="mt-6 text-[11px] sm:text-[12px] font-mono uppercase tracking-[0.42em] flex"
          style={{ color: "hsl(45 25% 78% / 0.95)" }}
          variants={tagContainer}
          initial="hidden"
          animate={isPlaying ? "visible" : "hidden"}
          aria-label={TAGLINE}
        >
          {TAGLINE.split("").map((ch, i) => (
            <motion.span
              key={`tg-${i}`}
              variants={tagLetter}
              style={{ display: "inline-block", whiteSpace: "pre" }}
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>

        {/* Blinking caret at the tail of the tagline */}
        <motion.div
          className="mt-1 h-px"
          style={{
            width: 14,
            background: "hsl(45 90% 75%)",
            boxShadow: "0 0 8px hsla(45 95% 65% / 0.7)",
          }}
          initial={{ opacity: 0 }}
          animate={isPlaying ? { opacity: [0, 1, 0, 1, 0] } : {}}
          transition={{ delay: t(5100), duration: t(400), times: [0, 0.25, 0.5, 0.75, 1] }}
        />
      </div>

      {/* Bottom-left timecode — micro detail for cinema feel */}
      <motion.div
        className="absolute left-6 bottom-6 font-mono text-[10px] tracking-[0.34em] text-foreground/30"
        initial={{ opacity: 0 }}
        animate={isPlaying ? { opacity: 0.55 } : { opacity: 0 }}
        transition={{ delay: t(400), duration: t(600) }}
      >
        SB · {new Date().getFullYear()} · TONIGHT
      </motion.div>

      {/* Final hand-off wash to the video */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, hsl(48 100% 92%), transparent 60%)" }}
        initial={{ opacity: 0 }}
        animate={isPlaying ? { opacity: [0, 0, 0.12, 0] } : { opacity: 0 }}
        transition={{ delay: t(7000), duration: t(500), times: [0, 0.4, 0.7, 1] }}
      />
    </div>
  );
}
