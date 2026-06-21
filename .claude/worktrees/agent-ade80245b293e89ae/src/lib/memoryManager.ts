/**
 * Memory Manager v1.0
 * 
 * Centralized memory management utilities for preventing leaks:
 * - Blob URL tracking and cleanup
 * - Video element management
 * - DOM cleanup utilities
 */

/**
 * Blob URL Tracker
 * Tracks all created blob URLs and ensures cleanup on unmount
 */
class BlobUrlTracker {
  private urls: Set<string> = new Set();
  private componentUrls: Map<string, Set<string>> = new Map();
  
  /**
   * Track a blob URL for cleanup
   */
  track(url: string, componentId?: string): void {
    this.urls.add(url);
    
    if (componentId) {
      if (!this.componentUrls.has(componentId)) {
        this.componentUrls.set(componentId, new Set());
      }
      this.componentUrls.get(componentId)!.add(url);
    }
  }
  
  /**
   * Revoke a specific blob URL
   */
  revoke(url: string): void {
    if (this.urls.has(url)) {
      try {
        URL.revokeObjectURL(url);
        this.urls.delete(url);
        
        // Also remove from component tracking
        this.componentUrls.forEach((urls) => urls.delete(url));
      } catch (error) {
        console.warn('[MemoryManager] Failed to revoke URL:', url);
      }
    }
  }
  
  /**
   * Revoke all URLs for a specific component
   */
  revokeForComponent(componentId: string): void {
    const urls = this.componentUrls.get(componentId);
    if (urls) {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
          this.urls.delete(url);
        } catch (error) {
          console.warn('[MemoryManager] Failed to revoke URL:', url);
        }
      });
      this.componentUrls.delete(componentId);
    }
  }
  
  /**
   * Revoke all tracked URLs (for app shutdown)
   */
  revokeAll(): void {
    this.urls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn('[MemoryManager] Failed to revoke URL:', url);
      }
    });
    this.urls.clear();
    this.componentUrls.clear();
  }
  
  /**
   * Get count of tracked URLs (for debugging)
   */
  getCount(): number {
    return this.urls.size;
  }
  
  /**
   * Get all tracked URLs (for debugging)
   */
  getUrls(): string[] {
    return Array.from(this.urls);
  }
}

// Singleton instance
export const blobUrlTracker = new BlobUrlTracker();

/**
 * Video Element Manager
 * Properly cleans up video elements to prevent memory leaks
 */
export function cleanupVideoElement(video: HTMLVideoElement | null): void {
  if (!video) return;
  
  try {
    // Pause playback
    video.pause();
    
    // Remove event listeners (they're garbage collected but this helps)
    video.onloadedmetadata = null;
    video.oncanplay = null;
    video.oncanplaythrough = null;
    video.onended = null;
    video.onerror = null;
    video.ontimeupdate = null;
    video.onplay = null;
    video.onpause = null;
    video.onseeking = null;
    video.onseeked = null;
    video.onwaiting = null;
    video.onstalled = null;
    
    // Clear source - this is critical for memory release
    video.removeAttribute('src');
    video.load(); // Force browser to release the video stream
    
    // If using MediaSource, close it
    if (video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  } catch (error) {
    console.warn('[MemoryManager] Video cleanup warning:', error);
  }
}

/**
 * Canvas Cleanup
 * Properly cleans up canvas elements
 */
export function cleanupCanvasElement(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Resize to 1x1 to release GPU memory
    canvas.width = 1;
    canvas.height = 1;
  } catch (error) {
    console.warn('[MemoryManager] Canvas cleanup warning:', error);
  }
}

/**
 * Audio Cleanup
 * Properly cleans up audio elements
 */
export function cleanupAudioElement(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
  } catch (error) {
    console.warn('[MemoryManager] Audio cleanup warning:', error);
  }
}

/**
 * Create a cleanup function for use in useEffect
 */
export function createCleanupEffect(
  componentId: string,
  options?: {
    videos?: React.RefObject<HTMLVideoElement>[];
    canvases?: React.RefObject<HTMLCanvasElement>[];
    audios?: React.RefObject<HTMLAudioElement>[];
  }
): () => void {
  return () => {
    // Revoke all blob URLs for this component
    blobUrlTracker.revokeForComponent(componentId);
    
    // Clean up video elements
    options?.videos?.forEach((ref) => cleanupVideoElement(ref.current));
    
    // Clean up canvas elements
    options?.canvases?.forEach((ref) => cleanupCanvasElement(ref.current));
    
    // Clean up audio elements
    options?.audios?.forEach((ref) => cleanupAudioElement(ref.current));
  };
}

/**
 * Memory usage reporter (for debugging)
 */
export function getMemoryUsage(): {
  jsHeapSizeLimit?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  blobUrlCount: number;
} {
  const memory = (performance as unknown as { memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  } }).memory;
  
  return {
    jsHeapSizeLimit: memory?.jsHeapSizeLimit,
    totalJSHeapSize: memory?.totalJSHeapSize,
    usedJSHeapSize: memory?.usedJSHeapSize,
    blobUrlCount: blobUrlTracker.getCount(),
  };
}

/**
 * Log memory usage (for debugging in development)
 */
export function logMemoryUsage(context?: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const usage = getMemoryUsage();
  console.group(`[MemoryManager] ${context || 'Memory Usage'}`);
  console.log('Blob URLs tracked:', usage.blobUrlCount);
  if (usage.usedJSHeapSize) {
    console.log('JS Heap Used:', Math.round(usage.usedJSHeapSize / 1024 / 1024), 'MB');
    console.log('JS Heap Total:', Math.round((usage.totalJSHeapSize || 0) / 1024 / 1024), 'MB');
  }
  console.groupEnd();
}
