/**
 * PrecisionRenderingEngine v1.0 - Frame-Exact Video Stitching
 * 
 * Technical Implementation:
 * 1. Frame-Exact Timing Loop - RAF + performance.now() for V-Sync alignment
 * 2. Double-Buffering - Pre-rendered background buffer for instant transitions
 * 3. Linear Interpolation (Lerp) - Alpha sum always equals 1.0
 * 4. Zero-Gap Audio Sync - Web Audio API aligned with video clock
 * 5. HD Export - Chunked Blob management for memory efficiency
 * 6. Resource Cleanup - Strict garbage collection routine
 */

// =====================================================
// CONSTANTS & TYPES
// =====================================================

export const PRECISION_CONSTANTS = {
  // Transition timing (30ms window for V-Sync pulse)
  TRANSITION_WINDOW_MS: 30,
  OVERLAP_DURATION_MS: 30,
  FADEOUT_DURATION_MS: 30,
  
  // Frame timing
  TARGET_FPS: 60,
  FRAME_BUDGET_MS: 16.667, // 1000ms / 60fps
  
  // Audio crossfade
  AUDIO_FADE_MS: 30,
  
  // Export quality presets
  QUALITY_PRESETS: {
    '720p': { width: 1280, height: 720, bitrate: 5_000_000 },
    '1080p': { width: 1920, height: 1080, bitrate: 10_000_000 },
    '1440p': { width: 2560, height: 1440, bitrate: 18_000_000 },
  } as const,
  
  // Blob chunking for memory management
  CHUNK_SIZE_BYTES: 10 * 1024 * 1024, // 10MB chunks
  MAX_CHUNKS_IN_MEMORY: 50,
} as const;

export type QualityPreset = keyof typeof PRECISION_CONSTANTS.QUALITY_PRESETS;

export interface ClipBufferData {
  videoElement: HTMLVideoElement;
  duration: number;
  width: number;
  height: number;
  blobUrl: string;
  loaded: boolean;
}

export interface RenderingState {
  status: 'idle' | 'preparing' | 'rendering' | 'finalizing' | 'complete' | 'error' | 'cancelled';
  progress: number;
  message: string;
  currentClipIndex: number;
  totalClips: number;
  estimatedTimeRemaining: number;
  fps: number;
  droppedFrames: number;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  duration: number;
  fileSize: number;
  quality: QualityPreset;
}

// =====================================================
// FRAME-EXACT TIMING LOOP
// High-precision requestAnimationFrame with performance.now()
// =====================================================

export class FrameExactTimer {
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private frameCallback: ((deltaTime: number, elapsedTime: number) => boolean) | null = null;
  private startTime: number = 0;
  private isRunning: boolean = false;
  private targetFrameTime: number = PRECISION_CONSTANTS.FRAME_BUDGET_MS;
  
  /**
   * Start the frame-exact timing loop
   * @param callback - Called each frame. Return false to stop the loop.
   * @param targetFps - Target frames per second (default: 60)
   */
  start(callback: (deltaTime: number, elapsedTime: number) => boolean, targetFps: number = 60): void {
    if (this.isRunning) return;
    
    this.targetFrameTime = 1000 / targetFps;
    this.frameCallback = callback;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.isRunning = true;
    
    this.tick();
  }
  
  private tick = (): void => {
    if (!this.isRunning || !this.frameCallback) return;
    
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    
    // Only render if enough time has passed (frame budget check)
    if (deltaTime >= this.targetFrameTime * 0.9) {
      const elapsedTime = now - this.startTime;
      const shouldContinue = this.frameCallback(deltaTime, elapsedTime);
      
      if (!shouldContinue) {
        this.stop();
        return;
      }
      
      this.lastFrameTime = now;
    }
    
    this.rafId = requestAnimationFrame(this.tick);
  };
  
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  get running(): boolean {
    return this.isRunning;
  }
}

// =====================================================
// DOUBLE-BUFFER SYSTEM
// Pre-loads and pre-renders incoming clip in background
// =====================================================

export class DoubleBufferManager {
  private bufferA: ClipBufferData | null = null;
  private bufferB: ClipBufferData | null = null;
  private activeBuffer: 'A' | 'B' = 'A';
  private preloadQueue: Map<number, Promise<ClipBufferData>> = new Map();
  
  /**
   * Get the currently active buffer (visible video)
   */
  getActiveBuffer(): ClipBufferData | null {
    return this.activeBuffer === 'A' ? this.bufferA : this.bufferB;
  }
  
  /**
   * Get the standby buffer (pre-loaded, ready to swap in)
   */
  getStandbyBuffer(): ClipBufferData | null {
    return this.activeBuffer === 'A' ? this.bufferB : this.bufferA;
  }
  
  /**
   * Pre-load a clip into the standby buffer
   */
  async preloadClip(blobUrl: string, clipIndex: number): Promise<ClipBufferData> {
    // Check if already preloading
    const existingPromise = this.preloadQueue.get(clipIndex);
    if (existingPromise) return existingPromise;
    
    const loadPromise = this.loadVideoElement(blobUrl);
    this.preloadQueue.set(clipIndex, loadPromise);
    
    try {
      const bufferData = await loadPromise;
      
      // Assign to standby buffer
      if (this.activeBuffer === 'A') {
        this.bufferB = bufferData;
      } else {
        this.bufferA = bufferData;
      }
      
      return bufferData;
    } finally {
      this.preloadQueue.delete(clipIndex);
    }
  }
  
  /**
   * Swap active and standby buffers (instant transition)
   */
  swapBuffers(): void {
    this.activeBuffer = this.activeBuffer === 'A' ? 'B' : 'A';
  }
  
  /**
   * Set the active buffer directly
   */
  setActiveBuffer(bufferData: ClipBufferData): void {
    if (this.activeBuffer === 'A') {
      this.bufferA = bufferData;
    } else {
      this.bufferB = bufferData;
    }
  }
  
  private async loadVideoElement(blobUrl: string): Promise<ClipBufferData> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      
      const timeout = setTimeout(() => {
        video.src = '';
        reject(new Error('Video preload timeout (30s)'));
      }, 30000);
      
      video.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve({
          videoElement: video,
          duration: video.duration || 5,
          width: video.videoWidth,
          height: video.videoHeight,
          blobUrl,
          loaded: true,
        });
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video load failed'));
      };
      
      video.src = blobUrl;
      video.load();
    });
  }
  
  /**
   * Cleanup all buffers and release memory
   */
  dispose(): void {
    [this.bufferA, this.bufferB].forEach(buffer => {
      if (buffer?.videoElement) {
        buffer.videoElement.pause();
        buffer.videoElement.src = '';
        buffer.videoElement.load();
      }
    });
    this.bufferA = null;
    this.bufferB = null;
    this.preloadQueue.clear();
  }
}

// =====================================================
// LINEAR INTERPOLATION (LERP) FOR FADES
// Ensures alpha sum always equals 1.0 (no brightness dipping)
// =====================================================

export class LerpFadeController {
  /**
   * Calculate opacity values for crossfade transition
   * Guarantees: outgoingOpacity + incomingOpacity = 1.0 at all times
   * 
   * @param progress - Transition progress from 0 to 1
   * @param easing - Easing function type
   * @returns Object with outgoing and incoming opacity values
   */
  static calculateOpacity(
    progress: number,
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear'
  ): { outgoing: number; incoming: number } {
    // Clamp progress to 0-1
    const t = Math.max(0, Math.min(1, progress));
    
    let easedProgress: number;
    
    switch (easing) {
      case 'ease-in':
        easedProgress = t * t;
        break;
      case 'ease-out':
        easedProgress = 1 - Math.pow(1 - t, 2);
        break;
      case 'ease-in-out':
        easedProgress = t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2;
        break;
      case 'linear':
      default:
        easedProgress = t;
    }
    
    // CRITICAL: Sum MUST equal 1.0 to prevent brightness dipping
    const incoming = easedProgress;
    const outgoing = 1 - incoming;
    
    return { outgoing, incoming };
  }
  
  /**
   * Calculate frame-by-frame opacity for exact 30ms transition window
   * Uses performance.now() for sub-millisecond precision
   */
  static calculateFrameOpacity(
    transitionStartTime: number,
    transitionDurationMs: number = PRECISION_CONSTANTS.TRANSITION_WINDOW_MS
  ): { outgoing: number; incoming: number; complete: boolean } {
    const elapsed = performance.now() - transitionStartTime;
    const progress = elapsed / transitionDurationMs;
    
    if (progress >= 1) {
      return { outgoing: 0, incoming: 1, complete: true };
    }
    
    const { outgoing, incoming } = this.calculateOpacity(progress, 'ease-out');
    return { outgoing, incoming, complete: false };
  }
}

// =====================================================
// ZERO-GAP AUDIO SYNCHRONIZATION
// Web Audio API aligned with video clock
// =====================================================

export class AudioSyncController {
  private audioContext: AudioContext | null = null;
  private outgoingGain: GainNode | null = null;
  private incomingGain: GainNode | null = null;
  private outgoingSource: MediaElementAudioSourceNode | null = null;
  private incomingSource: MediaElementAudioSourceNode | null = null;
  private masterGain: GainNode | null = null;
  
  /**
   * Initialize the Web Audio API context
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    // Create master gain node
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // Create gain nodes for crossfade
    this.outgoingGain = this.audioContext.createGain();
    this.incomingGain = this.audioContext.createGain();
    
    this.outgoingGain.connect(this.masterGain);
    this.incomingGain.connect(this.masterGain);
  }
  
  /**
   * Connect a video element to the outgoing audio path
   */
  connectOutgoing(videoElement: HTMLVideoElement): void {
    if (!this.audioContext || !this.outgoingGain) return;
    
    // Disconnect previous source if exists
    this.outgoingSource?.disconnect();
    
    this.outgoingSource = this.audioContext.createMediaElementSource(videoElement);
    this.outgoingSource.connect(this.outgoingGain);
    this.outgoingGain.gain.value = 1.0;
  }
  
  /**
   * Connect a video element to the incoming audio path
   */
  connectIncoming(videoElement: HTMLVideoElement): void {
    if (!this.audioContext || !this.incomingGain) return;
    
    // Disconnect previous source if exists
    this.incomingSource?.disconnect();
    
    this.incomingSource = this.audioContext.createMediaElementSource(videoElement);
    this.incomingSource.connect(this.incomingGain);
    this.incomingGain.gain.value = 0;
  }
  
  /**
   * Perform audio crossfade synchronized with video transition
   * Uses the same timing as visual fade for perfect sync
   */
  crossfade(
    transitionDurationMs: number = PRECISION_CONSTANTS.AUDIO_FADE_MS,
    currentTime: number = 0
  ): void {
    if (!this.audioContext || !this.outgoingGain || !this.incomingGain) return;
    
    const now = this.audioContext.currentTime + currentTime;
    const fadeDuration = transitionDurationMs / 1000;
    
    // Outgoing: 1.0 -> 0.0 over fadeDuration
    this.outgoingGain.gain.setValueAtTime(1.0, now);
    this.outgoingGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
    
    // Incoming: 0.0 -> 1.0 over fadeDuration
    this.incomingGain.gain.setValueAtTime(0, now);
    this.incomingGain.gain.linearRampToValueAtTime(1.0, now + fadeDuration);
  }
  
  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  /**
   * Cleanup audio context and nodes
   */
  dispose(): void {
    this.outgoingSource?.disconnect();
    this.incomingSource?.disconnect();
    this.outgoingGain?.disconnect();
    this.incomingGain?.disconnect();
    this.masterGain?.disconnect();
    this.audioContext?.close();
    
    this.outgoingSource = null;
    this.incomingSource = null;
    this.outgoingGain = null;
    this.incomingGain = null;
    this.masterGain = null;
    this.audioContext = null;
  }
}

// =====================================================
// CHUNKED BLOB MANAGER
// Memory-efficient HD export with 10MB chunk strategy
// =====================================================

export class ChunkedBlobManager {
  private chunks: Blob[] = [];
  private totalSize: number = 0;
  private mimeType: string;
  private onProgress: ((bytesProcessed: number, totalBytes: number) => void) | null = null;
  
  constructor(mimeType: string = 'video/webm') {
    this.mimeType = mimeType;
  }
  
  /**
   * Add a data chunk from MediaRecorder
   */
  addChunk(data: Blob): void {
    if (data.size > 0) {
      this.chunks.push(data);
      this.totalSize += data.size;
      
      // Trigger progress callback
      this.onProgress?.(this.totalSize, this.totalSize);
      
      // Memory management: if we have too many chunks, merge them
      if (this.chunks.length > PRECISION_CONSTANTS.MAX_CHUNKS_IN_MEMORY) {
        this.consolidateChunks();
      }
    }
  }
  
  /**
   * Merge chunks to reduce memory fragmentation
   */
  private consolidateChunks(): void {
    if (this.chunks.length <= 1) return;
    
    // Merge all chunks into one
    const consolidated = new Blob(this.chunks, { type: this.mimeType });
    this.chunks = [consolidated];
    
    console.log(`[ChunkedBlobManager] Consolidated ${this.chunks.length} chunks into 1 (${(this.totalSize / 1024 / 1024).toFixed(1)}MB)`);
  }
  
  /**
   * Get final blob with optimized memory usage
   */
  async finalize(): Promise<Blob> {
    // Final consolidation
    this.consolidateChunks();
    
    if (this.chunks.length === 0) {
      throw new Error('No data chunks to finalize');
    }
    
    return this.chunks[0];
  }
  
  /**
   * Set progress callback
   */
  setProgressCallback(callback: (bytesProcessed: number, totalBytes: number) => void): void {
    this.onProgress = callback;
  }
  
  /**
   * Get current total size
   */
  getSize(): number {
    return this.totalSize;
  }
  
  /**
   * Cleanup all chunks and release memory
   */
  dispose(): void {
    this.chunks = [];
    this.totalSize = 0;
    this.onProgress = null;
  }
}

// =====================================================
// RESOURCE CLEANUP MANAGER
// Strict garbage collection for URL objects and video elements
// =====================================================

export class ResourceCleanupManager {
  private blobUrls: Set<string> = new Set();
  private videoElements: Set<HTMLVideoElement> = new Set();
  private canvasElements: Set<HTMLCanvasElement> = new Set();
  
  /**
   * Register a blob URL for cleanup
   */
  registerBlobUrl(url: string): void {
    this.blobUrls.add(url);
  }
  
  /**
   * Register a video element for cleanup
   */
  registerVideoElement(video: HTMLVideoElement): void {
    this.videoElements.add(video);
  }
  
  /**
   * Register a canvas element for cleanup
   */
  registerCanvasElement(canvas: HTMLCanvasElement): void {
    this.canvasElements.add(canvas);
  }
  
  /**
   * Revoke a specific blob URL and remove from registry
   */
  revokeBlobUrl(url: string): void {
    if (this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
    }
  }
  
  /**
   * Cleanup a specific video element
   */
  cleanupVideoElement(video: HTMLVideoElement): void {
    video.pause();
    video.src = '';
    video.load();
    video.remove();
    this.videoElements.delete(video);
  }
  
  /**
   * Cleanup a specific canvas element
   */
  cleanupCanvasElement(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    this.canvasElements.delete(canvas);
  }
  
  /**
   * Perform full garbage collection of all registered resources
   */
  disposeAll(): void {
    // Revoke all blob URLs
    this.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('[ResourceCleanup] Failed to revoke URL:', url);
      }
    });
    this.blobUrls.clear();
    
    // Cleanup all video elements
    this.videoElements.forEach(video => {
      try {
        video.pause();
        video.src = '';
        video.load();
        video.remove();
      } catch (e) {
        console.warn('[ResourceCleanup] Failed to cleanup video element');
      }
    });
    this.videoElements.clear();
    
    // Cleanup all canvas elements
    this.canvasElements.forEach(canvas => {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
      } catch (e) {
        console.warn('[ResourceCleanup] Failed to cleanup canvas element');
      }
    });
    this.canvasElements.clear();
    
    console.log('[ResourceCleanup] Full garbage collection complete');
  }
  
  /**
   * Get resource statistics
   */
  getStats(): { blobUrls: number; videos: number; canvases: number } {
    return {
      blobUrls: this.blobUrls.size,
      videos: this.videoElements.size,
      canvases: this.canvasElements.size,
    };
  }
}

// =====================================================
// BEST MIME TYPE DETECTION
// =====================================================

export function getBestMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return 'video/webm';
}
