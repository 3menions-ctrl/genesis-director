/**
 * useMultiTrackAudio Hook
 * 
 * React hook for the Multi-Track Audio Engine.
 * Provides state management and controls for voice, music, and SFX tracks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MultiTrackAudioEngine,
  MultiTrackState,
  AudioTrackType,
  getAudioEngine,
  disposeAudioEngine,
} from '@/lib/audioEngine/MultiTrackAudioEngine';

interface UseMultiTrackAudioReturn {
  // State
  state: MultiTrackState;
  isInitialized: boolean;
  
  // Playback controls
  play: (fromTime?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  
  // Track controls
  loadTrack: (type: AudioTrackType, url: string) => Promise<void>;
  setTrackVolume: (type: AudioTrackType, volume: number) => void;
  setTrackMuted: (type: AudioTrackType, muted: boolean) => void;
  setTrackSolo: (type: AudioTrackType, solo: boolean) => void;
  
  // Master controls
  setMasterVolume: (volume: number) => void;
  
  // Waveform
  getRealtimeWaveform: (type: AudioTrackType) => Float32Array | null;
  
  // Lifecycle
  initialize: () => Promise<void>;
  dispose: () => void;
}

const defaultState: MultiTrackState = {
  voice: {
    type: 'voice',
    url: null,
    volume: 0.8,
    muted: false,
    solo: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,
  },
  music: {
    type: 'music',
    url: null,
    volume: 0.5,
    muted: false,
    solo: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,
  },
  sfx: {
    type: 'sfx',
    url: null,
    volume: 0.8,
    muted: false,
    solo: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,
  },
  masterVolume: 0.8,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
};

export function useMultiTrackAudio(): UseMultiTrackAudioReturn {
  const engineRef = useRef<MultiTrackAudioEngine | null>(null);
  const [state, setState] = useState<MultiTrackState>(defaultState);
  const [isInitialized, setIsInitialized] = useState(false);
  const mountedRef = useRef(true);
  
  // Get or create engine instance
  const getEngine = useCallback((): MultiTrackAudioEngine => {
    if (!engineRef.current) {
      engineRef.current = getAudioEngine();
    }
    return engineRef.current;
  }, []);
  
  // Initialize audio context
  const initialize = useCallback(async () => {
    if (isInitialized) return;
    
    try {
      const engine = getEngine();
      await engine.initialize();
      
      // Set up state change callback
      engine.onStateChangeCallback((newState) => {
        if (mountedRef.current) {
          setState(newState);
        }
      });
      
      // Set up time update callback
      engine.onTimeUpdateCallback((currentTime) => {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, currentTime }));
        }
      });
      
      if (mountedRef.current) {
        setIsInitialized(true);
        setState(engine.getState());
      }
    } catch (error) {
      console.error('[useMultiTrackAudio] Failed to initialize:', error);
    }
  }, [isInitialized, getEngine]);
  
  // Load a track
  const loadTrack = useCallback(async (type: AudioTrackType, url: string) => {
    const engine = getEngine();
    if (!isInitialized) {
      await initialize();
    }
    await engine.loadTrack(type, url);
    if (mountedRef.current) {
      setState(engine.getState());
    }
  }, [getEngine, isInitialized, initialize]);
  
  // Playback controls
  const play = useCallback((fromTime?: number) => {
    const engine = getEngine();
    engine.play(fromTime ?? state.currentTime);
  }, [getEngine, state.currentTime]);
  
  const pause = useCallback(() => {
    getEngine().pause();
  }, [getEngine]);
  
  const stop = useCallback(() => {
    getEngine().stop();
  }, [getEngine]);
  
  const seek = useCallback((time: number) => {
    getEngine().seek(time);
  }, [getEngine]);
  
  // Track controls
  const setTrackVolume = useCallback((type: AudioTrackType, volume: number) => {
    getEngine().setTrackVolume(type, volume);
    setState(prev => ({
      ...prev,
      [type]: { ...prev[type], volume },
    }));
  }, [getEngine]);
  
  const setTrackMuted = useCallback((type: AudioTrackType, muted: boolean) => {
    getEngine().setTrackMuted(type, muted);
    setState(prev => ({
      ...prev,
      [type]: { ...prev[type], muted },
    }));
  }, [getEngine]);
  
  const setTrackSolo = useCallback((type: AudioTrackType, solo: boolean) => {
    getEngine().setTrackSolo(type, solo);
  }, [getEngine]);
  
  // Master controls
  const setMasterVolume = useCallback((volume: number) => {
    getEngine().setMasterVolume(volume);
    setState(prev => ({ ...prev, masterVolume: volume }));
  }, [getEngine]);
  
  // Waveform
  const getRealtimeWaveform = useCallback((type: AudioTrackType) => {
    return getEngine().getRealtimeWaveform(type);
  }, [getEngine]);
  
  // Dispose
  const dispose = useCallback(() => {
    disposeAudioEngine();
    engineRef.current = null;
    setIsInitialized(false);
    setState(defaultState);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return {
    state,
    isInitialized,
    play,
    pause,
    stop,
    seek,
    loadTrack,
    setTrackVolume,
    setTrackMuted,
    setTrackSolo,
    setMasterVolume,
    getRealtimeWaveform,
    initialize,
    dispose,
  };
}
