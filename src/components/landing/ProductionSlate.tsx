/**
 * ProductionSlate — premium glass-and-brass film slate between sections.
 *
 * The visual idiom is "vintage hand-finished clapperboard left on the
 * apple-box between takes": warm-brass uppers, transparent smoked-glass
 * lower with the slate's metadata, hairline brass etching, and film-
 * perforation rails down the long edges. The clapper claps softly into
 * place on scroll-in (or sits still under prefers-reduced-motion).
 *
 * Visual layers (top → bottom):
 *   1. Soft amber halo behind the slate.
 *   2. Film-perforation rail on left + right edges.
 *   3. The clapper "sticks" — translucent warm-graphite + soft-beige
 *      stripes (NOT stark white/black — the perceived premium delta is
 *      what you're paying for).
 *   4. Hairline brass top-edge highlight on the clapper.
 *   5. The slate body — translucent smoked glass with two bands of
 *      hairline-brass-divided metadata.
 *   6. Slug headline in Fraunces small-caps with a tapered brass underline.
 *   7. Floor reflection blur to ground the slate.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface ProductionSlateProps {
  scene: string;
  location: string;
  timeOfDay?: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' | 'CONTINUOUS';
  intExt?: 'INT.' | 'EXT.';
  take?: number;
  roll?: string;
  className?: string;
  /** Eyebrow label rendered above the slate ("UP NEXT"). */
  eyebrow?: string;
}

export const ProductionSlate = memo(function ProductionSlate({
  scene,
  location,
  timeOfDay = 'DAY',
  intExt = 'INT.',
  take = 1,
  roll = '2026.06',
  className,
  eyebrow,
}: ProductionSlateProps) {
  const reduced = useReducedMotion();
  const today = new Date()
    .toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();

  return (
    <div className={cn('relative my-24 lg:my-32 flex justify-center px-6', className)}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.985 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[680px]"
      >
        {eyebrow && (
          <div className="text-center mb-5 text-[9px] font-mono uppercase tracking-[0.4em] text-white/30">
            <span className="inline-flex items-center gap-2">
              <span className="w-6 h-px bg-gradient-to-r from-transparent to-white/30" />
              {eyebrow}
              <span className="w-6 h-px bg-gradient-to-l from-transparent to-white/30" />
            </span>
          </div>
        )}

        {/* Amber halo behind the slate */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 rounded-[28px] opacity-70 blur-3xl"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 40%, hsl(40 60% 50% / 0.10) 0%, transparent 70%)',
          }}
        />

        {/* Outer card — translucent smoked glass with hairline brass border */}
        <div
          className="relative overflow-hidden rounded-[14px]"
          style={{
            background:
              'linear-gradient(180deg, hsl(40 18% 8% / 0.55) 0%, hsl(40 18% 4% / 0.78) 100%)',
            backdropFilter: 'blur(14px) saturate(140%)',
            WebkitBackdropFilter: 'blur(14px) saturate(140%)',
            boxShadow:
              '0 24px 60px -28px hsl(40 60% 10% / 0.65), 0 0 0 1px hsl(40 35% 55% / 0.18) inset, 0 0 0 0.5px hsl(40 50% 80% / 0.10)',
          }}
        >
          {/* Film perforation rails — left and right vertical edges */}
          <FilmPerforation side="left" />
          <FilmPerforation side="right" />

          {/* Slate body with internal padding (clears the perf rails) */}
          <div className="relative pl-9 pr-9">
            {/* The clapper — translucent warm-graphite + soft-beige stripes */}
            <motion.div
              className="relative h-9 overflow-hidden"
              initial={reduced ? false : { y: -42, rotate: -2 }}
              whileInView={
                reduced ? undefined : {
                  y: [-42, 1.2, 0, 0],
                  rotate: [-2, -0.5, 0, 0],
                }
              }
              viewport={{ once: true, margin: '-80px' }}
              transition={{
                duration: 0.85,
                ease: [0.18, 1.2, 0.3, 1],
                times: [0, 0.62, 0.82, 1],
              }}
              aria-hidden
              style={{
                backgroundImage:
                  'repeating-linear-gradient(112deg, hsl(40 18% 80% / 0.78) 0 22px, hsl(220 14% 10% / 0.88) 22px 44px)',
                opacity: 0.92,
              }}
            />

            {/* Hairline brass top-edge highlight on the clapper */}
            <div
              aria-hidden
              className="absolute top-9 left-9 right-9 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, hsl(40 80% 70% / 0.32) 18%, hsl(40 80% 70% / 0.32) 82%, transparent 100%)',
              }}
            />

            {/* Flash on clap — warm-tinted */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ background: 'rgba(255,220,160,0)' }}
              whileInView={
                reduced ? undefined : {
                  background: [
                    'rgba(255,220,160,0)',
                    'rgba(255,220,160,0.12)',
                    'rgba(255,220,160,0)',
                  ],
                }
              }
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.85, times: [0, 0.62, 0.78], ease: 'linear' }}
              aria-hidden
            />

            {/* Production row — eyebrow + roll + date */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/45">
                PROD. Small Bridges
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/45 flex items-center gap-2">
                <span>ROLL <span className="text-white/70">{roll}</span></span>
                <span className="opacity-30">·</span>
                <span className="text-white/55 tabular-nums">{today}</span>
              </div>
            </div>

            {/* Hairline brass divider */}
            <div
              aria-hidden
              className="mx-6"
              style={{
                height: 1,
                background:
                  'linear-gradient(90deg, transparent 0%, hsl(40 70% 65% / 0.22) 30%, hsl(40 70% 65% / 0.22) 70%, transparent 100%)',
              }}
            />

            {/* Scene + take */}
            <div className="grid grid-cols-12 gap-3 px-6 pt-5 pb-2">
              <div className="col-span-6">
                <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-white/30 mb-1">
                  Scene
                </div>
                <div className="font-mono text-[15px] tracking-[0.22em] text-white/95">
                  {scene}
                </div>
              </div>
              <div className="col-span-6 text-right">
                <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-white/30 mb-1">
                  Take
                </div>
                <div className="font-mono text-[15px] tracking-[0.22em] text-white/95 tabular-nums">
                  {String(take).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Slug — the headline */}
            <div className="px-6 pt-3 pb-7">
              <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-white/30 mb-2">
                Slug
              </div>
              <div
                className="font-display text-[22px] lg:text-[26px] text-white/95 leading-tight inline-block relative pb-1.5"
                style={{ fontVariant: 'small-caps', fontWeight: 300 }}
              >
                {intExt} {location} — {timeOfDay}
                {/* Tapered brass underline */}
                <span
                  aria-hidden
                  className="absolute left-0 bottom-0 h-px"
                  style={{
                    width: '62%',
                    background:
                      'linear-gradient(90deg, hsl(40 80% 65% / 0.55) 0%, hsl(40 80% 65% / 0) 100%)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Floor reflection / glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 w-[55%] h-10 rounded-[50%] blur-2xl opacity-50"
          style={{
            background:
              'radial-gradient(50% 50% at 50% 50%, hsl(40 80% 60% / 0.18) 0%, transparent 70%)',
          }}
        />
      </motion.div>
    </div>
  );
});

function FilmPerforation({ side }: { side: 'left' | 'right' }) {
  const HOLES = 9;
  return (
    <div
      aria-hidden
      className={cn(
        'absolute top-0 bottom-0 w-7 pointer-events-none flex flex-col justify-evenly items-center',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{
        background:
          side === 'left'
            ? 'linear-gradient(90deg, hsl(40 20% 6% / 0.55) 0%, hsl(40 20% 6% / 0.18) 100%)'
            : 'linear-gradient(-90deg, hsl(40 20% 6% / 0.55) 0%, hsl(40 20% 6% / 0.18) 100%)',
      }}
    >
      {Array.from({ length: HOLES }).map((_, i) => (
        <div
          key={i}
          className="w-3 h-2 rounded-[2px]"
          style={{
            background:
              'linear-gradient(180deg, hsl(220 14% 1%) 0%, hsl(220 14% 2.5%) 60%, hsl(220 14% 1%) 100%)',
            boxShadow:
              'inset 0 0 0 0.5px hsl(40 60% 70% / 0.08), inset 0 1px 1px hsl(0 0% 0% / 0.6)',
          }}
        />
      ))}
    </div>
  );
}

export default ProductionSlate;
