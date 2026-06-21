import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { BrandTile } from '@/components/cinema/Logo';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
}

const sizeMap = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
};

/**
 * Logo — the single canonical Small Bridges lockup, used app-wide.
 *
 * Renders the premium arch + glowing-keystone Brandmark inside its rounded
 * tile, plus (optionally) the gradient-ink "Small Bridges" wordmark. It reuses
 * BrandTile from components/cinema/Logo so the in-app logo can never drift from
 * the marketing/tour mark — there is exactly one logo design everywhere.
 */
export const Logo = memo(forwardRef<HTMLDivElement, LogoProps>(
  function Logo({ className, size = 'md', showText = false, textClassName }, ref) {
    return (
      <div ref={ref} className={cn("flex items-center gap-2.5", className)}>
        <BrandTile className={sizeMap[size]} />
        {showText && (
          <span
            className={cn("font-display text-[17px] tracking-[-0.01em]", textClassName)}
            style={{
              background: "linear-gradient(180deg,#ffffff 0%,#d4e0f3 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Small <span className="font-semibold italic">Bridges</span>
          </span>
        )}
      </div>
    );
  }
));

Logo.displayName = 'Logo';
