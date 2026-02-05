/**
 * MSE Gapless Engine - MediaSource Extensions for TRUE zero-gap video playback
 * 
 * This engine uses MediaSource API to append video segments into a single
 * unified timeline, eliminating the gaps caused by video element switching.
 * 
 * Key features:
 * - Single SourceBuffer in 'sequence' mode for automatic timestamp continuation
 * - Pre-fetches clips as ArrayBuffers for instant append
 * - Graceful fallback to standard playback if MSE unsupported
 * - Memory-efficient with automatic buffer cleanup
 */

export interface MSEClip {
  url: string;
  duration: number;
  index: number;
}

export interface MSEEngineState {
  status: 'idle' | 'initializing' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'ended';
  currentClipIndex: number;
  currentTime: number;
  totalDuration: number;
  bufferedPercent: number;
  loadedClips: number;
  totalClips: number;
  errorMessage: string | null;
  isMSESupported: boolean;
  usingFallback: boolean;
}

export interface MSEEngineCallbacks {
  onStateChange?: (state: MSEEngineState) => void;
  onClipChange?: (index: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (loaded: number, total: number) => void;
}

// Supported MIME types for MSE (in preference order)
const MSE_MIME_TYPES = [
  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  'video/mp4; codecs="avc1.42E01E"',
  'video/mp4',
  'video/webm; codecs="vp9, opus"',
  'video/webm; codecs="vp9"',
  'video/webm; codecs="vp8, vorbis"',
  'video/webm',
];

/**
 * Detects if MediaSource Extensions are supported and finds best MIME type
 */
export function detectMSESupport(): { supported: boolean; mimeType: string | null } {
  // CRITICAL: Wrap entire detection in try-catch for Safari crash prevention
  try {
    // CRITICAL: Check for Safari iOS which has limited MSE support
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOSSafari) {
      console.warn('[MSEEngine] iOS Safari detected - MSE not fully supported, using fallback');
      return { supported: false, mimeType: null };
    }

    // SAFARI FIX: Additional check for Safari desktop which can crash on some MSE operations
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const safariVersion = isSafari ? parseInt(navigator.userAgent.match(/Version\/(\d+)/)?.[1] || '0', 10) : 0;
    
    // Safari < 15 has very buggy MSE - force fallback
    if (isSafari && safariVersion < 15) {
      console.warn('[MSEEngine] Safari < 15 detected - using fallback for stability');
      return { supported: false, mimeType: null };
    }

    if (typeof MediaSource === 'undefined') {
      console.warn('[MSEEngine] MediaSource API not available');
      return { supported: false, mimeType: null };
    }

    // CRITICAL: Also check if MediaSource.isTypeSupported exists
    if (typeof MediaSource.isTypeSupported !== 'function') {
      console.warn('[MSEEngine] MediaSource.isTypeSupported not available');
      return { supported: false, mimeType: null };
    }

    // SAFARI FIX: Safari has issues with WebM, only use MP4 for Safari
    const mimeTypesToCheck = isSafari 
      ? MSE_MIME_TYPES.filter(mime => mime.startsWith('video/mp4'))
      : MSE_MIME_TYPES;

    for (const mime of mimeTypesToCheck) {
      try {
        if (MediaSource.isTypeSupported(mime)) {
          console.log('[MSEEngine] Supported MIME type found:', mime);
          return { supported: true, mimeType: mime };
        }
      } catch {
        // Skip this MIME type if check crashes
        continue;
      }
    }
  } catch (err) {
    console.warn('[MSEEngine] MSE detection crashed (likely Safari):', err);
    return { supported: false, mimeType: null };
  }

  console.warn('[MSEEngine] No supported MIME types found');
  return { supported: false, mimeType: null };
}

/**
 * Fetches a video URL as an ArrayBuffer for MSE append
 */
async function fetchAsArrayBuffer(
  url: string,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    return await response.arrayBuffer();
  }

  // Stream with progress tracking
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total || loaded);
  }

  // Combine chunks into single ArrayBuffer
  const combined = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined.buffer;
}

/**
 * MSE Gapless Engine Class
 * 
 * Manages MediaSource, SourceBuffer, and video element for seamless playback
 */
export class MSEGaplessEngine {
  private videoElement: HTMLVideoElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private mimeType: string | null = null;
  
  private clips: MSEClip[] = [];
  private clipBuffers: Map<number, ArrayBuffer> = new Map();
  private appendQueue: number[] = [];
  private isAppending: boolean = false;
  private abortController: AbortController | null = null;
  
  private state: MSEEngineState = {
    status: 'idle',
    currentClipIndex: 0,
    currentTime: 0,
    totalDuration: 0,
    bufferedPercent: 0,
    loadedClips: 0,
    totalClips: 0,
    errorMessage: null,
    isMSESupported: false,
    usingFallback: false,
  };
  
  private callbacks: MSEEngineCallbacks = {};
  private clipStartTimes: number[] = [];
  private updateIntervalId: number | null = null;

  constructor(callbacks?: MSEEngineCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }

    // Detect MSE support
    const { supported, mimeType } = detectMSESupport();
    this.mimeType = mimeType;
    this.updateState({ isMSESupported: supported });
  }

  /**
   * Initialize the engine with a video element and clips
   */
  async initialize(
    videoElement: HTMLVideoElement,
    clips: MSEClip[]
  ): Promise<boolean> {
    this.videoElement = videoElement;
    this.clips = clips;
    this.clipStartTimes = [];
    
    // Calculate clip start times
    let cumulative = 0;
    for (const clip of clips) {
      this.clipStartTimes.push(cumulative);
      cumulative += clip.duration;
    }

    this.updateState({
      status: 'initializing',
      totalClips: clips.length,
      totalDuration: cumulative,
    });

    // Check if MSE is supported
    if (!this.state.isMSESupported || !this.mimeType) {
      console.warn('[MSEEngine] MSE not supported, will use fallback mode');
      this.updateState({ usingFallback: true });
      return false;
    }

    try {
      // Create MediaSource
      this.mediaSource = new MediaSource();
      
      // Create object URL and attach to video
      const objectUrl = URL.createObjectURL(this.mediaSource);
      videoElement.src = objectUrl;

      // Wait for sourceopen
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MediaSource open timeout')), 10000);
        
        this.mediaSource!.addEventListener('sourceopen', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        this.mediaSource!.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(new Error('MediaSource error: ' + e));
        }, { once: true });
      });

      // Create SourceBuffer in sequence mode
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
      this.sourceBuffer.mode = 'sequence'; // Auto-continue timestamps
      
      // Handle SourceBuffer events
      this.sourceBuffer.addEventListener('updateend', () => this.processAppendQueue(), { once: false });
      this.sourceBuffer.addEventListener('error', (e) => {
        console.error('[MSEEngine] SourceBuffer error:', e);
        this.handleError(new Error('SourceBuffer error'));
      }, { once: true }); // Error should only trigger once

      console.log('[MSEEngine] Initialized successfully with', clips.length, 'clips');
      this.updateState({ status: 'loading' });
      
      // Start time update interval
      this.startTimeUpdates();
      
      return true;
    } catch (error) {
      console.error('[MSEEngine] Initialization failed:', error);
      this.updateState({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Init failed',
        usingFallback: true,
      });
      return false;
    }
  }

  /**
   * Load all clips and append to SourceBuffer
   */
  async loadAllClips(): Promise<void> {
    if (!this.sourceBuffer || !this.mediaSource) {
      throw new Error('Engine not initialized');
    }

    this.abortController = new AbortController();

    try {
      // Fetch all clips in parallel with limited concurrency
      const CONCURRENCY = 3;
      const results: ArrayBuffer[] = new Array(this.clips.length);
      
      for (let i = 0; i < this.clips.length; i += CONCURRENCY) {
        const batch = this.clips.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map(async (clip, batchIndex) => {
          const actualIndex = i + batchIndex;
          const buffer = await fetchAsArrayBuffer(
            clip.url,
            this.abortController!.signal,
            (loaded, total) => {
              this.callbacks.onProgress?.(
                this.state.loadedClips * 100 + Math.round((loaded / total) * 100),
                this.clips.length * 100
              );
            }
          );
          
          results[actualIndex] = buffer;
          this.clipBuffers.set(actualIndex, buffer);
          this.updateState({ loadedClips: this.state.loadedClips + 1 });
          
          return buffer;
        });

        await Promise.all(batchPromises);
      }

      console.log('[MSEEngine] All clips fetched, appending to buffer...');

      // Append all clips in order
      for (let i = 0; i < results.length; i++) {
        this.appendQueue.push(i);
      }
      
      // Start processing queue
      this.processAppendQueue();

      // Wait for all appends to complete
      await this.waitForAppendComplete();

      // End the stream
      if (this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }

      console.log('[MSEEngine] All clips appended successfully');
      this.updateState({
        status: 'ready',
        bufferedPercent: 100,
      });

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[MSEEngine] Load aborted');
        return;
      }
      
      console.error('[MSEEngine] Failed to load clips:', error);
      this.handleError(error instanceof Error ? error : new Error('Load failed'));
    }
  }

  /**
   * Process the append queue (handles SourceBuffer async nature)
   */
  private processAppendQueue(): void {
    // SAFARI FIX: Wrap entire method in try-catch to prevent crashes
    try {
      if (this.isAppending || this.appendQueue.length === 0 || !this.sourceBuffer) {
        return;
      }

      // SAFARI FIX: Check if sourceBuffer is still valid and not updating
      if (this.sourceBuffer.updating) {
        return; // Wait for current update to finish
      }

      // SAFARI FIX: Verify MediaSource is still open
      if (this.mediaSource && this.mediaSource.readyState !== 'open') {
        console.warn('[MSEEngine] MediaSource not open, skipping append');
        return;
      }

      const clipIndex = this.appendQueue.shift()!;
      const buffer = this.clipBuffers.get(clipIndex);

      if (!buffer) {
        console.warn('[MSEEngine] No buffer for clip', clipIndex);
        this.processAppendQueue();
        return;
      }

      // SAFARI FIX: Validate buffer before appending
      if (buffer.byteLength === 0) {
        console.warn('[MSEEngine] Empty buffer for clip', clipIndex);
        this.processAppendQueue();
        return;
      }

      this.isAppending = true;
      this.sourceBuffer.appendBuffer(buffer);
      console.log('[MSEEngine] Appended clip', clipIndex);
    } catch (error) {
      console.error('[MSEEngine] Append error:', error);
      this.isAppending = false;
      
      const errorName = (error as Error)?.name;
      
      // Handle QuotaExceededError by removing old buffer
      if (errorName === 'QuotaExceededError') {
        this.cleanupBuffer();
        // Re-queue the clip that failed
        const failedClip = this.appendQueue[0];
        if (failedClip !== undefined) {
          setTimeout(() => this.processAppendQueue(), 100);
        }
      } else if (errorName === 'InvalidStateError') {
        // SAFARI FIX: Safari throws this when SourceBuffer is removed
        console.warn('[MSEEngine] SourceBuffer invalid state - switching to fallback');
        this.updateState({ usingFallback: true, status: 'error', errorMessage: 'Safari MSE error - using fallback' });
      } else {
        this.handleError(error instanceof Error ? error : new Error('Append failed'));
      }
    }
  }

  /**
   * Wait for all appends to complete
   */
  private waitForAppendComplete(): Promise<void> {
    return new Promise((resolve) => {
      let iterationCount = 0;
      const MAX_ITERATIONS = 600; // 30 seconds at 50ms intervals
      
      const check = () => {
        iterationCount++;
        
        // SAFETY: Prevent infinite polling
        if (iterationCount >= MAX_ITERATIONS) {
          console.warn('[MSEEngine] waitForAppendComplete timed out after 30s');
          resolve();
          return;
        }
        
        if (this.appendQueue.length === 0 && !this.isAppending) {
          // Ensure sourceBuffer is done updating
          if (this.sourceBuffer && !this.sourceBuffer.updating) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        } else {
          setTimeout(check, 50);
        }
      };
      
      // Also listen for updateend
      const onUpdateEnd = () => {
        this.isAppending = false;
        this.processAppendQueue();
      };
      
      this.sourceBuffer?.addEventListener('updateend', onUpdateEnd);
      check();
    });
  }

  /**
   * Clean up old buffer data to free memory
   */
  private cleanupBuffer(): void {
    if (!this.sourceBuffer || !this.videoElement) return;

    const currentTime = this.videoElement.currentTime;
    const safeRemoveEnd = Math.max(0, currentTime - 30); // Keep 30s behind

    if (safeRemoveEnd > 0 && this.sourceBuffer.buffered.length > 0) {
      try {
        this.sourceBuffer.remove(0, safeRemoveEnd);
        console.log('[MSEEngine] Cleaned buffer 0 to', safeRemoveEnd);
      } catch (e) {
        console.warn('[MSEEngine] Buffer cleanup failed:', e);
      }
    }
  }

  /**
   * Start time update interval
   */
  private startTimeUpdates(): void {
    if (this.updateIntervalId) return;

    this.updateIntervalId = window.setInterval(() => {
      // SAFARI FIX: Wrap entire update in try-catch
      try {
        if (!this.videoElement) return;
        
        // SAFARI FIX: Check if element is still connected to DOM
        if (!this.videoElement.isConnected) {
          this.stopTimeUpdates();
          return;
        }

        // SAFARI FIX: Validate currentTime before using
        const rawTime = this.videoElement.currentTime;
        if (!isFinite(rawTime) || isNaN(rawTime)) {
          return; // Skip this update cycle
        }
        const currentTime = Math.max(0, rawTime);
        
        // Find current clip index based on time
        let clipIndex = 0;
        for (let i = 0; i < this.clipStartTimes.length; i++) {
          if (currentTime >= this.clipStartTimes[i]) {
            clipIndex = i;
          } else {
            break;
          }
        }

        // Check if clip changed
        if (clipIndex !== this.state.currentClipIndex) {
          this.callbacks.onClipChange?.(clipIndex);
        }

        // Calculate buffered percent with SAFARI FIX for invalid values
        let bufferedPercent = 0;
        try {
          if (this.videoElement.buffered.length > 0 && this.state.totalDuration > 0) {
            const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
            if (isFinite(bufferedEnd) && !isNaN(bufferedEnd)) {
              bufferedPercent = Math.min(100, (bufferedEnd / this.state.totalDuration) * 100);
            }
          }
        } catch {
          // Safari can throw on buffered.end() access
          bufferedPercent = this.state.bufferedPercent;
        }

        this.updateState({
          currentTime,
          currentClipIndex: clipIndex,
          bufferedPercent,
          status: this.videoElement.paused ? 'paused' : 'playing',
        });

        // Check for ended
        if (this.videoElement.ended && this.state.status !== 'ended') {
          this.updateState({ status: 'ended' });
          this.callbacks.onEnded?.();
        }
      } catch (err) {
        // SAFARI FIX: Prevent any time update error from crashing the app
        console.debug('[MSEEngine] Time update error (suppressed):', err);
      }
    }, 100);
  }

  /**
   * Stop time updates
   */
  private stopTimeUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Play the video
   */
  async play(): Promise<void> {
    if (!this.videoElement) return;

    try {
      await this.videoElement.play();
      this.updateState({ status: 'playing' });
    } catch (error) {
      console.error('[MSEEngine] Play failed:', error);
    }
  }

  /**
   * Pause the video
   */
  pause(): void {
    if (!this.videoElement) return;
    this.videoElement.pause();
    this.updateState({ status: 'paused' });
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    if (!this.videoElement) return;
    this.videoElement.currentTime = Math.max(0, Math.min(time, this.state.totalDuration));
  }

  /**
   * Seek to a specific clip
   */
  seekToClip(clipIndex: number): void {
    if (clipIndex < 0 || clipIndex >= this.clipStartTimes.length) return;
    this.seek(this.clipStartTimes[clipIndex]);
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current state
   */
  getState(): MSEEngineState {
    return { ...this.state };
  }

  /**
   * Get clip start time
   */
  getClipStartTime(index: number): number {
    return this.clipStartTimes[index] || 0;
  }

  /**
   * Update state and notify callback
   */
  private updateState(partial: Partial<MSEEngineState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks.onStateChange?.(this.state);
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.updateState({
      status: 'error',
      errorMessage: error.message,
    });
    this.callbacks.onError?.(error);
  }

  /**
   * Cleanup and destroy the engine
   */
  destroy(): void {
    console.log('[MSEEngine] Destroying...');

    // Abort any pending fetches
    this.abortController?.abort();

    // Stop time updates
    this.stopTimeUpdates();

    // Clear buffers from memory
    this.clipBuffers.clear();

    // Clean up SourceBuffer
    if (this.sourceBuffer && this.mediaSource?.readyState === 'open') {
      try {
        this.mediaSource.removeSourceBuffer(this.sourceBuffer);
      } catch (e) {
        console.warn('[MSEEngine] Error removing SourceBuffer:', e);
      }
    }

    // Revoke object URL
    if (this.videoElement?.src) {
      URL.revokeObjectURL(this.videoElement.src);
      this.videoElement.src = '';
    }

    // Reset state
    this.videoElement = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.clips = [];
    this.clipStartTimes = [];
    this.appendQueue = [];
    this.isAppending = false;

    this.updateState({
      status: 'idle',
      currentClipIndex: 0,
      currentTime: 0,
      bufferedPercent: 0,
      loadedClips: 0,
    });
  }
}

/**
 * Factory function to create and initialize an MSE engine
 * HARDENED: Wrapped in try-catch to prevent Safari crashes
 */
export async function createMSEEngine(
  videoElement: HTMLVideoElement,
  clips: MSEClip[],
  callbacks?: MSEEngineCallbacks
): Promise<{ engine: MSEGaplessEngine; useFallback: boolean }> {
  try {
    const engine = new MSEGaplessEngine(callbacks);
    const success = await engine.initialize(videoElement, clips);
    
    if (success) {
      try {
        await engine.loadAllClips();
      } catch (loadError) {
        console.warn('[MSEEngine] loadAllClips failed, using fallback:', loadError);
        return { engine, useFallback: true };
      }
    }

    return {
      engine,
      useFallback: !success,
    };
  } catch (err) {
    // CRITICAL: Any MSE error should gracefully fall back
    console.warn('[MSEEngine] createMSEEngine failed, using fallback:', err);
    const fallbackEngine = new MSEGaplessEngine(callbacks);
    return { engine: fallbackEngine, useFallback: true };
  }
}
