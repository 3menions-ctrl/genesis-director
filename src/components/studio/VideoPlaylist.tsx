import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface VideoPlaylistProps {
  clips: string[];
  onPlayStateChange?: (isPlaying: boolean) => void;
  onProgressChange?: (progress: number, duration: number) => void;
  onClipChange?: (clipIndex: number, totalClips: number) => void;
  showControls?: boolean;
  className?: string;
}

export interface VideoPlaylistRef {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  seekTo: (percent: number) => void;
  nextClip: () => void;
  prevClip: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPlaylist = forwardRef<VideoPlaylistRef, VideoPlaylistProps>(
  ({ clips, onPlayStateChange, onProgressChange, onClipChange, showControls = true, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const nextVideoRef = useRef<HTMLVideoElement>(null);
    const [currentClipIndex, setCurrentClipIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControlsOverlay, setShowControlsOverlay] = useState(true);
    const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

    const currentClip = clips[currentClipIndex];
    const nextClip = clips[currentClipIndex + 1];
    const shouldAutoPlayRef = useRef(false);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play().catch(console.error);
      },
      pause: () => {
        videoRef.current?.pause();
      },
      togglePlay: () => {
        if (isPlaying) {
          videoRef.current?.pause();
        } else {
          videoRef.current?.play().catch(console.error);
        }
      },
      setVolume: (vol: number) => {
        if (videoRef.current) {
          videoRef.current.volume = vol;
          setVolume(vol);
        }
      },
      setMuted: (muted: boolean) => {
        if (videoRef.current) {
          videoRef.current.muted = muted;
          setIsMuted(muted);
        }
      },
      seekTo: (percent: number) => {
        if (videoRef.current && videoRef.current.duration) {
          videoRef.current.currentTime = (percent / 100) * videoRef.current.duration;
        }
      },
      nextClip: () => {
        if (currentClipIndex < clips.length - 1) {
          setCurrentClipIndex(prev => prev + 1);
        }
      },
      prevClip: () => {
        if (currentClipIndex > 0) {
          setCurrentClipIndex(prev => prev - 1);
        }
      },
      enterFullscreen: () => {
        containerRef.current?.requestFullscreen?.();
      },
      exitFullscreen: () => {
        document.exitFullscreen?.();
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
    }));

    useEffect(() => {
      setCurrentClipIndex(0);
      setIsPlaying(false);
      setIsTransitioning(false);
      setProgress(0);
    }, [clips]);

    useEffect(() => {
      if (nextVideoRef.current && nextClip) {
        nextVideoRef.current.src = nextClip;
        nextVideoRef.current.load();
      }
    }, [nextClip, currentClipIndex]);

    useEffect(() => {
      onClipChange?.(currentClipIndex, clips.length);
    }, [currentClipIndex, clips.length, onClipChange]);

    // Fullscreen change listener
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleVideoEnded = () => {
      if (currentClipIndex < clips.length - 1) {
        setIsTransitioning(true);
        shouldAutoPlayRef.current = true;
        setTimeout(() => {
          setCurrentClipIndex(prev => prev + 1);
          setIsTransitioning(false);
        }, 500);
      } else {
        shouldAutoPlayRef.current = false;
        setIsPlaying(false);
        setCurrentClipIndex(0);
        onPlayStateChange?.(false);
      }
    };

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !currentClip) return;

      video.src = currentClip;
      video.load();
      
      if (shouldAutoPlayRef.current || isPlaying) {
        video.play()
          .then(() => {
            setIsPlaying(true);
            onPlayStateChange?.(true);
          })
          .catch(console.error);
        shouldAutoPlayRef.current = false;
      }
    }, [currentClipIndex, currentClip]);

    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (video) {
        const currentProgress = (video.currentTime / video.duration) * 100;
        setProgress(currentProgress);
        setDuration(video.duration);
        onProgressChange?.(video.currentTime, video.duration);
      }
    };

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;

      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(console.error);
      }
    };

    const handleSeek = (value: number[]) => {
      const video = videoRef.current;
      if (video && video.duration) {
        video.currentTime = (value[0] / 100) * video.duration;
        setProgress(value[0]);
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    const handleVolumeChange = (value: number[]) => {
      if (videoRef.current) {
        const vol = value[0] / 100;
        videoRef.current.volume = vol;
        setVolume(vol);
        if (vol > 0 && isMuted) {
          videoRef.current.muted = false;
          setIsMuted(false);
        }
      }
    };

    const toggleFullscreen = () => {
      if (isFullscreen) {
        document.exitFullscreen?.();
      } else {
        containerRef.current?.requestFullscreen?.();
      }
    };

    const goToNextClip = () => {
      if (currentClipIndex < clips.length - 1) {
        shouldAutoPlayRef.current = isPlaying;
        setCurrentClipIndex(prev => prev + 1);
      }
    };

    const goToPrevClip = () => {
      const video = videoRef.current;
      if (video && video.currentTime > 3) {
        video.currentTime = 0;
      } else if (currentClipIndex > 0) {
        shouldAutoPlayRef.current = isPlaying;
        setCurrentClipIndex(prev => prev - 1);
      } else if (video) {
        video.currentTime = 0;
      }
    };

    const formatTime = (seconds: number) => {
      if (!seconds || isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate total duration and current time across all clips
    const clipDuration = 8; // Each clip is 8 seconds
    const totalDuration = clips.length * clipDuration;
    const currentTotalTime = (currentClipIndex * clipDuration) + (duration ? (progress / 100) * duration : 0);
    const totalProgress = (currentTotalTime / totalDuration) * 100;

    // Auto-hide controls
    const handleMouseMove = () => {
      setShowControlsOverlay(true);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      if (isPlaying) {
        hideControlsTimeout.current = setTimeout(() => {
          setShowControlsOverlay(false);
        }, 3000);
      }
    };

    if (!clips.length) return null;

    return (
      <div 
        ref={containerRef}
        className={cn("relative w-full h-full bg-black overflow-hidden group", className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControlsOverlay(false)}
        onMouseEnter={() => setShowControlsOverlay(true)}
      >
        {/* Current video */}
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 w-full h-full object-contain transition-opacity duration-500",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => {
            setIsPlaying(true);
            onPlayStateChange?.(true);
          }}
          onPause={() => {
            setIsPlaying(false);
            onPlayStateChange?.(false);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          playsInline
        />

        {/* Next video (for crossfade preload) */}
        {nextClip && (
          <video
            ref={nextVideoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-opacity duration-500",
              isTransitioning ? "opacity-100" : "opacity-0"
            )}
            playsInline
            muted
          />
        )}

        {/* Center Play Button (when paused) */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/90 hover:bg-white hover:scale-110 transition-all duration-300 shadow-2xl">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
              <Play className="relative w-8 h-8 md:w-12 md:h-12 text-black ml-1" fill="currentColor" />
            </div>
          </button>
        )}

        {/* Controls Overlay */}
        {showControls && (
          <div 
            className={cn(
              "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-4 pt-16 transition-opacity duration-300 z-20",
              showControlsOverlay || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {/* Total Progress Bar */}
            <div className="mb-4">
              <Slider
                value={[totalProgress]}
                onValueChange={(val) => {
                  // Calculate which clip and position
                  const targetTime = (val[0] / 100) * totalDuration;
                  const targetClip = Math.min(Math.floor(targetTime / clipDuration), clips.length - 1);
                  const clipTime = targetTime - (targetClip * clipDuration);
                  
                  if (targetClip !== currentClipIndex) {
                    shouldAutoPlayRef.current = isPlaying;
                    setCurrentClipIndex(targetClip);
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = clipTime;
                      }
                    }, 100);
                  } else if (videoRef.current) {
                    videoRef.current.currentTime = clipTime;
                  }
                }}
                max={100}
                step={0.1}
                className="w-full cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-white"
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Left Controls */}
              <div className="flex items-center gap-1 md:gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-12 md:w-12 text-white hover:bg-white/20"
                  onClick={goToPrevClip}
                >
                  <SkipBack className="w-5 h-5 md:w-6 md:h-6" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-12 w-12 md:h-14 md:w-14 text-white hover:bg-white/20"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" />
                  ) : (
                    <Play className="w-6 h-6 md:w-8 md:h-8 ml-0.5" fill="currentColor" />
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-12 md:w-12 text-white hover:bg-white/20"
                  onClick={goToNextClip}
                >
                  <SkipForward className="w-5 h-5 md:w-6 md:h-6" />
                </Button>

                {/* Volume */}
                <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-white hover:bg-white/20"
                    onClick={toggleMute}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </Button>
                  <Slider 
                    value={[isMuted ? 0 : volume * 100]} 
                    onValueChange={handleVolumeChange} 
                    max={100} 
                    className="w-24 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3" 
                  />
                </div>
              </div>

              {/* Center - Time */}
              <div className="flex items-center gap-2 text-sm md:text-base font-mono text-white">
                <span>{formatTime(currentTotalTime)}</span>
                <span className="text-white/50">/</span>
                <span className="text-white/70">{formatTime(totalDuration)}</span>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1">
                {/* Clip indicator */}
                {clips.length > 1 && (
                  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 mr-2">
                    {clips.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          shouldAutoPlayRef.current = isPlaying;
                          setCurrentClipIndex(idx);
                        }}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          idx === currentClipIndex
                            ? "w-5 bg-primary"
                            : idx < currentClipIndex
                              ? "bg-primary/50"
                              : "bg-white/30 hover:bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                )}

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-12 md:w-12 text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Transition overlay */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-black/30 pointer-events-none z-5" />
        )}
      </div>
    );
  }
);

VideoPlaylist.displayName = 'VideoPlaylist';
