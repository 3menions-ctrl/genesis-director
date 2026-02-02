import { useState, useRef, useCallback, useEffect, memo, forwardRef, useMemo } from 'react';
import { Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoThumbnailProps {
  src: string | null | undefined;
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square';
  showTitleOnHover?: boolean;
  onClick?: () => void;
  overlay?: React.ReactNode;
  duration?: number;
  thumbnailUrl?: string | null;
}

// Placeholder component for null/undefined video sources
const VideoPlaceholder = memo(function VideoPlaceholder({ aspectRatio }: { aspectRatio: 'video' | 'square' }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-zinc-800/50",
      aspectRatio === 'video' ? 'aspect-video' : 'aspect-square'
    )}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Film className="w-8 h-8 text-white/20" />
      </div>
    </div>
  );
});

export const VideoThumbnail = memo(forwardRef<HTMLDivElement, VideoThumbnailProps>(function VideoThumbnail({
  src,
  title,
  className,
  aspectRatio = 'video',
  showTitleOnHover = true,
  onClick,
  overlay,
  duration,
  thumbnailUrl,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize whether we have a valid source
  const hasValidSrc = useMemo(() => Boolean(src && typeof src === 'string' && src.trim().length > 0), [src]);

  // Detect touch device on mount
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouchDevice();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Robust video loading with multiple event handlers and timeout fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasValidSrc) return;

    const markLoaded = () => {
      if (mountedRef.current && !isLoaded) {
        setIsLoaded(true);
        // Seek to 25% for thumbnail frame - wrapped in try/catch
        try {
          if (video.duration && isFinite(video.duration)) {
            video.currentTime = Math.min(video.duration * 0.25, 2);
          }
        } catch (e) {
          // Ignore seek errors
        }
      }
    };

    const handleLoadedMetadata = () => markLoaded();
    const handleLoadedData = () => markLoaded();
    const handleCanPlay = () => markLoaded();
    const handleError = () => {
      if (mountedRef.current) {
        setHasError(true);
        setIsLoaded(true);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    // Fallback timeout - cleaned up properly
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !isLoaded) {
        setIsLoaded(true);
      }
    }, 3000);

    // If video already has data (cached), mark as loaded immediately
    if (video.readyState >= 2) {
      markLoaded();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [hasValidSrc, isLoaded]);

  const handleInteractionStart = useCallback(() => {
    setIsHovered(true);
    const video = videoRef.current;
    if (video && !hasError && isLoaded) {
      try {
        // CRITICAL: iOS requires muted for autoplay
        video.muted = true;
        if (video.readyState >= 1 && isFinite(video.duration)) {
          video.currentTime = 0;
        }
        video.play().catch(() => {});
      } catch (e) {
        // Ignore playback errors
      }
    }
  }, [hasError, isLoaded]);

  const handleInteractionEnd = useCallback(() => {
    setIsHovered(false);
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        if (video.duration && isFinite(video.duration)) {
          video.currentTime = Math.min(video.duration * 0.25, 2);
        }
      } catch (e) {
        // Ignore pause/seek errors
      }
    }
  }, []);

  // Mouse event handlers (aliases)
  const handleMouseEnter = handleInteractionStart;
  const handleMouseLeave = handleInteractionEnd;

  // Touch event handlers for iPad/mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isHovered) {
      handleInteractionStart();
    }
  }, [isHovered, handleInteractionStart]);

  // CRITICAL: Data guardrail - return placeholder for null/undefined sources
  if (!hasValidSrc) {
    return <VideoPlaceholder aspectRatio={aspectRatio} />;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden cursor-pointer group rounded-xl",
        aspectRatio === 'video' ? 'aspect-video' : 'aspect-square',
        className
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
    >
      {/* Loading skeleton - YouTube style gray placeholder */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-10 bg-zinc-800"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent bg-shimmer bg-[length:200%_100%] animate-shimmer" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video element - shows the video directly */}
      {!hasError ? (
        <video
          ref={videoRef}
          src={src || undefined}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            isHovered && "scale-105"
          )}
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
          <Film className="w-8 h-8 text-white/20" />
        </div>
      )}

      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-50"
        )}
      />

      {/* Play button on hover */}
      <AnimatePresence>
        {isHovered && !hasError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center z-20"
          >
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title - only on hover if showTitleOnHover is true */}
      <AnimatePresence>
        {title && (!showTitleOnHover || isHovered) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-0 left-0 right-0 p-3 z-20"
          >
            <p className="text-sm font-medium text-white line-clamp-2 drop-shadow-lg">
              {title}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duration badge */}
      {duration && (
        <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/80">
          <span className="text-[10px] font-medium text-white">{duration}s</span>
        </div>
      )}

      {/* Custom overlay */}
      {overlay}
    </div>
  );
}));