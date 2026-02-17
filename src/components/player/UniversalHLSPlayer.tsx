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
import { Play, Pause, Volume2, VolumeX, Maximize2, Loader2, AlertCircle, RefreshCw, SkipBack, SkipForward } from 'lucide-react';
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
// HELPER
// ============================================================================

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
    const [playbackMethod, setPlaybackMethod] = useState<'native' | 'hlsjs' | null>(null);
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
    
    // Initialize HLS playback - only depends on hlsUrl
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !hlsUrl) return;
      
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
              safePlay(video);
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
                  setError('Network error - unable to load video');
                  onErrorRef.current?.('Network error');
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[UniversalHLS] Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                setError('Fatal playback error');
                onErrorRef.current?.('Fatal error');
                break;
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
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [hlsUrl, autoPlay, masterAudioUrl]);
    
    // Video event listeners
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      
      const handleLoadedMetadata = () => {
        if (!mountedRef.current) return;
        const dur = video.duration;
        if (isSafeVideoNumber(dur)) {
          setDuration(dur);
        }
        // For native HLS, this is when we're ready
        if (playbackMethod === 'native') {
          setIsLoading(false);
          initializingRef.current = false;
          onReadyRef.current?.();
          if (autoPlay) {
            safePlay(video);
          }
        }
      };
      
      const handleTimeUpdate = () => {
        if (!mountedRef.current) return;
        const time = video.currentTime;
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time, duration);
        
        // Update buffered amount
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          setBuffered(duration > 0 ? (bufferedEnd / duration) * 100 : 0);
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
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('canplay', handleCanPlay);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('canplay', handleCanPlay);
      };
    }, [autoPlay, duration, masterAudioUrl, playbackMethod]);
    
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
    
    return (
      <div 
        ref={containerRef}
        className={cn(
          "relative bg-black rounded-xl overflow-hidden group",
          aspectClass,
          className
        )}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          muted={muteClipAudio || isMuted}
          loop={loop}
          preload="auto"
          crossOrigin="anonymous"
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
        
        {/* Loading overlay */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
        
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="text-white text-sm text-center mb-4">{error}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        )}
        
        {/* Title overlay */}
        {title && (
          <div className="absolute top-4 left-4 z-40">
            <h2 className="text-lg font-semibold text-white drop-shadow-lg">{title}</h2>
          </div>
        )}
        
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors z-50"
          >
            ×
          </button>
        )}
        
        {/* Controls overlay */}
        {showControls && !error && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Progress bar */}
            <div 
              className="w-full h-1.5 mb-3 bg-white/20 rounded-full cursor-pointer relative"
              onClick={handleSeek}
            >
              {/* Buffered indicator */}
              <div 
                className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                style={{ width: `${buffered}%` }}
              />
              {/* Progress indicator */}
              <div 
                className="absolute inset-y-0 left-0 bg-white rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Scrubber handle */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Skip Back */}
                {showSkipButtons && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    onClick={skipBackward}
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Play/Pause */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" fill="currentColor" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                  )}
                </Button>
                
                {/* Skip Forward */}
                {showSkipButtons && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    onClick={skipForward}
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Volume */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                
                <span className="text-xs text-white/80 font-mono tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Playback method indicator (dev) */}
                {process.env.NODE_ENV === 'development' && playbackMethod && (
                  <span className="text-[10px] text-primary/70 font-mono uppercase">
                    HLS_{playbackMethod.toUpperCase()}
                  </span>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  onClick={requestFullscreen}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Click to play overlay (when paused) */}
        {!isPlaying && !isLoading && !error && (
          <button
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={togglePlayPause}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
            </div>
          </button>
        )}
      </div>
    );
  }
));

UniversalHLSPlayer.displayName = 'UniversalHLSPlayer';

export default UniversalHLSPlayer;
