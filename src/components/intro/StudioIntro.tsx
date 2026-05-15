/**
 * StudioIntro - Cinematic title-card sequence (Disney/Netflix-grade).
 *
 * A ~3.4s branded entrance played BEFORE the user lands inside the Studio.
 * Born from CinemaLoader's visual language (deep-blue void + concentric
 * halos + Sora wordmark) and elevated into a full title sequence:
 *
 *   0.00s  Black void, faint vignette breathes in
 *   0.30s  A single pinpoint ignites at center
 *   0.55s  Aperture iris (8 blades) opens with a soft bloom
 *   0.90s  Concentric rings burst outward, light rays sweep
 *   1.20s  "APEX" letters slam in from the sides and lock
 *   1.65s  "STUDIO" rises from the baseline + hairline draws across
 *   2.10s  Tagline "CINEMA · ENGINEERED" fades in
 *   2.80s  Anamorphic light streak sweeps across, white flash
 *   3.10s  Curtain dissolves to reveal the Studio
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudioIntroProps {
  isPlaying: boolean;
  onComplete?: () => void;
  /** Total duration in ms. Default 3400. */
  duration?: number;
}

const APEX_LETTERS = ['A', 'P', 'E', 'X'];

export const StudioIntro = memo(function StudioIntro({
  isPlaying,
  onComplete,
  duration = 3400,
}: StudioIntroProps) {
  const [mounted, setMounted] = useState(isPlaying);

  useEffect(() => {
    if (isPlaying) {
      setMounted(true);
      const t = window.setTimeout(() => {
        onComplete?.();
        // Allow exit animation a moment before unmounting
        window.setTimeout(() => setMounted(false), 600);
      }, duration);
      return () => window.clearTimeout(t);
    }
  }, [isPlaying, duration, onComplete]);

  return (
    <AnimatePresence>
      {mounted && isPlaying && (
        <motion.div
          key="studio-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[10000] overflow-hidden"
          style={{ backgroundColor: 'hsl(220, 14%, 2%)' }}
          aria-hidden
        >
          {/* Deep base wash with cool blue undertone (matches CinemaLoader) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(1400px 900px at 50% 50%, hsla(215, 95%, 26%, 0.22), transparent 62%),' +
                'linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
            }}
          />

          {/* Slow conic aurora — continuous ambient motion */}
          <motion.div
            className="absolute -inset-[20%] pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.22) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
              filter: 'blur(80px)',
            }}
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 90, opacity: 0.22 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />

          {/* Edge vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 45%, hsla(220,30%,1%,0.85) 100%)',
            }}
          />

          {/* Film grain */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
            }}
          />

          {/* Top + bottom luminous hairlines that sweep open */}
          <motion.div
            className="absolute top-0 left-1/2 h-px"
            initial={{ width: 0, x: '-50%', opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ duration: 1.0, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,65%,0.7) 50%, transparent 100%)',
              boxShadow: '0 0 18px hsla(215,100%,60%,0.55)',
            }}
          />
          <motion.div
            className="absolute bottom-0 left-1/2 h-px"
            initial={{ width: 0, x: '-50%', opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ duration: 1.0, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,65%,0.5) 50%, transparent 100%)',
              boxShadow: '0 0 14px hsla(215,100%,60%,0.45)',
            }}
          />

          {/* === Center stage === */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Pinpoint ignition + bloom */}
            <motion.div
              className="absolute"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0.85, 0.4],
                scale: [0, 1, 1.6, 2.4],
              }}
              transition={{
                duration: 1.2,
                delay: 0.3,
                times: [0, 0.25, 0.6, 1],
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: 'radial-gradient(circle, #ffffff 0%, hsla(215,100%,75%,0.9) 40%, transparent 70%)',
                  boxShadow:
                    '0 0 24px 6px hsla(215,100%,75%,0.8),' +
                    '0 0 80px 24px hsla(215,100%,55%,0.55),' +
                    '0 0 200px 60px hsla(215,100%,45%,0.3)',
                }}
              />
            </motion.div>

            {/* Aperture — 8 expanding rings */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full"
                initial={{ opacity: 0, scale: 0.05 }}
                animate={{
                  opacity: [0, 0.9, 0],
                  scale: [0.05, 1.4 + i * 0.5, 2 + i * 0.7],
                }}
                transition={{
                  duration: 1.6,
                  delay: 0.6 + i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  width: 220,
                  height: 220,
                  border: '1px solid hsla(215, 100%, 70%, 0.55)',
                  boxShadow:
                    '0 0 30px hsla(215,100%,55%,0.35), inset 0 0 30px hsla(215,100%,55%,0.2)',
                }}
              />
            ))}

            {/* Light rays — 12 spokes burst outward */}
            <motion.div
              className="absolute"
              initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.3, 2.2, 3], rotate: 60 }}
              transition={{ duration: 1.6, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: 700, height: 700 }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={`ray-${i}`}
                  className="absolute top-1/2 left-1/2 origin-left"
                  style={{
                    width: 350,
                    height: 1,
                    transform: `rotate(${i * 30}deg)`,
                    background:
                      'linear-gradient(90deg, hsla(215,100%,80%,0.85) 0%, hsla(215,100%,55%,0.4) 40%, transparent 100%)',
                    boxShadow: '0 0 6px hsla(215,100%,65%,0.6)',
                  }}
                />
              ))}
            </motion.div>

            {/* Wordmark stage */}
            <div className="relative z-10 flex flex-col items-center" style={{ minHeight: 220 }}>
              {/* APEX — letters fly in from alternating sides */}
              <div className="flex items-baseline gap-[0.04em] overflow-hidden px-2" style={{ minHeight: '1em' }}>
                {APEX_LETTERS.map((letter, i) => (
                  <motion.span
                    key={letter + i}
                    initial={{
                      opacity: 0,
                      x: i % 2 === 0 ? -120 : 120,
                      filter: 'blur(14px)',
                      letterSpacing: '0.4em',
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      filter: 'blur(0px)',
                      letterSpacing: '0em',
                    }}
                    transition={{
                      duration: 0.85,
                      delay: 1.2 + i * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="inline-block text-white"
                    style={{
                      fontFamily: 'Sora, "Inter", system-ui, sans-serif',
                      fontWeight: 200,
                      fontSize: 'clamp(64px, 11vw, 148px)',
                      lineHeight: 0.95,
                      letterSpacing: '0.01em',
                      textShadow:
                        '0 0 40px hsla(215,100%,60%,0.45), 0 0 120px hsla(215,100%,45%,0.25)',
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>

              {/* Hairline that draws across between APEX and STUDIO */}
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'min(70vw, 520px)', opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.55, ease: [0.16, 1, 0.3, 1] }}
                className="my-5 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, hsla(215,100%,70%,0.85) 50%, transparent 100%)',
                  boxShadow: '0 0 12px hsla(215,100%,60%,0.65)',
                }}
              />

              {/* STUDIO — rises from below with letter-spacing expansion */}
              <motion.div
                initial={{ opacity: 0, y: 20, letterSpacing: '0.05em' }}
                animate={{ opacity: 1, y: 0, letterSpacing: '0.55em' }}
                transition={{ duration: 1.0, delay: 1.7, ease: [0.16, 1, 0.3, 1] }}
                className="text-white/85 font-light uppercase"
                style={{
                  fontFamily: 'Sora, "Inter", system-ui, sans-serif',
                  fontSize: 'clamp(13px, 1.2vw, 17px)',
                  // letterSpacing animated above
                  paddingLeft: '0.55em', // visual centering compensation for letter-spacing
                }}
              >
                Studio
              </motion.div>

              {/* Tagline */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 2.1, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 flex items-center gap-3"
              >
                <div
                  className="h-px w-10"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, hsla(215,100%,70%,0.6))',
                  }}
                />
                <span
                  className="text-white/55 uppercase font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.45em',
                  }}
                >
                  Cinema · Engineered
                </span>
                <div
                  className="h-px w-10"
                  style={{
                    background:
                      'linear-gradient(90deg, hsla(215,100%,70%,0.6), transparent)',
                  }}
                />
              </motion.div>
            </div>
          </div>

          {/* Anamorphic horizontal lens streak — sweeps across at climax */}
          <motion.div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1.1, 0], opacity: [0, 0.95, 0] }}
            transition={{
              duration: 1.0,
              delay: 1.15,
              times: [0, 0.5, 1],
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              height: 2,
              transformOrigin: 'center',
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,80%,0.95) 50%, transparent 100%)',
              boxShadow:
                '0 0 30px 8px hsla(215,100%,65%,0.75), 0 0 80px 12px hsla(215,100%,55%,0.4)',
              filter: 'blur(0.5px)',
            }}
          />

          {/* Final white-flash dissolve */}
          <motion.div
            className="absolute inset-0 pointer-events-none bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.85, 0] }}
            transition={{
              duration: 0.9,
              delay: 2.7,
              times: [0, 0.3, 0.55, 1],
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

StudioIntro.displayName = 'StudioIntro';
export default StudioIntro;