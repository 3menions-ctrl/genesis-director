/**
 * BetaHero — the editorial hero band used across beta-free surfaces.
 *
 * Replaces 6+ copy-pasted instances of the same gradient card + blurred
 * radial glow + eyebrow row. Compose with `<Stat />` children for the
 * right-rail metrics treatment.
 *
 * Visual contract:
 *   • Rounded-3xl card on white/[0.025] gradient + 60px-blur radial in
 *     the upper-right (canonical primary glow).
 *   • Pill eyebrow + thin divider + small-caps secondary label.
 *   • Display-font title via `font-display font-light`.
 *   • Optional body paragraph.
 *   • Right rail for `<Stat />` cells (lg breakpoint).
 *
 * Sizing: `compact` for inline cards (StartOnboarding plan step),
 * `default` for page heroes (Credits, WelcomeCheckout).
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BetaHeroProps {
  /** Pill eyebrow text. Defaults to "BETA · FREE" for free-beta surfaces. */
  badge?: string;
  /** Small-caps label to the right of the divider. */
  eyebrow?: string;
  /** The display headline. */
  title: ReactNode;
  /** Body copy beneath the title. */
  body?: ReactNode;
  /** Optional right-rail slot (use `<Stat />` cells). */
  rail?: ReactNode;
  /** Optional actions row beneath the body (CTAs etc.). */
  actions?: ReactNode;
  /** Density: `compact` reduces padding for inline cards. */
  size?: 'default' | 'compact';
  className?: string;
}

export function BetaHero({
  badge = 'BETA · FREE',
  eyebrow,
  title,
  body,
  rail,
  actions,
  size = 'default',
  className,
}: BetaHeroProps) {
  const isCompact = size === 'compact';
  return (
    <section
      className={cn(
        'relative rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent overflow-hidden',
        isCompact ? 'p-8' : 'p-8 lg:p-10',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--brand) / 0.14), transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      <div className="relative flex flex-col lg:flex-row gap-8 lg:items-end justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <span className="px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/[0.06] text-emerald-300 text-[9px] font-mono font-bold tracking-[0.32em] uppercase">
              {badge}
            </span>
            {eyebrow && (
              <>
                <span className="h-px w-8 bg-white/10" />
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
                  {eyebrow}
                </span>
              </>
            )}
          </div>
          <h1
            className={cn(
              'font-display font-light text-white leading-[1.05]',
              isCompact ? 'text-[26px]' : 'text-[36px] lg:text-[44px]',
            )}
          >
            {title}
          </h1>
          {body && (
            <div className="text-white/65 text-[14px] lg:text-[15px] mt-4 max-w-xl leading-relaxed">
              {body}
            </div>
          )}
          {actions && <div className="mt-7">{actions}</div>}
        </div>
        {rail && <div className="shrink-0">{rail}</div>}
      </div>
    </section>
  );
}

/**
 * Stat — the matching small-cap label + display-number cell intended to live
 * inside `<BetaHero rail={…} />`. Place 2–4 of these in a flex/grid.
 */
export function Stat({
  label,
  value,
  tone = 'neutral',
  trend,
}: {
  label: string;
  value: ReactNode;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'neutral';
  trend?: string;
}) {
  const toneClass =
    tone === 'blue'
      ? 'text-brand-light'
      : tone === 'emerald'
        ? 'text-emerald-300'
        : tone === 'amber'
          ? 'text-amber-300'
          : tone === 'rose'
            ? 'text-rose-300'
            : 'text-white';
  return (
    <div>
      <div className="text-[9px] text-white/35 font-mono uppercase tracking-[0.32em] mb-2">
        {label}
      </div>
      <div className={cn('text-3xl font-display font-light tabular-nums', toneClass)}>
        {value}
      </div>
      {trend && (
        <div className="text-[10px] text-white/30 mt-1 font-mono uppercase tracking-[0.2em]">
          {trend}
        </div>
      )}
    </div>
  );
}

/**
 * StatGrid — convenience wrapper for the most common rail layout.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-6 lg:gap-10">{children}</div>
  );
}
