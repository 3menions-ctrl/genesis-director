import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Expand, Film, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

// Import local thumbnail images for instant loading
import illuminatedDreams from '@/assets/thumbnails/illuminated-dreams.jpg';
import wildHunt from '@/assets/thumbnails/wild-hunt.jpg';
import sunsetDreams from '@/assets/thumbnails/sunset-dreams.jpg';
import riverWhispers from '@/assets/thumbnails/river-whispers.jpg';
import snowyCabin from '@/assets/thumbnails/snowy-cabin.jpg';
import verdantGrove from '@/assets/thumbnails/verdant-grove.jpg';
import snowySerenity from '@/assets/thumbnails/snowy-serenity.jpg';
import chocolateAdventures from '@/assets/thumbnails/chocolate-adventures.jpg';
import ruinedValor from '@/assets/thumbnails/ruined-valor.jpg';
import fieryMajesty from '@/assets/thumbnails/fiery-majesty.jpg';
import owlWisdom from '@/assets/thumbnails/owl-wisdom.jpg';

// Sample videos generated with Apex Studio - using local thumbnails for fast loading
const CREATOR_VIDEOS = [
  {
    id: 'a1b6f181-26fa-4306-a663-d5892977b3fc',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a1b6f181-26fa-4306-a663-d5892977b3fc_1768451441287.mp4',
    title: 'Illuminated Dreams in Darkness',
    genre: 'Cinematic',
    featured: true,
    thumbnail: illuminatedDreams,
  },
  {
    id: 'a0016bb1-34ea-45e3-a173-da9441a84bda',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a0016bb1-34ea-45e3-a173-da9441a84bda_1768449857055.mp4',
    title: 'Whispers of the Wild Hunt',
    genre: 'Cinematic',
    featured: true,
    thumbnail: wildHunt,
  },
  {
    id: '71e83837-9ae4-4e79-a4f2-599163741b03',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
    title: 'Sunset Dreams on Winding Roads',
    genre: 'Cinematic',
    featured: false,
    thumbnail: sunsetDreams,
  },
  {
    id: 'c09f52b7-442c-41cd-be94-2895e78bd0ba',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_c09f52b7-442c-41cd-be94-2895e78bd0ba_1768330950513.mp4',
    title: 'Whispers by the River',
    genre: 'Nature',
    featured: false,
    thumbnail: riverWhispers,
  },
  {
    id: '72e42238-ddfc-4ce1-8bae-dce8d8fc6bba',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_72e42238-ddfc-4ce1-8bae-dce8d8fc6bba_1768263824409.mp4',
    title: 'Snowy Cabin Retreat',
    genre: 'Nature',
    featured: false,
    thumbnail: snowyCabin,
  },
  {
    id: 'f6b90eb8-fc54-4a82-b8db-7592a601a0f6',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_f6b90eb8-fc54-4a82-b8db-7592a601a0f6_1768205766918.mp4',
    title: 'Whispers of the Verdant Grove',
    genre: 'Nature',
    featured: false,
    thumbnail: verdantGrove,
  },
  {
    id: '099597a1-0cbf-4d71-b000-7d140ab896d1',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171807679.mp4',
    title: 'Soaring Above Snowy Serenity',
    genre: 'Aerial',
    featured: true,
    thumbnail: snowySerenity,
  },
  {
    id: '1b0ac63f-643a-4d43-b8ed-44b8083257ed',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    title: 'Whimsical Chocolate Adventures',
    genre: 'Creative',
    featured: false,
    thumbnail: chocolateAdventures,
  },
  {
    id: 'dc255261-7bc3-465f-a9ec-ef2acd47b4fb',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    title: 'Silent Vigil in Ruined Valor',
    genre: 'Cinematic',
    featured: false,
    thumbnail: ruinedValor,
  },
  {
    id: '7434c756-78d3-4f68-8107-b205930027c4',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
    title: 'Skyward Over Fiery Majesty',
    genre: 'Aerial',
    featured: false,
    thumbnail: fieryMajesty,
  },
  {
    id: '5bd6da17-734b-452b-b8b0-3381e7c710e3',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5bd6da17-734b-452b-b8b0-3381e7c710e3_1768069835550.mp4',
    title: "Owl of Wisdom's Twilight",
    genre: 'Creative',
    featured: false,
    thumbnail: owlWisdom,
  },
];

const CATEGORIES = ['All', 'Cinematic', 'Nature', 'Aerial', 'Creative'];

interface VideoCardProps {
  video: typeof CREATOR_VIDEOS[0];
  height: 'tall' | 'medium' | 'short';
  onClick: () => void;
  index: number;
}
const VideoCard = forwardRef<HTMLDivElement, VideoCardProps>(({ video, height, onClick, index }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const heightClasses = {
    tall: 'h-80 md:h-96',
    medium: 'h-52 md:h-64',
    short: 'h-40 md:h-48',
  };

  // Handle hover play/pause
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isHovering) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isHovering]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden cursor-pointer rounded-2xl w-full",
        heightClasses[height]
      )}
    >
      {/* Local thumbnail image - loads instantly from bundle */}
      <img
        src={video.thumbnail}
        alt={video.title}
        loading="eager"
        decoding="async"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-all duration-500",
          isHovering ? "scale-105 opacity-0" : "scale-100 opacity-100"
        )}
      />

      {/* Video element - only loads and plays on hover */}
      {isHovering && (
        <video
          ref={videoRef}
          src={video.url}
          className="absolute inset-0 w-full h-full object-cover scale-105"
          muted
          loop
          playsInline
          autoPlay
        />
      )}

      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 transition-opacity duration-300 pointer-events-none",
        "bg-gradient-to-t from-black/80 via-black/30 to-transparent",
        isHovering ? "opacity-100" : "opacity-70"
      )} />

      {/* Play button overlay */}
      <motion.div
        initial={false}
        animate={{ 
          scale: isHovering ? 1 : 0.8, 
          opacity: isHovering ? 1 : 0 
        }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
          <Play className="w-5 h-5 text-white ml-1" fill="currentColor" />
        </div>
      </motion.div>

      {/* Featured badge */}
      {video.featured && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-sm border-0">
            <Star className="w-3 h-3 mr-1 fill-current" />
            Featured
          </Badge>
        </div>
      )}

      {/* Genre badge */}
      <div className="absolute top-3 right-3 z-10">
        <Badge variant="outline" className="bg-black/50 backdrop-blur-sm border-white/10 text-white/80 text-xs">
          {video.genre}
        </Badge>
      </div>

      {/* Title at bottom */}
      <div className="absolute bottom-3 left-3 right-12 z-10">
        <p className="text-sm font-medium text-white line-clamp-2">{video.title}</p>
      </div>

      {/* Expand icon */}
      <motion.div
        initial={false}
        animate={{ opacity: isHovering ? 1 : 0 }}
        className="absolute bottom-3 right-3 z-10"
      >
        <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <Expand className="w-4 h-4 text-white" />
        </div>
      </motion.div>
    </motion.div>
  );
});

VideoCard.displayName = 'VideoCard';

const CreatorShowcase = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const mainVideoRef = useRef<HTMLVideoElement>(null);

  const filteredVideos = selectedCategory === 'All' 
    ? CREATOR_VIDEOS 
    : CREATOR_VIDEOS.filter(v => v.genre === selectedCategory);

  const activeVideo = filteredVideos[activeIndex] || CREATOR_VIDEOS[0];

  // Handle video source changes - runs when modal opens or video changes
  useEffect(() => {
    if (!showFullscreen) return;
    
    const video = mainVideoRef.current;
    if (!video) return;
    
    setIsVideoReady(false);
    
    const handleCanPlayThrough = () => {
      setIsVideoReady(true);
      video.muted = isMuted;
      video.play().catch(() => {});
    };
    
    const handleLoadedData = () => {
      // Fallback: if canplaythrough doesn't fire, use loadeddata
      setIsVideoReady(true);
      video.muted = isMuted;
      video.play().catch(() => {});
    };
    
    // Remove old listeners before adding new ones
    video.removeEventListener('canplaythrough', handleCanPlayThrough);
    video.removeEventListener('loadeddata', handleLoadedData);
    
    video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
    video.addEventListener('loadeddata', handleLoadedData, { once: true });
    
    // Set source and load
    video.src = activeVideo.url;
    video.load();
    
    // Fallback timeout - if video doesn't load in 5s, try playing anyway
    const fallbackTimer = setTimeout(() => {
      if (!isVideoReady) {
        setIsVideoReady(true);
        video.play().catch(() => {});
      }
    }, 5000);
    
    return () => {
      clearTimeout(fallbackTimer);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [activeIndex, activeVideo.url, showFullscreen]);

  // Handle play/pause and mute changes
  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video || !isVideoReady) return;
    
    video.muted = isMuted;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, isMuted, isVideoReady]);

  // Auto-advance video
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % filteredVideos.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [isPlaying, filteredVideos.length]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % filteredVideos.length);
  }, [filteredVideos.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + filteredVideos.length) % filteredVideos.length);
  }, [filteredVideos.length]);

  const handleVideoClick = (index: number) => {
    setActiveIndex(index);
    setShowFullscreen(true);
  };

  return (
    <>
      <section ref={ref} {...props} className={cn("relative z-10 py-24 px-4 lg:px-8 overflow-hidden", props.className)}>
        {/* Background ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Film className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Creator Gallery</span>
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold text-foreground mb-4">
              Stunning Videos,{' '}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
                Made by AI
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore videos created by our community. Each one generated entirely with AI.
            </p>
          </motion.div>

          {/* Category Filter */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-10"
          >
            <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-muted/50 backdrop-blur-sm border border-border">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setActiveIndex(0);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Masonry Carousel Gallery */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <Carousel
              opts={{
                align: 'start',
                loop: true,
                dragFree: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-3 md:-ml-4">
                {/* Create masonry-style columns */}
                {Array.from({ length: Math.ceil(filteredVideos.length / 2) }).map((_, colIndex) => {
                  const video1 = filteredVideos[colIndex * 2];
                  const video2 = filteredVideos[colIndex * 2 + 1];
                  // Alternate height patterns for masonry effect
                  const pattern = colIndex % 3;
                  const heights: Array<'tall' | 'medium' | 'short'> = 
                    pattern === 0 ? ['tall', 'short'] :
                    pattern === 1 ? ['medium', 'medium'] :
                    ['short', 'tall'];
                  
                  return (
                    <CarouselItem key={colIndex} className="pl-3 md:pl-4 basis-[280px] md:basis-[320px] lg:basis-[360px]">
                      <div className="flex flex-col gap-3 md:gap-4">
                        {video1 && (
                          <VideoCard
                            video={video1}
                            height={heights[0]}
                            onClick={() => handleVideoClick(colIndex * 2)}
                            index={colIndex * 2}
                          />
                        )}
                        {video2 && (
                          <VideoCard
                            video={video2}
                            height={heights[1]}
                            onClick={() => handleVideoClick(colIndex * 2 + 1)}
                            index={colIndex * 2 + 1}
                          />
                        )}
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-4 lg:-left-6 w-12 h-12 bg-background/80 backdrop-blur-sm border-border hover:bg-background" />
              <CarouselNext className="hidden md:flex -right-4 lg:-right-6 w-12 h-12 bg-background/80 backdrop-blur-sm border-border hover:bg-background" />
            </Carousel>
            
            {/* Swipe hint for mobile */}
            <div className="flex md:hidden justify-center mt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <ChevronLeft className="w-4 h-4" />
                <span>Swipe to explore</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Fullscreen Video Modal */}
      <AnimatePresence>
        {showFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
          >
            {/* Loading state */}
            {!isVideoReady && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
              </div>
            )}

            {/* Video */}
            <video
              ref={mainVideoRef}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
                isVideoReady ? "opacity-100" : "opacity-0"
              )}
              loop
              muted={isMuted}
              playsInline
              autoPlay
            />

            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />
            
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
            
            {/* Top gradient */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

            {/* Close button */}
            <button
              onClick={() => setShowFullscreen(false)}
              className="absolute top-6 right-6 z-50 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group hover:bg-white/20 transition-all"
            >
              <span className="text-white text-2xl group-hover:scale-110 transition-transform">×</span>
            </button>

            {/* Counter */}
            <div className="absolute top-6 left-6 z-50 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-sm font-medium text-white/60">
                <span className="text-white">{activeIndex + 1}</span> / {filteredVideos.length}
              </span>
            </div>

            {/* Navigation */}
            <button
              onClick={goPrev}
              className="absolute left-8 top-1/2 -translate-y-1/2 z-50 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            
            <button
              onClick={goNext}
              className="absolute right-8 top-1/2 -translate-y-1/2 z-50 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110"
            >
              <ChevronRight className="w-7 h-7" />
            </button>

            {/* Video info */}
            <div className="absolute bottom-0 left-0 right-0 p-10 z-40">
              <div className="max-w-4xl">
                <motion.div 
                  key={activeVideo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <Badge className="bg-white/10 backdrop-blur-sm border-white/10 text-white">
                    {activeVideo.genre}
                  </Badge>
                </motion.div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                  
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Thumbnail strip */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 hidden md:block">
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                {filteredVideos.slice(0, 8).map((video, i) => (
                  <button
                    key={video.id}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "relative w-20 h-12 rounded-lg overflow-hidden transition-all duration-300",
                      activeIndex === i 
                        ? "ring-2 ring-white/80 ring-offset-2 ring-offset-black/50 scale-110" 
                        : "opacity-50 hover:opacity-80 hover:scale-105"
                    )}
                  >
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

CreatorShowcase.displayName = 'CreatorShowcase';

export default CreatorShowcase;
