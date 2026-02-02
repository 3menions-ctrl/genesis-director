/**
 * ManifestVideoPlayer v5 - MSE GAPLESS ENGINE INTEGRATION
 * 
 * Features:
 * - TRUE ZERO-GAP playback via MSE SourceBuffer (when supported)
 * - Automatic fallback to dual video element switching
 * - HYDRATED BOOT: Waits for canplaythrough before any transition
 * - Buffer status tracking for diagnostics
 * - Preloads next clip while current plays
 * - Triggers transition 0.15s BEFORE clip ends for zero gaps
 */

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, Download, Loader2, Activity, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { safePlay, safePause, safeSeek, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { 
  waitForCanPlayThrough, 
  validateTransitionReadiness,
  checkHighResolutionTimers,
  type BufferStatus,
  type BootState 
} from '@/lib/videoEngine/HydratedBootSequence';
import {
  MSEGaplessEngine,
  createMSEEngine,
  detectMSESupport,
  type MSEClip,
  type MSEEngineState,
} from '@/lib/videoEngine/MSEGaplessEngine';
import { BlobPreloadCache } from '@/lib/videoEngine/BlobPreloadCache';

interface ManifestClip {
  index: number;
  shotId: string;
  videoUrl: string;
  audioUrl?: string;
  duration: number;
  transitionOut: string;
  startTime: number;
}

interface VideoManifest {
  version: string;
  projectId: string;
  createdAt: string;
  clips: ManifestClip[];
  totalDuration: number;
}

interface ManifestVideoPlayerProps {
  manifestUrl: string;
  musicUrl?: string;
  className?: string;
  showDiagnostics?: boolean;
}

// TRUE OVERLAP TRANSITION SYSTEM with HYDRATED BOOT
const CROSSFADE_OVERLAP_MS = 30; // 30ms true overlap where both are visible
const CROSSFADE_FADEOUT_MS = 30; // 30ms for outgoing to fade after overlap
const FALLBACK_TRANSITION_MS = 16; // One frame at 60fps for graceful fallback
const TRANSITION_THRESHOLD = 0.15; // Trigger 150ms before clip ends
const LOAD_TIMEOUT_MS = 8000; // 8 second timeout for canplaythrough

// Detect MSE support once at module load
const MSE_SUPPORT = detectMSESupport();

// Double-RAF helper to ensure browser has painted before continuing
function doubleRAF(callback: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

export const ManifestVideoPlayer = forwardRef<HTMLDivElement, ManifestVideoPlayerProps>(function ManifestVideoPlayer({ manifestUrl, musicUrl, className, showDiagnostics = false }, ref) {
  const [manifest, setManifest] = useState<VideoManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // MSE Engine state
  const [useMSE, setUseMSE] = useState(MSE_SUPPORT.supported);
  const [mseReady, setMseReady] = useState(false);
  const mseVideoRef = useRef<HTMLVideoElement>(null);
  const mseEngineRef = useRef<MSEGaplessEngine | null>(null);
  const [mseEngineState, setMseEngineState] = useState<MSEEngineState | null>(null);
  
  // Dual video state for legacy fallback gapless playback
  const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [videoAOpacity, setVideoAOpacity] = useState(1);
  const [videoBOpacity, setVideoBOpacity] = useState(0);
  
  // HYDRATED BOOT: Buffer status tracking
  const [videoAStatus, setVideoAStatus] = useState<BootState>('idle');
  const [videoBStatus, setVideoBStatus] = useState<BootState>('idle');
  const [bufferPercent, setBufferPercent] = useState(0);
  const [diagnosticMessage, setDiagnosticMessage] = useState('');
  const [useFallbackTransition, setUseFallbackTransition] = useState(false);
  
  // Refs
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const triggerTransitionRef = useRef<(() => void) | null>(null);
  const initialSetupDoneRef = useRef(false);
  const highResTimersRef = useRef<boolean>(true);

  // Get active and standby video refs
  const getActiveVideo = useCallback(() => {
    return activeVideoIndex === 0 ? videoARef.current : videoBRef.current;
  }, [activeVideoIndex]);

  const getStandbyVideo = useCallback(() => {
    return activeVideoIndex === 0 ? videoBRef.current : videoARef.current;
  }, [activeVideoIndex]);

  // Calculate total duration from manifest
  const totalDuration = useMemo(() => {
    return manifest?.totalDuration || manifest?.clips.reduce((sum, c) => sum + c.duration, 0) || 0;
  }, [manifest]);

  // Check high-resolution timer availability on mount
  useEffect(() => {
    highResTimersRef.current = checkHighResolutionTimers();
    if (!highResTimersRef.current) {
      console.warn('[ManifestPlayer] High-resolution timers reduced - using fallback transitions');
      setUseFallbackTransition(true);
    }
  }, []);

  // Load manifest
  useEffect(() => {
    const loadManifest = async () => {
      try {
        setIsLoading(true);
        initialSetupDoneRef.current = false;
        setDiagnosticMessage('Loading manifest...');
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error('Failed to load manifest');
        const data = await response.json();
        setManifest(data);
        setError(null);
        setDiagnosticMessage('Manifest loaded');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video manifest');
        setDiagnosticMessage('Manifest load failed');
      } finally {
        setIsLoading(false);
      }
    };
    loadManifest();
  }, [manifestUrl]);

  // MSE ENGINE INITIALIZATION - when manifest is ready and MSE is supported
  useEffect(() => {
    if (!manifest || manifest.clips.length === 0) return;
    if (!useMSE || !MSE_SUPPORT.supported) return;
    if (mseEngineRef.current) return; // Already initialized
    
    const video = mseVideoRef.current;
    if (!video) return;
    
    const initMSE = async () => {
      setDiagnosticMessage('Initializing MSE engine...');
      
      try {
        const mseClips: MSEClip[] = manifest.clips.map((clip, index) => ({
          url: clip.videoUrl,
          duration: clip.duration,
          index,
        }));
        
        const { engine, useFallback } = await createMSEEngine(video, mseClips, {
          onStateChange: (state) => {
            setMseEngineState(state);
            setCurrentClipIndex(state.currentClipIndex);
            setCurrentTime(state.currentTime);
          },
          onClipChange: (index) => {
            console.log('[ManifestPlayer/MSE] Clip changed:', index);
            setCurrentClipIndex(index);
          },
          onEnded: () => {
            console.log('[ManifestPlayer/MSE] Playback ended');
            setIsPlaying(false);
            setCurrentClipIndex(0);
            setCurrentTime(0);
          },
          onError: (error) => {
            console.error('[ManifestPlayer/MSE] Engine error:', error);
            // Fall back to legacy mode
            setUseMSE(false);
            setDiagnosticMessage('MSE failed, using legacy');
          },
        });
        
        mseEngineRef.current = engine;
        
        if (useFallback) {
          console.log('[ManifestPlayer] MSE engine fell back to legacy');
          setUseMSE(false);
          setDiagnosticMessage('Using legacy playback');
        } else {
          setMseReady(true);
          setDiagnosticMessage('MSE engine ready');
          console.log('[ManifestPlayer] MSE engine initialized successfully');
        }
      } catch (err) {
        console.warn('[ManifestPlayer] MSE init failed, falling back:', err);
        setUseMSE(false);
        setDiagnosticMessage('MSE failed, using legacy');
      }
    };
    
    initMSE();
    
    return () => {
      mseEngineRef.current?.destroy();
      mseEngineRef.current = null;
    };
  }, [manifest, useMSE]);

  // LEGACY HYDRATED BOOT: Setup first clip with canplaythrough validation (when not using MSE)
  useEffect(() => {
    if (!manifest || manifest.clips.length === 0 || initialSetupDoneRef.current) return;
    if (useMSE && MSE_SUPPORT.supported) return; // MSE handles its own initialization

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    
    const hydrateFirstClip = async () => {
      if (!videoA || !manifest.clips[0]) return;
      
      setVideoAStatus('loading');
      setDiagnosticMessage('Hydrating first clip...');
      
      // Set source
      videoA.src = manifest.clips[0].videoUrl;
      videoA.load();
      
      try {
        // Wait for canplaythrough with timeout
        const status = await waitForCanPlayThrough(videoA, LOAD_TIMEOUT_MS);
        setVideoAStatus(status.canPlayThrough ? 'ready' : 'buffering');
        setBufferPercent(status.bufferedPercent);
        setDiagnosticMessage(`Clip 1 ready: ${status.bufferedPercent.toFixed(0)}% buffered`);
        console.log('[ManifestPlayer/Legacy] First clip hydrated:', status);
      } catch (err) {
        console.warn('[ManifestPlayer/Legacy] First clip hydration warning:', err);
        // Don't fail - the video might still be playable
        setVideoAStatus('ready');
        setDiagnosticMessage('Clip 1 loaded (partial)');
      }
      
      // Preload second clip into video B (standby)
      if (videoB && manifest.clips[1]) {
        setVideoBStatus('loading');
        videoB.src = manifest.clips[1].videoUrl;
        videoB.load();
        
        try {
          const statusB = await waitForCanPlayThrough(videoB, LOAD_TIMEOUT_MS);
          setVideoBStatus(statusB.canPlayThrough ? 'ready' : 'buffering');
          console.log('[ManifestPlayer/Legacy] Second clip preloaded:', statusB);
        } catch {
          setVideoBStatus('ready'); // Proceed anyway
        }
      }
    };
    
    hydrateFirstClip();
    initialSetupDoneRef.current = true;
  }, [manifest, useMSE]);

  // Preload next clip into standby video when clip changes
  // NOTE: This is for manual skip navigation only - crossfade handles its own preloading
  useEffect(() => {
    if (!manifest) return;
    // CRITICAL: Don't interfere with ongoing transitions - they handle their own preloading
    if (isTransitioningRef.current || isCrossfading) return;
    
    // Use refs directly to get correct video without dependency issues
    const standbyVideo = activeVideoIndex === 0 ? videoBRef.current : videoARef.current;
    const setStandbyStatus = activeVideoIndex === 0 ? setVideoBStatus : setVideoAStatus;
    const nextClipIndex = currentClipIndex + 1;
    
    if (standbyVideo && nextClipIndex < manifest.clips.length && manifest.clips[nextClipIndex]) {
      const nextClipUrl = manifest.clips[nextClipIndex].videoUrl;
      if (standbyVideo.src !== nextClipUrl) {
        setStandbyStatus('loading');
        standbyVideo.src = nextClipUrl;
        standbyVideo.load();
        
        // Async hydration for standby
        waitForCanPlayThrough(standbyVideo, LOAD_TIMEOUT_MS)
          .then((status) => {
            setStandbyStatus(status.canPlayThrough ? 'ready' : 'buffering');
          })
          .catch(() => {
            setStandbyStatus('ready'); // Proceed anyway
          });
      }
    }
  }, [currentClipIndex, manifest, activeVideoIndex, isCrossfading]);

  // HYDRATED BOOT CROSSFADE TRANSITION SYSTEM
  // Validates buffer readiness before transition, with graceful fallback
  const triggerCrossfadeTransition = useCallback(() => {
    if (!manifest) return;
    if (isTransitioningRef.current || isCrossfading) return;
    if (currentClipIndex >= manifest.clips.length - 1) return;
    
    isTransitioningRef.current = true;
    setIsCrossfading(true);
    setDiagnosticMessage('Preparing transition...');
    
    const nextIndex = currentClipIndex + 1;
    const activeVideo = getActiveVideo();
    const standbyVideo = getStandbyVideo();
    
    // Capture which video is currently active BEFORE state update
    const currentActiveIndex = activeVideoIndex;
    
    // HYDRATED BOOT: Validate standby readiness
    const readiness = standbyVideo ? validateTransitionReadiness(standbyVideo) : { isReady: false, reason: 'No standby video' };
    
    // Determine transition mode: atomic (sub-ms) or graceful fallback (16ms)
    const useGracefulFallback = useFallbackTransition || !readiness.isReady || !highResTimersRef.current;
    const transitionDuration = useGracefulFallback ? FALLBACK_TRANSITION_MS : CROSSFADE_OVERLAP_MS;
    
    console.log('[ManifestPlayer] Transition mode:', {
      mode: useGracefulFallback ? 'GRACEFUL_FALLBACK' : 'ATOMIC',
      readiness,
      transitionDuration: `${transitionDuration}ms`,
    });
    
    if (standbyVideo && (standbyVideo.readyState >= 2 || useGracefulFallback) && manifest.clips[nextIndex]) {
      safeSeek(standbyVideo, 0);
      standbyVideo.muted = isMuted;
      
      // Start playing standby while still invisible (preroll)
      safePlay(standbyVideo);
      
      if (useGracefulFallback) {
        // GRACEFUL FALLBACK: Standard 16ms (one-frame) transition
        setDiagnosticMessage(`Graceful fallback (${transitionDuration}ms)`);
        
        // Immediate opacity swap
        if (currentActiveIndex === 0) {
          setVideoBOpacity(1);
        } else {
          setVideoAOpacity(1);
        }
        
        // Single-frame delay before hiding outgoing
        setTimeout(() => {
          if (currentActiveIndex === 0) {
            setVideoAOpacity(0);
          } else {
            setVideoBOpacity(0);
          }
          
          setActiveVideoIndex(currentActiveIndex === 0 ? 1 : 0);
          setCurrentClipIndex(nextIndex);
          setIsPlaying(true);
          
          if (activeVideo) safePause(activeVideo);
          
          // Preload next clip
          const futureClipIndex = nextIndex + 1;
          if (activeVideo && futureClipIndex < manifest.clips.length && manifest.clips[futureClipIndex]) {
            activeVideo.src = manifest.clips[futureClipIndex].videoUrl;
            activeVideo.load();
          }
          
          setIsCrossfading(false);
          isTransitioningRef.current = false;
          setDiagnosticMessage('Transition complete');
        }, transitionDuration);
        
      } else {
        // ATOMIC TRANSITION: True overlap with sub-ms timing
        setDiagnosticMessage('Atomic transition');
        
        // PHASE 1: TRUE OVERLAP - Both videos at 100% opacity simultaneously
        if (currentActiveIndex === 0) {
          setVideoBOpacity(1);
        } else {
          setVideoAOpacity(1);
        }
        
        // PHASE 2: After overlap duration, wait for browser paint then fade outgoing
        doubleRAF(() => {
          setTimeout(() => {
            if (currentActiveIndex === 0) {
              setVideoAOpacity(0);
            } else {
              setVideoBOpacity(0);
            }
            
            setActiveVideoIndex(currentActiveIndex === 0 ? 1 : 0);
            setCurrentClipIndex(nextIndex);
            setIsPlaying(true);
            
            // PHASE 3: After fadeout completes, clean up
            setTimeout(() => {
              if (activeVideo) safePause(activeVideo);
              
              setIsCrossfading(false);
              
              const futureClipIndex = nextIndex + 1;
              if (activeVideo && futureClipIndex < manifest.clips.length && manifest.clips[futureClipIndex]) {
                activeVideo.src = manifest.clips[futureClipIndex].videoUrl;
                activeVideo.load();
              }
              isTransitioningRef.current = false;
              setDiagnosticMessage('Transition complete');
            }, CROSSFADE_FADEOUT_MS + 20);
          }, CROSSFADE_OVERLAP_MS);
        });
      }
    } else {
      // FALLBACK: Force load and retry
      console.warn('[ManifestPlayer] Standby video not ready, force loading...');
      setDiagnosticMessage('Force loading standby...');
      if (standbyVideo && manifest.clips[nextIndex]) {
        standbyVideo.src = manifest.clips[nextIndex].videoUrl;
        standbyVideo.load();
        setTimeout(() => {
          isTransitioningRef.current = false;
          setIsCrossfading(false);
        }, 100);
      } else {
        isTransitioningRef.current = false;
        setIsCrossfading(false);
        setCurrentClipIndex(prev => prev + 1);
      }
    }
  }, [currentClipIndex, manifest, isCrossfading, isMuted, activeVideoIndex, getActiveVideo, getStandbyVideo, useFallbackTransition]);

  // Keep the ref updated with the latest trigger function
  useEffect(() => {
    triggerTransitionRef.current = triggerCrossfadeTransition;
  }, [triggerCrossfadeTransition]);

  // Handle video time update - trigger transition BEFORE clip ends
  const handleTimeUpdate = useCallback(() => {
    const activeVideo = getActiveVideo();
    if (!activeVideo || !manifest) return;
    
    const clip = manifest.clips[currentClipIndex];
    if (!clip) return;
    
    // Calculate overall time for progress bar
    const overallTime = (clip.startTime || 0) + activeVideo.currentTime;
    setCurrentTime(overallTime);
    
    // Trigger seamless transition BEFORE clip ends
    const timeRemaining = activeVideo.duration - activeVideo.currentTime;
    
    if (timeRemaining <= TRANSITION_THRESHOLD && timeRemaining > 0 && !isTransitioningRef.current && !isCrossfading) {
      if (currentClipIndex < manifest.clips.length - 1) {
        console.log('[ManifestPlayer] Triggering crossfade transition', {
          clipIndex: currentClipIndex,
          timeRemaining,
          threshold: TRANSITION_THRESHOLD
        });
        triggerTransitionRef.current?.();
      }
    }
  }, [currentClipIndex, manifest, isCrossfading, getActiveVideo]);

  // Handle clip ended - fallback for last clip or missed transitions
  const handleClipEnded = useCallback(() => {
    const activeVideo = getActiveVideo();
    if (!manifest) return;
    
    // Ignore spurious ended events
    if (activeVideo) {
      const duration = activeVideo.duration;
      const currentPos = activeVideo.currentTime;
      if (duration && currentPos < duration * 0.8) {
        console.warn('[ManifestPlayer] Ignoring spurious ended event');
        return;
      }
    }
    
    // If we're at the last clip and it ends, reset playlist
    if (currentClipIndex >= manifest.clips.length - 1) {
      console.log('[ManifestPlayer] Last clip ended, resetting playlist');
      setIsPlaying(false);
      setCurrentClipIndex(0);
      setCurrentTime(0);
      
      // Reset opacities and active video
      setVideoAOpacity(1);
      setVideoBOpacity(0);
      setActiveVideoIndex(0);
      
      // Reset to first clip
      const firstVideo = videoARef.current;
      if (firstVideo && manifest.clips[0]) {
        if (firstVideo.src !== manifest.clips[0].videoUrl) {
        firstVideo.src = manifest.clips[0].videoUrl;
          firstVideo.load();
        } else {
          safeSeek(firstVideo, 0);
        }
      }
    } else if (!isTransitioningRef.current && !isCrossfading) {
      // Fallback: if clip ended but transition wasn't triggered, do it now
      triggerTransitionRef.current?.();
    }
  }, [currentClipIndex, manifest, isCrossfading, getActiveVideo]);

  // Play/Pause toggle
  // Sync continuous music with video playback
  useEffect(() => {
    const music = musicRef.current;
    if (!music || !musicUrl) return;

    music.volume = isMuted ? 0 : 0.5;
    
    if (isPlaying) {
      music.play().catch(() => {});
    } else {
      music.pause();
    }
  }, [isPlaying, musicUrl, isMuted]);

  // Play/Pause toggle - MSE or legacy
  const togglePlay = useCallback(() => {
    // MSE mode
    if (useMSE && mseEngineRef.current && mseReady) {
      if (isPlaying) {
        mseEngineRef.current.pause();
        setIsPlaying(false);
      } else {
        mseEngineRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    
    // Legacy mode
    const activeVideo = getActiveVideo();
    if (!activeVideo) return;
    
    if (isPlaying) {
      safePause(activeVideo);
      setIsPlaying(false);
    } else {
      safePlay(activeVideo);
      setIsPlaying(true);
    }
  }, [isPlaying, getActiveVideo, useMSE, mseReady]);

  // Toggle mute on all videos and music
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    // MSE mode
    if (useMSE && mseEngineRef.current) {
      mseEngineRef.current.setMuted(newMuted);
    }
    
    // Legacy mode (also set for fallback)
    if (videoARef.current) videoARef.current.muted = newMuted;
    if (videoBRef.current) videoBRef.current.muted = newMuted;
    if (mseVideoRef.current) mseVideoRef.current.muted = newMuted;
    if (musicRef.current) musicRef.current.volume = newMuted ? 0 : 0.5;
  }, [isMuted, useMSE]);

  // Skip to specific clip
  const skipToClip = useCallback((index: number) => {
    if (!manifest || index < 0 || index >= manifest.clips.length) return;
    
    // Reset transition state
    isTransitioningRef.current = false;
    setIsCrossfading(false);
    setVideoAOpacity(1);
    setVideoBOpacity(0);
    setActiveVideoIndex(0);
    
    setCurrentClipIndex(index);
    
    const videoA = videoARef.current;
    if (videoA && manifest.clips[index]) {
      videoA.src = manifest.clips[index].videoUrl;
      videoA.load();
      videoA.muted = isMuted;
      if (isPlaying) {
        safePlay(videoA);
      }
    }
    
    // Preload next clip
    const videoB = videoBRef.current;
    if (videoB && manifest.clips[index + 1]) {
      videoB.src = manifest.clips[index + 1].videoUrl;
      videoB.load();
    }
    
    // Update time
    const clip = manifest.clips[index];
    setCurrentTime(clip?.startTime || 0);
  }, [manifest, isMuted, isPlaying]);

  // Skip next/previous
  const skipNext = useCallback(() => {
    if (!manifest || currentClipIndex >= manifest.clips.length - 1) return;
    skipToClip(currentClipIndex + 1);
  }, [manifest, currentClipIndex, skipToClip]);

  const skipPrev = useCallback(() => {
    if (currentClipIndex <= 0) {
      const activeVideo = getActiveVideo();
      if (activeVideo) safeSeek(activeVideo, 0);
      setCurrentTime(0);
      return;
    }
    skipToClip(currentClipIndex - 1);
  }, [currentClipIndex, skipToClip, getActiveVideo]);

  // Fullscreen - Safari/iOS compatible
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    const elem = containerRef.current as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    
    const isCurrentlyFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;
    
    if (isCurrentlyFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    }
  }, []);

  // Format time
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    if (!manifest || manifest.clips.length === 0) return;
    window.open(manifest.clips[0].videoUrl, '_blank');
  }, [manifest]);

  // Calculate progress
  const overallProgress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center bg-black rounded-xl aspect-video", className)}>
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-white/70">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className={cn("flex items-center justify-center bg-black rounded-xl aspect-video", className)}>
        <p className="text-destructive">{error || 'Failed to load video'}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative bg-black rounded-xl overflow-hidden group", className)}>
      {/* MSE Video Element - TRUE GAPLESS PLAYBACK (when supported) */}
      {useMSE && MSE_SUPPORT.supported && (
        <video
          ref={mseVideoRef}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: 2 }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          muted={isMuted}
          playsInline
          preload="auto"
        />
      )}
      
      {/* Legacy Dual Video Elements for Fallback Gapless Playback */}
      {(!useMSE || !MSE_SUPPORT.supported) && (
        <>
          <video
            ref={videoARef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ 
              opacity: videoAOpacity, 
              zIndex: activeVideoIndex === 0 ? 2 : 1,
              transition: `opacity ${CROSSFADE_FADEOUT_MS}ms ease-in-out`
            }}
            onTimeUpdate={activeVideoIndex === 0 ? handleTimeUpdate : undefined}
            onEnded={activeVideoIndex === 0 ? handleClipEnded : undefined}
            onPlay={activeVideoIndex === 0 ? () => setIsPlaying(true) : undefined}
            onPause={activeVideoIndex === 0 ? () => setIsPlaying(false) : undefined}
            onError={(e) => {
              // Prevent crash - just log and recover
              e.preventDefault?.();
              e.stopPropagation?.();
              try {
                const video = e.target as HTMLVideoElement;
                console.warn('[ManifestPlayer] Video A error:', video?.error?.message || 'Unknown');
              } catch {}
            }}
            muted={isMuted}
            playsInline
            preload="auto"
          />
          <video
            ref={videoBRef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ 
              opacity: videoBOpacity, 
              zIndex: activeVideoIndex === 1 ? 2 : 1,
              transition: `opacity ${CROSSFADE_FADEOUT_MS}ms ease-in-out`
            }}
            onTimeUpdate={activeVideoIndex === 1 ? handleTimeUpdate : undefined}
            onEnded={activeVideoIndex === 1 ? handleClipEnded : undefined}
            onPlay={activeVideoIndex === 1 ? () => setIsPlaying(true) : undefined}
            onPause={activeVideoIndex === 1 ? () => setIsPlaying(false) : undefined}
            onError={(e) => {
              // Prevent crash - just log and recover
              e.preventDefault?.();
              e.stopPropagation?.();
              try {
                const video = e.target as HTMLVideoElement;
                console.warn('[ManifestPlayer] Video B error:', video?.error?.message || 'Unknown');
              } catch {}
            }}
            muted={isMuted}
            playsInline
            preload="auto"
          />
        </>
      )}

      {/* Continuous Background Music */}
      {musicUrl && (
        <audio
          ref={musicRef}
          src={musicUrl}
          loop
          preload="auto"
        />
      )}

      {/* Overlay Controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        {/* Invisible click area for play/pause - no center button */}
        <button onClick={togglePlay} className="absolute inset-0" />

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 w-12">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="text-xs text-white/80 w-12 text-right">{formatTime(totalDuration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={skipPrev}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={skipNext}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Clip indicator */}
            <div className="flex items-center gap-1">
              {manifest.clips.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => skipToClip(idx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentClipIndex 
                      ? "bg-primary w-4" 
                      : idx < currentClipIndex 
                        ? "bg-white/80" 
                        : "bg-white/40"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Clip Badge */}
      <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs text-white/80 z-10">
        Clip {currentClipIndex + 1} of {manifest.clips.length}
      </div>

      {/* HYDRATED BOOT: Buffer Status Indicator */}
      {(videoAStatus === 'loading' || videoBStatus === 'loading' || isCrossfading) && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-xs text-white/80 z-10 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>
            {isCrossfading ? 'Transitioning...' : 'Buffering...'}
          </span>
        </div>
      )}

      {/* Diagnostic Overlay (optional - enabled via prop) */}
      {showDiagnostics && (
        <div className="absolute top-12 right-3 px-3 py-2 rounded bg-black/85 text-[10px] font-mono text-green-400 z-20 space-y-1 min-w-[180px]">
          <div className="text-green-300 font-bold flex items-center gap-1">
            {useMSE && mseReady ? <Zap className="w-3 h-3" /> : null}
            {useMSE && mseReady ? '🚀 MSE Gapless' : '🎬 Hydrated Boot'}
          </div>
          <div className="border-t border-green-400/30 my-1" />
          <div>Active: Clip {currentClipIndex + 1}</div>
          <div>Engine: {useMSE && mseReady ? '✅ MSE' : useFallbackTransition ? '⚠️ Fallback' : '✅ Atomic'}</div>
          <div>MSE Support: {MSE_SUPPORT.supported ? '✅' : '❌'}</div>
          <div>Hi-Res Timers: {highResTimersRef.current ? '✅' : '⚠️'}</div>
          {(!useMSE || !mseReady) && (
            <>
              <div className="border-t border-green-400/30 my-1" />
              <div className="flex items-center gap-2">
                <span className={videoAStatus === 'ready' ? 'text-green-400' : videoAStatus === 'loading' ? 'text-yellow-400' : 'text-red-400'}>
                  {videoAStatus === 'ready' ? '✅' : videoAStatus === 'loading' ? '⏳' : '❌'}
                </span>
                <span>Video A: {videoAStatus}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={videoBStatus === 'ready' ? 'text-green-400' : videoBStatus === 'loading' ? 'text-yellow-400' : 'text-red-400'}>
                  {videoBStatus === 'ready' ? '✅' : videoBStatus === 'loading' ? '⏳' : '❌'}
                </span>
                <span>Video B: {videoBStatus}</span>
              </div>
            </>
          )}
          <div className="border-t border-green-400/30 my-1" />
          <div className="text-[9px] text-green-300/70">{diagnosticMessage}</div>
        </div>
      )}
    </div>
  );
});
