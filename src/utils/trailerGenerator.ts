/**
 * Trailer Generator
 * 
 * Creates a promotional trailer from snippets of community videos.
 * Features smooth crossfade transitions and epic background music.
 */

import { supabase } from '@/integrations/supabase/client';

export interface TrailerProgress {
  phase: 'fetching' | 'music' | 'loading' | 'extracting' | 'encoding' | 'finalizing' | 'complete' | 'error';
  currentVideo: number;
  totalVideos: number;
  percentComplete: number;
  message: string;
}

export interface TrailerClip {
  url: string;
  title: string;
  startSec: number;
  durationSec: number;
}

export interface TrailerOptions {
  snippetDuration?: number;
  partsPerVideo?: number;
  crossfadeDuration?: number;
  includeMusic?: boolean;
  onProgress?: (progress: TrailerProgress) => void;
}

/**
 * Fetch video as blob for cross-origin support
 */
// Store blob URLs for cleanup
const blobUrls: string[] = [];

async function fetchVideoAsBlob(url: string): Promise<string> {
  console.log('[Trailer] Fetching video as blob:', url.substring(0, 60));
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobUrls.push(blobUrl);
  return blobUrl;
}

/**
 * Fetch audio as blob
 */
async function fetchAudioAsBlob(url: string): Promise<string> {
  console.log('[Trailer] Fetching audio as blob:', url.substring(0, 60));
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobUrls.push(blobUrl);
  return blobUrl;
}

/**
 * Clean up blob URLs
 */
function cleanupBlobUrls(): void {
  blobUrls.forEach(url => {
    try { URL.revokeObjectURL(url); } catch {}
  });
  blobUrls.length = 0;
}

/**
 * Load a video element with full buffering
 */
async function loadVideo(url: string): Promise<HTMLVideoElement> {
  let videoSrc = url;
  
  try {
    videoSrc = await fetchVideoAsBlob(url);
  } catch (e) {
    console.warn('[Trailer] Blob fetch failed, using direct URL:', e);
  }
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    
    const timeout = setTimeout(() => {
      console.error('[Trailer] Video load timeout for:', url.substring(0, 60));
      reject(new Error('Video load timeout'));
    }, 60000);
    
    video.oncanplaythrough = () => {
      clearTimeout(timeout);
      console.log(`[Trailer] Video ready: ${video.videoWidth}x${video.videoHeight}, ${video.duration}s`);
      resolve(video);
    };
    
    video.onerror = (e) => {
      clearTimeout(timeout);
      console.error('[Trailer] Video load error:', e);
      reject(new Error('Failed to load video'));
    };
    
    video.src = videoSrc;
    video.load();
  });
}

/**
 * Seek video and wait until it's fully buffered at that position
 */
async function seekAndBuffer(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    const safeTime = Math.max(0, Math.min(targetTime, video.duration - 0.5));
    video.currentTime = safeTime;
    
    const checkReady = () => {
      // Check if we have buffered data at the current position
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && 
            video.buffered.end(i) >= video.currentTime + 0.5) {
          console.log(`[Trailer] Buffered at ${video.currentTime.toFixed(2)}s`);
          resolve();
          return;
        }
      }
    };
    
    // Listen for seeked event
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      // Give a small delay for buffer to catch up
      setTimeout(() => {
        checkReady();
        resolve(); // Resolve anyway after timeout
      }, 100);
    };
    
    video.addEventListener('seeked', onSeeked);
    
    // Timeout fallback
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 2000);
  });
}

/**
 * Load an audio element
 */
async function loadAudio(url: string): Promise<HTMLAudioElement> {
  let audioSrc = url;
  
  try {
    audioSrc = await fetchAudioAsBlob(url);
  } catch (e) {
    console.warn('[Trailer] Audio blob fetch failed, using direct URL:', e);
  }
  
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    
    const timeout = setTimeout(() => {
      reject(new Error('Audio load timeout'));
    }, 30000);
    
    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      console.log(`[Trailer] Audio loaded: ${audio.duration}s`);
      resolve(audio);
    };
    
    audio.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load audio'));
    };
    
    audio.src = audioSrc;
    audio.load();
  });
}

/**
 * Draw video frame to canvas with optional opacity for crossfade
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  opacity: number = 1
): void {
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = width / height;
  
  let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
  
  if (videoAspect > canvasAspect) {
    drawHeight = height;
    drawWidth = height * videoAspect;
    offsetX = (width - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = width;
    drawHeight = width / videoAspect;
    offsetX = 0;
    offsetY = (height - drawHeight) / 2;
  }
  
  ctx.globalAlpha = opacity;
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  ctx.globalAlpha = 1;
}

/**
 * Draw a crossfade between two frames
 */
function drawCrossfade(
  ctx: CanvasRenderingContext2D,
  videoOut: HTMLVideoElement,
  videoIn: HTMLVideoElement,
  width: number,
  height: number,
  progress: number // 0 to 1
): void {
  // Clear with black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  // Draw outgoing video (fading out)
  drawFrame(ctx, videoOut, width, height, 1 - progress);
  
  // Draw incoming video (fading in)
  drawFrame(ctx, videoIn, width, height, progress);
}

/**
 * Get supported MIME type
 */
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}

/**
 * Generate epic trailer music
 */
async function generateTrailerMusic(durationSeconds: number): Promise<string | null> {
  try {
    console.log(`[Trailer] Generating ${durationSeconds}s of trailer music...`);
    
    const { data, error } = await supabase.functions.invoke('generate-music', {
      body: {
        projectId: 'trailer-' + Date.now(),
        mood: 'epic',
        duration: Math.min(durationSeconds, 30), // MusicGen max is 30s
        prompt: 'Epic cinematic trailer music with powerful drums, dramatic brass fanfares, building tension, and triumphant crescendo. Hollywood blockbuster style.',
      },
    });

    if (error || !data?.musicUrl) {
      console.warn('[Trailer] Music generation failed:', error || 'No URL returned');
      return null;
    }

    console.log('[Trailer] Music generated:', data.musicUrl);
    return data.musicUrl;
  } catch (e) {
    console.warn('[Trailer] Music generation error:', e);
    return null;
  }
}

/**
 * Pre-loaded video with metadata
 */
interface PreloadedClip {
  video: HTMLVideoElement;
  clip: TrailerClip;
  startTime: number;
}

/**
 * Generate a trailer from community videos
 * Pre-loads all clips upfront for glitch-free playback
 */
export async function generateTrailer(
  options: TrailerOptions = {}
): Promise<Blob> {
  const { 
    snippetDuration = 3,
    partsPerVideo = 1,
    onProgress 
  } = options;

  cleanupBlobUrls();
  const reportProgress = (progress: TrailerProgress) => onProgress?.(progress);

  try {
    // Phase 1: Fetch clip data
    reportProgress({
      phase: 'fetching',
      currentVideo: 0,
      totalVideos: 0,
      percentComplete: 0,
      message: 'Fetching community videos...',
    });

    const { data: response, error } = await supabase.functions.invoke('generate-trailer', {
      body: { snippetDuration, partsPerVideo, maxVideos: 4 },
    });

    if (error || !response?.success) {
      throw new Error(error?.message || response?.error || 'Failed to fetch');
    }

    const clips: TrailerClip[] = (response.clips || []).slice(0, 4);
    if (clips.length === 0) throw new Error('No clips available');
    console.log(`[Trailer] Processing ${clips.length} clips`);

    // Phase 2: PRE-LOAD ALL VIDEOS UPFRONT
    reportProgress({
      phase: 'loading',
      currentVideo: 0,
      totalVideos: clips.length,
      percentComplete: 5,
      message: 'Pre-loading all videos...',
    });

    const preloadedClips: PreloadedClip[] = [];
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      
      reportProgress({
        phase: 'loading',
        currentVideo: i + 1,
        totalVideos: clips.length,
        percentComplete: 5 + Math.round((i / clips.length) * 25),
        message: `Loading video ${i + 1}/${clips.length}...`,
      });

      try {
        const video = await loadVideo(clip.url);
        const startTime = Math.max(0, Math.min(clip.startSec, video.duration - clip.durationSec - 0.5));
        
        // Pre-seek and buffer the video at the start position
        await seekAndBuffer(video, startTime);
        
        preloadedClips.push({ video, clip, startTime });
        console.log(`[Trailer] Pre-loaded clip ${i + 1}: ${clip.title} at ${startTime.toFixed(2)}s`);
      } catch (e) {
        console.warn(`[Trailer] Failed to pre-load clip ${i + 1}:`, e);
        // Continue with remaining clips
      }
    }

    if (preloadedClips.length === 0) {
      throw new Error('No videos could be loaded');
    }

    console.log(`[Trailer] Successfully pre-loaded ${preloadedClips.length} clips`);

    // Phase 3: Setup recorder
    const width = 640, height = 360, fps = 24;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const mimeType = getSupportedMimeType();
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2000000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(200);

    const frameMs = 1000 / fps;
    const crossfadeDurationSec = 0.4; // Slightly shorter for snappier transitions
    const fadeFrames = Math.round(crossfadeDurationSec * fps);

    // Phase 4: Record each clip with crossfades
    for (let i = 0; i < preloadedClips.length; i++) {
      const { video: currentVideo, clip, startTime } = preloadedClips[i];
      const isLast = i === preloadedClips.length - 1;
      const nextPreloaded = !isLast ? preloadedClips[i + 1] : null;

      reportProgress({
        phase: 'extracting',
        currentVideo: i + 1,
        totalVideos: preloadedClips.length,
        percentComplete: 30 + Math.round((i / preloadedClips.length) * 60),
        message: `Recording clip ${i + 1}/${preloadedClips.length}...`,
      });

      // Ensure video is at correct position and start playing
      currentVideo.currentTime = startTime;
      await new Promise(r => setTimeout(r, 50));
      
      try {
        await currentVideo.play();
      } catch (e) {
        console.warn(`[Trailer] Play failed for clip ${i + 1}:`, e);
      }

      // Calculate frames for main content (before crossfade starts)
      const mainDurationSec = isLast ? clip.durationSec : Math.max(0.5, clip.durationSec - crossfadeDurationSec);
      const mainFrames = Math.floor(mainDurationSec * fps);

      // Record main frames
      const t0 = performance.now();
      for (let f = 0; f < mainFrames; f++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        drawFrame(ctx, currentVideo, width, height, 1);
        
        const elapsed = performance.now() - t0;
        const targetTime = (f + 1) * frameMs;
        const wait = targetTime - elapsed;
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
      }

      // Crossfade to next clip
      if (nextPreloaded) {
        const nextVideo = nextPreloaded.video;
        
        // Prepare next video
        nextVideo.currentTime = nextPreloaded.startTime;
        await new Promise(r => setTimeout(r, 30));
        
        try {
          await nextVideo.play();
        } catch (e) {
          console.warn(`[Trailer] Play failed for next clip:`, e);
        }

        // Render crossfade frames
        const ft0 = performance.now();
        for (let f = 0; f < fadeFrames; f++) {
          const linear = (f + 1) / fadeFrames;
          // Smooth ease-in-out curve
          const t = linear < 0.5 
            ? 2 * linear * linear 
            : 1 - Math.pow(-2 * linear + 2, 2) / 2;
          
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, width, height);
          drawFrame(ctx, currentVideo, width, height, 1 - t);
          drawFrame(ctx, nextVideo, width, height, t);
          
          const elapsed = performance.now() - ft0;
          const targetTime = (f + 1) * frameMs;
          const wait = targetTime - elapsed;
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
        }
      } else if (!isLast) {
        // Fade to black if next clip failed to load
        const ft0 = performance.now();
        for (let f = 0; f < fadeFrames; f++) {
          const t = (f + 1) / fadeFrames;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, width, height);
          drawFrame(ctx, currentVideo, width, height, 1 - t);
          
          const elapsed = performance.now() - ft0;
          const wait = (f + 1) * frameMs - elapsed;
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
        }
      }

      // Pause current video (don't clear src yet - might need for reference)
      currentVideo.pause();
    }

    // Cleanup all preloaded videos
    for (const { video } of preloadedClips) {
      video.pause();
      video.src = '';
    }

    // Finalize
    reportProgress({
      phase: 'finalizing',
      currentVideo: preloadedClips.length,
      totalVideos: preloadedClips.length,
      percentComplete: 95,
      message: 'Finalizing trailer...',
    });

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        console.log(`[Trailer] Done: ${blob.size} bytes`);
        setTimeout(cleanupBlobUrls, 500);
        reportProgress({
          phase: 'complete',
          currentVideo: preloadedClips.length,
          totalVideos: preloadedClips.length,
          percentComplete: 100,
          message: 'Trailer ready!',
        });
        resolve(blob);
      };
      recorder.onerror = () => { cleanupBlobUrls(); reject(new Error('Record error')); };
      recorder.stop();
    });
  } catch (err) {
    cleanupBlobUrls();
    throw err;
  }
}

/**
 * Convert WebM blob to MP4
 * Uses ffmpeg.wasm with SharedArrayBuffer if available,
 * otherwise falls back to direct WebM download with guidance
 */
export async function convertToMp4(
  webmBlob: Blob,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  // Check if SharedArrayBuffer is available (required for ffmpeg.wasm)
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  
  if (!hasSharedArrayBuffer) {
    console.warn('[Trailer] SharedArrayBuffer not available - MP4 conversion not supported in this environment');
    throw new Error('MP4 conversion requires a secure context with SharedArrayBuffer. Please download as WebM instead, or use a tool like HandBrake to convert locally.');
  }

  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile } = await import('@ffmpeg/util');
    
    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('progress', ({ progress }) => {
      onProgress?.(Math.round(progress * 100));
    });

    // Load ffmpeg with multi-threaded core if possible
    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    });

    // Write input file
    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile('input.webm', inputData);

    // Convert to MP4
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4'
    ]);

    // Read output - copy to regular ArrayBuffer to avoid SharedArrayBuffer issues
    const outputData = await ffmpeg.readFile('output.mp4') as Uint8Array;
    const buffer = new ArrayBuffer(outputData.byteLength);
    new Uint8Array(buffer).set(outputData);
    const mp4Blob = new Blob([buffer], { type: 'video/mp4' });

    // Cleanup
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');
    ffmpeg.terminate();

    return mp4Blob;
  } catch (err) {
    console.error('[Trailer] FFmpeg conversion failed:', err);
    throw new Error('MP4 conversion failed. Please download as WebM instead.');
  }
}

/**
 * Download a blob as a file
 */
export function downloadTrailer(blob: Blob, filename = 'community-trailer.webm'): void {
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
 * Download trailer as MP4
 */
export async function downloadTrailerAsMp4(
  webmBlob: Blob,
  filename = 'community-trailer.mp4',
  onProgress?: (percent: number) => void
): Promise<void> {
  const mp4Blob = await convertToMp4(webmBlob, onProgress);
  downloadTrailer(mp4Blob, filename);
}
