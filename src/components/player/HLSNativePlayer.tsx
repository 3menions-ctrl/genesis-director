/**
 * HLSNativePlayer - Native HLS playback for iOS Safari
 * 
 * Uses the browser's native HLS support for seamless playback
 * without MSE dependencies. Critical for iOS Safari which cannot
 * use MediaSource Extensions reliably.
 * 
 * Features:
 * - Native <video> element with HLS source
 * - Master audio track synchronization
 * - Segment boundary timing logs
 * - Error handling with fallback
 */

import { useState, useEffect, useRef, useCallback, forwardRef, memo } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { safePlay, safePause, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { logPlaybackPath } from '@/lib/video/platformDetection';

interface HLSNativePlayerProps {
  hlsUrl: string;
  masterAudioUrl?: string | null;
  muteClipAudio?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export const HLSNativePlayer = memo(forwardRef<HTMLDivElement, HLSNativePlayerProps>(
  function HLSNativePlayer({
    hlsUrl,
    masterAudioUrl,
    muteClipAudio = false,
    autoPlay = false,
    muted: initialMuted = false,
    loop = false,
    className,
    onEnded,
    onError,
    onTimeUpdate,
  }, ref) {
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(initialMuted || muteClipAudio);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [lastBoundary, setLastBoundary] = useState<number | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const mountedRef = useRef(true);
    
    // Log playback path on mount
    useEffect(() => {
      logPlaybackPath('HLS_NATIVE', { hlsUrl, masterAudioUrl, muteClipAudio });
      mountedRef.current = true;
      
      return () => {
        mountedRef.current = false;
      };
    }, [hlsUrl, masterAudioUrl, muteClipAudio]);
    
    // Setup video event listeners
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      
      const handleLoadedMetadata = () => {
        if (!mountedRef.current) return;
        setIsLoading(false);
        const dur = video.duration;
        if (isSafeVideoNumber(dur)) {
          setDuration(dur);
        }
        console.log(`[HLSNative] Loaded metadata - duration: ${dur}s`);
        
        if (autoPlay) {
          safePlay(video);
        }
      };
      
      const handleTimeUpdate = () => {
        if (!mountedRef.current) return;
        const time = video.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time, duration);
        
        // Log segment boundaries (detect discontinuities)
        const rounded = Math.floor(time);
        if (rounded !== lastBoundary && rounded > 0) {
          setLastBoundary(rounded);
          // Check for discontinuity by watching for jumps
          const diff = time - (lastBoundary ?? 0);
          if (lastBoundary !== null && Math.abs(diff - 1) > 0.5) {
            console.log(`[HLSNative] Segment boundary at ${time.toFixed(3)}s (jump: ${diff.toFixed(3)}s)`);
          }
        }
      };
      
      const handlePlay = () => {
        if (!mountedRef.current) return;
        setIsPlaying(true);
        
        // Sync master audio if present
        if (audioRef.current && masterAudioUrl) {
          audioRef.current.currentTime = video.currentTime;
          audioRef.current.play().catch(() => {});
        }
      };
      
      const handlePause = () => {
        if (!mountedRef.current) return;
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
      
      const handleEnded = () => {
        if (!mountedRef.current) return;
        setIsPlaying(false);
        console.log('[HLSNative] Playback ended');
        onEnded?.();
      };
      
      const handleError = (e: Event) => {
        if (!mountedRef.current) return;
        const errorMessage = (e.target as HTMLVideoElement)?.error?.message || 'Unknown error';
        console.error('[HLSNative] Error:', errorMessage);
        setError(errorMessage);
        setIsLoading(false);
        onError?.(errorMessage);
      };
      
      const handleWaiting = () => {
        if (!mountedRef.current) return;
        console.log('[HLSNative] Buffering...');
      };
      
      const handleCanPlay = () => {
        if (!mountedRef.current) return;
        console.log('[HLSNative] Can play');
        setIsLoading(false);
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
    }, [autoPlay, duration, lastBoundary, onEnded, onError, onTimeUpdate]);
    
    // Sync audio with video
    useEffect(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio || !masterAudioUrl) return;
      
      const syncAudio = () => {
        const drift = Math.abs(audio.currentTime - video.currentTime);
        if (drift > 0.1) {
          audio.currentTime = video.currentTime;
          console.log(`[HLSNative] Audio sync corrected - drift was ${drift.toFixed(3)}s`);
        }
      };
      
      const intervalId = setInterval(syncAudio, 1000);
      return () => clearInterval(intervalId);
    }, [masterAudioUrl]);
    
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
      
      // If using master audio, mute/unmute that instead of video
      if (masterAudioUrl && audio) {
        audio.muted = newMuted;
      } else {
        video.muted = newMuted;
      }
    }, [isMuted, masterAudioUrl]);
    
    const requestFullscreen = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if ((video as any).webkitEnterFullscreen) {
        // iOS Safari
        (video as any).webkitEnterFullscreen();
      }
    }, []);
    
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    return (
      <div 
        ref={ref}
        className={cn(
          "relative aspect-video bg-black rounded-xl overflow-hidden group",
          className
        )}
      >
        {/* Main video element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={hlsUrl}
          playsInline
          muted={muteClipAudio || isMuted}
          loop={loop}
          preload="auto"
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
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-white text-sm text-center">{error}</p>
          </div>
        )}
        
        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Progress bar */}
          <div className="w-full h-1 mb-3 bg-white/20 rounded-full">
            <div 
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
              
              <span className="text-xs text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
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
        
        {/* Path indicator (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-primary/80 text-primary-foreground text-xs rounded font-mono">
            HLS_NATIVE
          </div>
        )}
      </div>
    );
  }
));

HLSNativePlayer.displayName = 'HLSNativePlayer';

function formatTime(seconds: number): string {
  if (!isSafeVideoNumber(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
