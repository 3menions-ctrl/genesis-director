/**
 * FirstTakeTour — 4-step guided walk-through the user sees once, the
 * first time they land on /create. Pre-fills a sample prompt and
 * tooltips through the actual generation flow.
 *
 * Persistence: `profile.has_seen_first_take_tour` (a new column we'll
 * gate on; until the column exists, falls back to localStorage).
 *
 * UX:
 *   Step 1 → Welcome card with "Your first take is on us"
 *   Step 2 → Highlight the prompt field, paste a sample, explain pre-vis
 *   Step 3 → Highlight the mode picker, explain the difference
 *   Step 4 → "Hit the render button — we'll watch the dailies together"
 *
 * Skippable from any step. Marks complete on dismiss.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Wand2, Sparkles, Film, MonitorPlay } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';

const STORAGE_KEY = 'smallbridges.first_take_tour_done';
const SAMPLE_PROMPT =
  "A neon-lit Tokyo street at night, rain on the pavement, slow tracking shot toward a glowing ramen shop";

interface Step {
  title: string;
  body: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to the studio.',
    body:
      "We'll walk through one quick render together. Takes about 90 seconds, costs nothing.",
    icon: Sparkles,
  },
  {
    title: 'Step one — write the scene.',
    body:
      "You'll see a prompt box. Describe the shot in plain English. Camera moves, lighting, characters. We pre-rendered a sample for you.",
    icon: Wand2,
  },
  {
    title: 'Step two — pick the mode.',
    body:
      "Different modes are good for different shots. Text-to-video is the safest first choice — it composes from scratch. Avatar is for talking heads.",
    icon: Film,
  },
  {
    title: 'Step three — watch the dailies.',
    body:
      "Hit Render. You'll see the Production Slate appear shot by shot. Each take is logged. When it's done, the final video lands on the project page.",
    icon: MonitorPlay,
  },
];

export function FirstTakeTour() {
  const { user, profile } = useAuth();
  const { navigate } = useSafeNavigation();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  // Decide whether to show on mount.
  useEffect(() => {
    if (!user || !profile?.onboarding_completed) return;
    // Brand-new accounts only (no completed projects yet).
    if ((profile.total_credits_used ?? 0) > 0) return;
    let alreadySeen = false;
    try { alreadySeen = localStorage.getItem(STORAGE_KEY) === '1'; } catch {}
    if (alreadySeen) return;
    // Briefly delay so the landing transition completes first.
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [user, profile?.onboarding_completed, profile?.total_credits_used]);

  const close = (skipped = false) => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    if (!skipped) {
      // Drop the sample prompt into sessionStorage so the studio picks it up.
      try { sessionStorage.setItem('smallbridges.tour_prompt', SAMPLE_PROMPT); } catch {}
      navigate('/create?welcome=1');
    }
  };

  const next = () => {
    if (step >= STEPS.length - 1) {
      close(false);
    } else {
      setStep((s) => s + 1);
    }
  };

  if (!open) return null;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 backdrop-blur-md px-4"
      >
        <motion.div
          key={`tour-card-${step}`}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-2xl p-8 lg:p-10 overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 right-0 w-[320px] h-[320px] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(var(--brand) / 0.22), transparent 65%)',
              filter: 'blur(60px)',
            }}
          />
          {/* Close */}
          <button
            onClick={() => close(true)}
            aria-label="Skip tour"
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-glass-hover border border-white/10 text-white/55 hover:text-white hover:bg-glass-active flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            {/* Step progress */}
            <div className="flex items-center gap-1.5 mb-7">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-brand' : 'bg-glass-active'
                  }`}
                />
              ))}
            </div>

            <div className="w-12 h-12 rounded-2xl border border-white/10 bg-glass flex items-center justify-center mb-5">
              <Icon className="w-5 h-5 text-brand-light" strokeWidth={1.5} />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/30 mb-3">
              Step {step + 1} of {STEPS.length}
            </div>
            <h2
              className="font-display text-[24px] sm:text-[28px] font-light text-white leading-tight mb-3"
              style={{ fontVariant: 'small-caps' }}
            >
              {current.title}
            </h2>
            <p className="text-white/65 text-[14px] leading-relaxed mb-7">
              {current.body}
            </p>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => close(true)}
                className="text-[11px] uppercase tracking-[0.22em] text-white/45 hover:text-white transition-colors"
              >
                Skip the tour
              </button>
              <PrimaryCTA onClick={next} trailingIcon={ArrowRight}>
                {step >= STEPS.length - 1 ? 'Open the studio' : 'Next'}
              </PrimaryCTA>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default FirstTakeTour;
