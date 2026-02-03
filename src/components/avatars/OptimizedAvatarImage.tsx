import React, { useState, useCallback, memo, useRef, useEffect, forwardRef } from 'react';
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

// Shimmer skeleton component for loading state - GPU accelerated
const ShimmerSkeleton = memo(forwardRef<HTMLDivElement, { 
  className?: string;
  aspectRatio?: 'square' | 'portrait';
}>(function ShimmerSkeleton({ className, aspectRatio = 'portrait' }, ref) {
  return (
    <div 
      ref={ref}
      className={cn(
        "relative overflow-hidden bg-muted/20",
        aspectRatio === 'portrait' ? 'aspect-[2/3]' : 'aspect-square',
        className
      )}
    >
      {/* GPU-accelerated shimmer animation */}
      <div 
        className="absolute inset-0 -translate-x-full animate-shimmer will-change-transform"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(var(--foreground) / 0.06) 50%, transparent 100%)',
        }}
      />
      {/* Centered placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
          <User className="w-6 h-6 text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}));
ShimmerSkeleton.displayName = 'ShimmerSkeleton';

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
        "relative bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center",
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
        <rect width="100" height="100" fill="url(#grid)" className="text-foreground" />
      </svg>
      
      {/* Initials or icon */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          {text ? (
            <span className="text-xl font-semibold text-primary">{initials}</span>
          ) : (
            <User className="w-8 h-8 text-primary" />
          )}
        </div>
        <span className="text-xs text-muted-foreground max-w-[80%] text-center truncate">
          {text || 'Avatar'}
        </span>
      </div>
    </div>
  );
});

/**
 * Optimized avatar image component with:
 * - Shimmer skeleton during loading
 * - Blur-up progressive loading effect
 * - Lazy loading for off-screen images
 * - Error fallback to initials/SVG placeholder
 * - Fixed aspect ratio to prevent layout shifts
 * - Image caching via browser cache-control
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
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isInView, setIsInView] = useState(priority);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !src) {
      setIsInView(true);
      return;
    }

    const img = imgRef.current;
    if (!img) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observerRef.current.observe(img);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, src]);

  // Reset state when src changes
  useEffect(() => {
    if (src) {
      setLoadState('loading');
    } else {
      setLoadState('error');
    }
  }, [src]);

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
      ref={imgRef}
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

      {/* Actual image - CRITICAL: opacity strictly tied to onLoad event */}
      {loadState !== 'error' && isInView && (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            // CRITICAL: Use inline style for immediate opacity control
            // This prevents any flash of content before image is fully loaded
            opacity: loadState === 'loaded' ? 1 : 0,
            transform: loadState === 'loaded' ? 'scale(1)' : 'scale(1.05)',
            filter: loadState === 'loaded' ? 'blur(0)' : 'blur(8px)',
          }}
          className={cn(
            "w-full h-full object-contain will-change-transform",
            "transition-all duration-500 ease-out"
          )}
        />
      )}
    </div>
  );
});

export { ShimmerSkeleton, AvatarFallbackPlaceholder };
export default OptimizedAvatarImage;
