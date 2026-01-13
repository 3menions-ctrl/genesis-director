import { useState, useRef, useCallback } from 'react';
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
}

export function VideoThumbnail({
  src,
  title,
  className,
  aspectRatio = 'video',
  showTitleOnHover = true,
  onClick,
  overlay,
  duration,
}: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      // Seek to 25% to get a good thumbnail frame
      video.currentTime = video.duration * 0.25;
      setIsLoaded(true);
    }
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true); // Stop showing skeleton
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current && isLoaded && !hasError) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [isLoaded, hasError]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current && isLoaded && !hasError) {
      videoRef.current.pause();
      videoRef.current.currentTime = videoRef.current.duration * 0.25;
    }
  }, [isLoaded, hasError]);

  return (
    <div
      className={cn(
        "relative overflow-hidden cursor-pointer group",
        aspectRatio === 'video' ? 'aspect-video' : 'aspect-square',
        className
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Loading skeleton */}
      <AnimatePresence>
        {!isLoaded && src && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.08]"
          >
            <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video element */}
      {src && !hasError ? (
        <video
          ref={videoRef}
          src={src}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
            isHovered && "scale-105"
          )}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={handleLoadedData}
          onError={handleError}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
          <Film className="w-8 h-8 text-white/20" />
        </div>
      )}

      {/* Gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300",
          isHovered ? "opacity-100" : "opacity-60"
        )}
      />

      {/* Play button on hover */}
      <AnimatePresence>
        {isHovered && src && !hasError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center z-20"
          >
            <div className="relative">
              <div className="absolute inset-[-4px] rounded-full border border-white/30 animate-ping" style={{ animationDuration: '1.5s' }} />
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40">
                <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title - only on hover if showTitleOnHover is true */}
      <AnimatePresence>
        {title && (!showTitleOnHover || isHovered) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
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
        <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm">
          <span className="text-[10px] font-medium text-white">{duration}s</span>
        </div>
      )}

      {/* Custom overlay */}
      {overlay}
    </div>
  );
}
