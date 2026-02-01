/**
 * Video Engine - World-class gapless video playback system
 * 
 * Technical Specifications:
 * 1. MSE Gapless Engine: MediaSource Extensions for TRUE zero-gap playback
 * 2. Blob Preload Cache: Memory-efficient clip caching with LRU eviction
 * 3. Web Audio Master Clock: Precision timing for multi-clip synchronization
 * 4. Frame-Exact Timing: RAF + performance.now() for V-Sync alignment
 * 5. Double-Buffering: Pre-rendered background buffer for 0-flicker transitions
 * 6. Linear Interpolation (Lerp): Alpha sum = 1.0 for zero brightness dipping
 * 7. Zero-Gap Audio Sync: Web Audio API aligned with video clock
 * 8. HD Export: Chunked Blob strategy for memory-efficient 1080p+ rendering
 * 9. Resource Cleanup: Strict garbage collection for long sessions
 * 10. Atomic Frame Switch: Sub-microsecond V-Sync aligned transitions
 * 11. GPU Compositing: WebGL2 accelerated texture blending
 * 12. Web Worker: Off-thread processing for heavy computation
 */

// MSE Gapless Engine (NEW - True zero-gap playback)
export {
  MSEGaplessEngine,
  createMSEEngine,
  detectMSESupport,
  type MSEClip,
  type MSEEngineState,
  type MSEEngineCallbacks,
} from './MSEGaplessEngine';

// Blob Preload Cache (NEW - Memory-efficient caching)
export {
  BlobPreloadCache,
  getGlobalBlobCache,
  destroyGlobalBlobCache,
  type CachedClip,
  type CacheStats,
  type PreloadProgress,
  type BlobCacheConfig,
} from './BlobPreloadCache';

// Web Audio Master Clock (NEW - Precision timing)
export {
  WebAudioMasterClock,
  getGlobalMasterClock,
  destroyGlobalMasterClock,
  type AudioTrack,
  type ClockState as AudioClockState,
  type MasterClockCallbacks,
} from './WebAudioMasterClock';

// Core rendering engine components
export {
  PRECISION_CONSTANTS,
  type QualityPreset,
  type ClipBufferData,
  type RenderingState,
  type ExportResult,
  FrameExactTimer,
  DoubleBufferManager,
  LerpFadeController,
  AudioSyncController,
  ChunkedBlobManager,
  ResourceCleanupManager,
  getBestMimeType,
} from './PrecisionRenderingEngine';

// HD Export pipeline
export {
  type ClipSource,
  type ExportOptions,
  HDExportPipeline,
  getExportPipeline,
  resetExportPipeline,
} from './HDExportPipeline';

// Atomic Frame Switch Engine (Zero-Latency Transitions)
export {
  ATOMIC_CONSTANTS,
  type AtomicBuffer,
  type ClockState,
  type TransitionState,
  type AtomicSwitchResult,
  MasterClock,
  LookAheadBufferManager,
  AtomicToggleController,
  AtomicFrameSwitchEngine,
  getAtomicEngine,
  resetAtomicEngine,
} from './AtomicFrameSwitch';

// GPU Compositor (WebGL Accelerated Rendering)
export {
  GPU_CONSTANTS,
  type BlendMode,
  type GPUTexture,
  type CompositorState,
  GPUCompositor,
  getGPUCompositor,
  resetGPUCompositor,
} from './GPUCompositor';

// Hydrated Boot Sequence (Reliable Loading)
export {
  type BootState,
  type BufferStatus,
  type HydratedBootConfig,
  type DiagnosticData,
  waitForCanPlayThrough,
  getBufferStatus,
  hydrateVideoBuffer,
  gracefulTransitionFallback,
  validateTransitionReadiness,
  checkHighResolutionTimers,
  createDiagnosticOverlay,
  updateDiagnosticOverlay,
} from './HydratedBootSequence';
