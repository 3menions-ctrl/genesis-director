/**
 * Browser Video Merger - FFmpeg.wasm based video concatenation
 * 
 * Combines multiple video clips into a single downloadable video file
 * using FFmpeg compiled to WebAssembly for browser execution.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface MergeProgress {
  stage: 'loading' | 'downloading' | 'processing' | 'encoding' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  currentClip?: number;
  totalClips?: number;
}

export interface MergeOptions {
  clipUrls: string[];
  outputFilename?: string;
  onProgress?: (progress: MergeProgress) => void;
  masterAudioUrl?: string | null;
}

export interface MergeResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  duration?: number;
  error?: string;
}

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

/**
 * Check if FFmpeg.wasm is supported on this browser
 * FFmpeg.wasm requires SharedArrayBuffer which is NOT available on:
 * - iOS Safari (any version)
 * - Safari without COOP/COEP headers
 * - Some older browsers
 */
function isFFmpegSupported(): boolean {
  // Check for SharedArrayBuffer support (required by FFmpeg.wasm)
  if (typeof SharedArrayBuffer === 'undefined') {
    console.log('[FFmpeg] SharedArrayBuffer not available - FFmpeg.wasm not supported');
    return false;
  }
  
  // Check if we're on iOS (FFmpeg.wasm doesn't work on iOS even with SAB polyfills)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                !(window as unknown as { MSStream?: unknown }).MSStream;
  if (isIOS) {
    console.log('[FFmpeg] iOS detected - FFmpeg.wasm not supported');
    return false;
  }
  
  // Check for cross-origin isolation (required for SharedArrayBuffer in modern browsers)
  const isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  if (!isCrossOriginIsolated) {
    console.log('[FFmpeg] Not cross-origin isolated - SharedArrayBuffer restricted');
    return false;
  }
  
  return true;
}

/**
 * Initialize FFmpeg with WebAssembly binaries
 */
async function getFFmpeg(onProgress?: (progress: MergeProgress) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance;
  }

  // Check browser support before attempting to load
  if (!isFFmpegSupported()) {
    throw new Error('UNSUPPORTED_BROWSER');
  }

  onProgress?.({
    stage: 'loading',
    progress: 0,
    message: 'Loading video processor...',
  });

  ffmpegInstance = new FFmpeg();

  // Set up progress logging
  ffmpegInstance.on('log', ({ message }) => {
    console.debug('[FFmpeg]', message);
  });

  ffmpegInstance.on('progress', ({ progress }) => {
    onProgress?.({
      stage: 'encoding',
      progress: Math.round(progress * 100),
      message: `Encoding video... ${Math.round(progress * 100)}%`,
    });
  });

  // Load FFmpeg with CDN-hosted core files
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  try {
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegLoaded = true;
    
    onProgress?.({
      stage: 'loading',
      progress: 100,
      message: 'Video processor ready',
    });
    
    return ffmpegInstance;
  } catch (error) {
    console.error('[FFmpeg] Failed to load:', error);
    throw new Error('Failed to load video processor. Please try again.');
  }
}

/**
 * Download a video clip and write it to FFmpeg's virtual filesystem
 */
async function downloadClip(
  ffmpeg: FFmpeg,
  url: string,
  filename: string,
  clipIndex: number,
  totalClips: number,
  onProgress?: (progress: MergeProgress) => void
): Promise<void> {
  onProgress?.({
    stage: 'downloading',
    progress: Math.round((clipIndex / totalClips) * 50),
    message: `Downloading clip ${clipIndex + 1} of ${totalClips}...`,
    currentClip: clipIndex + 1,
    totalClips,
  });

  try {
    const data = await fetchFile(url);
    await ffmpeg.writeFile(filename, data);
  } catch (error) {
    console.error(`[FFmpeg] Failed to download clip ${clipIndex + 1}:`, error);
    throw new Error(`Failed to download clip ${clipIndex + 1}`);
  }
}

/**
 * Merge multiple video clips into a single video file
 */
export async function mergeVideoClips(options: MergeOptions): Promise<MergeResult> {
  const { 
    clipUrls, 
    outputFilename = 'merged-video.mp4', 
    onProgress,
    masterAudioUrl 
  } = options;

  if (clipUrls.length === 0) {
    return { success: false, error: 'No clips provided' };
  }

  // Single clip - just download directly (this always works)
  if (clipUrls.length === 1 && !masterAudioUrl) {
    return await downloadSingleClip(clipUrls[0], outputFilename, onProgress);
  }

  // Check if FFmpeg is supported - if not, use fallback for multi-clip
  if (!isFFmpegSupported()) {
    console.log('[FFmpeg] Using fallback download - FFmpeg not supported on this browser');
    return await fallbackDownload(clipUrls, outputFilename, onProgress);
  }

  try {
    const ffmpeg = await getFFmpeg(onProgress);

    // Download all clips
    const clipFilenames: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      const filename = `clip_${i}.mp4`;
      await downloadClip(ffmpeg, clipUrls[i], filename, i, clipUrls.length, onProgress);
      clipFilenames.push(filename);
    }

    // Download master audio if provided
    let audioFilename: string | null = null;
    if (masterAudioUrl) {
      onProgress?.({
        stage: 'downloading',
        progress: 55,
        message: 'Downloading audio track...',
      });
      
      try {
        const audioData = await fetchFile(masterAudioUrl);
        audioFilename = 'master_audio.mp3';
        await ffmpeg.writeFile(audioFilename, audioData);
      } catch (error) {
        console.warn('[FFmpeg] Failed to download master audio, proceeding without:', error);
      }
    }

    onProgress?.({
      stage: 'processing',
      progress: 60,
      message: 'Preparing video segments...',
    });

    // Create concat file list
    const concatList = clipFilenames.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat_list.txt', concatList);

    onProgress?.({
      stage: 'encoding',
      progress: 65,
      message: 'Merging video clips...',
    });

    // Build FFmpeg command
    // Using concat demuxer for seamless concatenation
    if (audioFilename) {
      // With master audio: concat videos, replace audio with master track
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-i', audioFilename,
        '-c:v', 'copy',           // Copy video stream (fast)
        '-c:a', 'aac',            // Encode audio to AAC
        '-map', '0:v:0',          // Use video from concat
        '-map', '1:a:0',          // Use audio from master track
        '-shortest',              // End when shortest stream ends
        '-movflags', '+faststart', // Optimize for web streaming
        'output.mp4'
      ]);
    } else {
      // Without master audio: just concat videos
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',             // Copy all streams (fastest)
        '-movflags', '+faststart',
        'output.mp4'
      ]);
    }

    onProgress?.({
      stage: 'encoding',
      progress: 95,
      message: 'Finalizing video...',
    });

    // Read the output file
    const outputData = await ffmpeg.readFile('output.mp4');
    // Handle different return types from FFmpeg
    let blobData: ArrayBuffer;
    if (typeof outputData === 'string') {
      // String encoding - convert to ArrayBuffer
      const encoder = new TextEncoder();
      blobData = encoder.encode(outputData).buffer as ArrayBuffer;
    } else {
      // Uint8Array - get underlying buffer
      blobData = (outputData as Uint8Array).buffer.slice(
        (outputData as Uint8Array).byteOffset,
        (outputData as Uint8Array).byteOffset + (outputData as Uint8Array).byteLength
      ) as ArrayBuffer;
    }
    const blob = new Blob([blobData], { type: 'video/mp4' });

    // Cleanup virtual filesystem
    for (const filename of clipFilenames) {
      try {
        await ffmpeg.deleteFile(filename);
      } catch { /* ignore cleanup errors */ }
    }
    try {
      await ffmpeg.deleteFile('concat_list.txt');
      await ffmpeg.deleteFile('output.mp4');
      if (audioFilename) await ffmpeg.deleteFile(audioFilename);
    } catch { /* ignore cleanup errors */ }

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Video merged successfully!',
    });

    return {
      success: true,
      blob,
      filename: outputFilename,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[FFmpeg] Merge failed:', error);
    
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Download a single clip directly - always works on all browsers
 */
async function downloadSingleClip(
  url: string,
  outputFilename: string,
  onProgress?: (progress: MergeProgress) => void
): Promise<MergeResult> {
  try {
    onProgress?.({
      stage: 'downloading',
      progress: 25,
      message: 'Downloading video...',
      currentClip: 1,
      totalClips: 1,
    });

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Download complete!',
    });

    return {
      success: true,
      blob,
      filename: outputFilename,
    };
  } catch (error) {
    console.error('[Download] Single clip download failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to download video';
    
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fallback download for browsers that don't support FFmpeg.wasm (iOS Safari, etc.)
 * Downloads the first clip directly since merging isn't possible
 */
async function fallbackDownload(
  clipUrls: string[],
  outputFilename: string,
  onProgress?: (progress: MergeProgress) => void
): Promise<MergeResult> {
  console.log('[FFmpeg] Using fallback download for unsupported browser');
  
  // Just download the first clip
  const adjustedFilename = clipUrls.length > 1 
    ? outputFilename.replace('.mp4', '-clip1.mp4')
    : outputFilename;
    
  const result = await downloadSingleClip(clipUrls[0], adjustedFilename, onProgress);
  
  // Update message if there were multiple clips
  if (result.success && clipUrls.length > 1) {
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Downloaded first clip. Use individual downloads for remaining clips.',
    });
  }
  
  return result;
}

/**
 * Check if browser supports video merging
 */
export function canMergeVideos(): boolean {
  return isFFmpegSupported();
}

/**
 * Download merged video to user's device
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Cleanup FFmpeg instance (call when component unmounts)
 */
export function cleanupFFmpeg(): void {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    ffmpegLoaded = false;
  }
}
