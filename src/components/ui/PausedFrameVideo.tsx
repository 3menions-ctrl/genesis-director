/**
 * PausedFrameVideo Component v2.1
 * 
 * A video element that automatically shows a paused frame as the thumbnail
 * by seeking to a small offset when metadata loads. This ensures videos
 * display a meaningful poster frame instead of a blank/placeholder.
 * 
 * Key improvements:
 * - NO crossOrigin attribute (causes CORS issues with Replicate/Supabase CDN)
 * - Faster fallback timeout (1.5s instead of 3s)
 * - Forces video.load() to trigger metadata fetch
 * - Better error recovery with canplay fallback
 */

import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Film } from 'lucide-react';

interface PausedFrameVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  /** Fraction of video duration to seek to for thumbnail (default: 0.1 = 10%) */
  seekFraction?: number;
  /** Show loading spinner while frame loads */
  showLoader?: boolean;
  /** Fallback element when video fails to load */
  fallback?: React.ReactNode;
}

export const PausedFrameVideo = memo(function PausedFrameVideo({
  src,
  seekFraction = 0.1,
  showLoader = true,
  fallback,
  className,
  ...props
}: PausedFrameVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);
  const loadAttemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset state and trigger load when src changes
  useEffect(() => {
    setFrameReady(false);
    setHasError(false);
    loadAttemptRef.current += 1;
    
    const video = videoRef.current;
    if (video && src) {
      // Force reload to trigger metadata fetch
      video.load();
    }
  }, [src]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !mountedRef.current) return;

    const duration = video.duration;
    if (!duration || !isFinite(duration) || isNaN(duration) || duration <= 0) {
      // Duration not valid, just show current frame
      setFrameReady(true);
      return;
    }

    try {
      // Seek to fraction of video (usually 10%) to get a meaningful frame
      // Cap at 2 seconds max to avoid long seeks
      const targetTime = Math.min(duration * seekFraction, 2);
      video.currentTime = targetTime;
    } catch (err) {
      console.debug('[PausedFrameVideo] Seek error:', err);
      setFrameReady(true);
    }
  }, [seekFraction]);

  const handleSeeked = useCallback(() => {
    if (mountedRef.current) {
      setFrameReady(true);
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    // If seeked event didn't fire, canplay is a good fallback
    if (mountedRef.current && !frameReady) {
      setFrameReady(true);
    }
  }, [frameReady]);

  const handleError = useCallback(() => {
    if (mountedRef.current) {
      setHasError(true);
      setFrameReady(true);
    }
  }, []);

  // Faster fallback timeout to prevent long loading states
  useEffect(() => {
    if (frameReady) return;
    
    const currentAttempt = loadAttemptRef.current;
    const timeout = setTimeout(() => {
      if (mountedRef.current && loadAttemptRef.current === currentAttempt) {
        // Still on same load attempt, force ready state
        setFrameReady(true);
      }
    }, 1500); // Reduced from 3000ms to 1500ms for snappier UX
    
    return () => clearTimeout(timeout);
  }, [frameReady, src]);

  if (hasError) {
    return (
      fallback || (
        <div className={cn("flex items-center justify-center bg-muted", className)}>
          <Film className="w-8 h-8 text-muted-foreground" />
        </div>
      )
    );
  }

  return (
    <div className={cn("relative", className)}>
      <video
        ref={videoRef}
        src={src}
        className={cn(
          "w-full h-full transition-opacity duration-300",
          !frameReady && "opacity-0"
        )}
        preload="metadata"
        muted
        playsInline
        // IMPORTANT: No crossOrigin attribute - causes CORS issues with CDNs
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
        onCanPlay={handleCanPlay}
        onError={handleError}
        {...props}
      />
      
      {/* Loading spinner */}
      {showLoader && !frameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

export default PausedFrameVideo;
