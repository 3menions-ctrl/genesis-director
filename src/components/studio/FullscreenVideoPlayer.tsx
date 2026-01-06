import { useRef, useState, useEffect, useCallback } from 'react';
import { 
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Download, ExternalLink, Edit2,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullscreenVideoPlayerProps {
  clips: string[];
  title?: string;
  onClose: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onOpenExternal?: () => void;
}

const CROSSFADE_DURATION = 800; // ms - longer for smoother transitions

export function FullscreenVideoPlayer({
  clips,
  title,
  onClose,
  onDownload,
  onEdit,
  onOpenExternal,
}: FullscreenVideoPlayerProps) {
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'primary' | 'secondary'>('primary');
  const [nextVideoReady, setNextVideoReady] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Format time as MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Preload and prepare next video
  const prepareNextVideo = useCallback((nextIndex: number) => {
    const nextVideo = activeVideo === 'primary' ? secondaryVideoRef.current : primaryVideoRef.current;
    if (!nextVideo || nextIndex < 0 || nextIndex >= clips.length) return;

    setNextVideoReady(false);
    nextVideo.src = clips[nextIndex];
    nextVideo.load();
    nextVideo.currentTime = 0;
    nextVideo.volume = volume;
    nextVideo.muted = isMuted;

    // Wait for video to be fully ready
    const handleCanPlay = () => {
      setNextVideoReady(true);
      nextVideo.removeEventListener('canplaythrough', handleCanPlay);
    };
    nextVideo.addEventListener('canplaythrough', handleCanPlay);
  }, [activeVideo, clips, volume, isMuted]);

  // Smooth crossfade to next clip
  const transitionToClip = useCallback((nextIndex: number) => {
    if (isTransitioning || nextIndex < 0 || nextIndex >= clips.length) return;
    if (nextIndex === currentClipIndex) return;

    const nextVideo = activeVideo === 'primary' ? secondaryVideoRef.current : primaryVideoRef.current;
    const currentVideo = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    
    if (!nextVideo || !currentVideo) return;

    setIsTransitioning(true);

    // Prepare next video if not already ready
    if (nextVideo.src !== clips[nextIndex]) {
      nextVideo.src = clips[nextIndex];
      nextVideo.load();
    }
    nextVideo.currentTime = 0;
    nextVideo.volume = volume;
    nextVideo.muted = isMuted;

    // Wait for next video to be ready before transitioning
    const startTransition = () => {
      nextVideo.play().then(() => {
        // Immediately start crossfade - both videos visible during transition
        setActiveVideo(prev => prev === 'primary' ? 'secondary' : 'primary');
        setCurrentClipIndex(nextIndex);
        
        // Wait for crossfade to complete before cleanup
        setTimeout(() => {
          currentVideo.pause();
          setIsTransitioning(false);
          // Preload the next clip in sequence
          const upcomingIndex = (nextIndex + 1) % clips.length;
          if (clips.length > 1) {
            prepareNextVideo(upcomingIndex);
          }
        }, CROSSFADE_DURATION);
      }).catch(() => {
        setIsTransitioning(false);
      });
    };

    // Check if video is ready
    if (nextVideo.readyState >= 3) {
      startTransition();
    } else {
      nextVideo.addEventListener('canplay', startTransition, { once: true });
    }
  }, [clips, currentClipIndex, isTransitioning, activeVideo, volume, isMuted, prepareNextVideo]);

  // Go to next clip
  const nextClip = useCallback(() => {
    const nextIndex = (currentClipIndex + 1) % clips.length;
    transitionToClip(nextIndex);
  }, [currentClipIndex, clips.length, transitionToClip]);

  // Go to previous clip
  const prevClip = useCallback(() => {
    const prevIndex = currentClipIndex === 0 ? clips.length - 1 : currentClipIndex - 1;
    transitionToClip(prevIndex);
  }, [currentClipIndex, clips.length, transitionToClip]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [activeVideo]);

  // Handle mute/unmute
  const toggleMute = useCallback(() => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [activeVideo]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;
    
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, [activeVideo]);

  // Handle seeking
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [activeVideo, duration]);

  // Skip forward/backward in current clip
  const skip = useCallback((seconds: number) => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  }, [activeVideo, duration]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Show controls on mouse move
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Update time from active video
  useEffect(() => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      // For multiple clips, auto-advance with crossfade
      // For single clip, the loop attribute handles it
      if (clips.length > 1) {
        nextClip();
      }
      // Don't set isPlaying to false - loop will restart
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [activeVideo, clips.length, nextClip]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (e.shiftKey && clips.length > 1) {
            prevClip();
          } else {
            skip(-10);
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey && clips.length > 1) {
            nextClip();
          } else {
            skip(10);
          }
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'n':
          if (clips.length > 1) nextClip();
          break;
        case 'p':
          if (clips.length > 1) prevClip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, skip, onClose, nextClip, prevClip, clips.length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  // Preload next clip on mount and after transitions
  useEffect(() => {
    if (clips.length > 1) {
      const nextIndex = (currentClipIndex + 1) % clips.length;
      prepareNextVideo(nextIndex);
    }
  }, [currentClipIndex, clips.length, prepareNextVideo]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black w-screen h-screen"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Primary Video Layer */}
      <video
        ref={primaryVideoRef}
        src={clips[0]}
        className={cn(
          "absolute inset-0 w-full h-full object-contain",
          "transition-opacity ease-in-out",
          activeVideo === 'primary' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        )}
        style={{ transitionDuration: `${CROSSFADE_DURATION}ms` }}
        autoPlay
        loop={clips.length === 1}
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => {
          if (clips.length > 1) nextClip();
        }}
      />

      {/* Secondary Video Layer (for crossfade) */}
      <video
        ref={secondaryVideoRef}
        className={cn(
          "absolute inset-0 w-full h-full object-contain",
          "transition-opacity ease-in-out",
          activeVideo === 'secondary' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        )}
        style={{ transitionDuration: `${CROSSFADE_DURATION}ms` }}
        loop={clips.length === 1}
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => {
          if (clips.length > 1) nextClip();
        }}
      />

      {/* Controls Overlay */}
      <div 
        className={cn(
          "absolute inset-0 z-20 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Top Bar - Title & Close */}
        <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-white font-medium text-lg sm:text-xl truncate drop-shadow-lg">
                {title || 'Untitled'}
              </h2>
              <p className="text-white/50 text-sm mt-0.5">
                {clips.length > 1 ? `Clip ${currentClipIndex + 1} of ${clips.length}` : '1 clip'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          {/* Clip indicators */}
          {clips.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {clips.map((_, index) => (
                <button
                  key={index}
                  onClick={() => transitionToClip(index)}
                  disabled={isTransitioning}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    index === currentClipIndex 
                      ? "w-6 bg-white" 
                      : "w-1.5 bg-white/40 hover:bg-white/60"
                  )}
                />
              ))}
            </div>
          )}

          {/* Progress Bar */}
          <div 
            ref={progressRef}
            className="relative h-1.5 bg-white/20 rounded-full cursor-pointer mb-4 group"
            onClick={handleSeek}
          >
            {/* Buffered */}
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: '100%' }} />
            {/* Progress */}
            <div 
              className="absolute inset-y-0 left-0 bg-white rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            {/* Thumb */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 8px)` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" fill="currentColor" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                )}
              </button>

              {/* Skip Back */}
              <button
                onClick={() => skip(-10)}
                className="w-10 h-10 hidden sm:flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => skip(10)}
                className="w-10 h-10 hidden sm:flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* Time */}
              <span className="text-white/70 text-sm font-medium ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Action Buttons */}
              {onOpenExternal && (
                <button
                  onClick={onOpenExternal}
                  className="hidden sm:flex items-center gap-2 h-9 px-4 bg-white/10 text-white text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden md:inline">Open</span>
                </button>
              )}
              
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="hidden sm:flex items-center gap-2 h-9 px-4 bg-white/10 text-white text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden md:inline">Download</span>
                </button>
              )}

              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 h-9 px-4 sm:px-5 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all shadow-lg"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transition indicator */}
      {isTransitioning && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}