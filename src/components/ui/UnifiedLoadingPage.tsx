/**
 * UnifiedLoadingPage - Standardized full-page loading component
 * 
 * A consistent branded loading experience across all route transitions.
 * Features:
 * - Unified shimmer/pulse animation
 * - Brand-aligned violet color scheme
 * - Progressive skeleton placeholders
 * - GPU-accelerated animations
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
        "relative overflow-hidden rounded-xl bg-zinc-800/40",
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
            <div className="h-4 bg-zinc-800/40 rounded w-3/4 relative overflow-hidden">
              <Shimmer />
            </div>
            <div className="h-3 bg-zinc-800/30 rounded w-1/2 relative overflow-hidden">
              <Shimmer />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
});

// Brand spinner - unified across all loading states
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
        className="absolute inset-0 rounded-full border-2 border-violet-500/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-fuchsia-500/40"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Inner glow */}
      <motion.div
        className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Center dot */}
      <motion.div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400"
          animate={{ 
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
});

// Full-page loading with consistent branding
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
  if (variant === 'skeleton-grid') {
    return (
      <div className="min-h-screen bg-background pt-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="text-center mb-10 space-y-4">
            <div className="h-10 bg-zinc-800/40 rounded-lg w-48 mx-auto relative overflow-hidden">
              <Shimmer />
            </div>
            <div className="h-5 bg-zinc-800/30 rounded w-64 mx-auto relative overflow-hidden">
              <Shimmer />
            </div>
          </div>
          
          {/* Grid skeleton */}
          <GridSkeleton {...gridConfig} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.08) 0%, transparent 50%)`,
        }}
      />
      
      {/* Ambient glow */}
      <motion.div
        className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        <BrandLoadingSpinner size={variant === 'full' ? 'lg' : 'md'} />
        
        {/* Progress bar */}
        {showProgress && (
          <div className="relative w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
            <Shimmer />
          </div>
        )}
        
        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-sm font-medium tracking-wide"
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  );
});

export default UnifiedLoadingPage;
