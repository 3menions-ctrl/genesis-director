import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Global thumbnail cache to persist across navigation - uses sessionStorage for persistence
const getSessionCache = (): Map<string, string> => {
  try {
    const cached = sessionStorage.getItem('video-thumbnail-cache');
    if (cached) {
      return new Map(JSON.parse(cached));
    }
  } catch {
    // Ignore errors
  }
  return new Map();
};

const saveSessionCache = (cache: Map<string, string>) => {
  try {
    // Limit cache size to avoid storage issues
    const entries = Array.from(cache.entries()).slice(-50);
    sessionStorage.setItem('video-thumbnail-cache', JSON.stringify(entries));
  } catch {
    // Ignore errors
  }
};

// Initialize from session storage
const thumbnailCache = getSessionCache();

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
  
  // Check cache first for instant display - prioritize thumbnailUrl from DB
  const cachedPoster = src ? thumbnailCache.get(src) : null;
  const initialPoster = thumbnailUrl || cachedPoster || null;
  const [posterFrame, setPosterFrame] = useState<string | null>(initialPoster);
  const [isLoaded, setIsLoaded] = useState(Boolean(initialPoster));
  const [videoReady, setVideoReady] = useState(false);

  // Load poster frame from video if not cached or no thumbnailUrl
  useEffect(() => {
    // If we have a thumbnailUrl from DB, we're good - mark as loaded immediately
    if (thumbnailUrl) {
      setPosterFrame(thumbnailUrl);
      setIsLoaded(true);
      return;
    }

    if (!src) return;
    
    // If already cached in memory/session, use it immediately
    if (thumbnailCache.has(src)) {
      setPosterFrame(thumbnailCache.get(src)!);
      setIsLoaded(true);
      return;
    }
    
    setHasError(false);

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let isMounted = true;
    let frameExtracted = false;

    const handleLoadedMetadata = () => {
      if (!isMounted) return;
      // Mark as loaded immediately when we have metadata (video dimensions known)
      setIsLoaded(true);
      // Seek to 25% for a good thumbnail frame
      video.currentTime = Math.min(video.duration * 0.25, 2);
    };

    const handleSeeked = () => {
      if (!isMounted || frameExtracted) return;
      frameExtracted = true;
      
      // Try to capture a poster frame from the video
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          // Only cache if it looks like a valid image (not empty)
          if (dataUrl.length > 100) {
            thumbnailCache.set(src, dataUrl);
            saveSessionCache(thumbnailCache);
            setPosterFrame(dataUrl);
          }
        }
      } catch {
        // CORS or other error - that's ok, video will show directly
      }
    };

    const handleCanPlay = () => {
      if (isMounted) {
        setIsLoaded(true);
      }
    };

    const handleError = () => {
      if (!isMounted) return;
      setHasError(true);
      setIsLoaded(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    
    // Start loading
    video.src = src;
    video.load();

    // Fallback timeout - show as loaded even if frame extraction fails
    const timeout = setTimeout(() => {
      if (isMounted) {
        setIsLoaded(true);
      }
    }, 2000);

    return () => {
      isMounted = false;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.src = '';
      clearTimeout(timeout);
    };
  }, [src, thumbnailUrl]);

  const handleVideoLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setVideoReady(true);
      video.currentTime = Math.min(video.duration * 0.25, 2);
    }
  }, []);

  const handleVideoError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current && !hasError) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [hasError]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.duration) {
        videoRef.current.currentTime = Math.min(videoRef.current.duration * 0.25, 2);
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

      {/* Poster frame (static image - shows immediately if cached/from DB) */}
      {posterFrame && !hasError && (
        <img
          src={posterFrame}
          alt=""
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
            isHovered && videoReady ? "opacity-0" : "opacity-100"
          )}
          loading="eager"
          onError={() => setPosterFrame(null)}
        />
      )}

      {/* Video element - preload metadata for faster playback on hover */}
      {src && !hasError ? (
        <video
          ref={videoRef}
          src={src}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-300",
            (isLoaded || videoReady) ? "opacity-100" : "opacity-0",
            isHovered && "scale-105"
          )}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={handleVideoLoadedData}
          onError={handleVideoError}
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