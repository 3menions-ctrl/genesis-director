/**
 * SmallBridgesPresentsStinger — the optional 1.8s opening title card stamped on
 * the front of any exported Small Bridges video.
 *
 * Visually identical across every export: deep-black background, the
 * Small Bridges wordmark rising into view in Fraunces small-caps, "presents"
 * dissolving in underneath. Total runtime: ~1.8s.
 *
 * The actual export pipeline composites this in via the editor's
 * branded-export presets. This component is the in-app preview the user
 * sees when they toggle the stinger on/off in Export Settings.
 */

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { playSound } from '@/lib/soundDesign';

export function SmallBridgesPresentsStinger({
  trigger = 0,
  onComplete,
  durationMs = 1800,
}: {
  /** Bump this to replay the animation. */
  trigger?: number;
  onComplete?: () => void;
  durationMs?: number;
}) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    setPhase(0);
    playSound('whoosh');
    const t1 = window.setTimeout(() => setPhase(1), 200);
    const t2 = window.setTimeout(() => setPhase(2), 900);
    const t3 = window.setTimeout(() => {
      setPhase(3);
      onComplete?.();
    }, durationMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      {/* Subtle vignette + grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 16, letterSpacing: '0.04em' }}
        animate={{
          opacity: phase >= 1 && phase < 3 ? 1 : 0,
          y: phase >= 1 && phase < 3 ? 0 : 8,
          letterSpacing: phase >= 1 ? '0.32em' : '0.04em',
        }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 flex flex-col items-center justify-center text-white"
      >
        <div
          className="font-display text-[8vw] sm:text-[80px] font-light leading-none"
          style={{ fontVariant: 'small-caps' }}
        >
          Small Bridges
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 2 && phase < 3 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="mt-4 font-mono text-[10px] sm:text-[12px] uppercase tracking-[0.6em] text-white/65"
        >
          presents
        </motion.div>
      </motion.div>

      {/* Bottom hairline reveal */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: phase >= 1 && phase < 3 ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-[14%] left-1/4 right-1/4 h-px bg-white origin-left"
      />
    </div>
  );
}

export default SmallBridgesPresentsStinger;
