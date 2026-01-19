/**
 * Browser-Based Video Stitcher
 * 
 * Uses Canvas + MediaRecorder to combine multiple video clips into a single MP4.
 * This runs entirely in the browser - no server required.
 * 
 * Limitations:
 * - Slower than server-side FFmpeg (30-90 seconds for a typical video)
 * - Quality depends on browser's MediaRecorder implementation
 * - Max resolution ~1080p on most devices
 * - No hardware acceleration on all browsers
 */

export interface StitchProgress {
  phase: 'loading' | 'processing' | 'encoding' | 'finalizing' | 'complete' | 'error';
  currentClip: number;
  totalClips: number;
  percentComplete: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export interface StitchOptions {
  resolution?: { width: number; height: number };
  fps?: number;
  videoBitrate?: number; // in Mbps
  audioUrl?: string;
  onProgress?: (progress: StitchProgress) => void;
}

interface VideoClipData {
  url: string;
  duration: number;
  element?: HTMLVideoElement;
}

const DEFAULT_OPTIONS: Required<Omit<StitchOptions, 'audioUrl' | 'onProgress'>> = {
  resolution: { width: 1280, height: 720 },
  fps: 30,
  videoBitrate: 5,
};

/**
 * Fetch video as blob and create object URL for better browser compatibility
 */
async function fetchVideoAsBlob(url: string): Promise<string> {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Load a video element and wait for it to be ready
 * Uses blob fetching for better cross-origin support
 */
async function loadVideo(url: string, retries = 3): Promise<HTMLVideoElement> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // First, fetch the video as a blob to avoid CORS issues
      console.log(`[BrowserStitcher] Loading clip ${attempt}/${retries}: ${url.substring(0, 60)}...`);
      
      let videoSrc = url;
      
      // Try fetching as blob for cross-origin videos
      if (url.includes('supabase.co') || url.includes('storage')) {
        try {
          videoSrc = await fetchVideoAsBlob(url);
          console.log(`[BrowserStitcher] Fetched as blob successfully`);
        } catch (fetchError) {
          console.warn(`[BrowserStitcher] Blob fetch failed, trying direct load:`, fetchError);
          // Fall back to direct URL
        }
      }
      
      const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
        const videoEl = document.createElement('video');
        videoEl.crossOrigin = 'anonymous';
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.preload = 'auto';
        
        const timeout = setTimeout(() => {
          videoEl.src = '';
          reject(new Error(`Video load timeout after 90s`));
        }, 90000);
        
        videoEl.onloadeddata = () => {
          clearTimeout(timeout);
          console.log(`[BrowserStitcher] Video loaded: ${videoEl.videoWidth}x${videoEl.videoHeight}, duration: ${videoEl.duration}s`);
          resolve(videoEl);
        };
        
        videoEl.onerror = (e) => {
          clearTimeout(timeout);
          const error = videoEl.error;
          reject(new Error(`Video load error: ${error?.message || 'Unknown error'} (code: ${error?.code})`));
        };
        
        videoEl.src = videoSrc;
        videoEl.load();
      });
      
      return video;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[BrowserStitcher] Attempt ${attempt}/${retries} failed:`, lastError.message);
      
      if (attempt < retries) {
        const delay = 2000 * attempt;
        console.log(`[BrowserStitcher] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw new Error(`Failed to load video after ${retries} attempts: ${lastError?.message}`);
}

/**
 * Load audio element for background music/voice
 */
async function loadAudio(url: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      reject(new Error('Audio load timeout'));
    }, 30000);
    
    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve(audio);
    };
    
    audio.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load audio'));
    };
    
    audio.src = url;
    audio.load();
  });
}

/**
 * Get the best supported video MIME type
 */
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return 'video/webm';
}

/**
 * Draw a frame from a video to a canvas with proper scaling
 */
function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number
): void {
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  
  let drawWidth: number;
  let drawHeight: number;
  let offsetX: number;
  let offsetY: number;
  
  // Cover the canvas (crop if needed)
  if (videoAspect > canvasAspect) {
    // Video is wider - fit height, crop width
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * videoAspect;
    offsetX = (canvasWidth - drawWidth) / 2;
    offsetY = 0;
  } else {
    // Video is taller - fit width, crop height
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / videoAspect;
    offsetX = 0;
    offsetY = (canvasHeight - drawHeight) / 2;
  }
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Main stitching function - combines multiple video clips into one
 */
export async function stitchVideos(
  clipUrls: string[],
  options: StitchOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { resolution, fps, videoBitrate, onProgress, audioUrl } = { ...opts, ...options };
  
  const reportProgress = (progress: StitchProgress) => {
    onProgress?.(progress);
  };
  
  if (clipUrls.length === 0) {
    throw new Error('No video clips provided');
  }
  
  // Phase 1: Load all videos
  reportProgress({
    phase: 'loading',
    currentClip: 0,
    totalClips: clipUrls.length,
    percentComplete: 0,
    message: 'Loading video clips...',
  });
  
  const clips: VideoClipData[] = [];
  
  for (let i = 0; i < clipUrls.length; i++) {
    reportProgress({
      phase: 'loading',
      currentClip: i + 1,
      totalClips: clipUrls.length,
      percentComplete: Math.round((i / clipUrls.length) * 20),
      message: `Loading clip ${i + 1} of ${clipUrls.length}...`,
    });
    
    try {
      const video = await loadVideo(clipUrls[i]);
      clips.push({
        url: clipUrls[i],
        duration: video.duration,
        element: video,
      });
    } catch (error) {
      console.error(`Failed to load clip ${i + 1}:`, error);
      throw new Error(`Failed to load clip ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Load audio if provided
  let audioElement: HTMLAudioElement | null = null;
  if (audioUrl) {
    try {
      audioElement = await loadAudio(audioUrl);
    } catch (error) {
      console.warn('Failed to load audio, continuing without it:', error);
    }
  }
  
  // Calculate total duration
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  
  reportProgress({
    phase: 'processing',
    currentClip: 0,
    totalClips: clipUrls.length,
    percentComplete: 20,
    message: `Preparing encoder (${Math.round(totalDuration)}s total)...`,
    estimatedTimeRemaining: Math.round(totalDuration * 1.5),
  });
  
  // Phase 2: Setup canvas and recorder
  const canvas = document.createElement('canvas');
  canvas.width = resolution.width;
  canvas.height = resolution.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  
  // Create audio context for mixing (if audio provided)
  let audioContext: AudioContext | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  
  if (audioElement) {
    audioContext = new AudioContext();
    audioSource = audioContext.createMediaElementSource(audioElement);
    audioDestination = audioContext.createMediaStreamDestination();
    audioSource.connect(audioDestination);
    audioSource.connect(audioContext.destination); // For monitoring
  }
  
  // Get canvas stream
  const canvasStream = canvas.captureStream(fps);
  
  // Combine video and audio streams
  let combinedStream: MediaStream;
  if (audioDestination) {
    combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
  } else {
    combinedStream = canvasStream;
  }
  
  // Setup MediaRecorder
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: videoBitrate * 1000000,
  });
  
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  
  // Start recording
  recorder.start(100); // Collect data every 100ms
  
  // Start audio playback if available
  if (audioElement) {
    audioElement.currentTime = 0;
    await audioElement.play().catch(() => {});
  }
  
  // Phase 3: Process each clip
  const frameInterval = 1000 / fps;
  let processedTime = 0;
  const startTime = Date.now();
  
  for (let clipIndex = 0; clipIndex < clips.length; clipIndex++) {
    const clip = clips[clipIndex];
    const video = clip.element!;
    
    reportProgress({
      phase: 'encoding',
      currentClip: clipIndex + 1,
      totalClips: clipUrls.length,
      percentComplete: 20 + Math.round((processedTime / totalDuration) * 70),
      message: `Encoding clip ${clipIndex + 1} of ${clipUrls.length}...`,
      estimatedTimeRemaining: Math.round((totalDuration - processedTime) * 1.2),
    });
    
    // Play and capture this clip
    video.currentTime = 0;
    await video.play();
    
    // Capture frames until clip ends
    while (video.currentTime < video.duration - 0.1) {
      drawVideoFrame(ctx, video, resolution.width, resolution.height);
      
      // Wait for next frame
      await new Promise(resolve => setTimeout(resolve, frameInterval));
      
      processedTime = clips.slice(0, clipIndex).reduce((sum, c) => sum + c.duration, 0) + video.currentTime;
      
      // Update progress periodically
      if (Math.random() < 0.1) { // ~10% of frames to avoid spam
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processedTime / elapsed;
        const remaining = (totalDuration - processedTime) / rate;
        
        reportProgress({
          phase: 'encoding',
          currentClip: clipIndex + 1,
          totalClips: clipUrls.length,
          percentComplete: 20 + Math.round((processedTime / totalDuration) * 70),
          message: `Encoding clip ${clipIndex + 1}... (${Math.round(processedTime)}s / ${Math.round(totalDuration)}s)`,
          estimatedTimeRemaining: Math.round(remaining),
        });
      }
    }
    
    video.pause();
  }
  
  // Phase 4: Finalize
  reportProgress({
    phase: 'finalizing',
    currentClip: clipUrls.length,
    totalClips: clipUrls.length,
    percentComplete: 95,
    message: 'Finalizing video...',
  });
  
  // Stop audio
  if (audioElement) {
    audioElement.pause();
  }
  
  // Stop recording and get final blob
  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      
      // Cleanup
      clips.forEach(clip => {
        if (clip.element) {
          clip.element.src = '';
          clip.element.load();
        }
      });
      if (audioContext) {
        audioContext.close();
      }
      
      reportProgress({
        phase: 'complete',
        currentClip: clipUrls.length,
        totalClips: clipUrls.length,
        percentComplete: 100,
        message: 'Video ready!',
      });
      
      resolve(blob);
    };
    
    recorder.onerror = (e) => {
      reject(new Error('MediaRecorder error: ' + e));
    };
    
    recorder.stop();
  });
}

/**
 * Download a blob as a file
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
 * Upload stitched video to Supabase storage
 */
export async function uploadStitchedVideo(
  blob: Blob,
  projectId: string,
  supabase: any
): Promise<string> {
  const filename = `stitched-${projectId}-${Date.now()}.webm`;
  const path = `stitched/${projectId}/${filename}`;
  
  const { data, error } = await supabase.storage
    .from('videos')
    .upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(path);
  
  return urlData.publicUrl;
}
