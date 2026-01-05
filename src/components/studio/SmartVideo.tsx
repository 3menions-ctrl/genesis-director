import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface SmartVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  previewSeekPercent?: number;
  playOnHover?: boolean;
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void;
}

export function SmartVideo({
  src,
  className,
  autoPlay = false,
  loop = false,
  muted = true,
  playsInline = true,
  controls = false,
  preload = 'metadata',
  previewSeekPercent,
  playOnHover = false,
  onClick,
}: SmartVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const { videoWidth, videoHeight } = video;
    
    // Detect if video appears to be rotated
    // If the video's natural dimensions suggest it's portrait but container is landscape,
    // or if dimensions seem swapped (width much smaller than height in a landscape container)
    const aspectRatio = videoWidth / videoHeight;
    
    // Check if this is a portrait video (taller than wide)
    const isPortrait = videoHeight > videoWidth;
    setIsPortraitVideo(isPortrait);
    
    // Detect potentially rotated videos:
    // Some mobile videos have incorrect orientation metadata
    // If aspect ratio is very unusual (like 0.5 or less for what should be landscape),
    // it might be a rotated video
    if (aspectRatio < 0.6 && aspectRatio > 0) {
      // This might be a sideways video that needs rotation
      // Check the container's aspect ratio vs video's
      const container = video.parentElement;
      if (container) {
        const containerAspect = container.clientWidth / container.clientHeight;
        // If container is landscape but video is extremely portrait,
        // the video might be rotated 90 degrees
        if (containerAspect > 1 && aspectRatio < 0.7) {
          // Don't auto-rotate as this could be intentional portrait video
          // Instead, let CSS object-fit handle it
          console.log('Portrait video detected:', { videoWidth, videoHeight, aspectRatio });
        }
      }
    }
    
    // Seek to preview position if specified
    if (previewSeekPercent !== undefined && video.duration) {
      video.currentTime = video.duration * (previewSeekPercent / 100);
    }
  }, [previewSeekPercent]);

  const handleMouseEnter = useCallback(() => {
    if (playOnHover && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked
      });
    }
  }, [playOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (playOnHover && videoRef.current) {
      videoRef.current.pause();
      // Return to preview frame
      if (previewSeekPercent !== undefined && videoRef.current.duration) {
        videoRef.current.currentTime = videoRef.current.duration * (previewSeekPercent / 100);
      }
    }
  }, [playOnHover, previewSeekPercent]);

  // Build transform style for rotation correction
  const transformStyle = rotation !== 0 ? {
    transform: `rotate(${rotation}deg)`,
    // When rotated 90 or 270 degrees, swap width/height
    ...(rotation === 90 || rotation === 270 ? {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    } : {})
  } : {};

  return (
    <video
      ref={videoRef}
      src={src}
      className={cn(
        "transition-transform duration-300",
        isPortraitVideo && "object-contain",
        !isPortraitVideo && "object-cover",
        className
      )}
      style={transformStyle}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      controls={controls}
      preload={preload}
      onLoadedMetadata={handleLoadedMetadata}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    />
  );
}

// Hook for detecting and correcting video orientation
export function useVideoOrientation() {
  const [orientations, setOrientations] = useState<Map<string, number>>(new Map());

  const detectOrientation = useCallback((videoUrl: string, video: HTMLVideoElement) => {
    const { videoWidth, videoHeight } = video;
    const aspectRatio = videoWidth / videoHeight;
    
    // Detect sideways videos: if aspect ratio suggests the video is rotated
    // Normal landscape: ~1.78 (16:9) or ~1.33 (4:3)
    // Normal portrait: ~0.56 (9:16) or ~0.75 (3:4)
    // Sideways video: might appear as very narrow or very wide unexpectedly
    
    let rotation = 0;
    
    // If video dimensions suggest it's been recorded sideways
    // This is a heuristic - actual rotation metadata would be better
    if (aspectRatio < 0.5 || aspectRatio > 2.5) {
      // Potentially rotated - check if rotating would normalize it
      const rotatedAspect = videoHeight / videoWidth;
      if (rotatedAspect >= 0.5 && rotatedAspect <= 2.5) {
        rotation = 90; // or -90
      }
    }

    setOrientations(prev => new Map(prev).set(videoUrl, rotation));
    return rotation;
  }, []);

  const getOrientation = useCallback((videoUrl: string) => {
    return orientations.get(videoUrl) || 0;
  }, [orientations]);

  return { detectOrientation, getOrientation };
}
