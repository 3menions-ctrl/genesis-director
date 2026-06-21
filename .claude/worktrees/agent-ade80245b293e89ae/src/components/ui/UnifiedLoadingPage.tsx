/**
 * UnifiedLoadingPage - Standardized full-page loading component
 * 
 * Uses the CinemaLoader as the single source of truth for loading states.
 * Also exports skeleton components for progressive loading patterns.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CinemaLoader } from './CinemaLoader';

// Re-export CinemaLoader as the primary loading component
export { CinemaLoader } from './CinemaLoader';

// Shimmer animation - reusable across components
export const Shimmer = memo(function Shimmer({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "absolute inset-0 -translate-x-full animate-shimmer",
        className
      )}
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
      }}
    />
  );
});

// Skeleton box with fixed aspect ratio
export const SkeletonBox = memo(function SkeletonBox({ 
  className,
  aspectRatio = 'square',
}: { 
  className?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'video';
}) {
  const aspectClasses = {
    square: 'aspect-square',
    portrait: 'aspect-[2/3]',
    landscape: 'aspect-[16/9]',
    video: 'aspect-video',
  };

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/5",
        aspectClasses[aspectRatio],
        className
      )}
    >
      <Shimmer />
    </div>
  );
});

// Grid skeleton for avatar/card layouts
export const GridSkeleton = memo(function GridSkeleton({
  count = 6,
  columns = 3,
  aspectRatio = 'portrait',
}: {
  count?: number;
  columns?: number;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'video';
}) {
  return (
    <div 
      className={cn(
        "grid gap-4 md:gap-6",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 md:grid-cols-3",
        columns === 4 && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        columns === 6 && "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="space-y-3"
        >
          <SkeletonBox aspectRatio={aspectRatio} />
          <div className="space-y-2 px-1">
            <div className="h-4 bg-white/5 rounded w-3/4 relative overflow-hidden">
              <Shimmer />
            </div>
            <div className="h-3 bg-white/[0.03] rounded w-1/2 relative overflow-hidden">
              <Shimmer />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
});

// Brand spinner - kept for backwards compatibility, now uses cinema theme
export const BrandLoadingSpinner = memo(function BrandLoadingSpinner({ 
  size = 'md',
}: { 
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  return (
    <div className={cn("relative", sizeClasses[size])}>
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-primary/40"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Inner glow */}
      <motion.div
        className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Center dot */}
      <motion.div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-3 h-3 rounded-full bg-gradient-to-br from-primary to-secondary"
          animate={{ 
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
});

// Full-page loading with consistent branding - NOW USES CINEMA LOADER
interface UnifiedLoadingPageProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;
  variant?: 'minimal' | 'full' | 'skeleton-grid';
  gridConfig?: {
    count?: number;
    columns?: number;
    aspectRatio?: 'square' | 'portrait' | 'landscape' | 'video';
  };
}

export const UnifiedLoadingPage = memo(function UnifiedLoadingPage({
  message = 'Loading...',
  showProgress = false,
  progress = 0,
  variant = 'minimal',
  gridConfig,
}: UnifiedLoadingPageProps) {
  // Skeleton grid variant - uses dark themed skeleton
  if (variant === 'skeleton-grid') {
    return (
      <div className="min-h-screen pt-20 px-4 md:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="text-center mb-10 space-y-4">
            <div className="h-10 bg-muted/40 rounded-lg w-48 mx-auto relative overflow-hidden">
              <Shimmer />
            </div>
            <div className="h-5 bg-muted/30 rounded w-64 mx-auto relative overflow-hidden">
              <Shimmer />
            </div>
          </div>
          
          {/* Grid skeleton */}
          <GridSkeleton {...gridConfig} />
        </div>
      </div>
    );
  }

  // Use CinemaLoader for all other variants
  return (
    <CinemaLoader
      message={message}
      progress={progress}
      showProgress={showProgress}
      variant="fullscreen"
    />
  );
});

export default UnifiedLoadingPage;
