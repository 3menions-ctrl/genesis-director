import { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlaylistProps {
  clips: string[];
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

export function VideoPlaylist({ clips, onPlayStateChange, className }: VideoPlaylistProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentClip = clips[currentClipIndex];

  useEffect(() => {
    // Reset to first clip when clips change
    setCurrentClipIndex(0);
    setIsPlaying(false);
  }, [clips]);

  // Track if we should auto-play the next clip
  const shouldAutoPlayRef = useRef(false);

  const handleVideoEnded = () => {
    if (currentClipIndex < clips.length - 1) {
      // Mark that we should auto-play next clip
      shouldAutoPlayRef.current = true;
      setCurrentClipIndex(prev => prev + 1);
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
    <div className={cn("relative w-full h-full", className)}>
      <video
        ref={videoRef}
        src={currentClip}
        className="w-full h-full object-cover"
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

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center group cursor-pointer"
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 backdrop-blur-xl">
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
                  : "bg-muted-foreground/50 hover:bg-muted-foreground"
              )}
            />
          ))}
          <span className="ml-2 text-xs font-mono text-muted-foreground">
            {currentClipIndex + 1}/{clips.length}
          </span>
        </div>
      )}
    </div>
  );
}