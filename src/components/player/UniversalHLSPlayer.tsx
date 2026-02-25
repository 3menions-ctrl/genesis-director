/**
 * UniversalHLSPlayer - HLS playback that works on ALL platforms
 * 
 * Strategy:
 * - Safari/iOS: Native HLS support (browser handles .m3u8 directly)
 * - Chrome/Firefox/Edge: hls.js library (MSE-based HLS parsing)
 * 
 * This provides a single unified playback path for all browsers.
 * The player automatically detects the best playback method.
 */

import { useState, useEffect, useRef, useCallback, forwardRef, memo, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize2, Loader2, AlertCircle, RefreshCw, SkipBack, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { safePlay, safePause, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { useMediaCleanup, useRouteCleanup } from '@/lib/navigation';

// ============================================================================
// TYPES
// ============================================================================

export interface UniversalHLSPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface UniversalHLSPlayerProps {
  /** HLS playlist URL (.m3u8) */
  hlsUrl: string;
  /** Optional direct MP4 fallback when HLS fails (e.g. Safari decode errors) */
  fallbackMp4Url?: string;
  /** Optional master audio track (for lip-synced content) */
  masterAudioUrl?: string | null;
  /** Mute the video track audio (use when master audio is provided) */
  muteClipAudio?: boolean;
  /** Auto-play on load */
  autoPlay?: boolean;
  /** Start muted */
  muted?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** CSS class name */
  className?: string;
  /** Aspect ratio mode */
  aspectRatio?: 'video' | 'square' | 'auto';
  /** Show controls */
  showControls?: boolean;
  /** Show skip buttons */
  showSkipButtons?: boolean;
  /** Callback when playback ends */
  onEnded?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Callback on time update */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback when ready to play */
  onReady?: () => void;
  /** Callback when playback starts */
  onPlay?: () => void;
  /** Callback when playback pauses */
  onPause?: () => void;
  /** Close button for fullscreen mode */
  onClose?: () => void;
  /** Title overlay */
  title?: string;
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Check if browser is Safari (desktop or iOS)
 */
function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  // Safari: contains "Safari" but NOT "Chrome" or "Chromium"
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium/.test(ua);
  // iOS: iPhone, iPad, iPod
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  return isSafari || isIOS;
}

/**
 * Check if browser has native HLS support (Safari, iOS)
 * Only Safari truly supports native HLS - Chrome's partial support is unreliable
 */
function hasNativeHLSSupport(): boolean {
  // Only Safari/iOS should use native HLS - other browsers should use hls.js
  if (!isSafariBrowser()) return false;
  
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Check if hls.js is supported in this browser
 */
function isHlsJsSupported(): boolean {
  return Hls.isSupported();
}

/**
 * Detect playback method - prefer hls.js for non-Safari browsers
 */
export function detectHLSPlaybackMethod(): 'native' | 'hlsjs' | null {
  // Safari/iOS: Use native HLS (most reliable)
  if (isSafariBrowser() && hasNativeHLSSupport()) return 'native';
  // Chrome/Firefox/Edge: Use hls.js (most reliable)
  if (isHlsJsSupported()) return 'hlsjs';
  // Fallback: Try native (unlikely to work well)
  if (hasNativeHLSSupport()) return 'native';
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse an m3u8 manifest to extract individual MP4/TS segment URLs.
 * Used as a fallback when hls.js can't handle discontinuity segments.
 */
async function parseM3u8ForClipUrls(m3u8Url: string): Promise<string[]> {
  try {
    const resp = await fetch(m3u8Url);
    if (!resp.ok) return [];
    const text = await resp.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const urls: string[] = [];
    for (const line of lines) {
      if (!line.startsWith('#') && (line.startsWith('http') || line.endsWith('.mp4') || line.endsWith('.ts'))) {
        // Resolve relative URLs
        if (line.startsWith('http')) {
          urls.push(line);
        } else {
          const base = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
          urls.push(base + line);
        }
      }
    }
    console.log(`[UniversalHLS] Parsed m3u8: found ${urls.length} clip URLs`);
    return urls;
  } catch (e) {
    console.error('[UniversalHLS] Failed to parse m3u8:', e);
    return [];
  }
}

function formatTime(seconds: number): string {
  if (!isSafeVideoNumber(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const UniversalHLSPlayer = memo(forwardRef<UniversalHLSPlayerHandle, UniversalHLSPlayerProps>(
  function UniversalHLSPlayer({
    hlsUrl,
    fallbackMp4Url,
    masterAudioUrl,
    muteClipAudio = false,
    autoPlay = false,
    muted: initialMuted = false,
    loop = false,
    className,
    aspectRatio = 'video',
    showControls = true,
    showSkipButtons = false,
    onEnded,
    onError,
    onTimeUpdate,
    onReady,
    onPlay,
    onPause,
    onClose,
    title,
  }, ref) {
    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(initialMuted || muteClipAudio);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackMethod, setPlaybackMethod] = useState<'native' | 'hlsjs' | 'sequential' | null>(null);
    const [buffered, setBuffered] = useState(0);
    
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const mountedRef = useRef(true);
     const retryCountRef = useRef(0);
    const initializingRef = useRef(false);
    const fallbackTriedRef = useRef(false);
    const nonFatalErrorCountRef = useRef(0);
    const playbackWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Sequential playback fallback refs
    const sequentialClipsRef = useRef<string[]>([]);
    const sequentialIndexRef = useRef(0);
    const sequentialTotalDurationRef = useRef(0);
    const sequentialElapsedRef = useRef(0);
    
    // Stable callback refs to prevent re-initialization loops
    const onErrorRef = useRef(onError);
    const onReadyRef = useRef(onReady);
    const onEndedRef = useRef(onEnded);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    
    // Keep refs in sync without triggering re-renders
    useEffect(() => {
      onErrorRef.current = onError;
      onReadyRef.current = onReady;
      onEndedRef.current = onEnded;
      onPlayRef.current = onPlay;
      onPauseRef.current = onPause;
      onTimeUpdateRef.current = onTimeUpdate;
    });
    
    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) safePlay(videoRef.current);
      },
      pause: () => {
        if (videoRef.current) safePause(videoRef.current);
      },
      seek: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getVideoElement: () => videoRef.current,
    }));
    
    // Cleanup on unmount
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, []);

    // CRITICAL: Register video element with NavigationCoordinator
    // so abortAllMedia() can pause/cleanup BEFORE React unmount races with new page mount
    useMediaCleanup(videoRef);

    // CRITICAL: Destroy HLS instance before navigation starts (not during unmount)
    // This prevents Safari resource exhaustion when old HLS streams overlap with new page loading
    useRouteCleanup(() => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load(); // Force release of media resources
      }
    }, []);
    
    // Helper: switch from HLS to sequential/MP4 fallback
    const triggerFallback = useCallback((hls: Hls, video: HTMLVideoElement) => {
      console.warn('[UniversalHLS] Switching to SEQUENTIAL/MP4 fallback');
      hls.destroy();
      hlsRef.current = null;
      nonFatalErrorCountRef.current = 0;
      
      parseM3u8ForClipUrls(hlsUrl).then(clips => {
        if (!mountedRef.current || clips.length === 0) {
          // Last resort: single MP4 fallback
          if (fallbackMp4Url && video) {
            console.log('[UniversalHLS] Using direct MP4 fallback');
            video.src = fallbackMp4Url;
            video.muted = muteClipAudio || initialMuted;
            video.load();
            if (autoPlay) safePlay(video);
          }
          return;
        }
        sequentialClipsRef.current = clips;
        sequentialIndexRef.current = 0;
        sequentialElapsedRef.current = 0;
        sequentialTotalDurationRef.current = clips.length * 10;
        setPlaybackMethod('sequential');
        setDuration(clips.length * 10);
        setIsLoading(false);
        setError(null);
        console.log(`[UniversalHLS] Sequential mode: ${clips.length} clips`);
        video.src = clips[0];
        video.muted = muteClipAudio || initialMuted;
        video.load();
        if (autoPlay) safePlay(video);
      });
    }, [hlsUrl, fallbackMp4Url, autoPlay, muteClipAudio, initialMuted]);

    // Initialize HLS playback - only depends on hlsUrl
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !hlsUrl) return;
      
      // If already in sequential fallback mode, don't re-init HLS
      if (sequentialClipsRef.current.length > 0) return;
      
      // Prevent concurrent initialization
      if (initializingRef.current) return;
      initializingRef.current = true;
      
      setIsLoading(true);
      setError(null);
      
      // Determine playback method
      const nativeSupport = hasNativeHLSSupport();
      const hlsJsSupport = isHlsJsSupported();
      
      console.log(`[UniversalHLS] Initializing:`, {
        url: hlsUrl.substring(0, 80),
        nativeHLS: nativeSupport,
        hlsJsSupport,
        masterAudio: !!masterAudioUrl,
      });
      
      // Clean up previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      if (nativeSupport) {
        // Safari/iOS - use native HLS
        setPlaybackMethod('native');
        video.src = hlsUrl;
        console.log('[UniversalHLS] Using NATIVE HLS playback (Safari/iOS)');
        initializingRef.current = false;
      } else if (hlsJsSupport) {
        // Chrome/Firefox/Edge - use hls.js
        setPlaybackMethod('hlsjs');
        
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          startLevel: -1, // Auto quality
          debug: false,
        });
        
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log(`[UniversalHLS] Manifest parsed - ${data.levels.length} quality levels`);
          initializingRef.current = false;
          if (mountedRef.current) {
            setIsLoading(false);
            onReadyRef.current?.();
            if (autoPlay) {
              // Ensure muted state is set imperatively before play attempt
              video.muted = muteClipAudio || initialMuted;
              safePlay(video);
              
              // Playback watchdog: if no timeupdate within 8s, HLS is broken → fallback
              if (playbackWatchdogRef.current) clearTimeout(playbackWatchdogRef.current);
              playbackWatchdogRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                // Check if video actually progressed
                if (video.currentTime < 0.5 && hlsRef.current) {
                  console.warn('[UniversalHLS] Playback watchdog: no progress after 8s, triggering fallback');
                  triggerFallback(hlsRef.current, video);
                }
              }, 8000);
            }
          }
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[UniversalHLS] HLS.js error:', data);
          
          if (data.fatal) {
            initializingRef.current = false;
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Try to recover
                if (retryCountRef.current < 3) {
                  retryCountRef.current++;
                  console.log(`[UniversalHLS] Network error, retrying... (${retryCountRef.current}/3)`);
                  hls.startLoad();
                } else {
                  const errMsg = 'Network error - unable to load video';
                  setError(errMsg);
                  onErrorRef.current?.(errMsg);
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Media errors with full MP4 + discontinuity = use sequential fallback
                if (retryCountRef.current < 1) {
                  retryCountRef.current++;
                  console.log('[UniversalHLS] Media error, attempting recovery...');
                  hls.recoverMediaError();
                } else {
                  triggerFallback(hls, video);
                }
                break;
              default: {
                // For other fatal errors, show error only if parent has no onError handler
                const errMsg = 'Fatal playback error';
                if (onErrorRef.current) {
                  onErrorRef.current(errMsg);
                } else {
                  setError(errMsg);
                }
                break;
              }
            }
          } else {
            // Track non-fatal errors — if too many accumulate, HLS is broken
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              nonFatalErrorCountRef.current++;
              if (nonFatalErrorCountRef.current >= 5) {
                console.warn('[UniversalHLS] Too many non-fatal media errors, triggering fallback');
                triggerFallback(hls, video);
              }
            }
          }
        });
        
        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (mountedRef.current) {
            setIsLoading(false);
          }
        });
        
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        
        console.log('[UniversalHLS] Using HLS.JS playback (Chrome/Firefox/Edge)');
      } else {
        // No HLS support at all - rare edge case
        initializingRef.current = false;
        setError('Your browser does not support HLS video playback');
        onErrorRef.current?.('HLS not supported');
      }
      
      return () => {
        initializingRef.current = false;
        if (playbackWatchdogRef.current) {
          clearTimeout(playbackWatchdogRef.current);
          playbackWatchdogRef.current = null;
        }
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [hlsUrl, autoPlay, masterAudioUrl, triggerFallback]);
    
    // Video event listeners
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      
      const handleLoadedMetadata = () => {
        if (!mountedRef.current) return;
        const dur = video.duration;
        if (isSafeVideoNumber(dur) && dur > 0) {
          setDuration(dur);
          console.log(`[UniversalHLS] loadedmetadata: duration=${dur.toFixed(2)}s`);
        }
        // For native HLS, this is when we're ready
        if (playbackMethod === 'native') {
          setIsLoading(false);
          initializingRef.current = false;
          onReadyRef.current?.();
          if (autoPlay) {
            // Ensure muted state is set imperatively before play attempt
            video.muted = muteClipAudio || initialMuted;
            safePlay(video);
          }
        }
      };
      
      // HLS duration can update as more segments are discovered
      const handleDurationChange = () => {
        if (!mountedRef.current) return;
        const dur = video.duration;
        if (isSafeVideoNumber(dur) && dur > 0) {
          setDuration(dur);
        }
      };
      
      const handleTimeUpdate = () => {
        if (!mountedRef.current) return;
        const time = video.currentTime;
        const liveDuration = video.duration;
        
        // Sequential mode: report cumulative time (check ref, not stale state)
        if (sequentialClipsRef.current.length > 0) {
          const totalElapsed = sequentialElapsedRef.current + time;
          const totalDur = sequentialTotalDurationRef.current;
          setCurrentTime(totalElapsed);
          setDuration(totalDur);
          onTimeUpdateRef.current?.(totalElapsed, totalDur);
          return;
        }
        
        setCurrentTime(time);
        if (isSafeVideoNumber(liveDuration) && liveDuration > 0) {
          setDuration(liveDuration);
        }
        onTimeUpdateRef.current?.(time, isSafeVideoNumber(liveDuration) ? liveDuration : 0);
        
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          setBuffered(liveDuration > 0 ? (bufferedEnd / liveDuration) * 100 : 0);
        }
      };
      
      const handlePlay = () => {
        if (!mountedRef.current) return;
        setIsPlaying(true);
        onPlayRef.current?.();
        
        // Sync master audio
        if (audioRef.current && masterAudioUrl) {
          audioRef.current.currentTime = video.currentTime;
          audioRef.current.play().catch(() => {});
        }
      };
      
      const handlePause = () => {
        if (!mountedRef.current) return;
        setIsPlaying(false);
        onPauseRef.current?.();
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
      
      const handleEnded = () => {
        if (!mountedRef.current) return;
        
        // Sequential mode: advance to next clip (check ref, not stale state)
        const clips = sequentialClipsRef.current;
        if (clips.length > 0) {
          const nextIndex = sequentialIndexRef.current + 1;
          const clipDur = video.duration;
          if (isSafeVideoNumber(clipDur)) {
            sequentialElapsedRef.current += clipDur;
          }
          if (nextIndex < clips.length) {
            sequentialIndexRef.current = nextIndex;
            console.log(`[UniversalHLS] Sequential: advancing to clip ${nextIndex + 1}/${clips.length}`);
            video.src = clips[nextIndex];
            video.load();
            safePlay(video);
            return; // Don't fire onEnded yet
          }
          console.log('[UniversalHLS] Sequential: all clips finished');
        }
        
        setIsPlaying(false);
        console.log('[UniversalHLS] Playback ended');
        onEndedRef.current?.();
      };
      
      const handleError = (e: Event) => {
        if (!mountedRef.current) return;
        // Only handle errors for native playback
        if (playbackMethod === 'native') {
          const errorMessage = (e.target as HTMLVideoElement)?.error?.message || 'Playback error';
          console.error('[UniversalHLS] Native error:', errorMessage);
          
          // Try fallback MP4 if available and not already tried
          if (fallbackMp4Url && !fallbackTriedRef.current) {
            fallbackTriedRef.current = true;
            console.log('[UniversalHLS] Falling back to direct MP4:', fallbackMp4Url.substring(0, 80));
            const video = videoRef.current;
            if (video) {
              video.src = fallbackMp4Url;
              video.load();
              if (autoPlay) safePlay(video);
              return;
            }
          }
          
          setError(errorMessage);
          setIsLoading(false);
          onErrorRef.current?.(errorMessage);
        }
      };
      
      const handleWaiting = () => {
        if (mountedRef.current) {
          setIsLoading(true);
        }
      };
      
      const handleCanPlay = () => {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('canplay', handleCanPlay);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('canplay', handleCanPlay);
      };
    }, [autoPlay, masterAudioUrl, playbackMethod]);
    
    // Sync master audio with video
    useEffect(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio || !masterAudioUrl) return;
      
      const syncAudio = () => {
        const drift = Math.abs(audio.currentTime - video.currentTime);
        if (drift > 0.15) {
          audio.currentTime = video.currentTime;
        }
      };
      
      const intervalId = setInterval(syncAudio, 500);
      return () => clearInterval(intervalId);
    }, [masterAudioUrl]);
    
    // Controls
    const togglePlayPause = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      
      if (video.paused) {
        safePlay(video);
      } else {
        safePause(video);
      }
    }, []);
    
    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video) return;
      
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      
      if (masterAudioUrl && audio) {
        audio.muted = newMuted;
      } else {
        video.muted = newMuted;
      }
    }, [isMuted, masterAudioUrl]);
    
    const requestFullscreen = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
        // iOS Safari
        (videoRef.current as any).webkitEnterFullscreen();
      }
    }, []);
    
    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      const seekTime = percent * duration;
      
      video.currentTime = seekTime;
      if (audioRef.current) {
        audioRef.current.currentTime = seekTime;
      }
    }, [duration]);
    
    const skipForward = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.min(video.currentTime + 10, duration);
    }, [duration]);
    
    const skipBackward = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(video.currentTime - 10, 0);
    }, []);
    
    const handleRetry = useCallback(() => {
      setError(null);
      retryCountRef.current = 0;
      
      // Force re-initialization
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      const video = videoRef.current;
      if (video) {
        video.load();
      }
    }, []);
    
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    const aspectClass = aspectRatio === 'video' 
      ? 'aspect-video' 
      : aspectRatio === 'square' 
        ? 'aspect-square' 
        : '';
    
    // Auto-hide controls
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isProgressHovered, setIsProgressHovered] = useState(false);
    const [hoverProgress, setHoverProgress] = useState<number | null>(null);

    const showControlsTemporarily = useCallback(() => {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (isPlaying && mountedRef.current) setControlsVisible(false);
      }, 3000);
    }, [isPlaying]);

    useEffect(() => {
      if (!isPlaying) { setControlsVisible(true); return; }
      showControlsTemporarily();
      return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
    }, [isPlaying, showControlsTemporarily]);

    const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoverProgress(((e.clientX - rect.left) / rect.width) * 100);
    }, []);

    return (
      <div 
        ref={containerRef}
        className={cn(
          "relative bg-black overflow-hidden group cursor-pointer",
          aspectClass,
          className
        )}
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => { if (isPlaying) setControlsVisible(false); }}
      >
        {/* Video element — fills entire container edge-to-edge */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted={muteClipAudio || isMuted}
          loop={loop}
          preload="auto"
          crossOrigin="anonymous"
          onClick={togglePlayPause}
        />
        
        {/* Master audio track (hidden) */}
        {masterAudioUrl && (
          <audio
            ref={audioRef}
            src={masterAudioUrl}
            preload="auto"
            muted={isMuted}
          />
        )}
        
        {/* Loading overlay — ethereal pulse */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] backdrop-blur-3xl border border-white/[0.08] flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.06)]">
              <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
            </div>
          </div>
        )}
        
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 z-30">
            <AlertCircle className="w-10 h-10 text-white/20 mb-3" />
            <p className="text-white/50 text-sm text-center mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] text-white/70 text-sm hover:bg-white/[0.12] hover:text-white transition-all duration-300"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}
        
        {/* Title overlay — floating text, no background bar */}
        {title && (
          <div className={cn(
            "absolute top-0 left-0 right-0 z-40 transition-all duration-700",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}>
            <div className="bg-gradient-to-b from-black/40 via-black/10 to-transparent px-6 pt-5 pb-10">
              <h2 className="text-sm font-medium text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] tracking-wide truncate">{title}</h2>
            </div>
          </div>
        )}
        
        {/* Close button — minimal floating circle */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-50 transition-all duration-500",
              "bg-black/20 backdrop-blur-2xl border border-white/[0.08]",
              "text-white/50 hover:bg-white/[0.12] hover:text-white hover:scale-105 hover:border-white/[0.15]",
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        {/* Center play — cinematic glass orb */}
        {!isPlaying && !isLoading && !error && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
            onClick={togglePlayPause}
          >
            <div className={cn(
              "w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-500",
              "bg-white/[0.07] backdrop-blur-3xl",
              "border border-white/[0.12]",
              "hover:bg-white/[0.14] hover:scale-110 hover:border-white/[0.22]",
              "shadow-[0_0_80px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.1)]"
            )}>
              <Play className="w-7 h-7 text-white/90 ml-1 drop-shadow-lg" fill="currentColor" />
            </div>
          </div>
        )}
        
        {/* ============ LEGENDARY CONTROLS BAR ============ */}
        {showControls && !error && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 z-40 transition-all duration-700 ease-out",
            controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
          )}>
            {/* Ultra-deep gradient — cinematic fade */}
            <div className="bg-gradient-to-t from-black/80 via-black/40 via-30% to-transparent pt-20 pb-4 px-5">
              
              {/* Progress bar — precision scrubber */}
              <div 
                className="relative w-full h-6 flex items-center mb-2.5 cursor-pointer group/progress"
                onClick={handleSeek}
                onMouseEnter={() => setIsProgressHovered(true)}
                onMouseLeave={() => { setIsProgressHovered(false); setHoverProgress(null); }}
                onMouseMove={handleProgressHover}
              >
                {/* Track container */}
                <div className={cn(
                  "absolute left-0 right-0 rounded-full transition-all duration-300 overflow-hidden",
                  isProgressHovered ? "h-[5px] top-[10.5px]" : "h-[2px] top-[12px]"
                )}>
                  {/* Background track */}
                  <div className="absolute inset-0 bg-white/[0.1]" />
                  {/* Buffered */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-white/[0.15] rounded-full transition-[width] duration-300"
                    style={{ width: `${buffered}%` }}
                  />
                  {/* Active progress — with subtle glow */}
                  <div 
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-[width] duration-75",
                      isProgressHovered 
                        ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" 
                        : "bg-white/90"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* Scrubber — luminous orb */}
                <div 
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-200 z-10",
                    isProgressHovered 
                      ? "w-[14px] h-[14px] opacity-100 shadow-[0_0_16px_rgba(255,255,255,0.4),0_0_4px_rgba(255,255,255,0.8)]" 
                      : "w-[8px] h-[8px] opacity-0 group-hover/progress:opacity-60"
                  )}
                  style={{ left: `calc(${progressPercent}% - ${isProgressHovered ? 7 : 4}px)` }}
                />
                {/* Hover seek indicator */}
                {hoverProgress !== null && isProgressHovered && (
                  <div 
                    className="absolute top-[6px] w-px h-[14px] bg-white/25 pointer-events-none rounded-full"
                    style={{ left: `${hoverProgress}%` }}
                  />
                )}
              </div>

              {/* Controls row — floating transparent buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  {/* Skip Back */}
                  {showSkipButtons && (
                    <button
                      onClick={skipBackward}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-300"
                    >
                      <SkipBack className="w-[18px] h-[18px]" />
                    </button>
                  )}
                  
                  {/* Play/Pause — primary action */}
                  <button
                    onClick={togglePlayPause}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/[0.1] transition-all duration-300"
                  >
                    {isPlaying ? (
                      <Pause className="w-[22px] h-[22px]" fill="currentColor" />
                    ) : (
                      <Play className="w-[22px] h-[22px] ml-0.5" fill="currentColor" />
                    )}
                  </button>
                  
                  {/* Skip Forward */}
                  {showSkipButtons && (
                    <button
                      onClick={skipForward}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-300"
                    >
                      <SkipForward className="w-[18px] h-[18px]" />
                    </button>
                  )}
                  
                  {/* Volume */}
                  <button
                    onClick={toggleMute}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-300"
                  >
                    {isMuted ? (
                      <VolumeX className="w-[18px] h-[18px]" />
                    ) : (
                      <Volume2 className="w-[18px] h-[18px]" />
                    )}
                  </button>
                  
                  {/* Time display — ultra refined */}
                  <span className="text-[11px] text-white/40 font-mono tabular-nums ml-2 select-none tracking-wider">
                    {formatTime(currentTime)}
                    <span className="text-white/15 mx-1.5">/</span>
                    {formatTime(duration)}
                  </span>
                </div>
                
                <div className="flex items-center gap-0.5">
                  {/* Fullscreen */}
                  <button
                    onClick={requestFullscreen}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-300"
                  >
                    <Maximize2 className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
));

UniversalHLSPlayer.displayName = 'UniversalHLSPlayer';

export default UniversalHLSPlayer;
