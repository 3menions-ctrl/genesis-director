import { useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlaylistProps {
  clips: string[];
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

export function VideoPlaylist({ clips, onPlayStateChange, className }: VideoPlaylistProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentClip = clips[currentClipIndex];
  const nextClip = clips[currentClipIndex + 1];

  // Track if we should auto-play the next clip
  const shouldAutoPlayRef = useRef(false);

  useEffect(() => {
    // Reset to first clip when clips change
    setCurrentClipIndex(0);
    setIsPlaying(false);
    setIsTransitioning(false);
  }, [clips]);

  // Preload next clip
  useEffect(() => {
    if (nextVideoRef.current && nextClip) {
      nextVideoRef.current.src = nextClip;
      nextVideoRef.current.load();
    }
  }, [nextClip, currentClipIndex]);

  const handleVideoEnded = () => {
    if (currentClipIndex < clips.length - 1) {
      // Start crossfade transition
      setIsTransitioning(true);
      shouldAutoPlayRef.current = true;
      
      // Brief delay for crossfade effect
      setTimeout(() => {
        setCurrentClipIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 500);
    } else {
      // All clips finished - reset to beginning
      shouldAutoPlayRef.current = false;
      setIsPlaying(false);
      setCurrentClipIndex(0);
      onPlayStateChange?.(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    // Load the new clip
    video.src = currentClip;
    video.load();
    
    // Auto-play if we should (after previous clip ended) or if already playing
    if (shouldAutoPlayRef.current || isPlaying) {
      const playPromise = video.play();
      if (playPromise) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            onPlayStateChange?.(true);
          })
          .catch((err) => {
            console.error('Failed to auto-play next clip:', err);
          });
      }
      shouldAutoPlayRef.current = false;
    }
  }, [currentClipIndex, currentClip]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      video.play().catch(console.error);
      setIsPlaying(true);
      onPlayStateChange?.(true);
    }
  };

  if (!clips.length) return null;

  return (
    <div className={cn("relative w-full h-full bg-black overflow-hidden", className)}>
      {/* Current video */}
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 w-full h-full object-contain transition-opacity duration-500",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
        onEnded={handleVideoEnded}
        onPlay={() => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayStateChange?.(false);
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

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center group cursor-pointer z-10"
        >
          <div className={cn(
            "relative flex items-center justify-center",
            "w-24 h-24 rounded-3xl",
            "bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent",
            "group-hover:scale-110 transition-all duration-400",
            "shadow-2xl"
          )}>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" />
            <Play className="relative w-10 h-10 text-white ml-1" />
          </div>
        </button>
      )}

      {/* Clip indicator */}
      {clips.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-xl z-10">
          {clips.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentClipIndex(idx);
                if (isPlaying) {
                  setTimeout(() => {
                    videoRef.current?.play().catch(console.error);
                  }, 100);
                }
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === currentClipIndex
                  ? "w-6 bg-primary"
                  : idx < currentClipIndex
                    ? "bg-primary/50"
                    : "bg-muted-foreground/50 hover:bg-muted-foreground"
              )}
            />
          ))}
          <span className="ml-2 text-xs font-mono text-muted-foreground">
            {currentClipIndex + 1}/{clips.length}
          </span>
        </div>
      )}

      {/* Transition overlay for smoother crossfade */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none z-5" />
      )}
    </div>
  );
}