import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoThumbnailProps {
  src: string | null;
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square';
  showTitleOnHover?: boolean;
  onClick?: () => void;
  overlay?: React.ReactNode;
  duration?: number;
  thumbnailUrl?: string | null;
}

export const VideoThumbnail = memo(function VideoThumbnail({
  src,
  title,
  className,
  aspectRatio = 'video',
  showTitleOnHover = true,
  onClick,
  overlay,
  duration,
  thumbnailUrl,
}: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Robust video loading with multiple event handlers and timeout fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let mounted = true;

    const markLoaded = () => {
      if (mounted && !isLoaded) {
        setIsLoaded(true);
        // Seek to 25% for thumbnail frame
        if (video.duration) {
          video.currentTime = Math.min(video.duration * 0.25, 2);
        }
      }
    };

    const handleLoadedMetadata = () => markLoaded();
    const handleLoadedData = () => markLoaded();
    const handleCanPlay = () => markLoaded();
    const handleError = () => {
      if (mounted) {
        setHasError(true);
        setIsLoaded(true);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    // Fallback timeout
    const timeout = setTimeout(() => {
      if (mounted && !isLoaded) {
        setIsLoaded(true);
      }
    }, 3000);

    // If video already has data (cached), mark as loaded immediately
    if (video.readyState >= 2) {
      markLoaded();
    }

    return () => {
      mounted = false;
      clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [src, isLoaded]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const video = videoRef.current;
    if (video && !hasError && isLoaded) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [hasError, isLoaded]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      if (video.duration) {
        video.currentTime = Math.min(video.duration * 0.25, 2);
      }
    }
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden cursor-pointer group rounded-xl",
        aspectRatio === 'video' ? 'aspect-video' : 'aspect-square',
        className
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Loading skeleton - YouTube style gray placeholder */}
      <AnimatePresence>
        {!isLoaded && src && (
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
      {src && !hasError ? (
        <video
          ref={videoRef}
          src={src}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            isHovered && "scale-105"
          )}
          muted
          loop
          playsInline
          preload="auto"
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
        {isHovered && src && !hasError && (
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
});