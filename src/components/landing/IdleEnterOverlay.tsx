import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Briefcase, ArrowRight, X, Sparkles } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';

const IDLE_MS = 30_000;
const SESSION_KEY = 'idle_enter_seen';

/**
 * Fully-immersive idle overlay. After 30s of no user activity, fades in
 * a cinematic "Enter" chooser asking visitors to self-identify as
 * Business or Enterprise. One-shot per session.
 */
export const IdleEnterOverlay = memo(function IdleEnterOverlay() {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { navigate } = useSafeNavigation();

  const dismiss = useCallback(() => {
    setOpen(false);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
  }, []);

  const arm = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(SESSION_KEY) === '1') return;
      } catch {}
      setOpen(true);
    }, IDLE_MS);
  }, []);

  // Only arm the idle timer once Hoppy intro has had a chance — wait 8s after mount.
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!armed) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {}

    arm();
    const events: (keyof WindowEventMap)[] = ['mousemove','keydown','scroll','touchstart','click','wheel'];
    const reset = () => { if (!open) arm(); };
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [armed, arm, open]);

  // Lock scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const goBusiness = () => { dismiss(); navigate('/business/start'); };
  const goEnterprise = () => { dismiss(); navigate('/business/start'); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose your path"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }}
            animate={{ backdropFilter: 'blur(28px)', backgroundColor: 'rgba(0,0,0,0.78)' }}
            exit={{ backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0"
            style={{ WebkitBackdropFilter: 'blur(28px)' }}
            onClick={dismiss}
          />

          {/* Ambient drifting orbs */}
          <motion.div
            aria-hidden
            className="absolute -top-32 -left-32 w-[640px] h-[640px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsla(212,100%,55%,0.22), transparent 60%)' }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-32 -right-32 w-[640px] h-[640px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsla(195,100%,60%,0.18), transparent 60%)' }}
            animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Close"
            className="absolute top-6 right-6 w-10 h-10 rounded-full inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-glass-active transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="relative z-[1] max-w-5xl w-full mx-auto px-6 md:px-12 text-center"
          >
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 border border-white/10 bg-glass backdrop-blur"
            >
              <Sparkles className="w-3 h-3 text-primary/60" />
              <span className="text-[10px] tracking-[0.32em] uppercase text-white/65 font-medium">
                Choose your path
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.7 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-5 leading-[1.02]"
            >
              Welcome to{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #ffffff, #9DCBFF, #0A84FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Small Bridges
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.7 }}
              className="text-white/65 text-base md:text-lg font-light max-w-xl mx-auto mb-12 leading-relaxed"
            >
              Tell us how you'll be using the studio so we can tailor the experience.
            </motion.p>

            {/* Single path — Enterprise temporarily hidden */}
            <div className="grid grid-cols-1 gap-5 max-w-md mx-auto">
              <PathCard
                delay={0.65}
                onClick={goBusiness}
                icon={<Briefcase className="w-6 h-6" />}
                kicker="For Creators & Teams"
                title="Business"
                copy="Start instantly with credits. Solo, indie studios, and growing teams."
                accent="hsla(212,100%,60%,0.55)"
              />
            </div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              onClick={dismiss}
              className="mt-10 text-[11px] tracking-[0.22em] uppercase text-white/75 hover:text-white/70 transition-colors"
            >
              Continue browsing
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function PathCard({
  delay, onClick, icon, kicker, title, copy, accent, premium,
}: {
  delay: number;
  onClick: () => void;
  icon: React.ReactNode;
  kicker: string;
  title: string;
  copy: string;
  accent: string;
  premium?: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative text-left p-7 md:p-8 rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
        border: '1px solid hsla(0,0%,100%,0.08)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      {/* Hover glow */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${accent}, transparent 60%)`,
        }}
      />
      {/* Top hairline */}
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {premium && (
        <span
          className="absolute top-5 right-5 text-[9px] tracking-[0.28em] uppercase font-semibold px-2 py-0.5 rounded-full text-white"
          style={{
            background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
            boxShadow: '0 0 18px hsla(212,100%,55%,0.45)',
          }}
        >
          Bespoke
        </span>
      )}

      <div
        className="relative w-12 h-12 rounded-xl inline-flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          border: '1px solid hsla(0,0%,100%,0.08)',
          color: '#9DCBFF',
        }}
      >
        {icon}
      </div>

      <p className="text-[10px] tracking-[0.28em] uppercase text-white/45 font-medium mb-2">
        {kicker}
      </p>
      <h3 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-white/55 text-sm font-light leading-relaxed mb-6">
        {copy}
      </p>

      <div className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.18em] uppercase text-white/85 group-hover:text-white transition-colors">
        <span>Continue</span>
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
  );
}

IdleEnterOverlay.displayName = 'IdleEnterOverlay';
