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
  musicUrl?: string; // Continuous background music track
  onClose: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onOpenExternal?: () => void;
}

const CROSSFADE_DURATION = 1500; // ms - smooth crossfade duration
const CROSSFADE_START_BEFORE_END = 2; // seconds - start transition before clip ends

export function FullscreenVideoPlayer({
  clips,
  title,
  musicUrl,
  onClose,
  onDownload,
  onEdit,
  onOpenExternal,
}: FullscreenVideoPlayerProps) {
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'primary' | 'secondary'>('primary');
  
  // Track video sources via state to prevent React from resetting them
  const [primarySrc, setPrimarySrc] = useState(clips[0] || '');
  const [secondarySrc, setSecondarySrc] = useState('');
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.4); // Music at 40% by default
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

  // Refs to track current state without stale closures
  const currentClipIndexRef = useRef(currentClipIndex);
  const isTransitioningRef = useRef(isTransitioning);
  
  useEffect(() => {
    currentClipIndexRef.current = currentClipIndex;
  }, [currentClipIndex]);
  
  useEffect(() => {
    isTransitioningRef.current = isTransitioning;
  }, [isTransitioning]);

  // Smooth crossfade with audio fade
  const transitionToClip = useCallback((nextIndex: number, isPreemptive = false) => {
    if (isTransitioningRef.current || nextIndex < 0 || nextIndex >= clips.length) return;
    if (nextIndex === currentClipIndexRef.current) return;

    const isNextPrimary = activeVideo === 'secondary';
    const nextVideo = isNextPrimary ? primaryVideoRef.current : secondaryVideoRef.current;
    const currentVideo = isNextPrimary ? secondaryVideoRef.current : primaryVideoRef.current;
    
    if (!nextVideo || !currentVideo) return;

    setIsTransitioning(true);

    // Update source via state (this prevents React from resetting it on re-render)
    const nextSrc = clips[nextIndex];
    if (isNextPrimary) {
      setPrimarySrc(nextSrc);
    } else {
      setSecondarySrc(nextSrc);
    }

    // Also set via ref for immediate effect before React re-renders
    nextVideo.src = nextSrc;
    nextVideo.currentTime = 0;
    nextVideo.volume = 0; // Start silent for crossfade
    nextVideo.muted = isMuted;
    nextVideo.load();

    // Audio crossfade function
    const crossfadeAudio = () => {
      const steps = 30;
      const stepDuration = CROSSFADE_DURATION / steps;
      let step = 0;
      
      const fadeInterval = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 2); // Ease out
        
        // Fade out current, fade in next
        if (!isMuted) {
          currentVideo.volume = Math.max(0, volume * (1 - eased));
          nextVideo.volume = Math.min(volume, volume * eased);
        }
        
        if (step >= steps) {
          clearInterval(fadeInterval);
          // Cleanup after crossfade
          currentVideo.pause();
          currentVideo.currentTime = 0;
          currentVideo.volume = volume; // Reset for next use
          setIsTransitioning(false);
        }
      }, stepDuration);
    };

    // Wait for next video to be ready before transitioning
    const startTransition = () => {
      nextVideo.play().then(() => {
        // Start visual crossfade
        setActiveVideo(isNextPrimary ? 'primary' : 'secondary');
        setCurrentClipIndex(nextIndex);
        
        // Start audio crossfade
        crossfadeAudio();
      }).catch((err) => {
        console.error('Video play failed:', err);
        setIsTransitioning(false);
      });
    };

    // Check if video is ready
    if (nextVideo.readyState >= 3) {
      startTransition();
    } else {
      nextVideo.addEventListener('canplay', startTransition, { once: true });
    }
  }, [clips, activeVideo, volume, isMuted]);

  // Go to next clip
  const nextClip = useCallback(() => {
    const nextIndex = (currentClipIndexRef.current + 1) % clips.length;
    transitionToClip(nextIndex);
  }, [clips.length, transitionToClip]);

  // Go to previous clip
  const prevClip = useCallback(() => {
    const prevIndex = currentClipIndexRef.current === 0 ? clips.length - 1 : currentClipIndexRef.current - 1;
    transitionToClip(prevIndex);
  }, [clips.length, transitionToClip]);

  // Handle play/pause - control BOTH videos and music to stay in sync
  const togglePlay = useCallback(() => {
    const primaryVideo = primaryVideoRef.current;
    const secondaryVideo = secondaryVideoRef.current;
    const music = musicRef.current;
    const activeVideoEl = activeVideo === 'primary' ? primaryVideo : secondaryVideo;
    
    if (!activeVideoEl) return;
    
    if (activeVideoEl.paused) {
      activeVideoEl.play();
      music?.play();
      setIsPlaying(true);
    } else {
      // Pause BOTH videos and music to prevent audio from continuing
      primaryVideo?.pause();
      secondaryVideo?.pause();
      music?.pause();
      setIsPlaying(false);
    }
  }, [activeVideo]);

  // Handle mute/unmute (video audio - dialogue/SFX)
  const toggleMute = useCallback(() => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [activeVideo]);

  // Handle mute/unmute music
  const toggleMusicMute = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    
    music.muted = !music.muted;
    setIsMusicMuted(music.muted);
  }, []);

  // Handle video volume change (dialogue/SFX)
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;
    
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, [activeVideo]);

  // Handle music volume change
  const handleMusicVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const music = musicRef.current;
    if (!music) return;
    
    const newVolume = parseFloat(e.target.value);
    music.volume = newVolume;
    setMusicVolume(newVolume);
    setIsMusicMuted(newVolume === 0);
  }, []);

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

  // Update time from active video and trigger pre-emptive transitions
  useEffect(() => {
    const video = activeVideo === 'primary' ? primaryVideoRef.current : secondaryVideoRef.current;
    if (!video) return;

    let preemptiveTriggered = false;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Pre-emptive transition: start crossfade before clip ends
      if (clips.length > 1 && !isTransitioningRef.current && !preemptiveTriggered) {
        const timeRemaining = video.duration - video.currentTime;
        if (timeRemaining > 0 && timeRemaining <= CROSSFADE_START_BEFORE_END) {
          preemptiveTriggered = true;
          const nextIndex = (currentClipIndexRef.current + 1) % clips.length;
          transitionToClip(nextIndex, true);
        }
      }
    };
    
    const handleDurationChange = () => setDuration(video.duration);
    
    const handleEnded = () => {
      // Fallback: if pre-emptive didn't trigger (very short clips), advance now
      if (clips.length > 1 && !isTransitioningRef.current) {
        nextClip();
      }
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      const primaryPaused = primaryVideoRef.current?.paused ?? true;
      const secondaryPaused = secondaryVideoRef.current?.paused ?? true;
      if (primaryPaused && secondaryPaused) {
        setIsPlaying(false);
      }
    };

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
  }, [activeVideo, clips.length, nextClip, transitionToClip]);

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

  // Sync music with video playback
  useEffect(() => {
    const music = musicRef.current;
    if (!music || !musicUrl) return;

    music.volume = musicVolume;
    music.muted = isMusicMuted;
    
    if (isPlaying) {
      music.play().catch(() => {});
    } else {
      music.pause();
    }
  }, [isPlaying, musicUrl, musicVolume, isMusicMuted]);


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
        src={primarySrc}
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
        src={secondarySrc}
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

      {/* Continuous Background Music */}
      {musicUrl && (
        <audio
          ref={musicRef}
          src={musicUrl}
          loop
          autoPlay
        />
      )}

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

              {/* Video Volume (Dialogue/SFX) */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                  title="Video Audio (Dialogue/SFX)"
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
                  className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  title="Video Audio"
                />
              </div>

              {/* Music Volume */}
              {musicUrl && (
                <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                  <button
                    onClick={toggleMusicMute}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                    title="Background Music"
                  >
                    {isMusicMuted || musicVolume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <span className="text-white/50 text-xs">Music</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMusicMuted ? 0 : musicVolume}
                    onChange={handleMusicVolumeChange}
                    className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    title="Music Volume"
                  />
                </div>
              )}

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