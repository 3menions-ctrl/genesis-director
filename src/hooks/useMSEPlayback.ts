/**
 * useMSEPlayback - Hook to integrate MSE gapless engine with legacy fallback
 * 
 * Provides a unified API for video playback that automatically uses
 * MSE when supported, with fallback to dual-video element switching.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MSEGaplessEngine,
  createMSEEngine,
  detectMSESupport,
  type MSEClip,
  type MSEEngineState,
} from '@/lib/videoEngine/MSEGaplessEngine';
import { BlobPreloadCache } from '@/lib/videoEngine/BlobPreloadCache';
import { safePlay, safePause, safeSeek, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';

export interface MSEPlaybackConfig {
  clips: string[];
  durations?: number[];
  autoPlay?: boolean;
  onClipChange?: (index: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  debug?: boolean;
}

export interface MSEPlaybackState {
  status: 'idle' | 'loading' | 'initializing' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
  currentClipIndex: number;
  currentTime: number;
  totalDuration: number;
  bufferedPercent: number;
  loadedClips: number;
  totalClips: number;
  errorMessage: string | null;
  isMSESupported: boolean;
  usingFallback: boolean;
}

export interface MSEPlaybackControls {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  seekToClip: (index: number) => void;
  setMuted: (muted: boolean) => void;
  retry: () => void;
}

export interface UseMSEPlaybackResult {
  /** Current playback state */
  state: MSEPlaybackState;
  /** Playback control methods */
  controls: MSEPlaybackControls;
  /** Whether using MSE engine (true) or legacy fallback (false) */
  isMSEActive: boolean;
  /** Reference to attach to MSE video element */
  mseVideoRef: React.RefObject<HTMLVideoElement>;
  /** References for legacy fallback dual-video elements */
  fallbackVideoARef: React.RefObject<HTMLVideoElement>;
  fallbackVideoBRef: React.RefObject<HTMLVideoElement>;
  /** Which fallback video is currently active (0 or 1) */
  activeFallbackIndex: number;
  /** Fallback video opacities for crossfade */
  fallbackOpacities: { a: number; b: number };
  /** Whether currently crossfading in fallback mode */
  isCrossfading: boolean;
  /** Trigger fallback crossfade transition */
  triggerFallbackTransition: () => void;
}

const DEFAULT_STATE: MSEPlaybackState = {
  status: 'idle',
  currentClipIndex: 0,
  currentTime: 0,
  totalDuration: 0,
  bufferedPercent: 0,
  loadedClips: 0,
  totalClips: 0,
  errorMessage: null,
  isMSESupported: false,
  usingFallback: false,
};

// TRUE OVERLAP TRANSITION SYSTEM
const CROSSFADE_OVERLAP_MS = 30;
const CROSSFADE_FADEOUT_MS = 30;
const TRANSITION_TRIGGER_OFFSET = 0.15;

export function useMSEPlayback(config: MSEPlaybackConfig): UseMSEPlaybackResult {
  const { clips, durations, autoPlay = false, onClipChange, onEnded, onError, debug = false } = config;

  // Refs
  const mseVideoRef = useRef<HTMLVideoElement>(null);
  const fallbackVideoARef = useRef<HTMLVideoElement>(null);
  const fallbackVideoBRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<MSEGaplessEngine | null>(null);
  const blobCacheRef = useRef<BlobPreloadCache | null>(null);
  const isTransitioningRef = useRef(false);
  const initializedRef = useRef(false);

  // State
  const [state, setState] = useState<MSEPlaybackState>({ ...DEFAULT_STATE, totalClips: clips.length });
  const [isMSEActive, setIsMSEActive] = useState(false);
  const [activeFallbackIndex, setActiveFallbackIndex] = useState<0 | 1>(0);
  const [fallbackOpacities, setFallbackOpacities] = useState({ a: 1, b: 0 });
  const [isCrossfading, setIsCrossfading] = useState(false);

  // Detect MSE support
  const mseSupport = detectMSESupport();

  // Log helper
  const log = useCallback((...args: unknown[]) => {
    if (debug) console.log('[useMSEPlayback]', ...args);
  }, [debug]);

  // Initialize engine
  useEffect(() => {
    if (clips.length === 0 || initializedRef.current) return;

    const init = async () => {
      initializedRef.current = true;
      setState(prev => ({ ...prev, status: 'loading', totalClips: clips.length }));

      // Try MSE first
      if (mseSupport.supported && mseVideoRef.current) {
        log('Initializing MSE engine');
        try {
          const mseClips: MSEClip[] = clips.map((url, index) => ({
            url,
            duration: durations?.[index] ?? 5,
            index,
          }));

          const { engine, useFallback } = await createMSEEngine(mseVideoRef.current, mseClips, {
            onStateChange: (engineState: MSEEngineState) => {
              setState(prev => ({
                ...prev,
                status: engineState.status,
                currentClipIndex: engineState.currentClipIndex,
                currentTime: engineState.currentTime,
                totalDuration: engineState.totalDuration,
                bufferedPercent: engineState.bufferedPercent,
                loadedClips: engineState.loadedClips,
                errorMessage: engineState.errorMessage,
                isMSESupported: true,
                usingFallback: engineState.usingFallback,
              }));
            },
            onClipChange: (index) => {
              log('MSE clip changed:', index);
              onClipChange?.(index);
            },
            onEnded: () => {
              log('MSE playback ended');
              onEnded?.();
            },
            onError: (error) => {
              log('MSE error:', error);
              onError?.(error);
            },
          });

          engineRef.current = engine;

          if (useFallback) {
            log('MSE failed, switching to fallback');
            setIsMSEActive(false);
            await initFallback();
          } else {
            setIsMSEActive(true);
            if (autoPlay) {
              await engine.play();
            }
          }
        } catch (error) {
          log('MSE init failed, using fallback:', error);
          setIsMSEActive(false);
          await initFallback();
        }
      } else {
        log('MSE not supported, using fallback');
        await initFallback();
      }
    };

    const initFallback = async () => {
      log('Initializing fallback mode');
      blobCacheRef.current = new BlobPreloadCache({ debug });

      try {
        // Preload clips
        await blobCacheRef.current.preloadAhead(clips, 0, (index, progress) => {
          setState(prev => ({
            ...prev,
            loadedClips: index + 1,
            bufferedPercent: progress.percentComplete,
          }));
        });

        // Calculate total duration
        let totalDuration = 0;
        const loadedDurations: number[] = [];

        for (let i = 0; i < clips.length; i++) {
          const cached = blobCacheRef.current.peek(clips[i]);
          if (cached) {
            loadedDurations.push(cached.duration);
            totalDuration += cached.duration;
          } else {
            loadedDurations.push(durations?.[i] ?? 5);
            totalDuration += durations?.[i] ?? 5;
          }
        }

        // Set first clip
        const videoA = fallbackVideoARef.current;
        if (videoA && clips[0]) {
          const first = blobCacheRef.current.peek(clips[0]);
          if (first) {
            videoA.src = first.blobUrl;
            videoA.load();
          }
        }

        // Preload second clip
        const videoB = fallbackVideoBRef.current;
        if (videoB && clips[1]) {
          const second = blobCacheRef.current.peek(clips[1]);
          if (second) {
            videoB.src = second.blobUrl;
            videoB.load();
          }
        }

        setState(prev => ({
          ...prev,
          status: 'ready',
          totalDuration,
          loadedClips: clips.length,
          usingFallback: true,
        }));

        if (autoPlay && videoA) {
          videoA.play().catch(() => {});
          setState(prev => ({ ...prev, status: 'playing' }));
        }
      } catch (err) {
        log('Fallback init failed:', err);
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Failed to load clips',
        }));
        onError?.(err instanceof Error ? err : new Error('Fallback init failed'));
      }
    };

    init();

    return () => {
      engineRef.current?.destroy();
      blobCacheRef.current?.destroy();
    };
  }, [clips.join(',')]); // Only reinit when clips change

  // Fallback transition handler
  const triggerFallbackTransition = useCallback(() => {
    if (isMSEActive || isTransitioningRef.current || isCrossfading) return;
    if (state.currentClipIndex >= clips.length - 1) return;

    isTransitioningRef.current = true;
    setIsCrossfading(true);

    const nextIndex = state.currentClipIndex + 1;
    const currentActiveIndex = activeFallbackIndex;
    const activeVideo = currentActiveIndex === 0 ? fallbackVideoARef.current : fallbackVideoBRef.current;
    const standbyVideo = currentActiveIndex === 0 ? fallbackVideoBRef.current : fallbackVideoARef.current;

    log('Fallback transition to clip', nextIndex);

    if (standbyVideo && standbyVideo.readyState >= 2) {
      safeSeek(standbyVideo, 0);
      safePlay(standbyVideo);

      // Phase 1: True overlap
      if (currentActiveIndex === 0) {
        setFallbackOpacities(prev => ({ ...prev, b: 1 }));
      } else {
        setFallbackOpacities(prev => ({ ...prev, a: 1 }));
      }

      // Phase 2: Fade out after overlap
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (currentActiveIndex === 0) {
              setFallbackOpacities(prev => ({ ...prev, a: 0 }));
            } else {
              setFallbackOpacities(prev => ({ ...prev, b: 0 }));
            }

            setActiveFallbackIndex(currentActiveIndex === 0 ? 1 : 0);
            setState(prev => ({ ...prev, currentClipIndex: nextIndex }));
            onClipChange?.(nextIndex);

          setTimeout(() => {
            if (activeVideo) safePause(activeVideo);
            setIsCrossfading(false);

              // Preload next clip
              const futureIndex = nextIndex + 1;
              if (activeVideo && futureIndex < clips.length && blobCacheRef.current) {
                const future = blobCacheRef.current.peek(clips[futureIndex]);
                if (future) {
                  activeVideo.src = future.blobUrl;
                  activeVideo.load();
                }
              }

              isTransitioningRef.current = false;
            }, CROSSFADE_FADEOUT_MS + 20);
          }, CROSSFADE_OVERLAP_MS);
        });
      });
    } else {
      // Force load standby and retry
      log('Standby not ready, force loading');
      if (standbyVideo && clips[nextIndex] && blobCacheRef.current) {
        const clip = blobCacheRef.current.peek(clips[nextIndex]);
        if (clip) {
          standbyVideo.src = clip.blobUrl;
          standbyVideo.load();
        }
      }
      setTimeout(() => {
        isTransitioningRef.current = false;
        setIsCrossfading(false);
      }, 100);
    }
  }, [isMSEActive, state.currentClipIndex, clips.length, activeFallbackIndex, isCrossfading, onClipChange, clips, log]);

  // Controls - HARDENED with try-catch wrappers
  const controls: MSEPlaybackControls = {
    play: async () => {
      try {
        if (isMSEActive && engineRef.current) {
          await engineRef.current.play();
        } else {
          const video = activeFallbackIndex === 0 ? fallbackVideoARef.current : fallbackVideoBRef.current;
          if (video && video.readyState >= 1) {
            await safePlay(video);
          }
        }
        setState(prev => ({ ...prev, status: 'playing' }));
      } catch {
        // Silently handle play errors
      }
    },

    pause: () => {
      try {
        if (isMSEActive && engineRef.current) {
          engineRef.current.pause();
        } else {
          const video = activeFallbackIndex === 0 ? fallbackVideoARef.current : fallbackVideoBRef.current;
          if (video) safePause(video);
        }
        setState(prev => ({ ...prev, status: 'paused' }));
      } catch {
        // Silently handle pause errors
      }
    },

    seek: (time: number) => {
      if (isMSEActive && engineRef.current) {
        engineRef.current.seek(time);
      }
      // Fallback seek is more complex - would need to calculate clip boundaries
    },

    seekToClip: (index: number) => {
      try {
        if (isMSEActive && engineRef.current) {
          engineRef.current.seekToClip(index);
        } else {
          // For fallback, directly set the clip
          setState(prev => ({ ...prev, currentClipIndex: index }));
          const video = activeFallbackIndex === 0 ? fallbackVideoARef.current : fallbackVideoBRef.current;
          if (video && blobCacheRef.current && clips[index]) {
            const clip = blobCacheRef.current.peek(clips[index]);
            if (clip) {
              video.src = clip.blobUrl;
              // Only seek if video has valid state
              if (video.readyState >= 1) {
                safeSeek(video, 0);
              }
              video.load();
              safePlay(video);
            }
          }
          onClipChange?.(index);
        }
      } catch {
        // Silently handle seek errors
      }
    },

    setMuted: (muted: boolean) => {
      if (isMSEActive && engineRef.current) {
        engineRef.current.setMuted(muted);
      } else {
        if (fallbackVideoARef.current) fallbackVideoARef.current.muted = muted;
        if (fallbackVideoBRef.current) fallbackVideoBRef.current.muted = muted;
      }
    },

    retry: () => {
      initializedRef.current = false;
      engineRef.current?.destroy();
      blobCacheRef.current?.destroy();
      engineRef.current = null;
      blobCacheRef.current = null;
      setState({ ...DEFAULT_STATE, totalClips: clips.length });
    },
  };

  return {
    state,
    controls,
    isMSEActive,
    mseVideoRef,
    fallbackVideoARef,
    fallbackVideoBRef,
    activeFallbackIndex,
    fallbackOpacities,
    isCrossfading,
    triggerFallbackTransition,
  };
}
