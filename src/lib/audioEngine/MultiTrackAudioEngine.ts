/**
 * Multi-Track Audio Engine v1.0
 * 
 * Professional-grade audio mixing engine with:
 * - Independent Voice, Music, and SFX tracks
 * - Per-track volume, mute, and solo controls
 * - Web Audio API with GainNodes for precise mixing
 * - Real-time waveform analysis
 * - Synchronized playback across all tracks
 */

export type AudioTrackType = 'voice' | 'music' | 'sfx';

export interface AudioTrackState {
  type: AudioTrackType;
  url: string | null;
  volume: number; // 0-1
  muted: boolean;
  solo: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  waveformData?: Float32Array;
}

export interface MultiTrackState {
  voice: AudioTrackState;
  music: AudioTrackState;
  sfx: AudioTrackState;
  masterVolume: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number; // Max duration across all tracks
}

interface AudioTrackNode {
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  gainNode: GainNode;
  analyser: AnalyserNode;
  startTime: number;
  pausedAt: number;
}

type TrackChangeCallback = (state: MultiTrackState) => void;
type TimeUpdateCallback = (currentTime: number) => void;
type WaveformCallback = (trackType: AudioTrackType, data: Float32Array) => void;

export class MultiTrackAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private tracks: Map<AudioTrackType, AudioTrackNode> = new Map();
  private trackStates: Map<AudioTrackType, AudioTrackState> = new Map();
  private masterVolume: number = 0.8;
  private isPlaying: boolean = false;
  private globalStartTime: number = 0;
  private globalPausedAt: number = 0;
  private timeUpdateInterval: number | null = null;
  
  // Callbacks
  private onStateChange: TrackChangeCallback | null = null;
  private onTimeUpdate: TimeUpdateCallback | null = null;
  private onWaveformUpdate: WaveformCallback | null = null;
  
  constructor() {
    this.initializeTrackStates();
  }
  
  private initializeTrackStates(): void {
    const defaultState = (type: AudioTrackType): AudioTrackState => ({
      type,
      url: null,
      volume: type === 'music' ? 0.5 : 0.8, // Music slightly lower by default
      muted: false,
      solo: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoading: false,
      error: null,
    });
    
    this.trackStates.set('voice', defaultState('voice'));
    this.trackStates.set('music', defaultState('music'));
    this.trackStates.set('sfx', defaultState('sfx'));
  }
  
  /**
   * Initialize the Web Audio API context
   * Must be called after user interaction (browser policy)
   */
  async initialize(): Promise<void> {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
      
      // Create track nodes
      for (const type of ['voice', 'music', 'sfx'] as AudioTrackType[]) {
        const gainNode = this.audioContext.createGain();
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        gainNode.connect(analyser);
        analyser.connect(this.masterGain);
        
        this.tracks.set(type, {
          source: null,
          buffer: null,
          gainNode,
          analyser,
          startTime: 0,
          pausedAt: 0,
        });
      }
      
      console.log('[MultiTrackAudioEngine] Initialized');
    } catch (error) {
      console.error('[MultiTrackAudioEngine] Failed to initialize:', error);
      throw error;
    }
  }
  
  /**
   * Load audio for a specific track
   */
  async loadTrack(type: AudioTrackType, url: string): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }
    
    const state = this.trackStates.get(type)!;
    this.updateTrackState(type, { isLoading: true, error: null, url });
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      const track = this.tracks.get(type)!;
      track.buffer = audioBuffer;
      
      // Generate waveform data
      const waveformData = this.generateWaveformData(audioBuffer);
      
      this.updateTrackState(type, {
        isLoading: false,
        duration: audioBuffer.duration,
        waveformData,
      });
      
      console.log(`[MultiTrackAudioEngine] Loaded ${type} track: ${audioBuffer.duration.toFixed(2)}s`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio';
      this.updateTrackState(type, { isLoading: false, error: errorMessage });
      console.error(`[MultiTrackAudioEngine] Error loading ${type}:`, error);
    }
  }
  
  /**
   * Generate waveform data for visualization
   */
  private generateWaveformData(buffer: AudioBuffer, samples: number = 200): Float32Array {
    const rawData = buffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const waveform = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      waveform[i] = sum / blockSize;
    }
    
    // Normalize
    const max = Math.max(...waveform);
    if (max > 0) {
      for (let i = 0; i < samples; i++) {
        waveform[i] /= max;
      }
    }
    
    return waveform;
  }
  
  /**
   * Play all loaded tracks synchronized
   */
  play(fromTime: number = 0): void {
    if (!this.audioContext) return;
    
    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Stop any existing playback
    this.stopAllSources();
    
    const now = this.audioContext.currentTime;
    this.globalStartTime = now - fromTime;
    
    // Check for solo tracks
    const soloTracks = Array.from(this.trackStates.values()).filter(s => s.solo);
    const hasSolo = soloTracks.length > 0;
    
    for (const [type, track] of this.tracks) {
      if (!track.buffer) continue;
      
      const state = this.trackStates.get(type)!;
      
      // Create new source
      const source = this.audioContext.createBufferSource();
      source.buffer = track.buffer;
      source.connect(track.gainNode);
      track.source = source;
      
      // Apply volume (considering mute and solo)
      const shouldPlay = !state.muted && (!hasSolo || state.solo);
      track.gainNode.gain.value = shouldPlay ? state.volume : 0;
      
      // Start playback
      const offset = Math.min(fromTime, track.buffer.duration);
      source.start(0, offset);
      
      this.updateTrackState(type, { isPlaying: true, currentTime: offset });
    }
    
    this.isPlaying = true;
    this.startTimeUpdates();
    this.notifyStateChange();
  }
  
  /**
   * Pause all tracks
   */
  pause(): void {
    if (!this.audioContext || !this.isPlaying) return;
    
    this.globalPausedAt = this.getCurrentTime();
    this.stopAllSources();
    
    for (const type of this.trackStates.keys()) {
      this.updateTrackState(type, { isPlaying: false });
    }
    
    this.isPlaying = false;
    this.stopTimeUpdates();
    this.notifyStateChange();
  }
  
  /**
   * Stop all tracks and reset to beginning
   */
  stop(): void {
    this.pause();
    this.globalPausedAt = 0;
    
    for (const type of this.trackStates.keys()) {
      this.updateTrackState(type, { currentTime: 0 });
    }
    
    this.notifyStateChange();
  }
  
  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.stopAllSources();
    }
    
    this.globalPausedAt = Math.max(0, time);
    
    for (const type of this.trackStates.keys()) {
      this.updateTrackState(type, { currentTime: time });
    }
    
    if (wasPlaying) {
      this.play(time);
    } else {
      this.notifyStateChange();
    }
  }
  
  /**
   * Set volume for a specific track
   */
  setTrackVolume(type: AudioTrackType, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const track = this.tracks.get(type);
    const state = this.trackStates.get(type)!;
    
    if (track && !state.muted) {
      track.gainNode.gain.value = clampedVolume;
    }
    
    this.updateTrackState(type, { volume: clampedVolume });
  }
  
  /**
   * Mute/unmute a specific track
   */
  setTrackMuted(type: AudioTrackType, muted: boolean): void {
    const track = this.tracks.get(type);
    const state = this.trackStates.get(type)!;
    
    if (track) {
      track.gainNode.gain.value = muted ? 0 : state.volume;
    }
    
    this.updateTrackState(type, { muted });
  }
  
  /**
   * Solo a specific track (mutes all others)
   */
  setTrackSolo(type: AudioTrackType, solo: boolean): void {
    this.updateTrackState(type, { solo });
    
    // Recalculate all track volumes based on solo state
    const soloTracks = Array.from(this.trackStates.values()).filter(s => s.solo);
    const hasSolo = soloTracks.length > 0;
    
    for (const [trackType, track] of this.tracks) {
      const state = this.trackStates.get(trackType)!;
      const shouldPlay = !state.muted && (!hasSolo || state.solo);
      track.gainNode.gain.value = shouldPlay ? state.volume : 0;
    }
    
    this.notifyStateChange();
  }
  
  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
    this.notifyStateChange();
  }
  
  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return this.globalPausedAt;
    }
    return this.audioContext.currentTime - this.globalStartTime;
  }
  
  /**
   * Get max duration across all tracks
   */
  getMaxDuration(): number {
    let maxDuration = 0;
    for (const state of this.trackStates.values()) {
      if (state.duration > maxDuration) {
        maxDuration = state.duration;
      }
    }
    return maxDuration;
  }
  
  /**
   * Get real-time waveform data for visualization
   */
  getRealtimeWaveform(type: AudioTrackType): Float32Array | null {
    const track = this.tracks.get(type);
    if (!track) return null;
    
    const bufferLength = track.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    track.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }
  
  /**
   * Get complete state for all tracks
   */
  getState(): MultiTrackState {
    return {
      voice: { ...this.trackStates.get('voice')! },
      music: { ...this.trackStates.get('music')! },
      sfx: { ...this.trackStates.get('sfx')! },
      masterVolume: this.masterVolume,
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getMaxDuration(),
    };
  }
  
  // ========== Event Handlers ==========
  
  onStateChangeCallback(callback: TrackChangeCallback): void {
    this.onStateChange = callback;
  }
  
  onTimeUpdateCallback(callback: TimeUpdateCallback): void {
    this.onTimeUpdate = callback;
  }
  
  onWaveformUpdateCallback(callback: WaveformCallback): void {
    this.onWaveformUpdate = callback;
  }
  
  // ========== Private Methods ==========
  
  private updateTrackState(type: AudioTrackType, updates: Partial<AudioTrackState>): void {
    const current = this.trackStates.get(type)!;
    this.trackStates.set(type, { ...current, ...updates });
  }
  
  private stopAllSources(): void {
    for (const track of this.tracks.values()) {
      if (track.source) {
        try {
          track.source.stop();
        } catch (e) {
          // Ignore - source may already be stopped
        }
        track.source.disconnect();
        track.source = null;
      }
    }
  }
  
  private startTimeUpdates(): void {
    this.stopTimeUpdates();
    
    this.timeUpdateInterval = window.setInterval(() => {
      const currentTime = this.getCurrentTime();
      const maxDuration = this.getMaxDuration();
      
      // Update track states
      for (const type of this.trackStates.keys()) {
        this.updateTrackState(type, { currentTime });
      }
      
      // Notify listeners
      if (this.onTimeUpdate) {
        this.onTimeUpdate(currentTime);
      }
      
      // Send waveform updates
      if (this.onWaveformUpdate) {
        for (const type of ['voice', 'music', 'sfx'] as AudioTrackType[]) {
          const waveform = this.getRealtimeWaveform(type);
          if (waveform) {
            this.onWaveformUpdate(type, waveform);
          }
        }
      }
      
      // Auto-stop at end
      if (currentTime >= maxDuration) {
        this.stop();
      }
    }, 50); // 20fps updates
  }
  
  private stopTimeUpdates(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
  
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
  
  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.stop();
    this.stopTimeUpdates();
    
    for (const track of this.tracks.values()) {
      track.gainNode.disconnect();
      track.analyser.disconnect();
    }
    
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.tracks.clear();
    console.log('[MultiTrackAudioEngine] Disposed');
  }
}

// Singleton instance
let engineInstance: MultiTrackAudioEngine | null = null;

export function getAudioEngine(): MultiTrackAudioEngine {
  if (!engineInstance) {
    engineInstance = new MultiTrackAudioEngine();
  }
  return engineInstance;
}

export function disposeAudioEngine(): void {
  if (engineInstance) {
    engineInstance.dispose();
    engineInstance = null;
  }
}
