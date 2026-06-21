/**
 * SimpleVideoPlayer - Easy-to-use video player wrapper
 * 
 * A drop-in replacement for <video> elements that automatically:
 * - Uses HLS when available (via hls.js for cross-browser support)
 * - Falls back to native video playback for MP4/WebM
 * - Works consistently across all browsers
 * 
 * Usage:
 * Replace: <video src={url} ... />
 * With:    <SimpleVideoPlayer src={url} ... />
 */

import { memo, forwardRef, useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { safePlay, safePause, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { useMediaCleanup, useRouteCleanup } from '@/lib/navigation';
import { Play, Pause, Volume2, VolumeX, Maximize2, Loader2 } from 'lucide-react';

export interface SimpleVideoPlayerHandle {
  play: () => Promise<void> | void;
  pause: () => void;
  seek: (time: number) => void;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface SimpleVideoPlayerProps {
  /** Video source URL (supports .mp4, .webm, .m3u8) */
  src: string;
  /** Auto-play on load */
  autoPlay?: boolean;
  /** Start muted */
  muted?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Inline playback (required for iOS) */
  playsInline?: boolean;
  /** Preload strategy */
  preload?: 'none' | 'metadata' | 'auto';
  /** CSS class name */
  className?: string;
  /** Object fit mode */
  objectFit?: 'contain' | 'cover' | 'fill';
  /** Show controls overlay */
  showControls?: boolean;
  /** Controls visibility behavior */
  controlsVisibility?: 'always' | 'hover' | 'none';
  /** Poster image */
  poster?: string;
  /** Callbacks */
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: string) => void;
  onLoadedData?: () => void;
  onCanPlay?: () => void;
  /** Cross origin */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

function isHLSUrl(url: string): boolean {
  return url?.endsWith('.m3u8') || url?.includes('.m3u8?');
}

function hasNativeHLSSupport(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

function formatTime(seconds: number): string {
  if (!isSafeVideoNumber(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const SimpleVideoPlayer = memo(forwardRef<SimpleVideoPlayerHandle, SimpleVideoPlayerProps>(
  function SimpleVideoPlayer({
    src,
    autoPlay = false,
    muted = false,
    loop = false,
    playsInline = true,
    preload = 'auto',
    className,
    objectFit = 'contain',
    showControls = true,
    controlsVisibility = 'hover',
    poster,
    onEnded,
    onPlay,
    onPause,
    onTimeUpdate,
    onError,
    onLoadedData,
    onCanPlay,
    crossOrigin,
  }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const mountedRef = useRef(true);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(muted);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    
    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          await safePlay(videoRef.current);
        }
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

    // CRITICAL: Register video with NavigationCoordinator for pre-navigation cleanup
    useMediaCleanup(videoRef);

    // CRITICAL: Destroy HLS instance before navigation starts (not during React unmount)
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
    
    // Initialize video source (HLS or native)
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;
      
      setIsLoading(true);
      
      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      if (isHLSUrl(src)) {
        // HLS URL - use hls.js or native
        if (hasNativeHLSSupport()) {
          // Safari/iOS - native HLS
          video.src = src;
          console.log('[SimpleVideoPlayer] Using native HLS (Safari/iOS)');
        } else if (Hls.isSupported()) {
          // Chrome/Firefox/Edge - hls.js
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            debug: false,
          });
          
          hlsRef.current = hls;
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (mountedRef.current) {
              setIsLoading(false);
              if (autoPlay) {
                safePlay(video);
              }
            }
          });
          
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('[SimpleVideoPlayer] HLS error:', data);
              onError?.('Video playback error');
            }
          });
          
          hls.loadSource(src);
          hls.attachMedia(video);
          
          console.log('[SimpleVideoPlayer] Using hls.js (Chrome/Firefox/Edge)');
        } else {
          onError?.('HLS not supported');
        }
      } else {
        // Regular video - native playback
        video.src = src;
        console.log('[SimpleVideoPlayer] Using native video playback');
      }
      
      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src, autoPlay, onError]);
    
    // Video event handlers
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      
      const handleLoadedData = () => {
        if (mountedRef.current) {
          setIsLoading(false);
          const dur = video.duration;
          if (isSafeVideoNumber(dur)) {
            setDuration(dur);
          }
          onLoadedData?.();
        }
      };
      
      const handleCanPlay = () => {
        if (mountedRef.current) {
          setIsLoading(false);
          onCanPlay?.();
          if (autoPlay && !isHLSUrl(src)) {
            safePlay(video);
          }
        }
      };
      
      const handleTimeUpdate = () => {
        if (mountedRef.current) {
          const time = video.currentTime;
          setCurrentTime(time);
          onTimeUpdate?.(time, video.duration);
        }
      };
      
      const handlePlay = () => {
        if (mountedRef.current) {
          setIsPlaying(true);
          onPlay?.();
        }
      };
      
      const handlePause = () => {
        if (mountedRef.current) {
          setIsPlaying(false);
          onPause?.();
        }
      };
      
      const handleEnded = () => {
        if (mountedRef.current) {
          setIsPlaying(false);
          onEnded?.();
        }
      };
      
      const handleError = () => {
        if (mountedRef.current) {
          setIsLoading(false);
          const errorMsg = video.error?.message || 'Video error';
          console.error('[SimpleVideoPlayer] Error:', errorMsg);
          onError?.(errorMsg);
        }
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
      };
    }, [src, autoPlay, onLoadedData, onCanPlay, onTimeUpdate, onPlay, onPause, onEnded, onError]);
    
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
      if (!video) return;
      
      const newMuted = !isMuted;
      video.muted = newMuted;
      setIsMuted(newMuted);
    }, [isMuted]);
    
    const requestFullscreen = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      }
    }, []);
    
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const shouldShowControls = showControls && (
      controlsVisibility === 'always' || 
      (controlsVisibility === 'hover' && isHovered)
    );
    
    const [isProgressHovered, setIsProgressHovered] = useState(false);

    return (
      <div 
        className={cn("relative group cursor-pointer overflow-hidden", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Video — absolute fill, edge-to-edge */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted={isMuted}
          loop={loop}
          playsInline={playsInline}
          preload={preload}
          poster={poster}
          crossOrigin={crossOrigin}
          onClick={togglePlayPause}
        />
        
        {/* Loading overlay — ethereal */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] backdrop-blur-3xl border border-white/[0.08] flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.06)]">
              <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
            </div>
          </div>
        )}
        
        {/* Controls overlay — legendary */}
        {shouldShowControls && !isLoading && (
          <div className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-700 ease-out">
            <div className="bg-gradient-to-t from-black/80 via-black/40 via-30% to-transparent pt-20 pb-4 px-5">
              {/* Progress bar — precision */}
              <div 
                className="relative w-full h-6 flex items-center mb-2.5 cursor-pointer group/progress"
                onClick={(e) => {
                  const video = videoRef.current;
                  if (!video || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  video.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
                }}
                onMouseEnter={() => setIsProgressHovered(true)}
                onMouseLeave={() => setIsProgressHovered(false)}
              >
                <div className={cn(
                  "absolute left-0 right-0 rounded-full transition-all duration-300 overflow-hidden",
                  isProgressHovered ? "h-[5px] top-[10.5px]" : "h-[2px] top-[12px]"
                )}>
                  <div className="absolute inset-0 bg-white/[0.1]" />
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
                <div 
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-200 z-10",
                    isProgressHovered 
                      ? "w-[14px] h-[14px] opacity-100 shadow-[0_0_16px_rgba(255,255,255,0.4),0_0_4px_rgba(255,255,255,0.8)]" 
                      : "w-[8px] h-[8px] opacity-0 group-hover/progress:opacity-60"
                  )}
                  style={{ left: `calc(${progressPercent}% - ${isProgressHovered ? 7 : 4}px)` }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  <button
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/[0.1] transition-all duration-300"
                    onClick={togglePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="w-[22px] h-[22px]" fill="currentColor" />
                    ) : (
                      <Play className="w-[22px] h-[22px] ml-0.5" fill="currentColor" />
                    )}
                  </button>
                  
                  <button
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-300"
                    onClick={toggleMute}
                  >
                    {isMuted ? (
                      <VolumeX className="w-[18px] h-[18px]" />
                    ) : (
                      <Volume2 className="w-[18px] h-[18px]" />
                    )}
                  </button>
                  
                  <span className="text-[11px] text-white/40 font-mono tabular-nums ml-2 select-none tracking-wider">
                    {formatTime(currentTime)}
                    <span className="text-white/15 mx-1.5">/</span>
                    {formatTime(duration)}
                  </span>
                </div>
                
                <button
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-300"
                  onClick={requestFullscreen}
                >
                  <Maximize2 className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Center play — cinematic glass orb */}
        {!isPlaying && !isLoading && controlsVisibility !== 'none' && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
            onClick={togglePlayPause}
          >
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500",
              "bg-white/[0.07] backdrop-blur-3xl border border-white/[0.12]",
              "hover:bg-white/[0.14] hover:scale-110 hover:border-white/[0.22]",
              "shadow-[0_0_80px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.1)]",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              <Play className="w-7 h-7 text-white/90 ml-1 drop-shadow-lg" fill="currentColor" />
            </div>
          </div>
        )}
      </div>
    );
  }
));

SimpleVideoPlayer.displayName = 'SimpleVideoPlayer';

export default SimpleVideoPlayer;
