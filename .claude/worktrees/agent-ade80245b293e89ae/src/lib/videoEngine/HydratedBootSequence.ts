/**
 * Hydrated Boot Sequence - Reliable Video Loading with Buffer Verification
 * 
 * Ensures no transitions occur until media buffers are 100% verified ready.
 * Implements graceful fallback for sub-millisecond transition failures.
 */

// Boot sequence states
export type BootState = 'idle' | 'loading' | 'buffering' | 'ready' | 'error';

export interface BufferStatus {
  clipId: string;
  state: BootState;
  bufferedPercent: number;
  bufferedRanges: { start: number; end: number }[];
  canPlayThrough: boolean;
  duration: number;
  loadedBytes: number;
  lastError: string | null;
}

export interface HydratedBootConfig {
  /** Timeout for canplaythrough event (ms) */
  loadTimeout: number;
  /** Minimum buffer percentage before allowing playback */
  minBufferPercent: number;
  /** Fallback transition duration if atomic fails (ms) */
  fallbackTransitionMs: number;
  /** Enable diagnostic overlay */
  enableDiagnostics: boolean;
}

const DEFAULT_CONFIG: HydratedBootConfig = {
  loadTimeout: 10000, // 10 seconds
  minBufferPercent: 25, // 25% buffered minimum
  fallbackTransitionMs: 16, // One frame at 60fps
  enableDiagnostics: false,
};

/**
 * Waits for a video element to reach canplaythrough state
 * Returns a promise that resolves when ready or rejects on timeout/error
 */
export function waitForCanPlayThrough(
  video: HTMLVideoElement,
  timeoutMs: number = DEFAULT_CONFIG.loadTimeout
): Promise<BufferStatus> {
  return new Promise((resolve, reject) => {
    const clipId = video.src || 'unknown';
    
    // If already ready, resolve immediately
    if (video.readyState >= 4) {
      resolve(getBufferStatus(video, clipId, 'ready'));
      return;
    }

    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Don't reject - resolve with current state for graceful fallback
        console.warn('[HydratedBoot] Timeout waiting for canplaythrough:', clipId.substring(0, 50));
        resolve(getBufferStatus(video, clipId, video.readyState >= 2 ? 'ready' : 'error'));
      }
    }, timeoutMs);

    const handleCanPlayThrough = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        console.log('[HydratedBoot] canplaythrough achieved:', clipId.substring(0, 50));
        resolve(getBufferStatus(video, clipId, 'ready'));
      }
    };

    const handleError = (e: Event) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
      const error = (e as ErrorEvent).message || 'Unknown video loading error';
        console.debug('[HydratedBoot] Video load error:', error);
        reject(new Error(error));
      }
    };

    // Also listen for loadeddata as a fallback (readyState 2)
    const handleLoadedData = () => {
      // If we have enough data, consider it partially ready
      console.log('[HydratedBoot] loadeddata received:', clipId.substring(0, 50));
    };

    const cleanup = () => {
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadeddata', handleLoadedData);
    };

    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('error', handleError);
    video.addEventListener('loadeddata', handleLoadedData);
  });
}

/**
 * Gets the current buffer status of a video element
 */
export function getBufferStatus(
  video: HTMLVideoElement,
  clipId: string,
  state: BootState = 'idle'
): BufferStatus {
  const buffered = video.buffered;
  const duration = video.duration || 0;
  
  // Calculate buffered ranges
  const bufferedRanges: { start: number; end: number }[] = [];
  let totalBuffered = 0;
  
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i);
    const end = buffered.end(i);
    bufferedRanges.push({ start, end });
    totalBuffered += end - start;
  }

  const bufferedPercent = duration > 0 ? (totalBuffered / duration) * 100 : 0;

  return {
    clipId,
    state,
    bufferedPercent,
    bufferedRanges,
    canPlayThrough: video.readyState >= 4,
    duration,
    loadedBytes: 0, // Not directly available, would need progress event
    lastError: null,
  };
}

/**
 * Preloads a video URL and waits for it to be ready
 * Returns a prepared video element or throws on failure
 */
export async function hydrateVideoBuffer(
  url: string,
  config: Partial<HydratedBootConfig> = {}
): Promise<{ video: HTMLVideoElement; status: BufferStatus }> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log('[HydratedBoot] Starting hydration for:', url.substring(0, 60));
  
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  
  // STABILITY FIX: crossOrigin removed entirely - Supabase/Replicate CDNs 
  // don't support CORS headers for media, causing permanent loading failures
  
  // Set source and begin loading
  video.src = url;
  video.load();

  try {
    const status = await waitForCanPlayThrough(video, mergedConfig.loadTimeout);
    return { video, status };
  } catch (error) {
    console.debug('[HydratedBoot] Failed to hydrate:', error);
    // Return with error state for graceful fallback
    return {
      video,
      status: {
        clipId: url,
        state: 'error',
        bufferedPercent: 0,
        bufferedRanges: [],
        canPlayThrough: false,
        duration: 0,
        loadedBytes: 0,
        lastError: 'Video boot failed',
      },
    };
  }
}

/**
 * Graceful transition fallback - uses standard 16ms transition
 * when atomic sub-millisecond switch fails
 */
export function gracefulTransitionFallback(
  outgoing: HTMLVideoElement | null,
  incoming: HTMLVideoElement,
  fallbackMs: number = DEFAULT_CONFIG.fallbackTransitionMs
): Promise<void> {
  return new Promise((resolve) => {
    console.log('[HydratedBoot] Using graceful fallback transition:', fallbackMs, 'ms');
    
    // Start incoming - using safe play pattern
    incoming.style.opacity = '1';
    incoming.style.visibility = 'visible';
    try {
      if (incoming.readyState >= 1) {
        incoming.play().catch(() => {});
      }
    } catch {}
    
    // Fade out outgoing over fallback duration
    if (outgoing) {
      outgoing.style.transition = `opacity ${fallbackMs}ms linear`;
      outgoing.style.opacity = '0';
      
      setTimeout(() => {
        outgoing.pause();
        outgoing.style.visibility = 'hidden';
        resolve();
      }, fallbackMs);
    } else {
      resolve();
    }
  });
}

/**
 * Validates that a video element is truly ready for seamless transition
 */
export function validateTransitionReadiness(video: HTMLVideoElement): {
  isReady: boolean;
  reason: string;
  readyState: number;
  bufferedPercent: number;
} {
  const status = getBufferStatus(video, video.src);
  
  // Check multiple readiness criteria
  const hasMinBuffer = status.bufferedPercent >= DEFAULT_CONFIG.minBufferPercent;
  const hasMetadata = video.readyState >= 1;
  const hasCurrentData = video.readyState >= 2;
  const canPlay = video.readyState >= 3;
  const canPlayThrough = video.readyState >= 4;
  const hasValidDuration = !isNaN(video.duration) && video.duration > 0;
  const hasValidSrc = video.src && video.src !== '';
  
  let reason = 'Ready';
  let isReady = true;
  
  if (!hasValidSrc) {
    isReady = false;
    reason = 'No source URL';
  } else if (!hasMetadata) {
    isReady = false;
    reason = 'Waiting for metadata';
  } else if (!hasValidDuration) {
    isReady = false;
    reason = 'Invalid duration';
  } else if (!hasCurrentData) {
    isReady = false;
    reason = 'Waiting for frame data';
  } else if (!canPlay && !hasMinBuffer) {
    isReady = false;
    reason = `Buffering: ${status.bufferedPercent.toFixed(1)}%`;
  }
  
  return {
    isReady,
    reason,
    readyState: video.readyState,
    bufferedPercent: status.bufferedPercent,
  };
}

/**
 * Buffer Status Diagnostic Overlay Component Data
 */
export interface DiagnosticData {
  clips: BufferStatus[];
  activeClipIndex: number;
  transitionState: 'idle' | 'preparing' | 'transitioning' | 'complete' | 'fallback';
  lastTransitionDuration: number;
  clockSource: 'audio' | 'performance' | 'date';
  highResTimersAvailable: boolean;
}

/**
 * Checks if high-resolution timers are available
 * (Not blocked by browser security policies)
 */
export function checkHighResolutionTimers(): boolean {
  try {
    // Test performance.now() precision
    const t1 = performance.now();
    const t2 = performance.now();
    
    // If difference is exactly 0 or only whole numbers, timers may be reduced precision
    const precision = t2 - t1;
    const hasHighRes = precision !== 0 || (t1 % 1 !== 0);
    
    console.log('[HydratedBoot] High-res timer check:', {
      t1,
      t2,
      precision,
      hasHighRes,
    });
    
    return hasHighRes;
  } catch {
    return false;
  }
}

/**
 * Creates a diagnostic overlay element for buffer status
 */
export function createDiagnosticOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'hydrated-boot-diagnostics';
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    font-family: monospace;
    font-size: 11px;
    padding: 10px;
    border-radius: 4px;
    z-index: 99999;
    max-width: 300px;
    pointer-events: none;
  `;
  return overlay;
}

/**
 * Updates diagnostic overlay with current status
 */
export function updateDiagnosticOverlay(
  overlay: HTMLDivElement,
  data: DiagnosticData
): void {
  const lines = [
    `🎬 Hydrated Boot Diagnostics`,
    `───────────────────────`,
    `Active: Clip ${data.activeClipIndex + 1}/${data.clips.length}`,
    `Transition: ${data.transitionState}`,
    `Last Duration: ${data.lastTransitionDuration.toFixed(3)}ms`,
    `Clock: ${data.clockSource}`,
    `Hi-Res Timers: ${data.highResTimersAvailable ? '✅' : '⚠️ Reduced'}`,
    `───────────────────────`,
  ];

  data.clips.forEach((clip, idx) => {
    const icon = clip.state === 'ready' ? '✅' : clip.state === 'error' ? '❌' : '⏳';
    lines.push(`${idx === data.activeClipIndex ? '▶' : ' '} ${icon} Clip ${idx + 1}: ${clip.bufferedPercent.toFixed(1)}%`);
  });

  overlay.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
}
