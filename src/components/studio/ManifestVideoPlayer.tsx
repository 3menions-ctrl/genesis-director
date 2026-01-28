import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface ManifestClip {
  index: number;
  shotId: string;
  videoUrl: string;
  audioUrl?: string;
  duration: number;
  transitionOut: string;
  startTime: number;
}

interface VideoManifest {
  version: string;
  projectId: string;
  createdAt: string;
  clips: ManifestClip[];
  totalDuration: number;
}

interface ManifestVideoPlayerProps {
  manifestUrl: string;
  className?: string;
}

export function ManifestVideoPlayer({ manifestUrl, className }: ManifestVideoPlayerProps) {
  const [manifest, setManifest] = useState<VideoManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [clipProgress, setClipProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load manifest
  useEffect(() => {
    const loadManifest = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error('Failed to load manifest');
        const data = await response.json();
        setManifest(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video manifest');
      } finally {
        setIsLoading(false);
      }
    };
    loadManifest();
  }, [manifestUrl]);

  // Handle video time updates
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !manifest) return;
    
    const video = videoRef.current;
    const clip = manifest.clips[currentClipIndex];
    
    // Calculate overall progress
    const overallTime = clip.startTime + video.currentTime;
    setCurrentTime(overallTime);
    setClipProgress((video.currentTime / clip.duration) * 100);
  }, [currentClipIndex, manifest]);

  // Handle clip ended - move to next
  const handleClipEnded = useCallback(() => {
    if (!manifest) return;
    
    if (currentClipIndex < manifest.clips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      // Video complete
      setIsPlaying(false);
      setCurrentClipIndex(0);
    }
  }, [currentClipIndex, manifest]);

  // Auto-play next clip when index changes
  useEffect(() => {
    if (!videoRef.current || !manifest || !isPlaying) return;
    videoRef.current.play().catch(() => {});
  }, [currentClipIndex, manifest, isPlaying]);

  // Play/Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  // Skip to next/previous clip
  const skipNext = () => {
    if (!manifest || currentClipIndex >= manifest.clips.length - 1) return;
    setCurrentClipIndex(prev => prev + 1);
  };

  const skipPrev = () => {
    if (currentClipIndex <= 0) {
      if (videoRef.current) videoRef.current.currentTime = 0;
      return;
    }
    setCurrentClipIndex(prev => prev - 1);
  };

  // Fullscreen - Safari/iOS compatible
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    const elem = containerRef.current as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    
    const isCurrentlyFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;
    
    if (isCurrentlyFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Download all clips as a zip would be ideal, but for now link to first clip
  const handleDownload = () => {
    if (!manifest || manifest.clips.length === 0) return;
    // Open first clip for download - in future could implement zip
    window.open(manifest.clips[0].videoUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center bg-black rounded-xl aspect-video", className)}>
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-white/70">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className={cn("flex items-center justify-center bg-black rounded-xl aspect-video", className)}>
        <p className="text-destructive">{error || 'Failed to load video'}</p>
      </div>
    );
  }

  const currentClip = manifest.clips[currentClipIndex];
  const overallProgress = (currentTime / manifest.totalDuration) * 100;

  return (
    <div ref={containerRef} className={cn("relative bg-black rounded-xl overflow-hidden group", className)}>
      {/* Video Element */}
      <video
        ref={videoRef}
        src={currentClip.videoUrl}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleClipEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted={isMuted}
        playsInline
      />

      {/* Overlay Controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Center Play Button */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </div>
        </button>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 w-12">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="text-xs text-white/80 w-12 text-right">{formatTime(manifest.totalDuration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={skipPrev}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={skipNext}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Clip indicator */}
            <div className="flex items-center gap-1">
              {manifest.clips.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentClipIndex(idx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentClipIndex 
                      ? "bg-primary w-4" 
                      : idx < currentClipIndex 
                        ? "bg-white/80" 
                        : "bg-white/40"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Clip Badge */}
      <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs text-white/80">
        Clip {currentClipIndex + 1} of {manifest.clips.length}
      </div>
    </div>
  );
}
