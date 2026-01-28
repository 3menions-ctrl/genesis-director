/**
 * ManifestVideoPlayer v3 - INSTANTANEOUS Gapless Playback
 * 
 * Features:
 * - Dual video element switching for ZERO gap transitions
 * - Preloads next clip while current plays
 * - 50ms crossfade for INSTANT transitions
 * - Triggers transition 0.15s BEFORE clip ends for zero gaps
 * - NO center play button - only bottom controls
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

// Crossfade duration in seconds - ultra-fast overlap for seamless blending
const CROSSFADE_DURATION_SEC = 0.030; // 30ms crossfade
// Trigger transition this many seconds before clip ends for ZERO gap
const TRANSITION_THRESHOLD = 0.15;

export function ManifestVideoPlayer({ manifestUrl, className }: ManifestVideoPlayerProps) {
  const [manifest, setManifest] = useState<VideoManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Dual video state for gapless playback
  const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [videoAOpacity, setVideoAOpacity] = useState(1);
  const [videoBOpacity, setVideoBOpacity] = useState(0);
  
  // Refs
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const triggerTransitionRef = useRef<(() => void) | null>(null);
  const initialSetupDoneRef = useRef(false);

  // Get active and standby video refs
  const getActiveVideo = useCallback(() => {
    return activeVideoIndex === 0 ? videoARef.current : videoBRef.current;
  }, [activeVideoIndex]);

  const getStandbyVideo = useCallback(() => {
    return activeVideoIndex === 0 ? videoBRef.current : videoARef.current;
  }, [activeVideoIndex]);

  // Calculate total duration from manifest
  const totalDuration = useMemo(() => {
    return manifest?.totalDuration || manifest?.clips.reduce((sum, c) => sum + c.duration, 0) || 0;
  }, [manifest]);

  // Load manifest
  useEffect(() => {
    const loadManifest = async () => {
      try {
        setIsLoading(true);
        initialSetupDoneRef.current = false;
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

  // Setup first clip and preload second when manifest is loaded
  useEffect(() => {
    if (!manifest || manifest.clips.length === 0 || initialSetupDoneRef.current) return;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    
    // Load first clip into video A (active)
    if (videoA && manifest.clips[0]) {
      videoA.src = manifest.clips[0].videoUrl;
      videoA.load();
    }

    // Preload second clip into video B (standby)
    if (videoB && manifest.clips[1]) {
      videoB.src = manifest.clips[1].videoUrl;
      videoB.load();
    }

    initialSetupDoneRef.current = true;
  }, [manifest]);

  // Preload next clip into standby video when clip changes
  // Preload next clip into standby video when clip changes
  // NOTE: This is for manual skip navigation only - crossfade handles its own preloading
  useEffect(() => {
    if (!manifest) return;
    // CRITICAL: Don't interfere with ongoing transitions - they handle their own preloading
    if (isTransitioningRef.current || isCrossfading) return;
    
    // Use refs directly to get correct video without dependency issues
    const standbyVideo = activeVideoIndex === 0 ? videoBRef.current : videoARef.current;
    const nextClipIndex = currentClipIndex + 1;
    
    if (standbyVideo && nextClipIndex < manifest.clips.length && manifest.clips[nextClipIndex]) {
      const nextClipUrl = manifest.clips[nextClipIndex].videoUrl;
      if (standbyVideo.src !== nextClipUrl) {
        standbyVideo.src = nextClipUrl;
        standbyVideo.load();
      }
    }
  }, [currentClipIndex, manifest, activeVideoIndex, isCrossfading]);

  // Crossfade transition logic - TRUE CROSSFADE: outgoing fades out while incoming fades in
  const triggerCrossfadeTransition = useCallback(() => {
    if (!manifest) return;
    if (isTransitioningRef.current || isCrossfading) return;
    if (currentClipIndex >= manifest.clips.length - 1) return;
    
    isTransitioningRef.current = true;
    setIsCrossfading(true);
    
    const nextIndex = currentClipIndex + 1;
    const activeVideo = getActiveVideo();
    const standbyVideo = getStandbyVideo();
    
    // Capture which video is currently active BEFORE state update
    const currentActiveIndex = activeVideoIndex;
    
    if (standbyVideo && standbyVideo.readyState >= 2 && manifest.clips[nextIndex]) {
      standbyVideo.currentTime = 0;
      standbyVideo.muted = isMuted;
      
      // Start playing standby BEFORE it becomes visible (it's at opacity 0)
      standbyVideo.play().catch(() => {});
      
      // CROSSFADE: Fade in incoming, fade out outgoing - SIMULTANEOUSLY
      // Incoming goes from 0 → 1, outgoing goes from 1 → 0
      if (currentActiveIndex === 0) {
        // A is active (opacity 1), B is standby (opacity 0)
        // Crossfade: A → 0, B → 1
        setVideoAOpacity(0);
        setVideoBOpacity(1);
      } else {
        // B is active (opacity 1), A is standby (opacity 0)
        // Crossfade: B → 0, A → 1
        setVideoBOpacity(0);
        setVideoAOpacity(1);
      }
      
      // Swap active/standby state
      setActiveVideoIndex(currentActiveIndex === 0 ? 1 : 0);
      setCurrentClipIndex(nextIndex);
      setIsPlaying(true);
      
      // After crossfade duration, clean up
      setTimeout(() => {
        // Pause the old video
        if (activeVideo) {
          activeVideo.pause();
        }
        
        setIsCrossfading(false);
        
        // Preload the NEXT clip into the old active (now standby)
        const futureClipIndex = nextIndex + 1;
        if (activeVideo && futureClipIndex < manifest.clips.length && manifest.clips[futureClipIndex]) {
          activeVideo.src = manifest.clips[futureClipIndex].videoUrl;
          activeVideo.load();
        }
        isTransitioningRef.current = false;
      }, CROSSFADE_DURATION_SEC * 1000 + 10); // Add small buffer
    } else {
      // Standby not ready - try immediate switch as fallback
      console.warn('[ManifestPlayer] Standby video not ready, using fallback transition');
      isTransitioningRef.current = false;
      setIsCrossfading(false);
      setCurrentClipIndex(prev => prev + 1);
    }
  }, [currentClipIndex, manifest, isCrossfading, isMuted, activeVideoIndex, getActiveVideo, getStandbyVideo]);

  // Keep the ref updated with the latest trigger function
  useEffect(() => {
    triggerTransitionRef.current = triggerCrossfadeTransition;
  }, [triggerCrossfadeTransition]);

  // Handle video time update - trigger transition BEFORE clip ends
  const handleTimeUpdate = useCallback(() => {
    const activeVideo = getActiveVideo();
    if (!activeVideo || !manifest) return;
    
    const clip = manifest.clips[currentClipIndex];
    if (!clip) return;
    
    // Calculate overall time for progress bar
    const overallTime = (clip.startTime || 0) + activeVideo.currentTime;
    setCurrentTime(overallTime);
    
    // Trigger seamless transition BEFORE clip ends
    const timeRemaining = activeVideo.duration - activeVideo.currentTime;
    
    if (timeRemaining <= TRANSITION_THRESHOLD && timeRemaining > 0 && !isTransitioningRef.current && !isCrossfading) {
      if (currentClipIndex < manifest.clips.length - 1) {
        console.log('[ManifestPlayer] Triggering crossfade transition', {
          clipIndex: currentClipIndex,
          timeRemaining,
          threshold: TRANSITION_THRESHOLD
        });
        triggerTransitionRef.current?.();
      }
    }
  }, [currentClipIndex, manifest, isCrossfading, getActiveVideo]);

  // Handle clip ended - fallback for last clip or missed transitions
  const handleClipEnded = useCallback(() => {
    const activeVideo = getActiveVideo();
    if (!manifest) return;
    
    // Ignore spurious ended events
    if (activeVideo) {
      const duration = activeVideo.duration;
      const currentPos = activeVideo.currentTime;
      if (duration && currentPos < duration * 0.8) {
        console.warn('[ManifestPlayer] Ignoring spurious ended event');
        return;
      }
    }
    
    // If we're at the last clip and it ends, reset playlist
    if (currentClipIndex >= manifest.clips.length - 1) {
      console.log('[ManifestPlayer] Last clip ended, resetting playlist');
      setIsPlaying(false);
      setCurrentClipIndex(0);
      setCurrentTime(0);
      
      // Reset opacities and active video
      setVideoAOpacity(1);
      setVideoBOpacity(0);
      setActiveVideoIndex(0);
      
      // Reset to first clip
      const firstVideo = videoARef.current;
      if (firstVideo && manifest.clips[0]) {
        if (firstVideo.src !== manifest.clips[0].videoUrl) {
          firstVideo.src = manifest.clips[0].videoUrl;
          firstVideo.load();
        } else {
          firstVideo.currentTime = 0;
        }
      }
    } else if (!isTransitioningRef.current && !isCrossfading) {
      // Fallback: if clip ended but transition wasn't triggered, do it now
      triggerTransitionRef.current?.();
    }
  }, [currentClipIndex, manifest, isCrossfading, getActiveVideo]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    const activeVideo = getActiveVideo();
    if (!activeVideo) return;
    
    if (isPlaying) {
      activeVideo.pause();
      setIsPlaying(false);
    } else {
      activeVideo.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, getActiveVideo]);

  // Toggle mute on both videos
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (videoARef.current) videoARef.current.muted = newMuted;
    if (videoBRef.current) videoBRef.current.muted = newMuted;
  }, [isMuted]);

  // Skip to specific clip
  const skipToClip = useCallback((index: number) => {
    if (!manifest || index < 0 || index >= manifest.clips.length) return;
    
    // Reset transition state
    isTransitioningRef.current = false;
    setIsCrossfading(false);
    setVideoAOpacity(1);
    setVideoBOpacity(0);
    setActiveVideoIndex(0);
    
    setCurrentClipIndex(index);
    
    const videoA = videoARef.current;
    if (videoA && manifest.clips[index]) {
      videoA.src = manifest.clips[index].videoUrl;
      videoA.load();
      videoA.muted = isMuted;
      if (isPlaying) {
        videoA.play().catch(() => {});
      }
    }
    
    // Preload next clip
    const videoB = videoBRef.current;
    if (videoB && manifest.clips[index + 1]) {
      videoB.src = manifest.clips[index + 1].videoUrl;
      videoB.load();
    }
    
    // Update time
    const clip = manifest.clips[index];
    setCurrentTime(clip?.startTime || 0);
  }, [manifest, isMuted, isPlaying]);

  // Skip next/previous
  const skipNext = useCallback(() => {
    if (!manifest || currentClipIndex >= manifest.clips.length - 1) return;
    skipToClip(currentClipIndex + 1);
  }, [manifest, currentClipIndex, skipToClip]);

  const skipPrev = useCallback(() => {
    if (currentClipIndex <= 0) {
      const activeVideo = getActiveVideo();
      if (activeVideo) activeVideo.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    skipToClip(currentClipIndex - 1);
  }, [currentClipIndex, skipToClip, getActiveVideo]);

  // Fullscreen - Safari/iOS compatible
  const toggleFullscreen = useCallback(() => {
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
  }, []);

  // Format time
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    if (!manifest || manifest.clips.length === 0) return;
    window.open(manifest.clips[0].videoUrl, '_blank');
  }, [manifest]);

  // Calculate progress
  const overallProgress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

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

  return (
    <div ref={containerRef} className={cn("relative bg-black rounded-xl overflow-hidden group", className)}>
      {/* Dual Video Elements for Gapless Playback */}
      <video
        ref={videoARef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ 
          opacity: videoAOpacity, 
          zIndex: activeVideoIndex === 0 ? 2 : 1,
          transition: `opacity ${CROSSFADE_DURATION_SEC}s ease-in-out` // 30ms crossfade
        }}
        onTimeUpdate={activeVideoIndex === 0 ? handleTimeUpdate : undefined}
        onEnded={activeVideoIndex === 0 ? handleClipEnded : undefined}
        onPlay={activeVideoIndex === 0 ? () => setIsPlaying(true) : undefined}
        onPause={activeVideoIndex === 0 ? () => setIsPlaying(false) : undefined}
        muted={isMuted}
        playsInline
        preload="auto"
      />
      <video
        ref={videoBRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ 
          opacity: videoBOpacity, 
          zIndex: activeVideoIndex === 1 ? 2 : 1,
          transition: `opacity ${CROSSFADE_DURATION_SEC}s ease-in-out` // 30ms crossfade
        }}
        onTimeUpdate={activeVideoIndex === 1 ? handleTimeUpdate : undefined}
        onEnded={activeVideoIndex === 1 ? handleClipEnded : undefined}
        onPlay={activeVideoIndex === 1 ? () => setIsPlaying(true) : undefined}
        onPause={activeVideoIndex === 1 ? () => setIsPlaying(false) : undefined}
        muted={isMuted}
        playsInline
        preload="auto"
      />

      {/* Overlay Controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        {/* Invisible click area for play/pause - no center button */}
        <button onClick={togglePlay} className="absolute inset-0" />

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
            <span className="text-xs text-white/80 w-12 text-right">{formatTime(totalDuration)}</span>
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
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Clip indicator */}
            <div className="flex items-center gap-1">
              {manifest.clips.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => skipToClip(idx)}
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
      <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs text-white/80 z-10">
        Clip {currentClipIndex + 1} of {manifest.clips.length}
      </div>
    </div>
  );
}
