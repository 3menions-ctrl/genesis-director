import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Curated showcase videos - Cloud Run stitched final videos only
const SHOWCASE_VIDEOS = [
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4', // Sunset Dreams on Winding Roads (NEWEST)
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_2b6fb5c2-ca02-4c06-8341-ec32286c9e60_1768303542610.mp4', // Creative Space of Confidence
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_72e42238-ddfc-4ce1-8bae-dce8d8fc6bba_1768263824409.mp4', // Snowy Cabin
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_f6b90eb8-fc54-4a82-b8db-7592a601a0f6_1768205766918.mp4', // Whispers of the Verdant Grove
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171807679.mp4', // Soaring Above Snowy Serenity
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4', // Whimsical Chocolate Adventures
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4', // Silent Vigil in Ruined Valor
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4', // Skyward Over Fiery Majesty
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_171d8bf6-2911-4c6a-b715-6ed0e93ff226_1768118838934.mp4', // Editing Dreams in Motion
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
