/**
 * Web Audio Master Clock - Precision timing for multi-clip synchronization
 * 
 * Uses Web Audio API's high-resolution clock as the single source of truth
 * for all media timing, preventing drift across long playback sessions.
 * 
 * Features:
 * - Sub-millisecond timing precision
 * - Synchronized audio tracks (voice, music, SFX)
 * - Drift compensation
 * - Cross-browser compatibility
 */

export interface AudioTrack {
  id: string;
  url: string;
  type: 'voice' | 'music' | 'sfx';
  startTime: number; // When to start in timeline
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ClockState {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  drift: number;
  audioContextState: AudioContextState;
}

export interface MasterClockCallbacks {
  onTimeUpdate?: (time: number) => void;
  onStateChange?: (state: ClockState) => void;
  onDriftDetected?: (drift: number) => void;
}

/**
 * Web Audio Master Clock
 */
export class WebAudioMasterClock {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  
  // Timing
  private startTimestamp: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  
  // Audio sources
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private trackGains: Map<string, GainNode> = new Map();
  
  // Scheduled tracks
  private tracks: AudioTrack[] = [];
  
  // Callbacks
  private callbacks: MasterClockCallbacks = {};
  
  // Update loop
  private animationFrameId: number | null = null;
  private lastVideoTime: number = 0;

  constructor(callbacks?: MasterClockCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Initialize the audio context
   */
  async initialize(): Promise<boolean> {
    try {
      // Create AudioContext (with fallback for older browsers)
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      // Create master gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      
      console.log('[MasterClock] Initialized, sample rate:', this.audioContext.sampleRate);
      return true;
    } catch (error) {
      console.error('[MasterClock] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[MasterClock] Audio context resumed');
    }
  }

  /**
   * Get current precise time
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return this.pausedAt;
    }

    const elapsed = this.audioContext.currentTime - this.startTimestamp;
    return elapsed * this.playbackRate;
  }

  /**
   * Start playback from current position
   */
  async play(fromTime?: number): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    await this.resume();

    const startFrom = fromTime ?? this.pausedAt;
    this.startTimestamp = this.audioContext!.currentTime - (startFrom / this.playbackRate);
    this.isPlaying = true;

    // Schedule all audio tracks
    this.scheduleAllTracks(startFrom);

    // Start update loop
    this.startUpdateLoop();

    console.log('[MasterClock] Playing from:', startFrom);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.pausedAt = this.getCurrentTime();
    this.isPlaying = false;

    // Stop all active sources
    this.stopAllSources();

    // Stop update loop
    this.stopUpdateLoop();

    console.log('[MasterClock] Paused at:', this.pausedAt);
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }

    this.pausedAt = Math.max(0, time);

    if (wasPlaying) {
      this.play(this.pausedAt);
    }
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    const currentTime = this.getCurrentTime();
    this.playbackRate = Math.max(0.25, Math.min(4, rate));
    
    if (this.isPlaying) {
      this.startTimestamp = this.audioContext!.currentTime - (currentTime / this.playbackRate);
    }
  }

  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext!.currentTime
      );
    }
  }

  /**
   * Load an audio track
   */
  async loadTrack(track: AudioTrack): Promise<boolean> {
    if (!this.audioContext) {
      await this.initialize();
    }

    try {
      const response = await fetch(track.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      this.audioBuffers.set(track.id, audioBuffer);
      this.tracks.push(track);
      
      console.log('[MasterClock] Loaded track:', track.id, 'duration:', audioBuffer.duration);
      return true;
    } catch (error) {
      console.error('[MasterClock] Failed to load track:', track.id, error);
      return false;
    }
  }

  /**
   * Load multiple tracks
   */
  async loadTracks(tracks: AudioTrack[]): Promise<void> {
    await Promise.all(tracks.map(track => this.loadTrack(track)));
  }

  /**
   * Set track volume
   */
  setTrackVolume(trackId: string, volume: number): void {
    const gainNode = this.trackGains.get(trackId);
    if (gainNode && this.audioContext) {
      gainNode.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext.currentTime
      );
    }
  }

  /**
   * Mute/unmute a track type
   */
  muteTrackType(type: 'voice' | 'music' | 'sfx', muted: boolean): void {
    for (const track of this.tracks) {
      if (track.type === type) {
        this.setTrackVolume(track.id, muted ? 0 : track.volume);
      }
    }
  }

  /**
   * Schedule all tracks from a given time
   */
  private scheduleAllTracks(fromTime: number): void {
    if (!this.audioContext || !this.gainNode) return;

    for (const track of this.tracks) {
      const buffer = this.audioBuffers.get(track.id);
      if (!buffer) continue;

      // Calculate when this track should start
      const trackStart = track.startTime;
      const trackEnd = trackStart + track.duration;

      // Skip if track has already ended
      if (fromTime >= trackEnd) continue;

      // Create source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = this.playbackRate;

      // Create track gain
      const trackGain = this.audioContext.createGain();
      trackGain.gain.value = track.volume;
      this.trackGains.set(track.id, trackGain);

      // Connect: source -> trackGain -> masterGain -> destination
      source.connect(trackGain);
      trackGain.connect(this.gainNode);

      // Calculate offset and when to start
      let offset = 0;
      let when = 0;

      if (fromTime > trackStart) {
        // We're seeking into the middle of this track
        offset = fromTime - trackStart;
        when = 0;
      } else {
        // Track starts in the future
        offset = 0;
        when = (trackStart - fromTime) / this.playbackRate;
      }

      // Apply fade in
      if (track.fadeIn && offset === 0) {
        trackGain.gain.setValueAtTime(0, this.audioContext.currentTime + when);
        trackGain.gain.linearRampToValueAtTime(
          track.volume,
          this.audioContext.currentTime + when + track.fadeIn
        );
      }

      // Apply fade out
      if (track.fadeOut) {
        const fadeOutStart = (trackEnd - fromTime - track.fadeOut) / this.playbackRate;
        if (fadeOutStart > 0) {
          trackGain.gain.setValueAtTime(
            track.volume,
            this.audioContext.currentTime + fadeOutStart
          );
          trackGain.gain.linearRampToValueAtTime(
            0,
            this.audioContext.currentTime + fadeOutStart + track.fadeOut
          );
        }
      }

      // Schedule playback
      const duration = track.duration - offset;
      source.start(this.audioContext.currentTime + when, offset, duration);
      
      this.activeSources.set(track.id, source);
    }
  }

  /**
   * Stop all active audio sources
   */
  private stopAllSources(): void {
    for (const source of this.activeSources.values()) {
      try {
        source.stop();
      } catch (e) {
        // Source may have already stopped
      }
    }
    this.activeSources.clear();
    this.trackGains.clear();
  }

  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    const update = () => {
      if (!this.isPlaying) return;

      const time = this.getCurrentTime();
      this.callbacks.onTimeUpdate?.(time);

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Sync with a video element (for drift compensation)
   */
  syncWithVideo(videoElement: HTMLVideoElement): void {
    if (!this.isPlaying) return;

    const audioTime = this.getCurrentTime();
    const videoTime = videoElement.currentTime;
    const drift = Math.abs(audioTime - videoTime);

    // If drift exceeds 100ms, correct it
    if (drift > 0.1) {
      console.warn('[MasterClock] Drift detected:', drift.toFixed(3), 's');
      this.callbacks.onDriftDetected?.(drift);

      // Adjust video to match audio (audio is the master)
      videoElement.currentTime = audioTime;
    }

    this.lastVideoTime = videoTime;
  }

  /**
   * Get current state
   */
  getState(): ClockState {
    return {
      currentTime: this.getCurrentTime(),
      isPlaying: this.isPlaying,
      playbackRate: this.playbackRate,
      drift: 0,
      audioContextState: this.audioContext?.state || 'closed',
    };
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    this.stopUpdateLoop();
    this.stopAllSources();
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
    this.audioBuffers.clear();
    this.tracks = [];

    console.log('[MasterClock] Destroyed');
  }
}

// Singleton instance
let globalClock: WebAudioMasterClock | null = null;

/**
 * Get the global master clock instance
 */
export function getGlobalMasterClock(): WebAudioMasterClock {
  if (!globalClock) {
    globalClock = new WebAudioMasterClock();
  }
  return globalClock;
}

/**
 * Destroy the global clock
 */
export async function destroyGlobalMasterClock(): Promise<void> {
  if (globalClock) {
    await globalClock.destroy();
    globalClock = null;
  }
}
