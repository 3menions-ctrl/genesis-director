/**
 * Spinner — the canonical loading indicator.
 *
 * Replaces both the raw `<Loader2 />` calls (which inherit Tailwind text color
 * inconsistently) and the inline `border-2 border-white/20 border-t-white
 * rounded-full animate-spin` blocks scattered through Landing/Production.
 *
 * Use this everywhere a brief loading state needs to render. For full-page
 * loaders that need messaging, use `CinemaLoader` instead.
 */

import { cn } from '@/lib/utils';

export interface SpinnerProps {
  /** Visual scale. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Tone: by default a soft white-on-glass for dark UI. */
  tone?: 'default' | 'muted' | 'primary' | 'inherit';
  className?: string;
  /** Accessible label; falls back to "Loading" if unset. */
  label?: string;
}

const sizeMap = {
  xs: 'w-3 h-3 border',
  sm: 'w-3.5 h-3.5 border-[1.5px]',
  md: 'w-5 h-5 border-2',
  lg: 'w-6 h-6 border-2',
  xl: 'w-8 h-8 border-[3px]',
} as const;

const toneMap = {
  default: 'border-white/20 border-t-white',
  muted: 'border-white/[0.08] border-t-white/45',
  primary: 'border-brand/20 border-t-brand',
  inherit: 'border-current/20 border-t-current',
} as const;

export function Spinner({
  size = 'md',
  tone = 'default',
  className,
  label = 'Loading',
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('rounded-full animate-spin', sizeMap[size], toneMap[tone], className)}
    />
  );
}
