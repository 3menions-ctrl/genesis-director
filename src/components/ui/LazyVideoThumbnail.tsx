/**
 * LazyVideoThumbnail - Viewport-aware video thumbnail
 * 
 * Uses IntersectionObserver to only create <video> elements when visible.
 * Limits concurrent video loads to prevent browser crashes from 60+ simultaneous
 * video decode operations.
 * 
 * This replaces direct PausedFrameVideo usage in grids/lists.
 */

import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Film } from 'lucide-react';

// ============================================================================
// CONCURRENCY LIMITER - max 6 videos loading at once
// ============================================================================

const MAX_CONCURRENT_LOADS = 6;
let activeLoads = 0;
const loadQueue: Array<() => void> = [];

function requestLoadSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeLoads < MAX_CONCURRENT_LOADS) {
      activeLoads++;
      resolve();
    } else {
      loadQueue.push(() => {
        activeLoads++;
        resolve();
      });
    }
  });
}

function releaseLoadSlot(): void {
  activeLoads--;
  if (loadQueue.length > 0 && activeLoads < MAX_CONCURRENT_LOADS) {
    const next = loadQueue.shift();
    next?.();
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface LazyVideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
  /** Static image to show before video loads */
  posterUrl?: string | null;
  /** Fraction of video to seek to for frame (default 0.1) */
  seekFraction?: number;
}

export const LazyVideoThumbnail = memo(function LazyVideoThumbnail({
  src,
  alt = '',
  className,
  posterUrl,
  seekFraction = 0.1,
}: LazyVideoThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Intersection Observer - only activate when in viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoadedRef.current) {
          setIsVisible(true);
          hasLoadedRef.current = true;
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0 } // Start loading 200px before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load video frame when visible — with concurrency limiting
  useEffect(() => {
    if (!isVisible || !src || hasError) return;

    let cancelled = false;

    async function loadFrame() {
      await requestLoadSlot();
      if (cancelled || !mountedRef.current) {
        releaseLoadSlot();
        return;
      }

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      // No crossOrigin to avoid CORS issues

      const cleanup = () => {
        video.removeAttribute('src');
        video.load();
        releaseLoadSlot();
      };

      const timeout = setTimeout(() => {
        // Timeout after 4s - show poster or placeholder
        if (mountedRef.current && !frameUrl) {
          setIsLoading(false);
        }
        cleanup();
      }, 4000);

      video.onloadedmetadata = () => {
        if (cancelled) { clearTimeout(timeout); cleanup(); return; }
        const duration = video.duration;
        if (!duration || !isFinite(duration) || duration <= 0) {
          clearTimeout(timeout);
          if (mountedRef.current) setIsLoading(false);
          cleanup();
          return;
        }
        try {
          video.currentTime = Math.min(duration * seekFraction, 2);
        } catch {
          clearTimeout(timeout);
          if (mountedRef.current) setIsLoading(false);
          cleanup();
        }
      };

      video.onseeked = () => {
        clearTimeout(timeout);
        if (cancelled || !mountedRef.current) { cleanup(); return; }

        // Extract frame to canvas → dataURL to free the video element
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(video.videoWidth, 640); // Cap resolution
          canvas.height = Math.min(video.videoHeight, 360);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            if (mountedRef.current) {
              setFrameUrl(dataUrl);
              setIsLoading(false);
            }
          } else {
            if (mountedRef.current) setIsLoading(false);
          }
          canvas.width = 1;
          canvas.height = 1;
        } catch {
          if (mountedRef.current) setIsLoading(false);
        }
        cleanup();
      };

      video.onerror = () => {
        clearTimeout(timeout);
        if (mountedRef.current) {
          setHasError(true);
          setIsLoading(false);
        }
        cleanup();
      };

      video.src = src;
    }

    loadFrame();

    return () => {
      cancelled = true;
    };
  }, [isVisible, src, seekFraction, hasError, frameUrl]);

  // Render
  if (hasError && !posterUrl) {
    return (
      <div ref={containerRef} className={cn("flex items-center justify-center bg-white/[0.02]", className)}>
        <Film className="w-8 h-8 text-white/10" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden bg-white/[0.02]", className)}>
      {/* Show extracted frame, poster, or placeholder */}
      {frameUrl ? (
        <img
          src={frameUrl}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : posterUrl ? (
        <img
          src={posterUrl}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : isLoading && isVisible ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Film className="w-8 h-8 text-white/10" />
        </div>
      )}
    </div>
  );
});

export default LazyVideoThumbnail;
