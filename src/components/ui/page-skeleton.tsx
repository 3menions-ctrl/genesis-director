import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  variant?: 'grid' | 'list' | 'detail' | 'dashboard';
  className?: string;
}

/**
 * Reusable page skeleton for consistent loading states
 * Uses dark cinema theme to match the unified loading system
 */
export function PageSkeleton({ variant = 'grid', className }: PageSkeletonProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)} style={{ backgroundColor: '#030303' }}>
      {/* Header skeleton */}
      <div className="border-b border-white/[0.08]" style={{ backgroundColor: 'rgba(3, 3, 3, 0.95)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
            <Skeleton className="h-6 w-32 bg-white/5" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-md bg-white/5" />
            <Skeleton className="h-9 w-9 rounded-full bg-white/5" />
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/[0.03]" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-64 rounded-md bg-white/5" />
          <Skeleton className="h-10 w-28 rounded-md bg-white/5" />
          <Skeleton className="h-10 w-28 rounded-md bg-white/5" />
        </div>

        {/* Content based on variant */}
        {variant === 'grid' && <GridSkeleton />}
        {variant === 'list' && <ListSkeleton />}
        {variant === 'detail' && <DetailSkeleton />}
        {variant === 'dashboard' && <DashboardSkeleton />}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.08] overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Skeleton className="aspect-video w-full bg-white/5" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4 bg-white/5" />
            <Skeleton className="h-4 w-1/2 bg-white/[0.03]" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full bg-white/5" />
              <Skeleton className="h-6 w-20 rounded-full bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-white/[0.08]" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Skeleton className="h-16 w-24 rounded-md flex-shrink-0 bg-white/5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3 bg-white/5" />
            <Skeleton className="h-4 w-2/3 bg-white/[0.03]" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md bg-white/5" />
            <Skeleton className="h-8 w-8 rounded-md bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="aspect-video w-full rounded-xl bg-white/5" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4 bg-white/5" />
          <Skeleton className="h-4 w-full bg-white/[0.03]" />
          <Skeleton className="h-4 w-5/6 bg-white/[0.03]" />
          <Skeleton className="h-4 w-4/6 bg-white/[0.03]" />
        </div>
      </div>
      
      {/* Sidebar */}
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-32 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-white/[0.08]" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <Skeleton className="h-4 w-20 mb-2 bg-white/5" />
            <Skeleton className="h-8 w-16 bg-white/5" />
          </div>
        ))}
      </div>
      
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-white/[0.08]" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Skeleton className="h-6 w-32 mb-4 bg-white/5" />
          <Skeleton className="h-48 w-full rounded-lg bg-white/5" />
        </div>
        <div className="p-6 rounded-xl border border-white/[0.08]" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Skeleton className="h-6 w-32 mb-4 bg-white/5" />
          <Skeleton className="h-48 w-full rounded-lg bg-white/5" />
        </div>
      </div>
      
      {/* Table */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div className="p-4 border-b border-white/[0.08]">
          <Skeleton className="h-6 w-40 bg-white/5" />
        </div>
        <div className="divide-y divide-white/[0.08]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
              <Skeleton className="h-4 w-32 bg-white/5" />
              <Skeleton className="h-4 w-24 ml-auto bg-white/[0.03]" />
              <Skeleton className="h-4 w-16 bg-white/[0.03]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Clips page specific skeleton
 */
export function ClipsPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#030303' }}>
      {/* Header */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
            <Skeleton className="h-6 w-24 bg-white/5" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full bg-white/5" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Title and stats */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 bg-white/5" />
            <Skeleton className="h-4 w-64 bg-white/[0.03]" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-16 w-24 rounded-lg bg-white/5" />
            <Skeleton className="h-16 w-24 rounded-lg bg-white/5" />
            <Skeleton className="h-16 w-24 rounded-lg bg-white/5" />
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-72 rounded-md bg-white/5" />
          <Skeleton className="h-10 w-32 rounded-md bg-white/5" />
          <Skeleton className="h-10 w-10 rounded-md bg-white/5" />
          <Skeleton className="h-10 w-10 rounded-md ml-auto bg-white/5" />
        </div>

        {/* Project groups */}
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="mb-6 rounded-xl border border-white/[0.08] overflow-hidden">
            {/* Group header */}
            <div className="flex items-center justify-between p-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 bg-white/5" />
                <Skeleton className="h-5 w-48 bg-white/5" />
                <Skeleton className="h-5 w-20 rounded-full bg-white/5" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md bg-white/5" />
            </div>
            
            {/* Clips grid */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, clipIndex) => (
                <div key={clipIndex} className="rounded-lg overflow-hidden border border-white/[0.06]">
                  <Skeleton className="aspect-video w-full bg-white/5" />
                  <div className="p-2 space-y-1">
                    <Skeleton className="h-3 w-12 bg-white/5" />
                    <Skeleton className="h-3 w-16 bg-white/[0.03]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Projects page specific skeleton
 */
export function ProjectsPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#030303' }}>
      <div className="border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Skeleton className="h-8 w-32 bg-white/5" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32 rounded-md bg-white/5" />
            <Skeleton className="h-9 w-9 rounded-full bg-white/5" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-8 w-40 bg-white/5" />
          <Skeleton className="h-10 w-36 rounded-md bg-white/5" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.08] overflow-hidden">
              <Skeleton className="aspect-video w-full bg-white/5" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4 bg-white/5" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full bg-white/5" />
                  <Skeleton className="h-4 w-20 bg-white/[0.03]" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full bg-white/5" />
                  <Skeleton className="h-6 w-12 rounded-full bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
