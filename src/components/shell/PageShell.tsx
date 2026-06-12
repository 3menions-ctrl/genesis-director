import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Width = 'narrow' | 'default' | 'wide' | 'gallery' | 'full';

// Canonical content widths.
//   narrow  — focused reading / forms (Auth-adjacent personal flows)
//   default — most personal pages (Settings, Profile, Notifications)
//   wide    — the standard app-content width (Credits, SupportInbox, library)
//   gallery — for grids that need extra breathing room (Projects, MediaLibrary)
//   full    — opt-out for pages providing their own container
const widthMap: Record<Width, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  gallery: 'max-w-[1800px]',
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
 *
 * Rendered as a `<section>` because AppShell already owns the single
 * `<main>` landmark for the route — two `<main>` elements per page
 * confuses screen readers and trips the a11y audit.
 */
export function PageShell({ children, width = 'wide', className, pad = true }: PageShellProps) {
  return (
    <section
      role="region"
      aria-label="Page content"
      className={cn(
        // min-h-dvh holds the layout open during route swaps so the
        // sidebar/header stay anchored and content does not collapse
        // to 0 height between data fetches.
        'relative z-10 mx-auto w-full min-h-dvh px-6 sm:px-8 lg:px-10',
        // The global AppShell already provides a sticky 56px topbar, so we only
        // add a small breathing-room top padding here.
        'pt-6 sm:pt-8',
        pad && 'pb-24',
        widthMap[width],
        className
      )}
    >
      {children}
    </section>
  );
}

export default PageShell;