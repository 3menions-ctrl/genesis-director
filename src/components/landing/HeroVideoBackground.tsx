import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Cole's showcase videos - Cloud Run stitched final videos
const SHOWCASE_VIDEOS = [
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9174320c-ede9-4d97-96b3-3f4f730622d8_1768476847502.mp4', // Fractured Dreams in Shadows (latest)
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_ef39dd93-3216-4e76-88ff-69fb2d407914_1768476284014.mp4', // Frustration in the Glow (2nd latest)
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a1b6f181-26fa-4306-a663-d5892977b3fc_1768451441287.mp4', // Illuminated Dreams in Darkness
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a0016bb1-34ea-45e3-a173-da9441a84bda_1768449857055.mp4', // Whispers of the Wild Hunt
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4', // Sunset Dreams on Winding Roads
];

interface HeroVideoBackgroundProps {
  className?: string;
  overlayOpacity?: number;
}

export default function HeroVideoBackground({ 
  className,
  overlayOpacity = 0.7 
}: HeroVideoBackgroundProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasEndedRef = useRef(false);

  // Stable transition handler
  const advanceToNextVideo = useCallback(() => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    
    setIsTransitioning(true);
    
    // Clear any existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % SHOWCASE_VIDEOS.length);
      setIsTransitioning(false);
      hasEndedRef.current = false;
    }, 500);
  }, []);

  // Preload next video (only once per index change)
  useEffect(() => {
    const nextIndex = (currentIndex + 1) % SHOWCASE_VIDEOS.length;
    if (nextVideoRef.current) {
      nextVideoRef.current.src = SHOWCASE_VIDEOS[nextIndex];
      nextVideoRef.current.load();
    }
  }, [currentIndex]);

  // Set up video event listeners - runs once on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => setIsLoaded(true);
    const handleEnded = () => advanceToNextVideo();
    
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [advanceToNextVideo]);

  // Reset loaded state when video source changes
  useEffect(() => {
    setIsLoaded(false);
    hasEndedRef.current = false;
    
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {
        // Autoplay blocked, that's fine
      });
    }
  }, [currentIndex]);

  const handleDotClick = useCallback((index: number) => {
    if (index === currentIndex || isTransitioning) return;
    
    setIsTransitioning(true);
    hasEndedRef.current = true;
    
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
      hasEndedRef.current = false;
    }, 300);
  }, [currentIndex, isTransitioning]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Main video player */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
          isTransitioning ? "opacity-0" : "opacity-100",
          !isLoaded && "opacity-0"
        )}
        src={SHOWCASE_VIDEOS[currentIndex]}
      />

      {/* Hidden preload video */}
      <video
        ref={nextVideoRef}
        muted
        playsInline
        preload="auto"
        className="hidden"
      />

      {/* Premium gradient overlays for depth */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background"
        style={{ opacity: overlayOpacity }}
      />
      
      {/* Top fade for nav blending */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-background to-transparent" />
      
      {/* Bottom fade for content blending */}
      <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-background via-background/90 to-transparent" />
      
      {/* Side vignettes for cinematic feel */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_100%)] opacity-40" />
      
      {/* Subtle noise texture for premium feel */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Loading shimmer */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Video indicator dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {SHOWCASE_VIDEOS.map((_, i) => (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-300",
              i === currentIndex 
                ? "bg-foreground w-6" 
                : "bg-foreground/30 hover:bg-foreground/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
