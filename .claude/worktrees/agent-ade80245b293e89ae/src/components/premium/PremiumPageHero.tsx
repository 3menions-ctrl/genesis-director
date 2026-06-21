import { memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

/**
 * PremiumPageHero — shared editorial hero matching the Projects page gold standard.
 * Pro-Dark, blue accent, Sora display, ambient glow, status pill, gradient title,
 * optional CTA slot and stats strip. Page-level accent hue is configurable.
 */

export interface HeroStat {
  label: string;
  value: string | number;
  /** Tailwind class for the value color, e.g. text-white, text-[hsl(var(--primary))] */
  accent?: string;
  icon?: LucideIcon;
}

export interface PremiumPageHeroProps {
  /** Eyebrow pill text, e.g. "Studio · Live" */
  eyebrow: string;
  /** Title parts: prefix, gradient highlight word, suffix */
  titlePrefix?: string;
  titleHighlight: string;
  titleSuffix?: string;
  /** Sub-headline */
  description?: string;
  /** Optional small status dot color (HSL var name e.g. "var(--success)") */
  statusColor?: string;
  /** Right side CTA(s) */
  actions?: ReactNode;
  /** Optional stat strip; 2-5 items */
  stats?: HeroStat[];
  /** Optional accent hue for the gradient highlight word (HSL var token, defaults to primary) */
  highlightHue?: string;
  /** Below-stats slot (e.g. tabs / filters) */
  children?: ReactNode;
  className?: string;
}

export const PremiumPageHero = memo(function PremiumPageHero({
  eyebrow,
  titlePrefix,
  titleHighlight,
  titleSuffix,
  description,
  statusColor = 'var(--success)',
  actions,
  stats,
  highlightHue,
  children,
  className,
}: PremiumPageHeroProps) {
  const hue = highlightHue || 'var(--primary)';

  return (
    <header className={cn('relative mb-10 sm:mb-14 animate-fade-in', className)}>
      {/* Luminous top hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-px left-0 right-0 h-px -z-10"
        style={{
          background: `linear-gradient(90deg, transparent 0%, hsl(${hue} / 0.55) 18%, hsl(${hue} / 0.9) 50%, hsl(${hue} / 0.55) 82%, transparent 100%)`,
          boxShadow: `0 0 24px hsl(${hue} / 0.45)`,
        }}
      />
      {/* Conic aurora behind title */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-10 right-0 h-[320px] -z-10 opacity-80"
        style={{
          background:
            `conic-gradient(from 200deg at 18% 50%, transparent 0deg, hsl(${hue} / 0.18) 60deg, transparent 140deg, hsl(var(--accent) / 0.10) 230deg, transparent 320deg),` +
            `radial-gradient(620px 240px at 12% 40%, hsl(${hue} / 0.18), transparent 60%),` +
            'radial-gradient(520px 220px at 78% 10%, hsl(var(--accent) / 0.10), transparent 65%)',
          filter: 'blur(12px)',
        }}
      />
      {/* Film grain wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06 0 0 0 0 0.07 0 0 0 0 0.08 0 0 0 0.65 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {/* Status pill + diagnostic */}
          <div className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full border border-white/[0.07] bg-white/[0.03] backdrop-blur-md mb-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping"
                style={{ backgroundColor: `hsl(${statusColor})` }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: `hsl(${statusColor})` }}
              />
            </span>
            <span className="text-[10px] uppercase tracking-[0.32em] text-white/55 font-medium font-mono">
              {eyebrow}
            </span>
            <span aria-hidden className="h-3 w-px bg-white/10" />
            <span className="text-[10px] uppercase tracking-[0.32em] text-white/30 font-mono tabular-nums">
              {String(((titleHighlight || '').length * 37) % 9999).padStart(4, '0')}
            </span>
          </div>

          {/* Display title with gradient accent */}
          <h1 className="font-display font-semibold tracking-[-0.03em] text-[40px] sm:text-[56px] leading-[1.02] text-white">
            {titlePrefix && <>{titlePrefix} </>}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(110deg, hsl(var(--foreground)) 0%, hsl(${hue}) 55%, hsl(var(--foreground)) 100%)`,
              }}
            >
              {titleHighlight}
            </span>
            {titleSuffix && <> {titleSuffix}</>}
          </h1>

          {description && (
            <p className="text-[14px] sm:text-[15px] text-white/45 mt-3 max-w-xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {/* Stat strip */}
      {stats && stats.length > 0 && (
        <div
          className="relative"
        >
          {/* corner ticks */}
          <span aria-hidden className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-white/15" />
          <span aria-hidden className="absolute -top-1 -right-1 w-3 h-3 border-t border-r border-white/15" />
          <span aria-hidden className="absolute -bottom-1 -left-1 w-3 h-3 border-b border-l border-white/15" />
          <span aria-hidden className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-white/15" />
          <div
          className={cn(
            'mt-8 grid gap-px rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm shadow-[0_30px_80px_-40px_hsl(220_14%_0%/0.9)]',
            stats.length === 2 && 'grid-cols-2',
            stats.length === 3 && 'grid-cols-2 sm:grid-cols-3',
            stats.length === 4 && 'grid-cols-2 sm:grid-cols-4',
            stats.length >= 5 && 'grid-cols-2 sm:grid-cols-5',
          )}
        >
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="group relative px-5 py-4 bg-[hsl(220_14%_3%/0.6)] transition-colors hover:bg-[hsl(220_14%_4%/0.7)]">
                {/* hover halo */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(180px 80px at 50% 100%, hsl(${hue} / 0.18), transparent 70%)` }}
                />
                <div className="relative flex items-center gap-1.5 text-[9px] uppercase tracking-[0.28em] text-white/35 font-medium font-mono">
                  {Icon && <Icon className="w-3 h-3" />}
                  {s.label}
                </div>
                <div
                  className={cn(
                    'relative mt-1.5 font-display font-semibold text-[22px] sm:text-[26px] tabular-nums tracking-tight',
                    s.accent || 'text-white',
                  )}
                >
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {children && <div className="mt-7">{children}</div>}
    </header>
  );
});

/**
 * PremiumHeroButton — a primary CTA matching the Projects "New project" button.
 */
export const PremiumHeroButton = memo(function PremiumHeroButton({
  onClick,
  icon: Icon,
  children,
  variant = 'primary',
}: {
  onClick?: () => void;
  icon?: LucideIcon;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  if (variant === 'ghost') {
    return (
      <button
        onClick={onClick}
        className="group relative h-11 px-5 rounded-full font-medium text-[13px] inline-flex items-center gap-2 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md text-white/80 hover:text-white transition-all"
      >
        {Icon && <Icon className="w-4 h-4" />}
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group relative h-11 px-6 rounded-full font-medium text-[13px] inline-flex items-center gap-2 overflow-hidden transition-all duration-300 text-primary-foreground border border-[hsl(var(--primary)/0.5)] bg-gradient-to-b from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] hover:from-[hsl(var(--primary)/0.95)] hover:to-[hsl(var(--primary)/0.8)] shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.7),inset_0_1px_0_hsl(0_0%_100%/0.2)]"
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)',
        }}
      />
      {Icon && <Icon className="w-4 h-4 relative" />}
      <span className="relative">{children}</span>
    </button>
  );
});

export default PremiumPageHero;