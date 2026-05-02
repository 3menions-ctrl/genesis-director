import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';

/**
 * Premium announcement banner — sits above the nav.
 * Animated shimmer, glassmorphic, dismissible (session-only).
 */
export const SeedanceBanner = memo(function SeedanceBanner({
  onLearnMore,
}: {
  onLearnMore?: () => void;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('seedance_2_dismissed') !== '1';
  });

  const dismiss = () => {
    sessionStorage.setItem('seedance_2_dismissed', '1');
    setOpen(false);
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-[60] overflow-hidden"
        >
          <div
            className="relative w-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(10,132,255,0.18) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.85) 65%, rgba(157,203,255,0.16) 100%)',
              borderBottom: '1px solid hsla(0,0%,100%,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* Animated shimmer sweep */}
            <motion.div
              aria-hidden
              animate={{ x: ['-30%', '130%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
              className="pointer-events-none absolute inset-y-0 w-[28%] opacity-40"
              style={{
                background:
                  'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 60%, transparent 100%)',
                filter: 'blur(2px)',
              }}
            />
            {/* Top + bottom hairlines */}
            <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-2.5 flex items-center justify-center gap-3 md:gap-5">
              {/* Sparkle pip */}
              <motion.div
                animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex items-center justify-center w-6 h-6 rounded-full"
                style={{
                  background: 'radial-gradient(circle, hsla(212,100%,60%,0.5), transparent 70%)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#9DCBFF]" strokeWidth={2.2} />
              </motion.div>

              {/* NEW chip */}
              <span
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] tracking-[0.32em] uppercase font-semibold text-white"
                style={{
                  background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
                  boxShadow: '0 0 18px hsla(212,100%,55%,0.45)',
                }}
              >
                New
              </span>

              {/* Headline */}
              <p className="flex items-center gap-2 text-[12px] md:text-[13px] tracking-[0.04em] text-white/90 font-light truncate">
                <span
                  className="font-semibold"
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    background: 'linear-gradient(90deg, #ffffff, #9DCBFF, #0A84FF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Seedance 2.0
                </span>
                <span className="hidden md:inline text-white/45">·</span>
                <span className="hidden md:inline text-white/70">
                  A new generation of cinematic motion is live.
                </span>
                <span className="md:hidden text-white/70">is live.</span>
              </p>

              {/* CTA */}
              <button
                onClick={onLearnMore}
                className="group hidden sm:inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase text-white/85 hover:text-white transition-colors"
              >
                <span>Explore</span>
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* Dismiss */}
              <button
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="ml-1 md:ml-2 w-6 h-6 inline-flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

SeedanceBanner.displayName = 'SeedanceBanner';
