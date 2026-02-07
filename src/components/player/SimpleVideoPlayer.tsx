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
    crossOrigin = 'anonymous',
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
    
    return (
      <div 
        className={cn("relative group", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <video
          ref={videoRef}
          className={cn(
            "w-full h-full",
            objectFit === 'contain' && 'object-contain',
            objectFit === 'cover' && 'object-cover',
            objectFit === 'fill' && 'object-fill'
          )}
          muted={isMuted}
          loop={loop}
          playsInline={playsInline}
          preload={preload}
          poster={poster}
          crossOrigin={crossOrigin}
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        
        {/* Controls overlay */}
        {shouldShowControls && !isLoading && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-200">
            {/* Progress bar */}
            <div className="w-full h-1 mb-3 bg-white/20 rounded-full">
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  className="h-8 w-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" fill="currentColor" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                  )}
                </button>
                
                <button
                  className="h-8 w-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                
                <span className="text-xs text-white/80 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              <button
                className="h-8 w-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
                onClick={requestFullscreen}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Click to play overlay */}
        {!isPlaying && !isLoading && controlsVisibility !== 'none' && (
          <button
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
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

SimpleVideoPlayer.displayName = 'SimpleVideoPlayer';

export default SimpleVideoPlayer;
