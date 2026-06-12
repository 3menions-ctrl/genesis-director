/**
 * PrimaryCTA — the canonical "blue gradient pill" call-to-action button.
 *
 * Replaces 6+ copy-pasted instances of the same gradient block
 * (`from-[#0A84FF] to-[#0A6CCC]`). Use this for *every* primary action in
 * the consumer + admin surfaces.
 *
 * Visual contract:
 *   • Mono-spaced 11px uppercase label, tracking 0.22em (cinema-mono).
 *   • Vertical gradient blue → darker blue, soft glow on hover.
 *   • Built-in spinner state via `loading`.
 *   • Optional leading + trailing icons.
 *   • Renders an <a> when `href` is set (preserves underline-free pill look).
 */

import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface PrimaryCTAProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  /** Lucide icon component to render before the label. */
  icon?: React.ElementType;
  /** Lucide icon component to render after the label. */
  trailingIcon?: React.ElementType;
  /** Render an <a> instead of <button>. */
  href?: string;
  /** External-link target. */
  target?: string;
  /** Show inline spinner; also sets aria-busy. */
  loading?: boolean;
  /** Visual scale. */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'px-4 py-2 text-[10px]',
  md: 'px-5 py-2.5 text-[11px]',
  lg: 'px-6 py-3 text-[12px]',
} as const;

const iconSize = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
} as const;

export const PrimaryCTA = forwardRef<HTMLButtonElement, PrimaryCTAProps>(
  function PrimaryCTA(
    {
      children,
      icon: Icon,
      trailingIcon: TrailingIcon,
      href,
      target,
      loading = false,
      disabled,
      size = 'md',
      className,
      ...rest
    },
    ref,
  ) {
    const klass = cn(
      'group inline-flex items-center gap-2 uppercase tracking-[0.22em] font-semibold text-white rounded-lg border border-brand/50 bg-gradient-to-b from-brand to-brand-dark shadow-[0_8px_24px_-10px_hsl(var(--brand)/0.6)] hover:shadow-[0_12px_32px_-10px_hsl(var(--brand)/0.8)] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_8px_24px_-10px_hsl(var(--brand)/0.6)]',
      sizeClass[size],
      className,
    );

    const content = (
      <>
        {loading ? (
          <Loader2 className={cn(iconSize[size], 'animate-spin')} />
        ) : Icon ? (
          <Icon className={iconSize[size]} />
        ) : null}
        {children}
        {TrailingIcon && !loading && (
          <TrailingIcon
            className={cn(
              iconSize[size],
              'group-hover:translate-x-0.5 transition-transform',
            )}
          />
        )}
      </>
    );

    if (href) {
      return (
        <a
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className={klass}
          aria-busy={loading || undefined}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={klass}
        {...rest}
      >
        {content}
      </button>
    );
  },
);
