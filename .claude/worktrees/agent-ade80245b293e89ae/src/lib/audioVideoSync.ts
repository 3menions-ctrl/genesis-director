/**
 * Audio-Video Sync Engine v1.0
 * 
 * Implements frame-accurate audio synchronization using absolute timestamps
 * to eliminate cumulative drift during multi-clip stitching.
 */

/**
 * Audio track with absolute timing
 */
export interface AudioTrack {
  id: string;
  url: string;
  startTime: number;      // Absolute start time in seconds
  duration: number;       // Duration in seconds
  volume: number;         // 0-1
  type: 'voice' | 'music' | 'sfx';
  fadeIn?: number;        // Fade in duration in seconds
  fadeOut?: number;       // Fade out duration in seconds
}

/**
 * Video clip with absolute timing
 */
export interface VideoClip {
  id: string;
  url: string;
  startTime: number;      // Absolute start time in seconds
  duration: number;       // Duration in seconds
  transitionIn?: number;  // Transition duration in seconds
  transitionOut?: number;
}

/**
 * Sync manifest that aligns audio to absolute timestamps
 */
export interface SyncManifest {
  version: string;
  totalDuration: number;
  videoTracks: VideoClip[];
  audioTracks: AudioTrack[];
  syncPoints: SyncPoint[];  // Alignment anchors
}

/**
 * Sync point for alignment verification
 */
export interface SyncPoint {
  time: number;           // Absolute time in seconds
  videoClipIndex: number;
  videoOffset: number;    // Offset within the video clip
  audioTrackId?: string;
  audioOffset?: number;
}

/**
 * Calculate absolute timestamps for video clips (eliminates cumulative error)
 */
export function calculateAbsoluteTimestamps(clips: { duration: number }[]): number[] {
  const timestamps: number[] = [];
  let currentTime = 0;
  
  for (const clip of clips) {
    timestamps.push(currentTime);
    currentTime += clip.duration;
  }
  
  return timestamps;
}

/**
 * Build sync manifest from clips and audio tracks
 */
export function buildSyncManifest(
  videoClips: Array<{ id: string; url: string; duration: number }>,
  audioTracks: AudioTrack[] = []
): SyncManifest {
  const absoluteTimestamps = calculateAbsoluteTimestamps(videoClips);
  
  const videoTracksWithTiming: VideoClip[] = videoClips.map((clip, index) => ({
    id: clip.id,
    url: clip.url,
    startTime: absoluteTimestamps[index],
    duration: clip.duration,
  }));
  
  const totalDuration = videoTracksWithTiming.reduce(
    (sum, clip) => Math.max(sum, clip.startTime + clip.duration),
    0
  );
  
  // Generate sync points at each clip boundary
  const syncPoints: SyncPoint[] = videoTracksWithTiming.map((clip, index) => ({
    time: clip.startTime,
    videoClipIndex: index,
    videoOffset: 0,
  }));
  
  // Add sync point at the end
  syncPoints.push({
    time: totalDuration,
    videoClipIndex: videoClips.length - 1,
    videoOffset: videoClips[videoClips.length - 1]?.duration || 0,
  });
  
  return {
    version: '1.0',
    totalDuration,
    videoTracks: videoTracksWithTiming,
    audioTracks,
    syncPoints,
  };
}

/**
 * Get expected audio position for a given video time (for drift detection)
 */
export function getExpectedAudioPosition(
  manifest: SyncManifest,
  currentTime: number
): { trackId: string; position: number } | null {
  // Find the audio track that should be playing at this time
  for (const track of manifest.audioTracks) {
    if (currentTime >= track.startTime && 
        currentTime < track.startTime + track.duration) {
      return {
        trackId: track.id,
        position: currentTime - track.startTime,
      };
    }
  }
  return null;
}

/**
 * Calculate drift between expected and actual audio position
 */
export function calculateDrift(
  expectedPosition: number,
  actualPosition: number
): { drift: number; withinTolerance: boolean } {
  const drift = actualPosition - expectedPosition;
  const TOLERANCE_MS = 50; // 50ms tolerance (2-3 frames at 60fps)
  
  return {
    drift,
    withinTolerance: Math.abs(drift * 1000) <= TOLERANCE_MS,
  };
}

/**
 * Correct audio drift by adjusting playback rate
 */
export function correctDrift(
  audioElement: HTMLAudioElement,
  drift: number
): void {
  const MAX_RATE_ADJUSTMENT = 0.05; // Max 5% speed adjustment
  const CORRECTION_THRESHOLD = 0.016; // 16ms (1 frame at 60fps)
  
  if (Math.abs(drift) < CORRECTION_THRESHOLD) {
    // Within tolerance, reset to normal speed
    audioElement.playbackRate = 1.0;
    return;
  }
  
  // Calculate correction rate
  let correctionRate: number;
  if (drift > 0) {
    // Audio is ahead, slow it down
    correctionRate = 1.0 - Math.min(drift * 0.5, MAX_RATE_ADJUSTMENT);
  } else {
    // Audio is behind, speed it up
    correctionRate = 1.0 + Math.min(Math.abs(drift) * 0.5, MAX_RATE_ADJUSTMENT);
  }
  
  // Apply rate adjustment
  audioElement.playbackRate = correctionRate;
  
  // If drift is too large, do a hard seek
  if (Math.abs(drift) > 0.5) {
    audioElement.currentTime -= drift;
    audioElement.playbackRate = 1.0;
  }
}

/**
 * Audio Sync Monitor - monitors and corrects A/V sync in real-time
 */
export class AudioSyncMonitor {
  private manifest: SyncManifest;
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private driftHistory: number[] = [];
  
  constructor(manifest: SyncManifest) {
    this.manifest = manifest;
  }
  
  /**
   * Register an audio element for monitoring
   */
  registerAudio(trackId: string, element: HTMLAudioElement): void {
    this.audioElements.set(trackId, element);
  }
  
  /**
   * Start monitoring A/V sync
   */
  startMonitoring(
    getVideoTime: () => number,
    onDrift?: (trackId: string, drift: number) => void
  ): void {
    if (this.monitoringInterval) return;
    
    this.monitoringInterval = setInterval(() => {
      const videoTime = getVideoTime();
      const expected = getExpectedAudioPosition(this.manifest, videoTime);
      
      if (!expected) return;
      
      const audioElement = this.audioElements.get(expected.trackId);
      if (!audioElement) return;
      
      const { drift, withinTolerance } = calculateDrift(
        expected.position,
        audioElement.currentTime
      );
      
      // Track drift history
      this.driftHistory.push(drift);
      if (this.driftHistory.length > 60) {
        this.driftHistory.shift();
      }
      
      // Notify callback
      onDrift?.(expected.trackId, drift);
      
      // Auto-correct if outside tolerance
      if (!withinTolerance) {
        correctDrift(audioElement, drift);
      }
    }, 100); // Check every 100ms
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  /**
   * Get average drift (for diagnostics)
   */
  getAverageDrift(): number {
    if (this.driftHistory.length === 0) return 0;
    return this.driftHistory.reduce((a, b) => a + b, 0) / this.driftHistory.length;
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.stopMonitoring();
    this.audioElements.clear();
    this.driftHistory = [];
  }
}

/**
 * Pre-calculate frame boundaries for precision seeking
 */
export function calculateFrameBoundaries(
  duration: number,
  fps: number = 30
): number[] {
  const frameDuration = 1 / fps;
  const boundaries: number[] = [];
  
  for (let time = 0; time <= duration; time += frameDuration) {
    boundaries.push(Number(time.toFixed(6))); // 6 decimal places for precision
  }
  
  return boundaries;
}

/**
 * Snap time to nearest frame boundary
 */
export function snapToFrame(time: number, fps: number = 30): number {
  const frameDuration = 1 / fps;
  return Math.round(time / frameDuration) * frameDuration;
}

/**
 * Calculate exact clip boundary for seamless transitions
 */
export function calculateClipBoundary(
  clips: { startTime: number; duration: number }[],
  time: number
): { clipIndex: number; localTime: number; atBoundary: boolean } {
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const clipEnd = clip.startTime + clip.duration;
    
    if (time >= clip.startTime && time < clipEnd) {
      const localTime = time - clip.startTime;
      const atBoundary = localTime < 0.05 || (clip.duration - localTime) < 0.05;
      
      return {
        clipIndex: i,
        localTime,
        atBoundary,
      };
    }
  }
  
  // Past end, return last clip
  return {
    clipIndex: clips.length - 1,
    localTime: clips[clips.length - 1]?.duration || 0,
    atBoundary: true,
  };
}
