/**
 * Safe Video Operations - Crash-proof video element utilities
 * 
 * All video DOM operations can throw in various edge cases:
 * - AbortError when play() is interrupted
 * - InvalidStateError when element is detached
 * - NotSupportedError for unsupported codecs
 * - NotAllowedError for autoplay policies
 * - NaN/Infinity errors when duration is not ready
 * 
 * This module wraps all risky operations with proper error handling.
 */

/**
 * Check if a number is safe for video operations (finite, not NaN, positive)
 */
export function isSafeVideoNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value) && value >= 0;
}

/**
 * Safely attempt to play a video element
 * Returns true if playback started, false otherwise
 */
export async function safePlay(video: HTMLVideoElement | null): Promise<boolean> {
  if (!video) return false;
  
  try {
    // Check if video is in a valid state
    if (video.readyState < 1) {
      console.debug('[SafeVideo] Video not ready for play (readyState:', video.readyState, ')');
      return false;
    }
    
    // Additional safety: check if video element is still in DOM
    if (!video.isConnected) {
      console.debug('[SafeVideo] Video element not in DOM');
      return false;
    }
    
    await video.play();
    return true;
  } catch (err) {
    const error = err as Error;
    
    // AbortError is common and harmless - happens when play is interrupted
    if (error?.name === 'AbortError') {
      console.debug('[SafeVideo] Play aborted (harmless)');
      return false;
    }
    
    // NotAllowedError - autoplay policy blocked
    if (error?.name === 'NotAllowedError') {
      console.debug('[SafeVideo] Autoplay blocked by browser policy');
      return false;
    }
    
    // InvalidStateError - element in wrong state
    if (error?.name === 'InvalidStateError') {
      console.debug('[SafeVideo] Invalid state for play');
      return false;
    }
    
    // Other errors - log but don't crash
    console.debug('[SafeVideo] Play failed:', error?.message || error);
    return false;
  }
}

/**
 * Safely pause a video element
 */
export function safePause(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  
  try {
    video.pause();
    return true;
  } catch (err) {
    console.debug('[SafeVideo] Pause failed:', (err as Error)?.message);
    return false;
  }
}

/**
 * Safely set currentTime on a video element
 */
export function safeSeek(video: HTMLVideoElement | null, time: number): boolean {
  if (!video) return false;
  
  try {
    // Validate time is a valid number
    if (!isFinite(time) || isNaN(time) || time < 0) {
      console.debug('[SafeVideo] Invalid seek time:', time);
      return false;
    }
    
    // Check duration is valid before seeking
    if (!isFinite(video.duration) || isNaN(video.duration) || video.duration <= 0) {
      console.debug('[SafeVideo] Cannot seek - invalid duration:', video.duration);
      return false;
    }
    
    // Clamp to valid range
    const clampedTime = Math.max(0, Math.min(time, video.duration));
    video.currentTime = clampedTime;
    return true;
  } catch (err) {
    console.debug('[SafeVideo] Seek failed:', (err as Error)?.message);
    return false;
  }
}

/**
 * Safely load a video source
 */
export function safeLoad(video: HTMLVideoElement | null, src?: string): boolean {
  if (!video) return false;
  
  try {
    if (src) {
      video.src = src;
    }
    video.load();
    return true;
  } catch (err) {
    console.debug('[SafeVideo] Load failed:', (err as Error)?.message);
    return false;
  }
}

/**
 * Get safe duration (returns 0 for invalid values)
 */
export function getSafeDuration(video: HTMLVideoElement | null): number {
  if (!video) return 0;
  
  const duration = video.duration;
  if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
    return 0;
  }
  return duration;
}

/**
 * Get safe current time (returns 0 for invalid values)
 */
export function getSafeCurrentTime(video: HTMLVideoElement | null): number {
  if (!video) return 0;
  
  try {
    const time = video.currentTime;
    if (!isFinite(time) || isNaN(time) || time < 0) {
      return 0;
    }
    return time;
  } catch {
    return 0;
  }
}

/**
 * Check if video is in a playable state
 */
export function isVideoPlayable(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  
  try {
    return video.readyState >= 2 && getSafeDuration(video) > 0;
  } catch {
    return false;
  }
}

/**
 * Safely set muted state
 */
export function safeSetMuted(video: HTMLVideoElement | null, muted: boolean): boolean {
  if (!video) return false;
  
  try {
    video.muted = muted;
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a cleanup function for blob URLs
 */
export function createBlobUrlCleaner(blobUrls: Map<number, string> | string[]): () => void {
  return () => {
    try {
      if (Array.isArray(blobUrls)) {
        blobUrls.forEach(url => {
          if (url?.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
      } else {
        blobUrls.forEach(url => {
          if (url?.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        blobUrls.clear();
      }
    } catch (err) {
      console.debug('[SafeVideo] Cleanup error:', err);
    }
  };
}

/**
 * Wrap a video error event handler to prevent crashes
 */
export function createSafeErrorHandler(
  onError?: (message: string) => void
): (e: Event) => void {
  return (e: Event) => {
    try {
      const video = e.target as HTMLVideoElement;
      const error = video?.error;
      
      let message = 'Video playback error';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = 'Video loading was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Video decode error - format may be unsupported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Video format not supported';
            break;
          default:
            message = error.message || 'Unknown video error';
        }
      }
      
      console.warn('[SafeVideo]', message);
      onError?.(message);
    } catch (err) {
      console.debug('[SafeVideo] Error handler failed:', err);
    }
  };
}
