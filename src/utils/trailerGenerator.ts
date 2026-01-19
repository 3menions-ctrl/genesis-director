/**
 * Trailer Generator
 * 
 * Creates a promotional trailer from snippets of community videos.
 * Takes 2-second clips from each video and combines them into one trailer.
 */

import { supabase } from '@/integrations/supabase/client';

export interface TrailerProgress {
  phase: 'fetching' | 'loading' | 'extracting' | 'encoding' | 'finalizing' | 'complete' | 'error';
  currentVideo: number;
  totalVideos: number;
  percentComplete: number;
  message: string;
}

export interface TrailerOptions {
  snippetDuration?: number; // seconds per snippet (default 2)
  partsPerVideo?: number; // number of parts per video (default 2)
  resolution?: { width: number; height: number };
  fps?: number;
  onProgress?: (progress: TrailerProgress) => void;
}

interface VideoSnippet {
  videoUrl: string;
  startTime: number;
  duration: number;
}

const DEFAULT_OPTIONS: Required<Omit<TrailerOptions, 'onProgress'>> = {
  snippetDuration: 2,
  partsPerVideo: 2,
  resolution: { width: 1280, height: 720 },
  fps: 30,
};

/**
 * Fetch public videos from the community feed
 */
async function fetchPublicVideos(limit = 10): Promise<string[]> {
  const { data, error } = await supabase
    .from('movie_projects')
    .select('video_url')
    .eq('is_public', true)
    .not('video_url', 'is', null)
    .order('likes_count', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch videos: ${error.message}`);
  
  // Filter out manifest files (JSON) and return only direct video URLs
  return (data || [])
    .map(v => v.video_url)
    .filter((url): url is string => url !== null && !url.endsWith('.json'));
}

/**
 * Fetch video as blob for cross-origin support
 */
async function fetchVideoAsBlob(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Load a video element
 */
async function loadVideo(url: string): Promise<HTMLVideoElement> {
  let videoSrc = url;
  
  // Try blob fetch for cross-origin
  if (url.includes('supabase.co') || url.includes('storage')) {
    try {
      videoSrc = await fetchVideoAsBlob(url);
    } catch (e) {
      console.warn('Blob fetch failed, using direct URL');
    }
  }
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    
    const timeout = setTimeout(() => {
      video.src = '';
      reject(new Error('Video load timeout'));
    }, 60000);
    
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve(video);
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load video'));
    };
    
    video.src = videoSrc;
    video.load();
  });
}

/**
 * Draw video frame to canvas with cover scaling
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number
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
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Get supported MIME type
 */
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}

/**
 * Extract a snippet from a video
 */
async function extractSnippet(
  video: HTMLVideoElement,
  startTime: number,
  duration: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  fps: number
): Promise<void> {
  video.currentTime = startTime;
  
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
  });
  
  await video.play();
  
  const frameInterval = 1000 / fps;
  const endTime = startTime + duration;
  
  while (video.currentTime < endTime && video.currentTime < video.duration) {
    drawFrame(ctx, video, canvas.width, canvas.height);
    await new Promise(r => setTimeout(r, frameInterval));
  }
  
  video.pause();
}

/**
 * Generate a trailer from community videos
 */
export async function generateTrailer(
  options: TrailerOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { snippetDuration, partsPerVideo, resolution, fps, onProgress } = opts;

  const reportProgress = (progress: TrailerProgress) => onProgress?.(progress);

  // Phase 1: Fetch videos
  reportProgress({
    phase: 'fetching',
    currentVideo: 0,
    totalVideos: 0,
    percentComplete: 0,
    message: 'Fetching community videos...',
  });

  const videoUrls = await fetchPublicVideos(12);
  
  if (videoUrls.length === 0) {
    throw new Error('No public videos available for trailer');
  }

  const totalVideos = videoUrls.length;
  const snippets: VideoSnippet[] = [];

  // Phase 2: Load videos and plan snippets
  reportProgress({
    phase: 'loading',
    currentVideo: 0,
    totalVideos,
    percentComplete: 5,
    message: 'Loading videos...',
  });

  const loadedVideos: HTMLVideoElement[] = [];
  
  for (let i = 0; i < videoUrls.length; i++) {
    reportProgress({
      phase: 'loading',
      currentVideo: i + 1,
      totalVideos,
      percentComplete: 5 + Math.round((i / totalVideos) * 20),
      message: `Loading video ${i + 1} of ${totalVideos}...`,
    });

    try {
      const video = await loadVideo(videoUrls[i]);
      loadedVideos.push(video);
      
      // Calculate snippet positions - spread evenly through the video
      const videoDuration = video.duration;
      if (videoDuration >= snippetDuration * partsPerVideo) {
        for (let p = 0; p < partsPerVideo; p++) {
          const segmentLength = videoDuration / partsPerVideo;
          const startTime = p * segmentLength + (segmentLength - snippetDuration) / 2;
          snippets.push({
            videoUrl: videoUrls[i],
            startTime: Math.max(0, startTime),
            duration: snippetDuration,
          });
        }
      } else if (videoDuration >= snippetDuration) {
        // Video too short for multiple parts, take one from middle
        snippets.push({
          videoUrl: videoUrls[i],
          startTime: (videoDuration - snippetDuration) / 2,
          duration: snippetDuration,
        });
      }
    } catch (error) {
      console.warn(`Failed to load video ${i + 1}:`, error);
    }
  }

  if (snippets.length === 0) {
    throw new Error('Could not extract any snippets from videos');
  }

  // Shuffle snippets for variety
  for (let i = snippets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [snippets[i], snippets[j]] = [snippets[j], snippets[i]];
  }

  // Phase 3: Setup canvas and recorder
  const canvas = document.createElement('canvas');
  canvas.width = resolution.width;
  canvas.height = resolution.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const mimeType = getSupportedMimeType();
  const canvasStream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 5000000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(100);

  // Phase 4: Extract and encode snippets
  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i];
    
    reportProgress({
      phase: 'extracting',
      currentVideo: i + 1,
      totalVideos: snippets.length,
      percentComplete: 25 + Math.round((i / snippets.length) * 65),
      message: `Encoding snippet ${i + 1} of ${snippets.length}...`,
    });

    // Find the loaded video for this snippet
    const videoIndex = videoUrls.indexOf(snippet.videoUrl);
    if (videoIndex >= 0 && loadedVideos[videoIndex]) {
      try {
        await extractSnippet(
          loadedVideos[videoIndex],
          snippet.startTime,
          snippet.duration,
          canvas,
          ctx,
          fps
        );
      } catch (error) {
        console.warn(`Failed to extract snippet ${i + 1}:`, error);
      }
    }
  }

  // Phase 5: Finalize
  reportProgress({
    phase: 'finalizing',
    currentVideo: snippets.length,
    totalVideos: snippets.length,
    percentComplete: 95,
    message: 'Finalizing trailer...',
  });

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      
      // Cleanup
      loadedVideos.forEach(v => {
        v.src = '';
        v.load();
      });

      reportProgress({
        phase: 'complete',
        currentVideo: snippets.length,
        totalVideos: snippets.length,
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
