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
async function fetchVideoAsBlob(url: string): Promise<string> {
  console.log('[Trailer] Fetching video as blob:', url.substring(0, 60));
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Fetch audio as blob
 */
async function fetchAudioAsBlob(url: string): Promise<string> {
  console.log('[Trailer] Fetching audio as blob:', url.substring(0, 60));
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
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
      video.src = '';
      reject(new Error('Video load timeout'));
    }, 60000); // Increased timeout to 60s
    
    video.onloadeddata = () => {
      clearTimeout(timeout);
      console.log(`[Trailer] Video loaded: ${video.videoWidth}x${video.videoHeight}, ${video.duration}s`);
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
 */
export async function generateTrailer(
  options: TrailerOptions = {}
): Promise<Blob> {
  const { 
    snippetDuration = 2, 
    partsPerVideo = 2, 
    crossfadeDuration = 0.5,
    includeMusic = true,
    onProgress 
  } = options;

  const reportProgress = (progress: TrailerProgress) => onProgress?.(progress);

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
    body: { snippetDuration, partsPerVideo, maxVideos: 8 },
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

  // Calculate total trailer duration for music
  const totalDuration = clips.reduce((sum, clip) => sum + clip.durationSec, 0);

  // Phase 1.5: Generate trailer music
  let musicAudio: HTMLAudioElement | null = null;
  
  if (includeMusic) {
    reportProgress({
      phase: 'music',
      currentVideo: 0,
      totalVideos: clips.length,
      percentComplete: 3,
      message: 'Generating epic trailer music...',
    });

    const musicUrl = await generateTrailerMusic(totalDuration);
    
    if (musicUrl) {
      try {
        musicAudio = await loadAudio(musicUrl);
        console.log('[Trailer] Music loaded successfully');
      } catch (e) {
        console.warn('[Trailer] Failed to load music:', e);
      }
    }
  }

  // Phase 2: Load unique videos
  reportProgress({
    phase: 'loading',
    currentVideo: 0,
    totalVideos: clips.length,
    percentComplete: 5,
    message: 'Loading videos...',
  });

  const uniqueUrls = [...new Set(clips.map(c => c.url))];
  const videoCache = new Map<string, HTMLVideoElement>();
  
  for (let i = 0; i < uniqueUrls.length; i++) {
    reportProgress({
      phase: 'loading',
      currentVideo: i + 1,
      totalVideos: uniqueUrls.length,
      percentComplete: 5 + Math.round((i / uniqueUrls.length) * 20),
      message: `Loading video ${i + 1} of ${uniqueUrls.length}...`,
    });

    try {
      const video = await loadVideo(uniqueUrls[i]);
      videoCache.set(uniqueUrls[i], video);
    } catch (error) {
      console.warn(`[Trailer] Failed to load video ${i + 1}:`, error);
    }
  }

  if (videoCache.size === 0) {
    throw new Error('Could not load any videos');
  }

  // Phase 3: Setup canvas and recorder with audio
  const resolution = { width: 1280, height: 720 };
  const fps = 30;
  
  const canvas = document.createElement('canvas');
  canvas.width = resolution.width;
  canvas.height = resolution.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const mimeType = getSupportedMimeType();
  console.log(`[Trailer] Using MIME type: ${mimeType}`);
  
  // Create combined stream with video and optional audio
  const canvasStream = canvas.captureStream(fps);
  
  // Add audio track if music is available
  if (musicAudio) {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(musicAudio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination); // Also play through speakers
      
      const audioTrack = destination.stream.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
        console.log('[Trailer] Audio track added to stream');
      }
    } catch (e) {
      console.warn('[Trailer] Failed to add audio track:', e);
    }
  }

  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 5000000,
    audioBitsPerSecond: 128000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(100);

  // Start music playback
  if (musicAudio) {
    musicAudio.currentTime = 0;
    musicAudio.volume = 0.7;
    musicAudio.play().catch(e => console.warn('[Trailer] Music play failed:', e));
  }

  // Phase 4: Record each clip with crossfade transitions
  const frameInterval = 1000 / fps;
  const crossfadeFrames = Math.floor(crossfadeDuration * fps);
  let processedClips = 0;

  // Get valid clips (ones we have videos for)
  const validClips = clips.filter(clip => videoCache.has(clip.url));

  for (let clipIndex = 0; clipIndex < validClips.length; clipIndex++) {
    const clip = validClips[clipIndex];
    const video = videoCache.get(clip.url)!;
    const nextClip = validClips[clipIndex + 1];
    const nextVideo = nextClip ? videoCache.get(nextClip.url) : null;

    reportProgress({
      phase: 'extracting',
      currentVideo: clipIndex + 1,
      totalVideos: validClips.length,
      percentComplete: 25 + Math.round((clipIndex / validClips.length) * 65),
      message: `Recording clip ${clipIndex + 1} of ${validClips.length}...`,
    });

    try {
      // Seek to start position
      const startTime = Math.min(clip.startSec, Math.max(0, video.duration - clip.durationSec));
      video.currentTime = startTime;
      
      // Wait for seek to complete properly
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        setTimeout(resolve, 300);
      });

      // Small delay to ensure frame is ready
      await new Promise(r => setTimeout(r, 50));
      await video.play();

      // Calculate frames for main content and crossfade
      const mainDuration = clip.durationSec - (nextVideo ? crossfadeDuration : 0);
      const totalMainFrames = Math.floor(mainDuration * fps);
      
      // Use requestAnimationFrame-aligned timing for smoother playback
      const startTimestamp = performance.now();
      let lastFrameTime = startTimestamp;
      
      // Record main frames with proper timing
      for (let frame = 0; frame < totalMainFrames; frame++) {
        // Draw current frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawFrame(ctx, video, canvas.width, canvas.height, 1);
        
        // Calculate proper delay to maintain consistent framerate
        const targetTime = startTimestamp + (frame + 1) * frameInterval;
        const now = performance.now();
        const delay = Math.max(1, targetTime - now);
        
        await new Promise(r => setTimeout(r, delay));
        lastFrameTime = performance.now();
      }

      // Crossfade to next clip if there is one
      if (nextVideo) {
        // Prepare next video while current is still playing
        const nextStartTime = Math.min(nextClip.startSec, Math.max(0, nextVideo.duration - nextClip.durationSec));
        nextVideo.currentTime = nextStartTime;
        
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            nextVideo.removeEventListener('seeked', onSeeked);
            resolve();
          };
          nextVideo.addEventListener('seeked', onSeeked);
          setTimeout(resolve, 300);
        });

        await new Promise(r => setTimeout(r, 50));
        await nextVideo.play();

        // Record smooth crossfade frames with easing
        const crossfadeStart = performance.now();
        for (let frame = 0; frame < crossfadeFrames; frame++) {
          // Use easeInOutCubic for smoother transition
          const t = frame / crossfadeFrames;
          const easedProgress = t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
          
          drawCrossfade(ctx, video, nextVideo, canvas.width, canvas.height, easedProgress);
          
          // Maintain consistent timing
          const targetTime = crossfadeStart + (frame + 1) * frameInterval;
          const now = performance.now();
          const delay = Math.max(1, targetTime - now);
          
          await new Promise(r => setTimeout(r, delay));
        }

        nextVideo.pause();
      }

      video.pause();
      processedClips++;
    } catch (error) {
      console.warn(`[Trailer] Error processing clip:`, error);
    }
  }

  // Stop music
  if (musicAudio) {
    musicAudio.pause();
  }

  // Phase 5: Finalize
  reportProgress({
    phase: 'finalizing',
    currentVideo: validClips.length,
    totalVideos: validClips.length,
    percentComplete: 95,
    message: 'Finalizing trailer...',
  });

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      console.log(`[Trailer] Created blob: ${blob.size} bytes`);
      
      // Cleanup
      videoCache.forEach(v => {
        v.src = '';
        v.load();
      });

      reportProgress({
        phase: 'complete',
        currentVideo: validClips.length,
        totalVideos: validClips.length,
        percentComplete: 100,
        message: 'Trailer ready!',
      });

      resolve(blob);
    };

    recorder.onerror = (e) => reject(new Error('Recording error: ' + e));
    recorder.stop();
  });
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
