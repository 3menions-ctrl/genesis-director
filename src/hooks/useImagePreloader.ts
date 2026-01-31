/**
 * Image Preloader Hook
 * 
 * Provides gatekeeper loading by preloading critical images before showing content.
 * Uses AbortController for proper cleanup on unmount/navigation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface PreloadResult {
  loaded: string[];
  failed: string[];
  pending: string[];
}

interface UseImagePreloaderOptions {
  /** Images to preload (URLs) */
  images: string[];
  /** Whether to start preloading immediately */
  enabled?: boolean;
  /** Maximum concurrent loads */
  concurrency?: number;
  /** Timeout per image in ms */
  timeout?: number;
  /** Minimum images to load before marking ready */
  minRequired?: number;
}

interface UseImagePreloaderReturn {
  /** Whether minimum required images are loaded */
  isReady: boolean;
  /** All images have finished (loaded or failed) */
  isComplete: boolean;
  /** Progress percentage 0-100 */
  progress: number;
  /** Detailed result state */
  result: PreloadResult;
  /** Manually trigger preload */
  preload: () => void;
  /** Cancel ongoing preloads */
  cancel: () => void;
}

// Global image cache to prevent re-fetching across navigations
const imageCache = new Map<string, boolean>();

export function useImagePreloader(options: UseImagePreloaderOptions): UseImagePreloaderReturn {
  const {
    images,
    enabled = true,
    concurrency = 5,
    timeout = 5000,
    minRequired,
  } = options;

  const [result, setResult] = useState<PreloadResult>({
    loaded: [],
    failed: [],
    pending: [],
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const preloadingRef = useRef(false);
  
  // Calculate ready state
  const effectiveMinRequired = minRequired ?? Math.min(5, images.length);
  const totalProcessed = result.loaded.length + result.failed.length;
  const isReady = result.loaded.length >= effectiveMinRequired || totalProcessed === images.length;
  const isComplete = totalProcessed === images.length;
  const progress = images.length > 0 ? Math.round((totalProcessed / images.length) * 100) : 100;

  // Preload a single image with timeout
  const preloadImage = useCallback((src: string, signal: AbortSignal): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check cache first
      if (imageCache.has(src)) {
        resolve(imageCache.get(src)!);
        return;
      }

      // Skip invalid URLs
      if (!src || src.trim() === '') {
        resolve(false);
        return;
      }

      const img = new Image();
      let settled = false;
      
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      };
      
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          imageCache.set(src, false);
          resolve(false);
        }
      }, timeout);

      // Handle abort
      const handleAbort = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(false);
        }
      };
      signal.addEventListener('abort', handleAbort);

      img.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', handleAbort);
          imageCache.set(src, true);
          resolve(true);
        }
      };

      img.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', handleAbort);
          imageCache.set(src, false);
          resolve(false);
        }
      };

      // Start loading - decoding async for performance
      img.decoding = 'async';
      img.src = src;
    });
  }, [timeout]);

  // Batch preload with concurrency control
  const preload = useCallback(async () => {
    if (preloadingRef.current || images.length === 0) return;
    
    // Cancel any previous preload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    preloadingRef.current = true;
    
    // Filter out already cached images
    const uncachedImages = images.filter(src => !imageCache.has(src));
    const cachedLoaded = images.filter(src => imageCache.get(src) === true);
    const cachedFailed = images.filter(src => imageCache.get(src) === false);
    
    // Initialize with cached results
    if (isMountedRef.current) {
      setResult({
        loaded: cachedLoaded,
        failed: cachedFailed,
        pending: uncachedImages,
      });
    }
    
    // Process in batches
    for (let i = 0; i < uncachedImages.length; i += concurrency) {
      if (signal.aborted) break;
      
      const batch = uncachedImages.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(src => preloadImage(src, signal).then(success => ({ src, success })))
      );
      
      if (signal.aborted || !isMountedRef.current) break;
      
      setResult(prev => {
        const newLoaded = [...prev.loaded];
        const newFailed = [...prev.failed];
        const newPending = prev.pending.filter(src => !batch.includes(src));
        
        for (const { src, success } of results) {
          if (success) {
            newLoaded.push(src);
          } else {
            newFailed.push(src);
          }
        }
        
        return { loaded: newLoaded, failed: newFailed, pending: newPending };
      });
    }
    
    preloadingRef.current = false;
  }, [images, concurrency, preloadImage]);

  // Cancel handler
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    preloadingRef.current = false;
  }, []);

  // Auto-preload on mount/enable
  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled && images.length > 0) {
      preload();
    }
    
    return () => {
      isMountedRef.current = false;
      cancel();
    };
  }, [enabled, preload, cancel]);

  return {
    isReady,
    isComplete,
    progress,
    result,
    preload,
    cancel,
  };
}

/**
 * Utility to prefetch avatar images globally
 * Call this from navigation hover for eager loading
 */
export function prefetchAvatarImages(imageUrls: string[], limit = 10): void {
  const toPrefetch = imageUrls.slice(0, limit).filter(url => url && !imageCache.has(url));
  
  toPrefetch.forEach(src => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => imageCache.set(src, true);
    img.onerror = () => imageCache.set(src, false);
    img.src = src;
  });
}

/**
 * Clear image cache (useful for testing or memory cleanup)
 */
export function clearImageCache(): void {
  imageCache.clear();
}
