import { useState, useEffect, useCallback, forwardRef, useRef, memo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useMountGuard } from '@/hooks/useNavigationGuard';

// Import local thumbnails for instant loading
import sunsetDreams from '@/assets/thumbnails/sunset-dreams.jpg';
import snowySerenity from '@/assets/thumbnails/snowy-serenity.jpg';
import chocolateAdventures from '@/assets/thumbnails/chocolate-adventures.jpg';
import illuminatedDreams from '@/assets/thumbnails/illuminated-dreams.jpg';
import ruinedValor from '@/assets/thumbnails/ruined-valor.jpg';
import fieryMajesty from '@/assets/thumbnails/fiery-majesty.jpg';
import verdantGrove from '@/assets/thumbnails/verdant-grove.jpg';
import wildHunt from '@/assets/thumbnails/wild-hunt.jpg';

const SHOWCASE_VIDEOS = [
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
    title: 'Sunset Dreams on Winding Roads',
    description: 'A cinematic journey through golden-hour landscapes and endless horizons',
    thumbnail: sunsetDreams,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
    title: 'Soaring Above Snowy Serenity',
    description: 'A breathtaking aerial journey through pristine winter landscapes',
    thumbnail: snowySerenity,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_ed88401a-7a11-404c-acbc-55e375aee05d_1768166059131.mp4',
    title: 'Haunted Whispers of the Past',
    description: 'A chilling exploration of forgotten places and lost memories',
    thumbnail: illuminatedDreams,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    title: 'Whimsical Chocolate Adventures',
    description: 'A delightful journey through a world of sweet confections',
    thumbnail: chocolateAdventures,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_2e3503b6-a687-4d3e-bd97-9a1c264a7af2_1768153499834.mp4',
    title: 'Echoes of Desolation',
    description: 'A haunting exploration of abandoned landscapes and forgotten memories',
    thumbnail: verdantGrove,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_56f2b0ca-e570-4ab0-b73d-39318a6c2ea8_1768128683272.mp4',
    title: 'Illuminated Conversations',
    description: 'Light and shadow dance in meaningful dialogue',
    thumbnail: illuminatedDreams,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    title: 'Silent Vigil in Ruined Valor',
    description: 'An epic tale of courage standing against the test of time',
    thumbnail: ruinedValor,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
    title: 'Skyward Over Fiery Majesty',
    description: 'Drone cinematography capturing volcanic power from above',
    thumbnail: fieryMajesty,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_171d8bf6-2911-4c6a-b715-6ed0e93ff226_1768118838934.mp4',
    title: 'Editing Dreams in Motion',
    description: 'A cinematic ad showcasing creative video editing possibilities',
    thumbnail: wildHunt,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9ee134ca-5526-4e7f-9c10-1345f7b7b01f_1768109298602.mp4',
    title: 'Whispers of the Enchanted Jungle',
    description: 'Explore the magical depths of an untouched rainforest',
    thumbnail: verdantGrove,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5d530ba0-a1e7-4954-8d90-05ffb5a346c2_1768108186067.mp4',
    title: 'Shadows of the Predator',
    description: "A thrilling wildlife documentary capturing nature's fierce beauty",
    thumbnail: wildHunt,
  },
];

interface ExamplesGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ExamplesGallery = memo(forwardRef<HTMLDivElement, ExamplesGalleryProps>(
  function ExamplesGallery({ open, onOpenChange }, ref) {
  const { safeSetState, isMounted } = useMountGuard();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentVideo = SHOWCASE_VIDEOS[currentIndex];

  const goToNext = useCallback(() => {
    if (!isMounted()) return;
    safeSetState(setIsLoaded, false);
    safeSetState(setProgress, 0);
    safeSetState(setCurrentIndex, (prev) => (prev + 1) % SHOWCASE_VIDEOS.length);
  }, [isMounted, safeSetState]);

  const goToPrev = useCallback(() => {
    if (!isMounted()) return;
    safeSetState(setIsLoaded, false);
    safeSetState(setProgress, 0);
    safeSetState(setCurrentIndex, (prev) => (prev - 1 + SHOWCASE_VIDEOS.length) % SHOWCASE_VIDEOS.length);
  }, [isMounted, safeSetState]);

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
            ref={videoRef}
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
                onClick={() => {
                  // Directly control video element in user gesture context for browser policy compliance
                  if (videoRef.current) {
                    videoRef.current.muted = !videoRef.current.muted;
                    setIsMuted(videoRef.current.muted);
                  }
                }}
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
            {SHOWCASE_VIDEOS.slice(0, 8).map((video, i) => (
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
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                {currentIndex === i && (
                  <div className="absolute inset-0 bg-white/10" />
                )}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}));

export default ExamplesGallery;
