import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import heroVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import heroPoster from '@/assets/landing-immersive-hero.jpg';

const IDLE_MS = 10_000;
const SESSION_KEY = 'hoppy_intro_shown';

export const HoppyImmersiveIntro = memo(function HoppyImmersiveIntro() {
  const [open, setOpen] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<number | null>(null);
  const hasShown = useRef(false);

  const dismiss = useCallback(() => {
    setOpen(false);
    setShowEnter(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  // Idle detection
  useEffect(() => {
    // One-shot per session to avoid annoyance
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      hasShown.current = true;
      return;
    }

    const trigger = () => {
      if (hasShown.current) return;
      hasShown.current = true;
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      setOpen(true);
    };

    const reset = () => {
      if (hasShown.current) return;
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(trigger, IDLE_MS);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, []);

  // Reveal Enter button shortly after intro starts
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setShowEnter(true), 1800);
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => undefined);
    }
    // Esc to dismiss
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
          aria-label="Immersive intro"
        >
          {/* Cinematic video */}
          <video
            ref={videoRef}
            src={heroVideo.url}
            poster={heroPoster}
            muted
            playsInline
            autoPlay
            loop
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Vignette + gradient grade */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.92) 100%)',
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />

          {/* Skip (top-right) */}
          <button
            onClick={dismiss}
            className="absolute top-6 right-6 text-[11px] tracking-[0.22em] uppercase text-white/55 hover:text-white transition-colors"
          >
            Skip intro
          </button>

          {/* Centered title + Enter */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-20 md:pb-28 px-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-[11px] font-medium text-[#0A84FF] tracking-[0.32em] uppercase mb-4"
            >
              Apex Studio
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-white text-center text-4xl md:text-7xl font-bold tracking-tight leading-[1.02] max-w-4xl"
            >
              Cinematic ad creative,<br />on demand.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.8 }}
              className="mt-5 text-white/65 max-w-xl text-center text-base md:text-lg font-light"
            >
              The AI-native studio for high-performing marketing teams.
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
