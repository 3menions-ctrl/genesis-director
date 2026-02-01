/**
 * Blob Preload Cache - Memory-efficient clip caching with automatic cleanup
 * 
 * Features:
 * - Prefetches video clips as Blobs for reliable playback
 * - LRU eviction when cache exceeds memory limit
 * - Automatic cleanup of Blob URLs
 * - Progress tracking for UI feedback
 */

export interface CachedClip {
  url: string;
  blobUrl: string;
  blob: Blob;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  duration?: number;
}

export interface CacheStats {
  totalSizeBytes: number;
  clipCount: number;
  maxSizeBytes: number;
  hitRate: number;
  missCount: number;
  hitCount: number;
}

export interface PreloadProgress {
  clipIndex: number;
  url: string;
  loadedBytes: number;
  totalBytes: number;
  percentComplete: number;
}

export interface BlobCacheConfig {
  /** Maximum cache size in bytes (default: 500MB) */
  maxSizeBytes: number;
  /** Preload ahead count (default: 2 clips) */
  preloadAhead: number;
  /** Cleanup clips older than this (ms, default: 5 min) */
  maxAge: number;
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: BlobCacheConfig = {
  maxSizeBytes: 500 * 1024 * 1024, // 500MB
  preloadAhead: 2,
  maxAge: 5 * 60 * 1000, // 5 minutes
  debug: false,
};

/**
 * Blob Preload Cache Manager
 */
export class BlobPreloadCache {
  private cache: Map<string, CachedClip> = new Map();
  private config: BlobCacheConfig;
  private abortControllers: Map<string, AbortController> = new Map();
  private totalSize: number = 0;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(config: Partial<BlobCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log('Initialized with config:', this.config);
  }

  /**
   * Get a clip from cache, fetching if not present
   */
  async get(
    url: string,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<CachedClip | null> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      this.hitCount++;
      cached.lastAccessedAt = Date.now();
      this.log('Cache hit:', url.substring(0, 50));
      return cached;
    }

    this.missCount++;
    this.log('Cache miss, fetching:', url.substring(0, 50));

    // Fetch and cache
    try {
      const clip = await this.fetchAndCache(url, onProgress);
      return clip;
    } catch (error) {
      console.error('[BlobCache] Fetch failed:', error);
      return null;
    }
  }

  /**
   * Check if URL is in cache
   */
  has(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * Get cached clip without fetching
   */
  peek(url: string): CachedClip | null {
    return this.cache.get(url) || null;
  }

  /**
   * Preload multiple clips ahead of current playback
   */
  async preloadAhead(
    urls: string[],
    currentIndex: number,
    onProgress?: (index: number, progress: PreloadProgress) => void
  ): Promise<void> {
    const endIndex = Math.min(
      currentIndex + this.config.preloadAhead + 1,
      urls.length
    );

    const toPreload: string[] = [];
    for (let i = currentIndex; i < endIndex; i++) {
      if (!this.has(urls[i])) {
        toPreload.push(urls[i]);
      }
    }

    if (toPreload.length === 0) {
      this.log('All clips already cached');
      return;
    }

    this.log(`Preloading ${toPreload.length} clips...`);

    // Preload in order (not parallel) to prioritize closer clips
    for (const url of toPreload) {
      const index = urls.indexOf(url);
      try {
        await this.fetchAndCache(url, (progress) => {
          onProgress?.(index, progress);
        });
      } catch (error) {
        console.warn('[BlobCache] Preload failed for:', url.substring(0, 50));
      }
    }
  }

  /**
   * Fetch a URL and store in cache
   */
  private async fetchAndCache(
    url: string,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<CachedClip> {
    // Create abort controller for this fetch
    const controller = new AbortController();
    this.abortControllers.set(url, controller);

    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let loadedBytes = 0;
      const chunks: BlobPart[] = [];

      if (response.body) {
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Convert to regular Uint8Array to avoid SharedArrayBuffer issues
          const chunk = new Uint8Array(value.buffer.slice(0));
          chunks.push(chunk);
          loadedBytes += value.length;

          onProgress?.({
            clipIndex: 0,
            url,
            loadedBytes,
            totalBytes: totalBytes || loadedBytes,
            percentComplete: totalBytes
              ? Math.round((loadedBytes / totalBytes) * 100)
              : 0,
          });
        }
      } else {
        // Fallback for browsers without body.getReader()
        const arrayBuffer = await response.arrayBuffer();
        chunks.push(arrayBuffer);
        loadedBytes = arrayBuffer.byteLength;
      }

      // Combine chunks into Blob
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);

      // Check if we need to evict before adding
      while (this.totalSize + blob.size > this.config.maxSizeBytes) {
        if (!this.evictLRU()) {
          break; // No more items to evict
        }
      }

      // Create cache entry
      const clip: CachedClip = {
        url,
        blobUrl,
        blob,
        sizeBytes: blob.size,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      this.cache.set(url, clip);
      this.totalSize += blob.size;

      this.log(`Cached: ${url.substring(0, 50)} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);

      return clip;
    } finally {
      this.abortControllers.delete(url);
    }
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): boolean {
    let oldestUrl: string | null = null;
    let oldestTime = Infinity;

    for (const [url, clip] of this.cache) {
      if (clip.lastAccessedAt < oldestTime) {
        oldestTime = clip.lastAccessedAt;
        oldestUrl = url;
      }
    }

    if (oldestUrl) {
      this.remove(oldestUrl);
      return true;
    }

    return false;
  }

  /**
   * Remove a specific clip from cache
   */
  remove(url: string): boolean {
    const clip = this.cache.get(url);
    if (!clip) return false;

    // Revoke blob URL to free memory
    URL.revokeObjectURL(clip.blobUrl);
    this.totalSize -= clip.sizeBytes;
    this.cache.delete(url);

    this.log(`Evicted: ${url.substring(0, 50)}`);
    return true;
  }

  /**
   * Abort pending fetch for a URL
   */
  abortFetch(url: string): void {
    const controller = this.abortControllers.get(url);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(url);
    }
  }

  /**
   * Abort all pending fetches
   */
  abortAll(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  /**
   * Clear all cached clips
   */
  clear(): void {
    this.abortAll();

    for (const clip of this.cache.values()) {
      URL.revokeObjectURL(clip.blobUrl);
    }

    this.cache.clear();
    this.totalSize = 0;
    this.log('Cache cleared');
  }

  /**
   * Cleanup old clips beyond maxAge
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [url, clip] of this.cache) {
      if (now - clip.lastAccessedAt > this.config.maxAge) {
        this.remove(url);
        removed++;
      }
    }

    if (removed > 0) {
      this.log(`Cleaned up ${removed} stale clips`);
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      totalSizeBytes: this.totalSize,
      clipCount: this.cache.size,
      maxSizeBytes: this.config.maxSizeBytes,
      hitRate:
        this.hitCount + this.missCount > 0
          ? this.hitCount / (this.hitCount + this.missCount)
          : 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
    };
  }

  /**
   * Debug logging
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[BlobCache]', ...args);
    }
  }

  /**
   * Destroy the cache and free all memory
   */
  destroy(): void {
    this.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.log('Destroyed');
  }
}

// Singleton instance for global use
let globalCache: BlobPreloadCache | null = null;

/**
 * Get the global blob cache instance
 */
export function getGlobalBlobCache(): BlobPreloadCache {
  if (!globalCache) {
    globalCache = new BlobPreloadCache({ debug: false });
  }
  return globalCache;
}

/**
 * Destroy the global cache (for cleanup on unmount)
 */
export function destroyGlobalBlobCache(): void {
  if (globalCache) {
    globalCache.destroy();
    globalCache = null;
  }
}
