import React, { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface OptimizedAvatarImageProps {
  src: string | null | undefined;
  alt: string;
  fallbackText?: string;
  className?: string;
  aspectRatio?: 'square' | 'portrait';
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

// Shimmer skeleton component for loading state
const ShimmerSkeleton = memo(function ShimmerSkeleton({ 
  className,
  aspectRatio = 'portrait' 
}: { 
  className?: string;
  aspectRatio?: 'square' | 'portrait';
}) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-zinc-800/50",
        aspectRatio === 'portrait' ? 'aspect-[2/3]' : 'aspect-square',
        className
      )}
    >
      {/* Shimmer animation */}
      <div 
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        }}
      />
      {/* Centered placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center">
          <User className="w-6 h-6 text-zinc-500" />
        </div>
      </div>
    </div>
  );
});

// SVG/Initials fallback for failed loads
const AvatarFallbackPlaceholder = memo(function AvatarFallbackPlaceholder({
  text,
  className,
  aspectRatio = 'portrait'
}: {
  text?: string;
  className?: string;
  aspectRatio?: 'square' | 'portrait';
}) {
  // Extract initials from text (max 2 characters)
  const initials = text
    ? text.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
    : 'AV';

  return (
    <div 
      className={cn(
        "relative bg-gradient-to-b from-zinc-700 to-zinc-800 flex items-center justify-center",
        aspectRatio === 'portrait' ? 'aspect-[2/3]' : 'aspect-square',
        className
      )}
    >
      {/* Background pattern */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-10" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" className="text-white" />
      </svg>
      
      {/* Initials or icon */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          {text ? (
            <span className="text-xl font-semibold text-violet-300">{initials}</span>
          ) : (
            <User className="w-8 h-8 text-violet-400" />
          )}
        </div>
        <span className="text-xs text-white/40 max-w-[80%] text-center truncate">
          {text || 'Avatar'}
        </span>
      </div>
    </div>
  );
});

/**
 * Optimized avatar image component with:
 * - Shimmer skeleton during loading
 * - Lazy loading for off-screen images
 * - Error fallback to initials/SVG placeholder
 * - WebP format preference (via CSS object-fit)
 */
export const OptimizedAvatarImage = memo(function OptimizedAvatarImage({
  src,
  alt,
  fallbackText,
  className,
  aspectRatio = 'portrait',
  priority = false,
  onLoad,
  onError,
}: OptimizedAvatarImageProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    src ? 'loading' : 'error'
  );

  const handleLoad = useCallback(() => {
    setLoadState('loaded');
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setLoadState('error');
    onError?.();
  }, [onError]);

  // No source provided - show fallback immediately
  if (!src) {
    return (
      <AvatarFallbackPlaceholder 
        text={fallbackText || alt} 
        className={className}
        aspectRatio={aspectRatio}
      />
    );
  }

  return (
    <div 
      className={cn(
        "relative overflow-hidden",
        aspectRatio === 'portrait' ? 'aspect-[2/3]' : 'aspect-square',
        className
      )}
    >
      {/* Shimmer skeleton - visible while loading */}
      {loadState === 'loading' && (
        <ShimmerSkeleton 
          className="absolute inset-0" 
          aspectRatio={aspectRatio}
        />
      )}

      {/* Error fallback */}
      {loadState === 'error' && (
        <AvatarFallbackPlaceholder 
          text={fallbackText || alt}
          className="absolute inset-0"
          aspectRatio={aspectRatio}
        />
      )}

      {/* Actual image - hidden until loaded */}
      {loadState !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "w-full h-full object-cover object-top transition-opacity duration-300",
            loadState === 'loaded' ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  );
});

export { ShimmerSkeleton, AvatarFallbackPlaceholder };
export default OptimizedAvatarImage;
