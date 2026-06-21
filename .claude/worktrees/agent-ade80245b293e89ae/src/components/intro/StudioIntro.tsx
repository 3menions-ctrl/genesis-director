/**
 * StudioIntro — APEX STUDIO branded title sequence.
 *
 * A ~4.5s cinematic cold-open played BEFORE the user enters the Studio.
 * Designed to feel like a feature-film distributor card: built from a
 * deep-blue void, a geometric "A" monogram constructed in real-time,
 * an anamorphic horizon split, and a refined APEX · STUDIO wordmark.
 *
 * Beats (seconds):
 *   0.00  Pure void. Subtle vignette breathes in.
 *   0.25  Horizon line ignites at center, splits open vertically.
 *   0.55  Particle dust drifts upward through the rift.
 *   0.70  Aperture rings pulse outward (8-blade iris).
 *   1.00  Geometric "A" monogram constructs stroke-by-stroke (SVG draw).
 *   1.85  APEX wordmark slams in (scale-down + blur-clear).
 *   2.20  Hairline rule draws beneath; "STUDIO" tracks out.
 *   2.70  Tagline "EST. MMXXVI · CINEMA ENGINEERED" fades in.
 *   3.20  Anamorphic lens streak sweeps across.
 *   3.60  Letterbox bars close in (top + bottom), framing the card.
 *   4.00  Iris-out reveal — radial mask opens to studio underneath.
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudioIntroProps {
  isPlaying: boolean;
  onComplete?: () => void;
  /** Total duration in ms. Default 4500. */
  duration?: number;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const StudioIntro = memo(function StudioIntro({
  isPlaying,
  onComplete,
  duration = 4500,
}: StudioIntroProps) {
  const [mounted, setMounted] = useState(isPlaying);

  useEffect(() => {
    if (isPlaying) {
      setMounted(true);
      const t = window.setTimeout(() => {
        onComplete?.();
        window.setTimeout(() => setMounted(false), 700);
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
          exit={{ opacity: 0, transition: { duration: 0.65, ease: EASE_OUT_EXPO } }}
          className="fixed inset-0 z-[10000] overflow-hidden select-none"
          style={{ backgroundColor: 'hsl(220, 16%, 1.5%)' }}
          aria-hidden
        >
          {/* ───────────── Layer 0: deep void + cool blue base ───────────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(1600px 1000px at 50% 50%, hsla(215, 95%, 22%, 0.28), transparent 65%),' +
                'linear-gradient(180deg, hsl(220, 18%, 3%) 0%, hsl(220, 16%, 1.5%) 60%, hsl(220, 20%, 0.8%) 100%)',
            }}
          />

          {/* Slow drifting aurora — ambient depth */}
          <motion.div
            className="absolute -inset-[25%] pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,55%,0.30) 70deg, transparent 150deg, hsla(210,100%,50%,0.22) 240deg, transparent 320deg, hsla(215,100%,55%,0.28) 360deg)',
              filter: 'blur(90px)',
            }}
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 75, opacity: 0.28 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />

          {/* Edge vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 38%, hsla(220,40%,0.5%,0.92) 100%)',
            }}
          />

          {/* Film grain */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
            }}
          />

          {/* Subtle CRT scanlines for cinema texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, hsla(215,100%,80%,0.6) 2px, hsla(215,100%,80%,0.6) 3px)',
            }}
          />

          {/* ───────────── Layer 1: horizon split (cold open) ───────────── */}
          {/* A single luminous line ignites at center, then splits — top half rises, bottom half drops */}
          <motion.div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: '50%',
              height: 1,
              transformOrigin: 'center',
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,75%,0.95) 50%, transparent 100%)',
              boxShadow:
                '0 0 22px 2px hsla(215,100%,65%,0.85), 0 0 60px 6px hsla(215,100%,55%,0.45)',
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 2.0,
              delay: 0.25,
              times: [0, 0.25, 0.7, 1],
              ease: EASE_OUT_EXPO,
            }}
          />

          {/* ───────────── Layer 2: aperture rings + light rays ───────────── */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Ignition core */}
            <motion.div
              className="absolute"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.6, 0], scale: [0, 1, 1.8, 3] }}
              transition={{
                duration: 1.4,
                delay: 0.35,
                times: [0, 0.2, 0.55, 1],
                ease: EASE_OUT_EXPO,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, #ffffff 0%, hsla(215,100%,80%,0.95) 40%, transparent 70%)',
                  boxShadow:
                    '0 0 28px 6px hsla(215,100%,80%,0.85),' +
                    '0 0 90px 26px hsla(215,100%,55%,0.55),' +
                    '0 0 220px 70px hsla(215,100%,42%,0.32)',
                }}
              />
            </motion.div>

            {/* Concentric rings */}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full"
                initial={{ opacity: 0, scale: 0.05 }}
                animate={{
                  opacity: [0, 0.85, 0],
                  scale: [0.05, 1.2 + i * 0.45, 1.8 + i * 0.65],
                }}
                transition={{
                  duration: 1.8,
                  delay: 0.55 + i * 0.09,
                  ease: EASE_OUT_EXPO,
                }}
                style={{
                  width: 260,
                  height: 260,
                  border: '1px solid hsla(215, 100%, 72%, 0.6)',
                  boxShadow:
                    '0 0 32px hsla(215,100%,55%,0.4), inset 0 0 32px hsla(215,100%,55%,0.22)',
                }}
              />
            ))}

            {/* Light-ray spokes */}
            <motion.div
              className="absolute"
              initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
              animate={{ opacity: [0, 0.85, 0], scale: [0.3, 2.4, 3.4], rotate: 45 }}
              transition={{ duration: 1.8, delay: 0.85, ease: EASE_OUT_EXPO }}
              style={{ width: 760, height: 760 }}
            >
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={`ray-${i}`}
                  className="absolute top-1/2 left-1/2 origin-left"
                  style={{
                    width: 380,
                    height: 1,
                    transform: `rotate(${i * 22.5}deg)`,
                    background:
                      'linear-gradient(90deg, hsla(215,100%,82%,0.9) 0%, hsla(215,100%,55%,0.4) 38%, transparent 100%)',
                    boxShadow: '0 0 6px hsla(215,100%,68%,0.6)',
                  }}
                />
              ))}
            </motion.div>

            {/* Drifting particles — luminous dust */}
            {Array.from({ length: 22 }).map((_, i) => {
              const seed = (i * 37) % 100;
              const x = (seed * 9) % 100;
              const drift = -120 - (seed % 80);
              const size = 1 + (seed % 3);
              const delay = 0.6 + (seed % 18) * 0.05;
              const dur = 2.6 + (seed % 10) * 0.15;
              return (
                <motion.div
                  key={`dust-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${x}%`,
                    top: '60%',
                    width: size,
                    height: size,
                    background: 'hsla(215, 100%, 80%, 0.9)',
                    boxShadow: '0 0 6px hsla(215,100%,70%,0.8)',
                  }}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 0.9, 0], y: drift }}
                  transition={{ duration: dur, delay, ease: 'easeOut' }}
                />
              );
            })}
          </div>

          {/* ───────────── Layer 3: top + bottom luminous rails ───────────── */}
          <motion.div
            className="absolute top-0 left-1/2 h-px"
            initial={{ width: 0, x: '-50%', opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.7, ease: EASE_OUT_EXPO }}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,68%,0.7) 50%, transparent 100%)',
              boxShadow: '0 0 18px hsla(215,100%,60%,0.55)',
            }}
          />
          <motion.div
            className="absolute bottom-0 left-1/2 h-px"
            initial={{ width: 0, x: '-50%', opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.8, ease: EASE_OUT_EXPO }}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,68%,0.55) 50%, transparent 100%)',
              boxShadow: '0 0 16px hsla(215,100%,60%,0.45)',
            }}
          />

          {/* ───────────── Layer 4: center stage (monogram + wordmark) ───────────── */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Geometric "A" monogram — constructed stroke-by-stroke */}
            <motion.div
              className="relative mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0, 1, 1, 0.65, 0],
                scale: [0.8, 1, 1.02, 1.08, 1.18],
              }}
              transition={{
                duration: 1.7,
                delay: 0.95,
                times: [0, 0.18, 0.6, 0.85, 1],
                ease: EASE_OUT_EXPO,
              }}
            >
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                style={{
                  filter:
                    'drop-shadow(0 0 18px hsla(215,100%,65%,0.7)) drop-shadow(0 0 48px hsla(215,100%,50%,0.45))',
                }}
              >
                <defs>
                  <linearGradient id="apexA" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(0,0%,100%)" />
                    <stop offset="60%" stopColor="hsl(215, 100%, 78%)" />
                    <stop offset="100%" stopColor="hsl(215, 100%, 55%)" />
                  </linearGradient>
                </defs>
                {/* Left leg */}
                <motion.line
                  x1="60" y1="14" x2="14" y2="106"
                  stroke="url(#apexA)" strokeWidth="2" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.0, ease: EASE_OUT_EXPO }}
                />
                {/* Right leg */}
                <motion.line
                  x1="60" y1="14" x2="106" y2="106"
                  stroke="url(#apexA)" strokeWidth="2" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.05, ease: EASE_OUT_EXPO }}
                />
                {/* Crossbar */}
                <motion.line
                  x1="32" y1="74" x2="88" y2="74"
                  stroke="url(#apexA)" strokeWidth="1.6" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.45, ease: EASE_OUT_EXPO }}
                />
                {/* Apex dot */}
                <motion.circle
                  cx="60" cy="14" r="2.2" fill="hsl(0,0%,100%)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.6, ease: EASE_OUT_EXPO }}
                />
              </svg>
            </motion.div>

            {/* APEX wordmark — scales down from large + blur clears */}
            <div className="overflow-hidden" style={{ paddingBottom: '0.18em' }}>
              <motion.div
                initial={{ opacity: 0, scale: 1.6, filter: 'blur(18px)', letterSpacing: '0.3em' }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: 'blur(0px)',
                  letterSpacing: '0.18em',
                }}
                transition={{ duration: 1.0, delay: 1.85, ease: EASE_OUT_EXPO }}
                className="text-white"
                style={{
                  fontFamily: 'Sora, "Inter", system-ui, sans-serif',
                  fontWeight: 200,
                  fontSize: 'clamp(58px, 9.5vw, 132px)',
                  lineHeight: 0.95,
                  textShadow:
                    '0 0 40px hsla(215,100%,60%,0.45), 0 0 120px hsla(215,100%,45%,0.28)',
                }}
              >
                APEX
              </motion.div>
            </div>

            {/* Hairline rule */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'min(60vw, 460px)', opacity: 1 }}
              transition={{ duration: 0.85, delay: 2.15, ease: EASE_OUT_EXPO }}
              className="my-5 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, hsla(215,100%,72%,0.9) 50%, transparent 100%)',
                boxShadow: '0 0 12px hsla(215,100%,60%,0.65)',
              }}
            />

            {/* STUDIO — letter-tracking expansion */}
            <motion.div
              initial={{ opacity: 0, y: 16, letterSpacing: '0.05em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0.62em' }}
              transition={{ duration: 1.05, delay: 2.25, ease: EASE_OUT_EXPO }}
              className="text-white/85 font-light uppercase"
              style={{
                fontFamily: 'Sora, "Inter", system-ui, sans-serif',
                fontSize: 'clamp(13px, 1.25vw, 18px)',
                paddingLeft: '0.62em',
              }}
            >
              Studio
            </motion.div>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 2.7, ease: EASE_OUT_EXPO }}
              className="mt-12 flex items-center gap-3"
            >
              <div
                className="h-px w-10"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, hsla(215,100%,72%,0.6))',
                }}
              />
              <span
                className="text-white/55 uppercase font-mono"
                style={{ fontSize: 10, letterSpacing: '0.5em' }}
              >
                Est. MMXXVI · Cinema Engineered
              </span>
              <div
                className="h-px w-10"
                style={{
                  background:
                    'linear-gradient(90deg, hsla(215,100%,72%,0.6), transparent)',
                }}
              />
            </motion.div>
          </div>

          {/* ───────────── Layer 5: anamorphic lens streak ───────────── */}
          <motion.div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1.15, 0], opacity: [0, 1, 0] }}
            transition={{
              duration: 1.1,
              delay: 3.2,
              times: [0, 0.5, 1],
              ease: EASE_OUT_EXPO,
            }}
            style={{
              height: 2,
              transformOrigin: 'center',
              background:
                'linear-gradient(90deg, transparent 0%, hsla(215,100%,82%,0.98) 50%, transparent 100%)',
              boxShadow:
                '0 0 32px 8px hsla(215,100%,68%,0.8), 0 0 90px 14px hsla(215,100%,55%,0.45)',
              filter: 'blur(0.5px)',
            }}
          />

          {/* ───────────── Layer 6: cinematic letterbox curtain ───────────── */}
          <motion.div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            initial={{ height: 0 }}
            animate={{ height: ['0%', '14%'] }}
            transition={{ duration: 0.8, delay: 3.6, ease: EASE_IN_OUT }}
            style={{
              background:
                'linear-gradient(180deg, hsl(220,30%,0.5%) 0%, hsl(220,30%,0.5%) 92%, hsla(220,30%,0.5%,0) 100%)',
              borderBottom: '1px solid hsla(215,100%,60%,0.25)',
              boxShadow: '0 6px 24px hsla(215,100%,55%,0.18)',
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            initial={{ height: 0 }}
            animate={{ height: ['0%', '14%'] }}
            transition={{ duration: 0.8, delay: 3.6, ease: EASE_IN_OUT }}
            style={{
              background:
                'linear-gradient(0deg, hsl(220,30%,0.5%) 0%, hsl(220,30%,0.5%) 92%, hsla(220,30%,0.5%,0) 100%)',
              borderTop: '1px solid hsla(215,100%,60%,0.25)',
              boxShadow: '0 -6px 24px hsla(215,100%,55%,0.18)',
            }}
          />

          {/* ───────────── Layer 7: iris-out reveal ───────────── */}
          {/* Radial mask grows from center, dissolving the void into the studio underneath */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 1] }}
            transition={{ duration: 0.6, delay: 4.0, times: [0, 0.1, 0.5, 1] }}
            style={{
              background: 'hsl(220, 16%, 1.5%)',
              maskImage:
                'radial-gradient(circle at center, transparent 0%, transparent 0%, black 100%)',
              WebkitMaskImage:
                'radial-gradient(circle at center, transparent 0%, transparent 0%, black 100%)',
            }}
          />
          <motion.div
            className="absolute inset-0 pointer-events-none bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.85, 0] }}
            transition={{
              duration: 0.7,
              delay: 3.95,
              times: [0, 0.25, 0.55, 1],
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