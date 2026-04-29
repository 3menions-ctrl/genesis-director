import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Width = 'narrow' | 'default' | 'wide' | 'full';

const widthMap: Record<Width, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

interface PageShellProps {
  children: ReactNode;
  width?: Width;
  className?: string;
  /** Bottom padding for sticky elements / breathing room */
  pad?: boolean;
}

/**
 * PageShell — consistent page chrome for in-app pages.
 * Provides editorial vertical rhythm and centered max-width.
 */
export function PageShell({ children, width = 'wide', className, pad = true }: PageShellProps) {
  return (
    <main
      className={cn(
        'relative z-10 mx-auto w-full px-6 sm:px-8 lg:px-10',
        'pt-24 sm:pt-28',
        pad && 'pb-24',
        widthMap[width],
        className
      )}
    >
      {children}
    </main>
  );
}

export default PageShell;