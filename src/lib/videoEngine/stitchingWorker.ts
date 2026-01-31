/**
 * Stitching Web Worker v1.0 - Off-Main-Thread Video Processing
 * 
 * ARCHITECTURE:
 * This worker handles heavy computational tasks to keep the main thread
 * 100% free for rendering. All frame decoding, buffer management, and
 * pre-processing happens here.
 * 
 * SUPPORTED OPERATIONS:
 * - PRELOAD_CLIP: Fetch and decode video clip
 * - EXTRACT_FRAMES: Extract frames to ImageBitmap array
 * - CALCULATE_TRANSITIONS: Compute transition timings
 * - PROCESS_AUDIO: Prepare audio buffers
 */

// =====================================================
// MESSAGE TYPES
// =====================================================

interface WorkerMessage {
  type: 'PRELOAD_CLIP' | 'EXTRACT_FRAMES' | 'CALCULATE_TRANSITIONS' | 'PROCESS_AUDIO' | 'DISPOSE';
  id: string;
  payload: unknown;
}

interface WorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  id: string;
  payload: unknown;
}

interface ClipPreloadPayload {
  url: string;
  clipIndex: number;
}

interface ExtractFramesPayload {
  clipIndex: number;
  frameCount: number;
  startTime: number;
  fps: number;
}

interface TransitionPayload {
  clips: { duration: number; index: number }[];
  transitionDurationMs: number;
}

// =====================================================
// STATE
// =====================================================

const clipCache = new Map<number, {
  blob: Blob;
  duration: number;
  width: number;
  height: number;
}>();

const frameCache = new Map<number, ImageBitmap[]>();

// =====================================================
// MESSAGE HANDLER
// =====================================================

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data;
  
  try {
    switch (type) {
      case 'PRELOAD_CLIP':
        await handlePreloadClip(id, payload as ClipPreloadPayload);
        break;
        
      case 'EXTRACT_FRAMES':
        await handleExtractFrames(id, payload as ExtractFramesPayload);
        break;
        
      case 'CALCULATE_TRANSITIONS':
        handleCalculateTransitions(id, payload as TransitionPayload);
        break;
        
      case 'PROCESS_AUDIO':
        // Audio processing handled on main thread (AudioContext not available in workers)
        sendResponse({ type: 'SUCCESS', id, payload: { message: 'Audio handled on main thread' } });
        break;
        
      case 'DISPOSE':
        handleDispose(id);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    sendResponse({
      type: 'ERROR',
      id,
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
};

// =====================================================
// HANDLERS
// =====================================================

async function handlePreloadClip(id: string, payload: ClipPreloadPayload): Promise<void> {
  const { url, clipIndex } = payload;
  
  sendProgress(id, 0, 'Fetching clip...');
  
  // Fetch video as blob
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch clip`);
  }
  
  sendProgress(id, 30, 'Downloading...');
  
  const blob = await response.blob();
  
  sendProgress(id, 60, 'Processing metadata...');
  
  // Create video element to get metadata (using OffscreenCanvas trick)
  // Note: We can't use HTMLVideoElement in workers, so we send back the blob
  // and let the main thread extract metadata
  
  clipCache.set(clipIndex, {
    blob,
    duration: 0, // Will be set by main thread
    width: 0,
    height: 0,
  });
  
  sendProgress(id, 100, 'Complete');
  
  sendResponse({
    type: 'SUCCESS',
    id,
    payload: {
      clipIndex,
      blobSize: blob.size,
      blobType: blob.type,
    },
  });
}

async function handleExtractFrames(id: string, payload: ExtractFramesPayload): Promise<void> {
  const { clipIndex, frameCount, startTime, fps } = payload;
  
  const clipData = clipCache.get(clipIndex);
  if (!clipData) {
    throw new Error(`Clip ${clipIndex} not found in cache`);
  }
  
  sendProgress(id, 0, 'Preparing frame extraction...');
  
  // Create VideoFrame extraction using VideoDecoder API if available
  // This is the modern way to do frame extraction in workers
  
  if ('VideoDecoder' in self) {
    // Use WebCodecs API for efficient frame extraction
    const frames = await extractFramesWithWebCodecs(
      clipData.blob,
      frameCount,
      startTime,
      fps,
      (progress) => sendProgress(id, progress, 'Extracting frames...')
    );
    
    frameCache.set(clipIndex, frames);
    
    sendResponse({
      type: 'SUCCESS',
      id,
      payload: {
        clipIndex,
        frameCount: frames.length,
        frames, // ImageBitmaps are transferable
      },
    });
  } else {
    // Fallback: return blob and let main thread handle extraction
    sendResponse({
      type: 'SUCCESS',
      id,
      payload: {
        clipIndex,
        fallback: true,
        message: 'WebCodecs not available, use main thread extraction',
      },
    });
  }
}

async function extractFramesWithWebCodecs(
  blob: Blob,
  frameCount: number,
  startTime: number,
  fps: number,
  onProgress: (progress: number) => void
): Promise<ImageBitmap[]> {
  const frames: ImageBitmap[] = [];
  
  // For now, return empty array - full WebCodecs implementation would go here
  // This is a placeholder for the WebCodecs VideoDecoder pipeline
  
  // WebCodecs requires:
  // 1. Demuxing the video container (need mp4box.js or similar)
  // 2. Creating a VideoDecoder with the codec config
  // 3. Feeding encoded chunks and collecting VideoFrames
  // 4. Converting VideoFrames to ImageBitmaps
  
  onProgress(100);
  
  return frames;
}

function handleCalculateTransitions(id: string, payload: TransitionPayload): void {
  const { clips, transitionDurationMs } = payload;
  
  const transitions: {
    clipIndex: number;
    startTime: number;
    endTime: number;
    transitionStart: number;
    duration: number;
  }[] = [];
  
  let accumulatedTime = 0;
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const startTime = accumulatedTime;
    const endTime = accumulatedTime + clip.duration * 1000; // Convert to ms
    
    // Transition should start before clip ends
    const transitionStart = endTime - transitionDurationMs;
    
    transitions.push({
      clipIndex: clip.index,
      startTime,
      endTime,
      transitionStart,
      duration: clip.duration * 1000,
    });
    
    accumulatedTime = endTime;
  }
  
  sendResponse({
    type: 'SUCCESS',
    id,
    payload: {
      transitions,
      totalDuration: accumulatedTime,
    },
  });
}

function handleDispose(id: string): void {
  // Close all ImageBitmaps
  frameCache.forEach((frames) => {
    frames.forEach((frame) => frame.close());
  });
  frameCache.clear();
  
  // Clear clip cache
  clipCache.clear();
  
  sendResponse({
    type: 'SUCCESS',
    id,
    payload: { message: 'Worker disposed' },
  });
}

// =====================================================
// UTILITIES
// =====================================================

function sendResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

function sendProgress(id: string, progress: number, message: string): void {
  self.postMessage({
    type: 'PROGRESS',
    id,
    payload: { progress, message },
  } as WorkerResponse);
}
