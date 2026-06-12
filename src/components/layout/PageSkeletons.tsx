/**
 * PageSkeletons — layout-correct placeholders that pre-render the *shape*
 * of the destination route while the route's chunk + initial data fetches.
 *
 * Each skeleton mirrors the canonical structure of its destination so the
 * cross-dissolve view-transition feels like "the same page filling in",
 * not "blank screen → flash → content".
 */

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

function Shimmer({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-white/[0.025]', className)}
      style={{
        background:
          'linear-gradient(90deg, hsl(0 0% 100% / 0.02) 0%, hsl(0 0% 100% / 0.05) 50%, hsl(0 0% 100% / 0.02) 100%)',
        backgroundSize: '200% 100%',
        animation: `app-shimmer ${1.4 + delay * 0.18}s linear infinite`,
        animationDelay: `${delay * 0.05}s`,
      }}
    />
  );
}

function SkelHero() {
  return (
    <div className="relative rounded-3xl border border-white/[0.06] bg-white/[0.012] p-8 lg:p-10 overflow-hidden mb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 right-0 w-[420px] h-[420px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--brand) / 0.10), transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      <div className="relative flex flex-col lg:flex-row gap-8 lg:items-end">
        <div className="flex-1 space-y-4">
          <Shimmer className="h-3 w-28" />
          <Shimmer className="h-9 w-3/4 sm:w-2/3" />
          <Shimmer className="h-3.5 w-full max-w-md" delay={1} />
          <Shimmer className="h-3.5 w-5/6 max-w-md" delay={2} />
        </div>
        <div className="shrink-0 grid grid-cols-3 gap-6 lg:gap-10">
          <Shimmer className="h-12 w-16" delay={1} />
          <Shimmer className="h-12 w-16" delay={2} />
          <Shimmer className="h-12 w-16" delay={3} />
        </div>
      </div>
    </div>
  );
}

function SkelGrid({
  cols = 3,
  count = 9,
  aspect = '1 / 1',
}: {
  cols?: number;
  count?: number;
  aspect?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-3 lg:gap-4',
        cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className="w-full rounded-2xl" delay={i} style={{ aspectRatio: aspect }} />
      ))}
    </div>
  );
}

// Type widening for Shimmer to accept inline aspect-ratio style.
function ShimmerCell(
  props: { delay: number; className: string; style?: React.CSSProperties },
) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-white/[0.025]', props.className)}
      style={{
        ...props.style,
        background:
          'linear-gradient(90deg, hsl(0 0% 100% / 0.02) 0%, hsl(0 0% 100% / 0.05) 50%, hsl(0 0% 100% / 0.02) 100%)',
        backgroundSize: '200% 100%',
        animation: `app-shimmer ${1.4 + props.delay * 0.12}s linear infinite`,
      }}
    />
  );
}

/** Frame used by every skeleton — matches PageShell width="wide". */
function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-10 mx-auto w-full min-h-dvh px-6 sm:px-8 lg:px-10 pt-8 pb-24 max-w-7xl">
      {children}
    </main>
  );
}

// ── Per-route skeletons ───────────────────────────────────────────────

export function ProjectsSkeleton() {
  return (
    <Frame>
      <SkelHero />
      <div className="flex items-center gap-2 mb-6">
        <Shimmer className="h-7 w-20" delay={0} />
        <Shimmer className="h-7 w-24" delay={1} />
        <Shimmer className="h-7 w-20" delay={2} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <ShimmerCell key={i} delay={i} className="w-full" style={{ aspectRatio: '16 / 10' }} />
        ))}
      </div>
    </Frame>
  );
}

export function LibrarySkeleton() {
  return (
    <Frame>
      <SkelHero />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerCell key={i} delay={i} className="w-full" style={{ aspectRatio: '4 / 3' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ShimmerCell delay={4} className="w-full" style={{ aspectRatio: '5 / 2' }} />
        <ShimmerCell delay={5} className="w-full" style={{ aspectRatio: '5 / 2' }} />
      </div>
    </Frame>
  );
}

export function AtomSkeleton() {
  return (
    <Frame>
      <SkelHero />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <ShimmerCell key={i} delay={i} className="w-full" style={{ aspectRatio: '3 / 4' }} />
        ))}
      </div>
    </Frame>
  );
}

export function CreditsSkeleton() {
  return (
    <Frame>
      <SkelHero />
      <Shimmer className="h-40 w-full rounded-3xl mb-6" delay={1} />
      <Shimmer className="h-24 w-full rounded-3xl mb-6" delay={2} />
      <Shimmer className="h-80 w-full rounded-3xl" delay={3} />
    </Frame>
  );
}

export function ProductionSkeleton() {
  return (
    <Frame>
      <Shimmer className="h-32 w-full rounded-2xl mb-5" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerCell key={i} delay={i} className="w-full h-24" />
        ))}
      </div>
    </Frame>
  );
}

export function GallerySkeleton() {
  return (
    <Frame>
      <SkelHero />
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 lg:gap-2">
        {Array.from({ length: 32 }).map((_, i) => (
          <ShimmerCell key={i} delay={i} className="w-full" style={{ aspectRatio: '1 / 1' }} />
        ))}
      </div>
    </Frame>
  );
}
