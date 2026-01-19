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
 * Load a video element
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
 * Generate a trailer from community videos
 * Uses memory-efficient sequential loading to prevent crashes
 */
export async function generateTrailer(
  options: TrailerOptions = {}
): Promise<Blob> {
  const { 
    snippetDuration = 2, 
    partsPerVideo = 1, // Reduced from 2 to lower memory usage
    includeMusic = false, // Disabled by default for stability
    onProgress 
  } = options;

  // Clear any previous blob URLs
  cleanupBlobUrls();

  const reportProgress = (progress: TrailerProgress) => onProgress?.(progress);

  try {
    // Phase 1: Fetch clip data from edge function
    reportProgress({
      phase: 'fetching',
      currentVideo: 0,
      totalVideos: 0,
      percentComplete: 0,
      message: 'Fetching community videos...',
    });

    console.log('[Trailer] Calling generate-trailer edge function...');

    const { data: response, error } = await supabase.functions.invoke('generate-trailer', {
      body: { snippetDuration, partsPerVideo, maxVideos: 5 }, // Reduced from 8 to 5
    });

    if (error || !response?.success) {
      const errorMsg = error?.message || response?.error || 'Failed to fetch video data';
      console.error('[Trailer] Edge function error:', errorMsg);
      throw new Error(errorMsg);
    }

    const clips: TrailerClip[] = response.clips;
    console.log(`[Trailer] Got ${clips.length} clips from edge function`);

    if (clips.length === 0) {
      throw new Error('No clips available for trailer');
    }

    // Phase 2: Setup canvas and recorder (lower resolution for stability)
    const resolution = { width: 854, height: 480 }; // 480p instead of 720p
    const fps = 24; // Reduced from 30
    
    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    // Fill initial black frame
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mimeType = getSupportedMimeType();
    console.log(`[Trailer] Using MIME type: ${mimeType}`);
    
    const canvasStream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 2500000, // Lower bitrate
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.start(500);

    // Phase 3: Process clips with crossfade transitions
    const frameInterval = 1000 / fps;
    const crossfadeDuration = 0.1; // seconds
    const crossfadeFrames = Math.floor(crossfadeDuration * fps);
    let processedClips = 0;

    // Pre-load first two videos for crossfade
    let currentVideo: HTMLVideoElement | null = null;
    let nextVideo: HTMLVideoElement | null = null;
    let nextVideoPromise: Promise<HTMLVideoElement> | null = null;

    if (clips.length > 0) {
      currentVideo = await loadVideo(clips[0].url);
    }
    if (clips.length > 1) {
      nextVideo = await loadVideo(clips[1].url);
    }

    for (let clipIndex = 0; clipIndex < clips.length; clipIndex++) {
      const clip = clips[clipIndex];
      const isLastClip = clipIndex === clips.length - 1;
      const hasNextClip = nextVideo !== null && !isLastClip;

      reportProgress({
        phase: 'extracting',
        currentVideo: clipIndex + 1,
        totalVideos: clips.length,
        percentComplete: 10 + Math.round((clipIndex / clips.length) * 80),
        message: `Processing clip ${clipIndex + 1} of ${clips.length}...`,
      });

      try {
        if (!currentVideo) {
          console.warn(`[Trailer] No video for clip ${clipIndex + 1}`);
          continue;
        }

        // Start loading the video after next in background
        if (clipIndex + 2 < clips.length) {
          nextVideoPromise = loadVideo(clips[clipIndex + 2].url);
        }

        // Seek current video to start
        const startTime = Math.min(clip.startSec, Math.max(0, currentVideo.duration - clip.durationSec));
        currentVideo.currentTime = startTime;
        
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 1000);
          const onSeeked = () => {
            clearTimeout(timeout);
            currentVideo?.removeEventListener('seeked', onSeeked);
            resolve();
          };
          currentVideo?.addEventListener('seeked', onSeeked);
        });

        await currentVideo.play();

        // Calculate frames: main content + crossfade overlap
        const mainFrames = hasNextClip 
          ? Math.floor((clip.durationSec - crossfadeDuration) * fps)
          : Math.floor(clip.durationSec * fps);
        
        const startTimestamp = performance.now();
        
        // Record main frames (before crossfade)
        for (let frame = 0; frame < mainFrames; frame++) {
          drawFrame(ctx, currentVideo, canvas.width, canvas.height, 1);
          
          const targetTime = startTimestamp + (frame + 1) * frameInterval;
          const delay = Math.max(0, targetTime - performance.now());
          if (delay > 0) await new Promise(r => setTimeout(r, delay));
        }

        // Crossfade to next clip
        if (hasNextClip && nextVideo) {
          const nextClip = clips[clipIndex + 1];
          const nextStartTime = Math.min(nextClip.startSec, Math.max(0, nextVideo.duration - nextClip.durationSec));
          nextVideo.currentTime = nextStartTime;
          
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 1000);
            const onSeeked = () => {
              clearTimeout(timeout);
              nextVideo?.removeEventListener('seeked', onSeeked);
              resolve();
            };
            nextVideo?.addEventListener('seeked', onSeeked);
          });

          await nextVideo.play();

          // Render crossfade frames
          const crossfadeStart = performance.now();
          for (let frame = 0; frame < crossfadeFrames; frame++) {
            const progress = frame / crossfadeFrames;
            // Smooth easing
            const eased = progress < 0.5 
              ? 2 * progress * progress 
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Draw both frames with opacity blend
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawFrame(ctx, currentVideo, canvas.width, canvas.height, 1 - eased);
            drawFrame(ctx, nextVideo, canvas.width, canvas.height, eased);
            
            const targetTime = crossfadeStart + (frame + 1) * frameInterval;
            const delay = Math.max(0, targetTime - performance.now());
            if (delay > 0) await new Promise(r => setTimeout(r, delay));
          }
        }

        currentVideo.pause();
        currentVideo.removeAttribute('src');
        processedClips++;
        console.log(`[Trailer] Clip ${clipIndex + 1} complete`);

        // Rotate videos: next becomes current
        currentVideo = nextVideo;
        
        // Load the next-next video that was loading in background
        if (nextVideoPromise && clipIndex + 2 < clips.length) {
          try {
            nextVideo = await nextVideoPromise;
          } catch (e) {
            console.warn(`[Trailer] Failed to pre-load video:`, e);
            nextVideo = null;
          }
        } else {
          nextVideo = null;
        }
        nextVideoPromise = null;

      } catch (error) {
        console.warn(`[Trailer] Error processing clip ${clipIndex + 1}:`, error);
      }
    }

    // Clean up remaining videos
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.removeAttribute('src');
    }
    if (nextVideo) {
      nextVideo.pause();
      nextVideo.removeAttribute('src');
    }

    // Phase 4: Finalize
    reportProgress({
      phase: 'finalizing',
      currentVideo: clips.length,
      totalVideos: clips.length,
      percentComplete: 95,
      message: 'Finalizing trailer...',
    });

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        console.log(`[Trailer] Created blob: ${blob.size} bytes`);
        
        // Clean up blob URLs after a delay
        setTimeout(() => {
          cleanupBlobUrls();
        }, 1000);

        reportProgress({
          phase: 'complete',
          currentVideo: clips.length,
          totalVideos: clips.length,
          percentComplete: 100,
          message: 'Trailer ready!',
        });

        resolve(blob);
      };

      recorder.onerror = (e) => {
        cleanupBlobUrls();
        reject(new Error('Recording error: ' + e));
      };
      recorder.stop();
    });
  } catch (error) {
    // Cleanup on error
    cleanupBlobUrls();
    throw error;
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
