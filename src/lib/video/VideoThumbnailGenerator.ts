/**
 * VideoThumbnailGenerator - Reliable thumbnail extraction
 * 
 * Strategies:
 * 1. Server-generated (preferred) - Check project.thumbnail_url
 * 2. Client canvas extraction with IndexedDB caching
 * 3. Placeholder fallback for failures
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { cleanupCanvasElement } from '@/lib/memoryManager';

interface ThumbnailCacheSchema extends DBSchema {
  thumbnails: {
    key: string;
    value: {
      url: string;
      dataUrl: string;
      width: number;
      height: number;
      createdAt: number;
      etag?: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ThumbnailCacheSchema>> | null = null;

const DB_NAME = 'apex-video-thumbnails';
const DB_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getDB(): Promise<IDBPDatabase<ThumbnailCacheSchema> | null> {
  if (typeof indexedDB === 'undefined') return null;
  
  if (!dbPromise) {
    dbPromise = openDB<ThumbnailCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails');
        }
      },
    }).catch(() => null) as Promise<IDBPDatabase<ThumbnailCacheSchema>>;
  }
  
  return dbPromise;
}

/**
 * Get cached thumbnail from IndexedDB
 */
export async function getCachedThumbnail(videoUrl: string): Promise<string | null> {
  try {
    const db = await getDB();
    if (!db) return null;
    
    const cached = await db.get('thumbnails', videoUrl);
    if (!cached) return null;
    
    // Check expiration
    if (Date.now() - cached.createdAt > CACHE_MAX_AGE_MS) {
      await db.delete('thumbnails', videoUrl);
      return null;
    }
    
    return cached.dataUrl;
  } catch {
    return null;
  }
}

/**
 * Cache thumbnail to IndexedDB
 */
async function cacheThumbnail(
  videoUrl: string,
  dataUrl: string,
  width: number,
  height: number,
  etag?: string
): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    
    await db.put('thumbnails', {
      url: videoUrl,
      dataUrl,
      width,
      height,
      createdAt: Date.now(),
      etag,
    }, videoUrl);
  } catch {
    // Cache failure is non-fatal
  }
}

/**
 * Clean expired thumbnails from cache
 */
export async function cleanExpiredThumbnails(): Promise<number> {
  try {
    const db = await getDB();
    if (!db) return 0;
    
    const tx = db.transaction('thumbnails', 'readwrite');
    const store = tx.objectStore('thumbnails');
    
    let deleted = 0;
    let cursor = await store.openCursor();
    
    while (cursor) {
      if (Date.now() - cursor.value.createdAt > CACHE_MAX_AGE_MS) {
        await cursor.delete();
        deleted++;
      }
      cursor = await cursor.continue();
    }
    
    return deleted;
  } catch {
    return 0;
  }
}

export interface ThumbnailResult {
  success: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
  fromCache?: boolean;
}

/**
 * Extract thumbnail from video at specified time
 * 
 * @param videoUrl - Video source URL
 * @param seekTime - Time in seconds (default: 0.25s or 10% of duration for short videos)
 * @param options - Additional options
 */
export async function extractThumbnail(
  videoUrl: string,
  seekTime?: number,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    timeout?: number;
    useCache?: boolean;
  } = {}
): Promise<ThumbnailResult> {
  const {
    maxWidth = 640,
    maxHeight = 360,
    quality = 0.85,
    timeout = 15000,
    useCache = true,
  } = options;
  
  // Check cache first
  if (useCache) {
    const cached = await getCachedThumbnail(videoUrl);
    if (cached) {
      return { success: true, dataUrl: cached, fromCache: true };
    }
  }
  
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
      // SAFETY: Clean up canvas to release GPU memory
      cleanupCanvasElement(canvas);
    };
    
    const onError = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      
      const error = video.error;
      let message = 'Failed to load video';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Decode error';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Format not supported';
            break;
        }
      }
      
      resolve({ success: false, error: message });
    };
    
    const onMetadata = () => {
      if (resolved) return;
      
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        resolved = true;
        cleanup();
        resolve({ success: false, error: 'Invalid duration' });
        return;
      }
      
      // Determine seek time
      let targetTime = seekTime;
      if (targetTime === undefined) {
        // For short videos, seek to 10%; otherwise 0.25s
        targetTime = duration < 3 ? duration * 0.1 : Math.min(0.25, duration - 0.1);
      }
      targetTime = Math.max(0, Math.min(targetTime, duration - 0.1));
      
      video.currentTime = targetTime;
    };
    
    const onSeeked = () => {
      if (resolved) return;
      resolved = true;
      
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        
        if (vw === 0 || vh === 0) {
          cleanup();
          resolve({ success: false, error: 'Invalid dimensions' });
          return;
        }
        
        // Calculate scaled dimensions maintaining aspect ratio
        let width = vw;
        let height = vh;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (maxHeight / height) * width;
          height = maxHeight;
        }
        
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        
        if (!ctx) {
          cleanup();
          resolve({ success: false, error: 'Canvas context unavailable' });
          return;
        }
        
        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Export as data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        cleanup();
        
        // Cache the result
        if (useCache) {
          cacheThumbnail(videoUrl, dataUrl, canvas.width, canvas.height);
        }
        
        resolve({
          success: true,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      } catch (err) {
        cleanup();
        
        // CORS canvas taint error
        if (err instanceof DOMException && err.name === 'SecurityError') {
          resolve({ success: false, error: 'CORS prevents canvas access' });
          return;
        }
        
        resolve({ success: false, error: 'Canvas draw failed' });
      }
    };
    
    // Set up video element
    // NOTE: crossOrigin removed for stability - some CDNs don't support CORS
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    
    // Timeout
    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ success: false, error: 'Thumbnail extraction timed out' });
    }, timeout);
    
    // Start loading
    video.src = videoUrl;
    video.load();
  });
}

/**
 * Generate placeholder thumbnail data URL
 */
export function generatePlaceholder(
  width: number = 640,
  height: number = 360,
  text: string = 'No Preview'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Dark gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#18181b');
  gradient.addColorStop(1, '#09090b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Text
  ctx.fillStyle = '#52525b';
  ctx.font = `${Math.floor(width / 20)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  
  // SAFETY: Clean up canvas after extracting data URL
  cleanupCanvasElement(canvas);
  
  return dataUrl;
}

/**
 * Get or generate thumbnail with full fallback chain
 */
export async function getThumbnailWithFallback(
  videoUrl: string | null | undefined,
  serverThumbnailUrl?: string | null
): Promise<{ src: string; type: 'server' | 'extracted' | 'placeholder' | 'cached' }> {
  // 1. Server thumbnail (preferred)
  if (serverThumbnailUrl && serverThumbnailUrl.length > 0) {
    return { src: serverThumbnailUrl, type: 'server' };
  }
  
  // 2. No video URL - return placeholder
  if (!videoUrl || videoUrl.trim() === '') {
    return { src: generatePlaceholder(640, 360, 'No Video'), type: 'placeholder' };
  }
  
  // 3. Check cache
  const cached = await getCachedThumbnail(videoUrl);
  if (cached) {
    return { src: cached, type: 'cached' };
  }
  
  // 4. Try extraction
  const result = await extractThumbnail(videoUrl);
  if (result.success && result.dataUrl) {
    return { src: result.dataUrl, type: 'extracted' };
  }
  
  // 5. Placeholder fallback
  return { src: generatePlaceholder(640, 360, result.error || 'Preview Failed'), type: 'placeholder' };
}
