/**
 * FilmLeader — academy-leader countdown shown only on the *very first*
 * app load. After it plays once per browser session, normal cinematic
 * loading takes over.
 *
 * Visual reference: Universal Studios "tail leader" — a circular sweep
 * with a number in the center, ticking from 3 → 2 → 1 → APEX. Pure SVG
 * + framer-motion; no asset weight.
 *
 * Total runtime: ~2.4 seconds. Honors prefers-reduced-motion (skipped).
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const SESSION_KEY = 'smallbridges.film_leader_played';

interface Props {
  /** Force-show even if already played this session. */
  force?: boolean;
  onComplete?: () => void;
}

export function FilmLeader({ force = false, onComplete }: Props) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (reduced) {
      onComplete?.();
      return;
    }
    try {
      if (!force && sessionStorage.getItem(SESSION_KEY) === '1') {
        onComplete?.();
        return;
      }
    } catch {}
    setShouldShow(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}

    const t1 = window.setTimeout(() => setStep(1), 100);  // 3
    const t2 = window.setTimeout(() => setStep(2), 800);  // 2
    const t3 = window.setTimeout(() => setStep(3), 1500); // 1
    const t4 = window.setTimeout(() => setStep(4), 2100); // APEX
    const t5 = window.setTimeout(() => {
      onComplete?.();
    }, 2400);
    return () => {
      [t1, t2, t3, t4, t5].forEach(window.clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shouldShow) return null;

  const number = step === 1 ? '3' : step === 2 ? '2' : step === 3 ? '1' : null;

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-[hsl(0_0%_2.5%)] overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: step === 4 ? 0 : 1 }}
      transition={{ duration: 0.35, ease: [0.6, 0, 0.4, 1] }}
      onAnimationComplete={() => {
        if (step === 4) setShouldShow(false);
      }}
    >
      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          backgroundSize: '200px 200px',
        }}
      />

      {/* Concentric sweep circles */}
      <div className="relative w-[260px] h-[260px]">
        <svg viewBox="0 0 260 260" className="w-full h-full">
          {/* Outer dark circle */}
          <circle cx="130" cy="130" r="124" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="2" fill="none" />
          {/* Sweep ring */}
          <motion.circle
            cx="130"
            cy="130"
            r="124"
            stroke="hsl(var(--brand-light))"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 124}
            initial={{ strokeDashoffset: 2 * Math.PI * 124 }}
            animate={{ strokeDashoffset: step >= 4 ? 0 : (1 - step / 4) * (2 * Math.PI * 124) }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            transform="rotate(-90 130 130)"
          />
          {/* Crosshair */}
          <line x1="0" y1="130" x2="260" y2="130" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="1" />
          <line x1="130" y1="0" x2="130" y2="260" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="1" />
          {/* Inner ring */}
          <circle cx="130" cy="130" r="80" stroke="hsl(0 0% 100% / 0.10)" strokeWidth="1" fill="none" />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center">
          {number !== null ? (
            <motion.div
              key={`num-${number}`}
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-[140px] font-display font-light text-white tabular-nums leading-none"
              style={{ textShadow: '0 0 60px hsl(var(--brand) / 0.45)' }}
            >
              {number}
            </motion.div>
          ) : step === 4 ? (
            <motion.div
              initial={{ opacity: 0, letterSpacing: '0.04em' }}
              animate={{ opacity: 1, letterSpacing: '0.32em' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="text-[40px] font-display font-light text-white uppercase"
              style={{ fontVariant: 'small-caps' }}
            >
              Small Bridges
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Bottom roll / date footer */}
      <div className="absolute bottom-8 inset-x-0 text-center font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
        Small Bridges · A PRODUCTION · MMXXVI
      </div>
    </motion.div>
  );
}

export default FilmLeader;
