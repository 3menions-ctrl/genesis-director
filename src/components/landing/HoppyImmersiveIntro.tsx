import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import hoppyVideo from '@/assets/landing-hoppy-intro.mp4.asset.json';

export const HOPPY_INTRO_EVENT = 'hoppy:open-intro';

export const HoppyImmersiveIntro = memo(function HoppyImmersiveIntro() {
  const [open, setOpen] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    setShowEnter(false);
    if (videoRef.current) videoRef.current.pause();
  }, []);

  // Manual trigger via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(HOPPY_INTRO_EVENT, handler);
    return () => window.removeEventListener(HOPPY_INTRO_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setShowEnter(true), 1800);
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => undefined);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, dismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="hoppy-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Hoppy immersive intro"
        >
          <video
            ref={videoRef}
            src={hoppyVideo.url}
            muted
            playsInline
            autoPlay
            loop
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.92) 100%)',
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />

          <button
            onClick={dismiss}
            className="absolute top-6 right-6 text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-white transition-colors"
          >
            Skip intro
          </button>

          <div className="absolute inset-0 flex flex-col items-center justify-end pb-20 md:pb-28 px-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-[11px] font-medium text-[#0A84FF] tracking-[0.32em] uppercase mb-4"
            >
              Meet Hoppy
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-white text-center text-4xl md:text-7xl font-bold tracking-tight leading-[1.02] max-w-4xl"
            >
              Your creative<br />co-pilot.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.8 }}
              className="mt-5 text-white/65 max-w-xl text-center text-base md:text-lg font-light"
            >
              Cinematic ad creative, on demand — for marketing & growth teams.
            </motion.p>

            <AnimatePresence>
              {showEnter && (
                <motion.button
                  key="enter-cta"
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  onClick={dismiss}
                  className="group mt-10 inline-flex items-center gap-3 h-14 pl-8 pr-6 rounded-full bg-white text-black text-sm font-medium tracking-wide hover:bg-white/90 transition-all"
                  style={{
                    boxShadow:
                      '0 0 0 1px hsla(0,0%,100%,0.1), 0 20px 60px -15px hsla(212,100%,50%,0.55), 0 0 80px -10px hsla(212,100%,50%,0.35)',
                  }}
                  autoFocus
                >
                  <span>Enter Apex</span>
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: showEnter ? 0.5 : 0 }}
              transition={{ duration: 0.6 }}
              className="mt-6 text-[10px] tracking-[0.28em] uppercase text-white/45"
            >
              Press Esc to skip
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
