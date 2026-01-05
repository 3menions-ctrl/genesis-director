import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';

const SHOWCASE_VIDEOS = [
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767596471199-c94lc.mp4',
    title: 'Ethereal Ascension',
    description: 'A soul rises through clouds of light into heavenly realms',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767596635855-7jnlfu.mp4',
    title: 'Divine Gateway',
    description: 'Golden gates open to reveal paradise beyond',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767600530682-zjy8m.mp4',
    title: 'Ocean Voyage',
    description: 'A majestic ship sails through crystal waters at sunset',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767600585125-0g9aex.mp4',
    title: 'Horizon Dreams',
    description: 'Endless seas meet golden skies in perfect harmony',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/character-references/generated-videos/veo-1767597195370-5ui9ma.mp4',
    title: 'Nautical Symphony',
    description: 'Wind fills the sails as adventure beckons beyond the horizon',
  },
];

interface ExamplesGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExamplesGallery({ open, onOpenChange }: ExamplesGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentVideo = SHOWCASE_VIDEOS[currentIndex];

  const goToNext = useCallback(() => {
    setIsLoaded(false);
    setProgress(0);
    setCurrentIndex((prev) => (prev + 1) % SHOWCASE_VIDEOS.length);
  }, []);

  const goToPrev = useCallback(() => {
    setIsLoaded(false);
    setProgress(0);
    setCurrentIndex((prev) => (prev - 1 + SHOWCASE_VIDEOS.length) % SHOWCASE_VIDEOS.length);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'Escape') onOpenChange(false);
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goToNext, goToPrev, onOpenChange]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setIsPlaying(true);
      setIsLoaded(false);
      setProgress(0);
    }
  }, [open]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const progress = (video.currentTime / video.duration) * 100;
    setProgress(progress);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black overflow-hidden [&>button]:hidden rounded-none">
        {/* Fullscreen Video - No boundaries */}
        <div className="absolute inset-0">
          {/* Loading state */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            </div>
          )}

          {/* Video fills entire screen */}
          <video
            key={currentIndex}
            autoPlay={isPlaying}
            muted={isMuted}
            playsInline
            loop
            onCanPlay={() => setIsLoaded(true)}
            onTimeUpdate={handleTimeUpdate}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            src={currentVideo.url}
          />

          {/* Subtle vignette for depth */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
          
          {/* Bottom gradient for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          
          {/* Top gradient for controls */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        </div>

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-6 right-6 z-50 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all hover:scale-105"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Counter */}
        <div className="absolute top-6 left-6 z-50 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
          <span className="text-sm font-medium text-white/60">
            <span className="text-white">{currentIndex + 1}</span> / {SHOWCASE_VIDEOS.length}
          </span>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={goToPrev}
          className="absolute left-8 top-1/2 -translate-y-1/2 z-50 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110 group"
        >
          <ChevronLeft className="w-7 h-7 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        
        <button
          onClick={goToNext}
          className="absolute right-8 top-1/2 -translate-y-1/2 z-50 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110 group"
        >
          <ChevronRight className="w-7 h-7 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Video info overlay - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-10 z-40">
          <div className="max-w-4xl">
            <div className="animate-fade-in mb-6">
              <h3 className="text-4xl lg:text-5xl font-bold text-white mb-3">{currentVideo.title}</h3>
              <p className="text-white/60 text-xl max-w-2xl">{currentVideo.description}</p>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all hover:scale-105"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              
              {/* Mute/Unmute */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all hover:scale-105"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>

              {/* Progress bar */}
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div 
                  className="h-full bg-white transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail strip at bottom */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
            {SHOWCASE_VIDEOS.map((video, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsLoaded(false);
                  setProgress(0);
                  setCurrentIndex(i);
                }}
                className={cn(
                  "relative w-20 h-12 rounded-lg overflow-hidden transition-all duration-300",
                  currentIndex === i 
                    ? "ring-2 ring-white/80 ring-offset-2 ring-offset-black/50 scale-110" 
                    : "opacity-50 hover:opacity-80 hover:scale-105"
                )}
              >
                <video
                  src={video.url}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {currentIndex === i && (
                  <div className="absolute inset-0 bg-white/10" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Counter */}
        <div className="absolute top-6 left-6 z-50 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
          <span className="text-sm font-medium text-white/60">
            <span className="text-white">{currentIndex + 1}</span> / {SHOWCASE_VIDEOS.length}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
