/**
 * EmptyState — single shared primitive for "nothing here yet" surfaces.
 *
 * Replaces five hand-rolled variants across Projects, MediaLibrary,
 * Notifications, workspace pages, and admin pages. Every empty surface
 * should guide the operator to a concrete next action — that's why a primary
 * CTA is the default expectation, not a nicety.
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';

export interface EmptyStateProps {
  /** Icon component (lucide-react preferred). */
  icon?: React.ElementType;
  /** Headline — short, declarative ("No projects yet"). */
  title: string;
  /** One sentence on what the operator can do next. */
  description?: string;
  /** Primary call to action. Almost always present. */
  cta?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
  };
  /** Optional secondary action (link to docs, browse templates, etc.). */
  secondaryCta?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Suggestions — concrete things the operator can copy or click. Examples:
   * sample prompts, popular templates, common starting points. Optional.
   */
  examples?: {
    label: string;
    onClick?: () => void;
  }[];
  /** Layout density. `compact` for tabs, `full` for first-page surfaces. */
  size?: 'compact' | 'full';
  className?: string;
  /** Additional content slot below the CTA row. */
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  secondaryCta,
  examples,
  size = 'full',
  className,
  children,
}: EmptyStateProps) {
  const isFull = size === 'full';

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        isFull ? 'px-6 py-20' : 'px-4 py-12',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'rounded-2xl border border-white/[0.06] bg-glass flex items-center justify-center mb-5',
            isFull ? 'w-14 h-14' : 'w-10 h-10',
          )}
        >
          <Icon className={cn('text-brand-light', isFull ? 'w-6 h-6' : 'w-4 h-4')} strokeWidth={1.5} />
        </div>
      )}

      <h3
        className={cn(
          'text-white font-display font-light',
          isFull ? 'text-[22px]' : 'text-[16px]',
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'text-white/55 max-w-md leading-relaxed mt-3',
            isFull ? 'text-[14px]' : 'text-[12px]',
          )}
        >
          {description}
        </p>
      )}

      {(cta || secondaryCta) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {cta && (
            <PrimaryCTA size="lg" onClick={cta.onClick} icon={cta.icon}>
              {cta.label}
            </PrimaryCTA>
          )}
          {secondaryCta && (
            <button
              onClick={secondaryCta.onClick}
              className="text-[12px] uppercase tracking-[0.22em] text-white/55 hover:text-white px-5 py-3 rounded-lg border border-white/[0.06] hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-colors"
            >
              {secondaryCta.label}
            </button>
          )}
        </div>
      )}

      {examples && examples.length > 0 && (
        <div className="mt-10 w-full max-w-lg">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30 mb-3">
            Try one of these
          </div>
          <ul className="space-y-2">
            {examples.map((e, i) => (
              <li key={i}>
                <button
                  onClick={e.onClick}
                  disabled={!e.onClick}
                  className="w-full text-left px-4 py-3 rounded-xl border border-white/[0.06] bg-glass hover:bg-glass-hover hover:border-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-colors text-[13px] text-white/75 leading-relaxed disabled:cursor-default disabled:hover:bg-glass disabled:hover:border-white/[0.06]"
                >
                  {e.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </div>
  );
}
