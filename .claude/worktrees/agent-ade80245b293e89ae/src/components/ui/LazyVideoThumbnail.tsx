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
// CONCURRENCY LIMITER - max 6 videos loading at once (exported for reuse)
// ============================================================================

const MAX_CONCURRENT_LOADS = 6;
let activeLoads = 0;
const loadQueue: Array<() => void> = [];

export function requestLoadSlot(): Promise<void> {
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

export function releaseLoadSlot(): void {
  activeLoads--;
  if (loadQueue.length > 0 && activeLoads < MAX_CONCURRENT_LOADS) {
    const next = loadQueue.shift();
    next?.();
  }
}

/** Check if a load slot is immediately available without queuing */
export function hasAvailableLoadSlot(): boolean {
  return activeLoads < MAX_CONCURRENT_LOADS;
}

// ============================================================================
// PERSISTENT THUMBNAIL CACHE — keeps frames visible across remounts/scroll
// ============================================================================

const thumbCache = new Map<string, string>(); // src -> dataURL
const thumbInflight = new Map<string, Promise<string | null>>();
const thumbSubscribers = new Map<string, Set<(url: string) => void>>();
const thumbFailures = new Map<string, number>(); // src -> last-failure-timestamp
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // retry failed extracts every 5min

// ----------------------------------------------------------------------------
// IndexedDB layer — persists extracted frames across sessions so thumbnails
// stay visible "forever" and never need to be re-extracted on reload.
// ----------------------------------------------------------------------------
const IDB_NAME = 'lov-thumb-cache-v1';
const IDB_STORE = 'frames';
let idbPromise: Promise<IDBDatabase | null> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return idbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch { /* noop */ }
}

/** Hydrate a single src from IndexedDB into the in-memory cache. */
async function hydrateFromIdb(src: string): Promise<string | null> {
  if (thumbCache.has(src)) return thumbCache.get(src)!;
  const stored = await idbGet(src);
  if (stored) {
    thumbCache.set(src, stored);
    thumbSubscribers.get(src)?.forEach((fn) => { try { fn(stored); } catch { /* noop */ } });
    return stored;
  }
  return null;
}

function notifyThumb(src: string, url: string) {
  thumbCache.set(src, url);
  // Persist asynchronously — never blocks rendering
  idbSet(src, url).catch(() => { /* noop */ });
  thumbSubscribers.get(src)?.forEach((fn) => { try { fn(url); } catch { /* noop */ } });
}

export function getCachedThumb(src: string): string | undefined {
  return thumbCache.get(src);
}

function extractFrame(src: string, seekFraction = 0.1): Promise<string | null> {
  const cached = thumbCache.get(src);
  if (cached) return Promise.resolve(cached);
  const inflight = thumbInflight.get(src);
  if (inflight) return inflight;

  // Skip rapidly-retrying failed sources
  const lastFail = thumbFailures.get(src);
  if (lastFail && Date.now() - lastFail < FAILURE_COOLDOWN_MS) {
    return Promise.resolve(null);
  }

  const p = (async (): Promise<string | null> => {
    // First check IndexedDB — may have been extracted in a prior session
    const persisted = await hydrateFromIdb(src);
    if (persisted) return persisted;

    await requestLoadSlot();
    return new Promise<string | null>((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      let done = false;
      const finish = (url: string | null) => {
        if (done) return;
        done = true;
        try { video.removeAttribute('src'); video.load(); } catch { /* noop */ }
        releaseLoadSlot();
        if (url) notifyThumb(src, url);
        else thumbFailures.set(src, Date.now());
        resolve(url);
      };

      const timeout = setTimeout(() => finish(null), 6000);

      video.onloadedmetadata = () => {
        const d = video.duration;
        if (!d || !isFinite(d) || d <= 0) { clearTimeout(timeout); finish(null); return; }
        try { video.currentTime = Math.min(d * seekFraction, 2); }
        catch { clearTimeout(timeout); finish(null); }
      };
      video.onseeked = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(video.videoWidth || 640, 640);
          canvas.height = Math.min(video.videoHeight || 360, 360);
          const ctx = canvas.getContext('2d');
          if (!ctx) return finish(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          canvas.width = 1; canvas.height = 1;
          finish(dataUrl);
        } catch { finish(null); }
      };
      video.onerror = () => {
        clearTimeout(timeout);
        // Retry once without crossOrigin — many CDNs (replicate, signed urls) reject
        // anonymous CORS but serve the bytes fine without it. We can still draw to
        // canvas, just won't be able to read pixels — so we skip extract and fail.
        finish(null);
      };
      video.src = src;
    });
  })();

  thumbInflight.set(src, p);
  p.finally(() => thumbInflight.delete(src));
  return p;
}

/** Background pre-warm a list of sources so thumbnails stay always-visible.
 *  Skips already-cached or already-inflight srcs. Throttled by load slot limiter. */
export function prewarmThumbnails(srcs: Array<string | null | undefined>, seekFraction = 0.1): void {
  const unique = Array.from(new Set(srcs.filter((s): s is string => !!s)));
  unique.forEach((src) => {
    if (thumbCache.has(src) || thumbInflight.has(src)) return;
    // Fire and forget
    extractFrame(src, seekFraction).catch(() => { /* swallow */ });
  });
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
  const [isVisible, setIsVisible] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(() => (src ? thumbCache.get(src) ?? null : null));
  const [posterFailed, setPosterFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(() => !(src && thumbCache.has(src)));
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Hydrate from IndexedDB on mount — instantly restores thumbs from prior sessions
  useEffect(() => {
    if (!src || thumbCache.has(src)) return;
    let cancelled = false;
    hydrateFromIdb(src).then((url) => {
      if (cancelled || !mountedRef.current || !url) return;
      setFrameUrl(url);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [src]);

  // Subscribe to cache updates so background pre-warm fills in without remount
  useEffect(() => {
    if (!src) return;
    const cached = thumbCache.get(src);
    if (cached) {
      setFrameUrl(cached);
      setIsLoading(false);
      return;
    }
    let subs = thumbSubscribers.get(src);
    if (!subs) { subs = new Set(); thumbSubscribers.set(src, subs); }
    const cb = (url: string) => {
      if (!mountedRef.current) return;
      setFrameUrl(url);
      setIsLoading(false);
    };
    subs.add(cb);
    return () => { subs?.delete(cb); };
  }, [src]);

  // Intersection Observer - only activate when in viewport
  useEffect(() => {
    if (src && thumbCache.has(src)) return; // already cached, skip observing
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
  }, [src]);

  // Load video frame when visible — uses persistent cache + concurrency limiter
  useEffect(() => {
    if (!isVisible || !src) return;
    let cancelled = false;
    extractFrame(src, seekFraction).then((url) => {
      if (cancelled || !mountedRef.current) return;
      if (url) {
        setFrameUrl(url);
        setIsLoading(false);
      } else {
        // No frame — keep poster fallback / placeholder visible
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [isVisible, src, seekFraction]);

  // Determine which fallback to render. We NEVER show a "failed" state — we
  // always fall back to a soft cinematic placeholder so the wall stays full.
  const showPoster = !frameUrl && posterUrl && !posterFailed;
  const showPlaceholder = !frameUrl && (!posterUrl || posterFailed);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      {/* Always-visible cinematic gradient backdrop — guarantees no blank cells */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, hsl(220 14% 6%) 0%, hsl(220 14% 3%) 60%, hsl(217 91% 8%) 100%)',
        }}
      />
      {frameUrl ? (
        <img
          src={frameUrl}
          alt={alt}
          className="relative w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : showPoster ? (
        <img
          src={posterUrl as string}
          alt={alt}
          className="relative w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setPosterFailed(true)}
        />
      ) : null}
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center">
          {isLoading && isVisible ? (
            <div className="w-5 h-5 border-2 border-white/10 border-t-primary/40 rounded-full animate-spin" />
          ) : (
            <Film className="w-8 h-8 text-white/10" strokeWidth={1.25} />
          )}
        </div>
      )}
    </div>
  );
});

export default LazyVideoThumbnail;
