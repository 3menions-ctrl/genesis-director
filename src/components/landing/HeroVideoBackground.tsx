import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Curated showcase videos from generated projects
const SHOWCASE_VIDEOS = [
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767596471199-c94lc.mp4', // Heaven 1
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767596635855-7jnlfu.mp4', // Heaven 2
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767600530682-zjy8m.mp4', // Sail 1
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767600585125-0g9aex.mp4', // Sail 2
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767597195370-5ui9ma.mp4', // Sail 3
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

  // Preload next video
  useEffect(() => {
    const nextIndex = (currentIndex + 1) % SHOWCASE_VIDEOS.length;
    if (nextVideoRef.current) {
      nextVideoRef.current.src = SHOWCASE_VIDEOS[nextIndex];
      nextVideoRef.current.load();
    }
  }, [currentIndex]);

  // Handle video end - smooth transition to next
  const handleVideoEnd = () => {
    setIsTransitioning(true);
    
    // Short transition delay for smooth crossfade
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % SHOWCASE_VIDEOS.length);
      setIsTransitioning(false);
    }, 500);
  };

  // Auto-advance after video plays (with fallback timer)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => setIsLoaded(true);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleVideoEnd);

    // Fallback: if video is longer than 8 seconds, transition anyway
    const fallbackTimer = setTimeout(() => {
      handleVideoEnd();
    }, 8000);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleVideoEnd);
      clearTimeout(fallbackTimer);
    };
  }, [currentIndex]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Main video player */}
      <video
        ref={videoRef}
        key={currentIndex}
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
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setCurrentIndex(i);
                setIsTransitioning(false);
              }, 300);
            }}
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