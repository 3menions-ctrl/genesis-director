/**
 * Video Engine - Precision Rendering for Browser-Based Video Stitching
 * 
 * Technical Specifications:
 * 1. Frame-Exact Timing: RAF + performance.now() for V-Sync alignment
 * 2. Double-Buffering: Pre-rendered background buffer for 0-flicker transitions
 * 3. Linear Interpolation (Lerp): Alpha sum = 1.0 for zero brightness dipping
 * 4. Zero-Gap Audio Sync: Web Audio API aligned with video clock
 * 5. HD Export: Chunked Blob strategy for memory-efficient 1080p+ rendering
 * 6. Resource Cleanup: Strict garbage collection for long sessions
 * 7. Atomic Frame Switch: Sub-microsecond V-Sync aligned transitions
 * 8. GPU Compositing: WebGL2 accelerated texture blending
 * 9. Web Worker: Off-thread processing for heavy computation
 */

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
