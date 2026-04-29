import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Frost = 'thin' | 'regular' | 'thick';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  frost?: Frost;
  lift?: boolean;
  sheen?: boolean;
  asChild?: boolean;
}

/**
 * Spatial OS frosted panel.
 * frost: blur intensity. lift: hover-elevate. sheen: light-sweep on hover.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel({ className, frost = 'regular', lift, sheen, children, ...rest }, ref) {
    const frostClass =
      frost === 'thin' ? 'spatial-glass-thin'
      : frost === 'thick' ? 'spatial-glass-thick'
      : '';
    return (
      <div
        ref={ref}
        className={cn(
          'spatial-glass',
          frostClass,
          lift && 'spatial-lift',
          sheen && 'spatial-sheen-on-hover',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);