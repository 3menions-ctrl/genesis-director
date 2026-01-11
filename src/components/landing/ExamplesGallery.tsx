import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';

const SHOWCASE_VIDEOS = [
  // Newest videos first
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768156700246.mp4',
    title: 'Whimsical Chocolate Adventures',
    description: 'A delightful journey through a world of sweet confections',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_2e3503b6-a687-4d3e-bd97-9a1c264a7af2_1768153499834.mp4',
    title: 'Echoes of Desolation',
    description: 'A haunting exploration of abandoned landscapes and forgotten memories',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_56f2b0ca-e570-4ab0-b73d-39318a6c2ea8_1768128683272.mp4',
    title: 'Illuminated Conversations',
    description: 'Light and shadow dance in meaningful dialogue',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_171d8bf6-2911-4c6a-b715-6ed0e93ff226_1768118838934.mp4',
    title: 'Editing Dreams in Motion',
    description: 'A cinematic ad showcasing creative video editing possibilities',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9ee134ca-5526-4e7f-9c10-1345f7b7b01f_1768109298602.mp4',
    title: 'Whispers of the Enchanted Jungle',
    description: 'Explore the magical depths of an untouched rainforest',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5d530ba0-a1e7-4954-8d90-05ffb5a346c2_1768108186067.mp4',
    title: 'Shadows of the Predator',
    description: "A thrilling wildlife documentary capturing nature's fierce beauty",
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_f47e40c4-26cd-4746-8f98-144d830e2303_1768091719237.mp4',
    title: "Jungle Guardian's Vigil",
    description: 'The silent watchman of the forest stands eternal guard',
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_df957e60-7589-46be-b044-d6d52e342316_1768084359189.mp4',
    title: 'Volcanic Forces',
    description: 'Breathtaking drone footage capturing the raw power of nature',
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
      <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black overflow-hidden rounded-none left-0 top-0 translate-x-0 translate-y-0 [&>button]:hidden">
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
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        </div>

        {/* Close X button - Top right corner */}
        <button 
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-6 right-6 z-[9999] cursor-pointer w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group hover:bg-white/20 transition-all"
          aria-label="Close gallery"
        >
          <X className="w-7 h-7 text-white group-hover:scale-110 transition-transform" strokeWidth={2} />
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
