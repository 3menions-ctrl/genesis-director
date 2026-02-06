/**
 * PausedFrameVideo Component
 * 
 * A video element that automatically shows a paused frame as the thumbnail
 * by seeking to a small offset when metadata loads. This ensures videos
 * display a meaningful poster frame instead of a blank/placeholder.
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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset state when src changes
  useEffect(() => {
    setFrameReady(false);
    setHasError(false);
  }, [src]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !mountedRef.current) return;

    const duration = video.duration;
    if (!duration || !isFinite(duration) || isNaN(duration) || duration <= 0) {
      setFrameReady(true);
      return;
    }

    try {
      // Seek to fraction of video (usually 10%) to get a meaningful frame
      const targetTime = Math.min(duration * seekFraction, 2); // Cap at 2 seconds
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

  const handleError = useCallback(() => {
    if (mountedRef.current) {
      setHasError(true);
      setFrameReady(true);
    }
  }, []);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    if (frameReady) return;
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setFrameReady(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [frameReady, src]);

  if (hasError) {
    return (
      fallback || (
        <div className={cn("flex items-center justify-center bg-zinc-900", className)}>
          <Film className="w-8 h-8 text-zinc-600" />
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
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
        onError={handleError}
        {...props}
      />
      
      {/* Loading spinner */}
      {showLoader && !frameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

export default PausedFrameVideo;
