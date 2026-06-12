import { memo, forwardRef } from 'react';
import { Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AvatarsHeroProps {
  totalCount?: number;
  realisticCount?: number;
  animatedCount?: number;
  voiceCount?: number;
}

/**
 * AvatarsHero — mirrors the Create page's cinematic hero composition.
 * Live eyebrow → oversized display title with a gradient highlight →
 * soft body copy on the left, right-side mode ticker, then a hairline.
 * Boundary-less, no container chrome — pure editorial typography.
 */
export const AvatarsHero = memo(forwardRef<HTMLElement, AvatarsHeroProps>(function AvatarsHero(
  _props,
  ref,
) {
  return (
    <section ref={ref} className="relative pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <style>{`
        @keyframes avatarsTick { 0%,100%{opacity:.35} 50%{opacity:1} }
      `}</style>

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-10 sm:mb-14"
      >
        {/* Live eyebrow */}
        <div className="flex items-center gap-2 mb-5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground font-medium">
            Small Bridges · Cast
          </span>
        </div>

        <div className="flex items-end justify-between gap-8 flex-wrap">
          <div className="min-w-0 max-w-3xl">
            <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.035em] font-medium">
              <span className="text-foreground/95">Cast your</span>{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, hsl(212 100% 70%) 0%, hsl(190 100% 70%) 45%, hsl(212 100% 85%) 100%)',
                }}
              >
                presenter.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-5 leading-relaxed font-light max-w-xl">
              Choose a photoreal or animated lead for your next cinematic story — voice, motion, and identity locked end-to-end.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[10px] uppercase tracking-[0.32em] text-foreground/80 font-medium">
            <span className="inline-flex items-center gap-2 mr-1">
              <Wand2 className="w-3.5 h-3.5 text-primary/80" />
              Director Cast
            </span>
            {['Identity', 'Voice', 'Lip-Sync'].map((t, i) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span
                  className="w-1 h-1 rounded-full bg-[hsl(var(--primary))]"
                  style={{ animation: `avatarsTick 2.4s ease-in-out ${i * 0.4}s infinite` }}
                />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* hairline */}
        <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
      </motion.header>
    </section>
  );
}));

AvatarsHero.displayName = 'AvatarsHero';

export default AvatarsHero;
