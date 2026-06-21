/**
 * VideoSourceValidator - Deterministic video source validation
 * 
 * MUST be used before mounting ANY video player to prevent:
 * - Empty/undefined src crashes
 * - CORS blocked videos crashing the app
 * - 404 errors cascading to app crash
 * - Invalid content-type crashes
 * 
 * Usage:
 * const result = await validateVideoSource(url);
 * if (!result.valid) {
 *   // Render error state, NOT the player
 * }
 */

export interface VideoValidationResult {
  valid: boolean;
  url: string;
  error?: VideoSourceError;
  contentType?: string;
  contentLength?: number;
  supportsRanges?: boolean;
  duration?: number;
  width?: number;
  height?: number;
}

export type VideoSourceError = 
  | 'EMPTY_SOURCE'
  | 'INVALID_URL'
  | 'NETWORK_ERROR'
  | 'CORS_BLOCKED'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'INVALID_CONTENT_TYPE'
  | 'UNSUPPORTED_CODEC'
  | 'NOT_SEEKABLE'
  | 'TIMEOUT'
  | 'UNKNOWN';

export const ERROR_MESSAGES: Record<VideoSourceError, string> = {
  EMPTY_SOURCE: 'No video source provided',
  INVALID_URL: 'Invalid video URL format',
  NETWORK_ERROR: 'Network error - check your connection',
  CORS_BLOCKED: 'Video blocked by CORS policy',
  NOT_FOUND: 'Video not found (404)',
  SERVER_ERROR: 'Server error - try again later',
  INVALID_CONTENT_TYPE: 'Invalid video format',
  UNSUPPORTED_CODEC: 'Video codec not supported',
  NOT_SEEKABLE: 'Video does not support seeking',
  TIMEOUT: 'Video loading timed out',
  UNKNOWN: 'Unknown video error',
};

// Cache for validation results to avoid re-validating same URLs
const validationCache = new Map<string, VideoValidationResult>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Quick synchronous check - use before async validation
 */
export function quickValidateSource(src: string | undefined | null): { valid: boolean; error?: VideoSourceError } {
  // Check empty/undefined
  if (!src || src.trim() === '') {
    return { valid: false, error: 'EMPTY_SOURCE' };
  }
  
  // Check valid URL format
  try {
    new URL(src);
  } catch {
    return { valid: false, error: 'INVALID_URL' };
  }
  
  // Check not a manifest (JSON) - those need different handling
  if (src.endsWith('.json')) {
    // JSON manifests are valid but need ManifestPlayer
    return { valid: true };
  }
  
  // Check for known bad patterns
  if (src.includes('replicate.delivery') && !src.includes('supabase')) {
    // Replicate URLs expire quickly - warn but allow
    console.debug('[VideoValidator] Replicate URL detected - may be expired');
  }
  
  return { valid: true };
}

/**
 * Full async validation with network checks
 */
export async function validateVideoSource(
  src: string | undefined | null,
  options: {
    timeout?: number;
    skipNetworkCheck?: boolean;
    skipMetadataCheck?: boolean;
  } = {}
): Promise<VideoValidationResult> {
  const { timeout = 5000, skipNetworkCheck = false, skipMetadataCheck = true } = options;
  
  // Quick validation first
  const quickResult = quickValidateSource(src);
  if (!quickResult.valid) {
    return { valid: false, url: src || '', error: quickResult.error };
  }
  
  const url = src!;
  
  // Check cache
  const cached = validationCache.get(url);
  const cacheTime = cacheTimestamps.get(url);
  if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cached;
  }
  
  // Skip network check if requested (faster, less reliable)
  if (skipNetworkCheck) {
    const result: VideoValidationResult = { valid: true, url };
    validationCache.set(url, result);
    cacheTimestamps.set(url, Date.now());
    return result;
  }
  
  // Network validation with HEAD request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    });
    
    clearTimeout(timeoutId);
    
    // Check response status
    if (response.status === 404) {
      const result: VideoValidationResult = { valid: false, url, error: 'NOT_FOUND' };
      validationCache.set(url, result);
      cacheTimestamps.set(url, Date.now());
      return result;
    }
    
    if (response.status >= 500) {
      const result: VideoValidationResult = { valid: false, url, error: 'SERVER_ERROR' };
      validationCache.set(url, result);
      cacheTimestamps.set(url, Date.now());
      return result;
    }
    
    if (!response.ok) {
      const result: VideoValidationResult = { valid: false, url, error: 'NETWORK_ERROR' };
      validationCache.set(url, result);
      cacheTimestamps.set(url, Date.now());
      return result;
    }
    
    // Check content type
    const contentType = response.headers.get('content-type') || '';
    const validTypes = ['video/', 'application/octet-stream', 'binary/octet-stream'];
    const hasValidType = validTypes.some(t => contentType.includes(t)) || contentType === '';
    
    if (!hasValidType && contentType.includes('text/html')) {
      // Server returned HTML error page
      const result: VideoValidationResult = { valid: false, url, error: 'INVALID_CONTENT_TYPE', contentType };
      validationCache.set(url, result);
      cacheTimestamps.set(url, Date.now());
      return result;
    }
    
    // Check for range support (needed for seeking)
    const acceptRanges = response.headers.get('accept-ranges');
    const supportsRanges = acceptRanges === 'bytes';
    
    // Get content length
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;
    
    const result: VideoValidationResult = {
      valid: true,
      url,
      contentType: contentType || undefined,
      contentLength,
      supportsRanges,
    };
    
    validationCache.set(url, result);
    cacheTimestamps.set(url, Date.now());
    return result;
    
  } catch (err) {
    const error = err as Error;
    
    // CORS blocked
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      // Could be CORS or network - try opaque request to distinguish
      try {
        await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        // If this succeeds, it's CORS blocked (opaque response)
        const result: VideoValidationResult = { valid: false, url, error: 'CORS_BLOCKED' };
        validationCache.set(url, result);
        cacheTimestamps.set(url, Date.now());
        return result;
      } catch {
        // Actual network error
        const result: VideoValidationResult = { valid: false, url, error: 'NETWORK_ERROR' };
        validationCache.set(url, result);
        cacheTimestamps.set(url, Date.now());
        return result;
      }
    }
    
    // Timeout
    if (error.name === 'AbortError') {
      const result: VideoValidationResult = { valid: false, url, error: 'TIMEOUT' };
      validationCache.set(url, result);
      cacheTimestamps.set(url, Date.now());
      return result;
    }
    
    // Unknown error
    console.debug('[VideoValidator] Validation error:', error);
    const result: VideoValidationResult = { valid: false, url, error: 'UNKNOWN' };
    validationCache.set(url, result);
    cacheTimestamps.set(url, Date.now());
    return result;
  }
}

/**
 * Validate video metadata by loading in hidden element
 * Only call after network validation passes
 */
export function validateVideoMetadata(
  url: string,
  timeout: number = 10000
): Promise<{ valid: boolean; duration?: number; width?: number; height?: number; error?: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    let resolved = false;
    
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    };
    
    const onLoaded = () => {
      if (resolved) return;
      resolved = true;
      
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      
      cleanup();
      
      if (!isFinite(duration) || duration <= 0) {
        resolve({ valid: false, error: 'Invalid duration' });
        return;
      }
      
      if (width === 0 || height === 0) {
        resolve({ valid: false, error: 'Invalid dimensions' });
        return;
      }
      
      resolve({ valid: true, duration, width, height });
    };
    
    const onError = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      
      const error = video.error;
      let message = 'Unknown error';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = 'Playback aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Unsupported codec';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Format not supported';
            break;
        }
      }
      
      resolve({ valid: false, error: message });
    };
    
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
    
    // Timeout
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ valid: false, error: 'Metadata load timeout' });
    }, timeout);
    
    video.src = url;
    video.load();
  });
}

/**
 * Clear validation cache (call on user action or after long idle)
 */
export function clearValidationCache(): void {
  validationCache.clear();
  cacheTimestamps.clear();
}

/**
 * Get cached validation result if available
 */
export function getCachedValidation(url: string): VideoValidationResult | null {
  const cached = validationCache.get(url);
  const cacheTime = cacheTimestamps.get(url);
  if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cached;
  }
  return null;
}
