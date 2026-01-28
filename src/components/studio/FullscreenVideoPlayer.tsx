import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Download, ExternalLink, Edit2,
  Loader2
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

const CROSSFADE_DURATION = 30; // ms - brief overlap for smooth blending
const CROSSFADE_START_BEFORE_END = 0.15; // seconds - start transition just before clip ends
const PRELOAD_TRIGGER_PERCENT = 0.3; // Start preloading next clip at 30% of current

// Buffer states for the triple buffer pool
type BufferState = 'empty' | 'loading' | 'ready';

interface VideoBuffer {
  ref: React.RefObject<HTMLVideoElement>;
  clipIndex: number;
  state: BufferState;
}

export function FullscreenVideoPlayer({
  clips,
  title,
  musicUrl,
  onClose,
  onDownload,
  onEdit,
  onOpenExternal,
}: FullscreenVideoPlayerProps) {
  // Triple buffer pool refs
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const videoCRef = useRef<HTMLVideoElement>(null); // Preload buffer
  const musicRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);

  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'A' | 'B'>('A');
  const [preloadedClipIndex, setPreloadedClipIndex] = useState<number | null>(null);
  const [isWaitingForBuffer, setIsWaitingForBuffer] = useState(false);
  
  // Track video sources via state
  const [videoASrc, setVideoASrc] = useState(clips[0] || '');
  const [videoBSrc, setVideoBSrc] = useState('');
  const [videoCSrc, setVideoCSrc] = useState(''); // Preload buffer source
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clipDurations, setClipDurations] = useState<number[]>([]); // Track each clip's duration
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
  const activeVideoRef = useRef(activeVideo);
  const isPlayingRef = useRef(isPlaying);
  const preloadTriggeredRef = useRef(false);
  const transitionTriggeredRef = useRef(false);
  
  useEffect(() => {
    currentClipIndexRef.current = currentClipIndex;
  }, [currentClipIndex]);
  
  useEffect(() => {
    isTransitioningRef.current = isTransitioning;
  }, [isTransitioning]);

  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Get video refs by ID
  const getVideoRef = useCallback((id: 'A' | 'B' | 'C') => {
    switch (id) {
      case 'A': return videoARef.current;
      case 'B': return videoBRef.current;
      case 'C': return videoCRef.current;
    }
  }, []);

  // Preload next clip into buffer C
  const preloadNextClip = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= clips.length) return;
    if (preloadedClipIndex === nextIndex) return; // Already preloaded
    
    const preloadVideo = videoCRef.current;
    if (!preloadVideo) return;

    setVideoCSrc(clips[nextIndex]);
    preloadVideo.src = clips[nextIndex];
    preloadVideo.load();
    
    const handleCanPlayThrough = () => {
      setPreloadedClipIndex(nextIndex);
      preloadVideo.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
    
    preloadVideo.addEventListener('canplaythrough', handleCanPlayThrough);
  }, [clips, preloadedClipIndex]);

  // Smooth crossfade with audio fade
  const transitionToClip = useCallback((nextIndex: number, isPreemptive = false) => {
    if (isTransitioningRef.current || nextIndex < 0 || nextIndex >= clips.length) return;
    if (nextIndex === currentClipIndexRef.current) return;

    const isNextA = activeVideoRef.current === 'B';
    const nextVideo = isNextA ? videoARef.current : videoBRef.current;
    const currentVideo = isNextA ? videoBRef.current : videoARef.current;
    const preloadVideo = videoCRef.current;
    
    if (!nextVideo || !currentVideo) return;

    setIsTransitioning(true);
    transitionTriggeredRef.current = true;

    const nextSrc = clips[nextIndex];
    
    // Check if we have this clip preloaded
    const isPreloaded = preloadedClipIndex === nextIndex && preloadVideo;
    
    // If preloaded, copy from buffer C to the target buffer
    if (isPreloaded && preloadVideo) {
      // Copy the preloaded source to the next video
      if (isNextA) {
        setVideoASrc(nextSrc);
      } else {
        setVideoBSrc(nextSrc);
      }
      nextVideo.src = nextSrc;
      nextVideo.currentTime = 0;
      nextVideo.volume = 0;
      nextVideo.muted = isMuted;
      nextVideo.load();
    } else {
      if (isNextA) {
        setVideoASrc(nextSrc);
      } else {
        setVideoBSrc(nextSrc);
      }
      nextVideo.src = nextSrc;
      nextVideo.currentTime = 0;
      nextVideo.volume = 0;
      nextVideo.muted = isMuted;
      nextVideo.load();
    }

    // Brief crossfade with audio blend - last frame overlaps with first frame of next
    const crossfadeAudioAndVideo = () => {
      const steps = 3; // Very brief crossfade
      const stepDuration = CROSSFADE_DURATION / steps;
      let step = 0;
      
      const fadeInterval = setInterval(() => {
        step++;
        const progress = step / steps;
        
        if (!isMuted) {
          currentVideo.volume = Math.max(0, volume * (1 - progress));
          nextVideo.volume = Math.min(volume, volume * progress);
        }
        
        if (step >= steps) {
          clearInterval(fadeInterval);
          currentVideo.pause();
          currentVideo.currentTime = 0;
          currentVideo.volume = volume;
          setIsTransitioning(false);
          transitionTriggeredRef.current = false;
          preloadTriggeredRef.current = false;
          setPreloadedClipIndex(null);
          
          // Start preloading the NEXT next clip
          const upcomingIndex = (nextIndex + 1) % clips.length;
          if (clips.length > 1) {
            preloadNextClip(upcomingIndex);
          }
        }
      }, stepDuration);
    };

    // Start transition immediately when video is ready
    const startTransition = () => {
      setIsWaitingForBuffer(false);
      nextVideo.play().then(() => {
        setActiveVideo(isNextA ? 'A' : 'B');
        setCurrentClipIndex(nextIndex);
        crossfadeAudioAndVideo();
      }).catch((err) => {
        console.error('Video play failed:', err);
        setIsTransitioning(false);
        transitionTriggeredRef.current = false;
      });
    };

    // Check if video is ready with fallback
    if (nextVideo.readyState >= 3) {
      startTransition();
    } else {
      // Show loading indicator if we have to wait
      setIsWaitingForBuffer(true);
      
      const handleCanPlay = () => {
        startTransition();
        nextVideo.removeEventListener('canplay', handleCanPlay);
      };
      
      nextVideo.addEventListener('canplay', handleCanPlay, { once: true });
      
      // Fallback timeout - if video doesn't load in 3 seconds, try anyway
      setTimeout(() => {
        if (nextVideo.readyState < 3) {
          startTransition();
        }
      }, 3000);
    }
  }, [clips, volume, isMuted, preloadedClipIndex, preloadNextClip]);

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

  // Handle play/pause
  const togglePlay = useCallback(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    const music = musicRef.current;
    const activeVideoEl = activeVideoRef.current === 'A' ? videoA : videoB;
    
    if (!activeVideoEl) return;
    
    if (activeVideoEl.paused) {
      activeVideoEl.play();
      music?.play();
      setIsPlaying(true);
    } else {
      videoA?.pause();
      videoB?.pause();
      music?.pause();
      setIsPlaying(false);
    }
  }, []);

  // Handle mute/unmute
  const toggleMute = useCallback(() => {
    const video = activeVideoRef.current === 'A' ? videoARef.current : videoBRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Handle mute/unmute music
  const toggleMusicMute = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    
    music.muted = !music.muted;
    setIsMusicMuted(music.muted);
  }, []);

  // Handle video volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = activeVideoRef.current === 'A' ? videoARef.current : videoBRef.current;
    if (!video) return;
    
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

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
    const video = activeVideoRef.current === 'A' ? videoARef.current : videoBRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Reset preload triggers when seeking
    preloadTriggeredRef.current = false;
    transitionTriggeredRef.current = false;
  }, [duration]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    const video = activeVideoRef.current === 'A' ? videoARef.current : videoBRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  }, [duration]);

  // Toggle fullscreen - Safari/iOS compatible
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const elem = container as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    
    const isCurrentlyFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;

    if (!isCurrentlyFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, []);

  // Show controls on mouse move
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlayingRef.current) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  // Load all clip durations on mount for accurate total time display
  useEffect(() => {
    const loadDurations = async () => {
      const durations: number[] = [];
      
      for (const clipUrl of clips) {
        try {
          const video = document.createElement('video');
          video.preload = 'metadata';
          
          await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
              durations.push(video.duration || 0);
              resolve();
            };
            video.onerror = () => {
              durations.push(0);
              resolve();
            };
            video.src = clipUrl;
          });
        } catch {
          durations.push(0);
        }
      }
      
      setClipDurations(durations);
    };
    
    if (clips.length > 1) {
      loadDurations();
    }
  }, [clips]);

  // Phase 2: RAF-based timing loop (60fps precision)
  useEffect(() => {
    if (clips.length <= 1) return;

    const tick = () => {
      const video = activeVideoRef.current === 'A' ? videoARef.current : videoBRef.current;
      
      if (video && !video.paused && video.duration > 0) {
        const currentT = video.currentTime;
        const totalDuration = video.duration;
        const percentComplete = currentT / totalDuration;
        const timeRemaining = totalDuration - currentT;

        // Update UI time (throttled to reduce re-renders)
        setCurrentTime(currentT);
        setDuration(totalDuration);

        // Phase 1: Trigger preload at 30%
        if (percentComplete >= PRELOAD_TRIGGER_PERCENT && !preloadTriggeredRef.current) {
          preloadTriggeredRef.current = true;
          const nextIndex = (currentClipIndexRef.current + 1) % clips.length;
          preloadNextClip(nextIndex);
        }

        // Trigger transition at CROSSFADE_START_BEFORE_END seconds before end
        if (timeRemaining > 0 && timeRemaining <= CROSSFADE_START_BEFORE_END && !transitionTriggeredRef.current) {
          const nextIndex = (currentClipIndexRef.current + 1) % clips.length;
          transitionToClip(nextIndex, true);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [clips.length, preloadNextClip, transitionToClip]);

  // Handle video ended event (fallback for very short clips)
  useEffect(() => {
    const handleEnded = () => {
      if (clips.length > 1 && !isTransitioningRef.current) {
        nextClip();
      }
    };

    const videoA = videoARef.current;
    const videoB = videoBRef.current;

    videoA?.addEventListener('ended', handleEnded);
    videoB?.addEventListener('ended', handleEnded);

    return () => {
      videoA?.removeEventListener('ended', handleEnded);
      videoB?.removeEventListener('ended', handleEnded);
    };
  }, [clips.length, nextClip]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
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

  // Calculate total elapsed time and total duration across all clips
  const totalDuration = useMemo(() => {
    if (clips.length === 1) return duration;
    if (clipDurations.length === clips.length) {
      return clipDurations.reduce((sum, d) => sum + d, 0);
    }
    // Fallback: estimate based on current clip duration
    return duration * clips.length;
  }, [clips.length, clipDurations, duration]);

  const totalElapsedTime = useMemo(() => {
    if (clips.length === 1) return currentTime;
    // Sum durations of all completed clips + current clip time
    const completedClipsTime = clipDurations
      .slice(0, currentClipIndex)
      .reduce((sum, d) => sum + d, 0);
    return completedClipsTime + currentTime;
  }, [clips.length, clipDurations, currentClipIndex, currentTime]);

  const progress = totalDuration > 0 ? (totalElapsedTime / totalDuration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black w-screen h-screen"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlayingRef.current && setShowControls(false)}
    >
      {/* Video A Layer */}
      <video
        ref={videoARef}
        src={videoASrc}
        className={cn(
          "absolute inset-0 w-full h-full object-contain",
          "transition-opacity ease-in-out",
          activeVideo === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        )}
        style={{ transitionDuration: `${CROSSFADE_DURATION}ms` }}
        autoPlay
        loop={clips.length === 1}
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Video B Layer (for crossfade) */}
      <video
        ref={videoBRef}
        src={videoBSrc}
        className={cn(
          "absolute inset-0 w-full h-full object-contain",
          "transition-opacity ease-in-out",
          activeVideo === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        )}
        style={{ transitionDuration: `${CROSSFADE_DURATION}ms` }}
        loop={clips.length === 1}
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Video C Layer (hidden preload buffer) */}
      <video
        ref={videoCRef}
        src={videoCSrc}
        className="hidden"
        preload="auto"
        muted
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

      {/* Phase 3: Loading/Buffering Indicator */}
      {isWaitingForBuffer && (
        <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 bg-black/60 backdrop-blur-sm px-6 py-4 rounded-xl">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white/80 text-sm font-medium">Buffering next clip...</span>
          </div>
        </div>
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

              {/* Time - shows total elapsed / total duration for multi-clip videos */}
              <span className="text-white/70 text-sm font-medium ml-2 tabular-nums">
                {formatTime(totalElapsedTime)} / {formatTime(totalDuration)}
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

      {/* Transition indicator (subtle) */}
      {isTransitioning && !isWaitingForBuffer && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}
