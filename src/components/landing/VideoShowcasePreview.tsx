import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Import thumbnails for poster images
import sunsetDreams from '@/assets/thumbnails/sunset-dreams.jpg';
import snowySerenity from '@/assets/thumbnails/snowy-serenity.jpg';
import chocolateAdventures from '@/assets/thumbnails/chocolate-adventures.jpg';
import fieryMajesty from '@/assets/thumbnails/fiery-majesty.jpg';

const PREVIEW_VIDEOS = [
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
    title: 'Sunset Dreams',
    prompt: '"A cinematic journey through golden-hour landscapes..."',
    thumbnail: sunsetDreams,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
    title: 'Snowy Serenity',
    prompt: '"Aerial journey through pristine winter landscapes..."',
    thumbnail: snowySerenity,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    title: 'Chocolate Dreams',
    prompt: '"Whimsical journey through a world of sweets..."',
    thumbnail: chocolateAdventures,
  },
  {
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
    title: 'Volcanic Majesty',
    prompt: '"Drone cinematography capturing volcanic power..."',
    thumbnail: fieryMajesty,
  },
];

interface VideoShowcasePreviewProps {
  className?: string;
  onViewAllClick?: () => void;
}

export default function VideoShowcasePreview({ className, onViewAllClick }: VideoShowcasePreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentVideo = PREVIEW_VIDEOS[activeIndex];

  // Auto-advance to next video when current ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsLoaded(false);
      setActiveIndex((prev) => (prev + 1) % PREVIEW_VIDEOS.length);
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  // Play/pause control
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, activeIndex]);

  return (
    <section className={cn("py-16 sm:py-24", className)}>
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Made with Apex Studio</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            See What's Possible
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real videos created by our AI. Type a description, get cinematic results.
          </p>
        </motion.div>

        {/* Main video showcase */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Main player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-3 relative rounded-2xl overflow-hidden bg-muted aspect-video shadow-2xl"
          >
            {/* Loading state */}
            <AnimatePresence>
              {!isLoaded && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-muted"
                >
                  <img
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  />
                  <div className="w-12 h-12 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video */}
            <video
              ref={videoRef}
              key={activeIndex}
              autoPlay
              muted={isMuted}
              playsInline
              onCanPlay={() => setIsLoaded(true)}
              poster={currentVideo.thumbnail}
              className="w-full h-full object-cover"
              src={currentVideo.url}
            />

            {/* Overlay controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
            
            {/* Play/pause overlay button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 z-20 flex items-center justify-center group"
            >
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"
                  >
                    <Play className="w-8 h-8 text-white ml-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-30 flex items-end justify-between">
              <div>
                <p className="text-sm text-white/60 mb-1">Prompt:</p>
                <p className="text-white font-medium text-sm sm:text-base max-w-md truncate">
                  {currentVideo.prompt}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Video thumbnails sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2 flex lg:flex-col gap-3"
          >
            {PREVIEW_VIDEOS.map((video, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsLoaded(false);
                  setActiveIndex(index);
                }}
                className={cn(
                  "relative flex-1 lg:flex-initial rounded-xl overflow-hidden transition-all duration-300 group",
                  activeIndex === index
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "opacity-70 hover:opacity-100"
                )}
              >
                <div className="aspect-video lg:aspect-[16/9]">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-xs sm:text-sm font-medium truncate">{video.title}</p>
                  </div>
                  {activeIndex === index && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              </button>
            ))}

            {/* View all button */}
            {onViewAllClick && (
              <Button
                variant="outline"
                onClick={onViewAllClick}
                className="w-full lg:mt-auto rounded-xl h-12 group"
              >
                View All Examples
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
