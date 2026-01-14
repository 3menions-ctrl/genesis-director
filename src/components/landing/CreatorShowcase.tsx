import { useState, useRef, useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Sample videos generated with Apex Studio (from demo & admin accounts)
const CREATOR_VIDEOS = [
  {
    id: '71e83837-9ae4-4e79-a4f2-599163741b03',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
    title: 'Sunset Dreams on Winding Roads',
    genre: 'Cinematic',
  },
  {
    id: 'ad10b35f-1a39-47c5-8323-3b57b97c9968',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_ad10b35f-1a39-47c5-8323-3b57b97c9968_1768351244978.mp4',
    title: 'Morning Reflections on the River',
    genre: 'Cinematic',
  },
  {
    id: 'c09f52b7-442c-41cd-be94-2895e78bd0ba',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_c09f52b7-442c-41cd-be94-2895e78bd0ba_1768330950513.mp4',
    title: 'Whispers by the River',
    genre: 'Cinematic',
  },
  {
    id: '9fd85630-6a38-4dee-8fec-9da9737a8082',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9fd85630-6a38-4dee-8fec-9da9737a8082_1768304689306.mp4',
    title: 'Whispers of the Verdant Heart',
    genre: 'Cinematic',
  },
  {
    id: '2b6fb5c2-ca02-4c06-8341-ec32286c9e60',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_2b6fb5c2-ca02-4c06-8341-ec32286c9e60_1768303542610.mp4',
    title: 'Creative Space of Confidence',
    genre: 'Ad',
  },
  {
    id: '72e42238-ddfc-4ce1-8bae-dce8d8fc6bba',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_72e42238-ddfc-4ce1-8bae-dce8d8fc6bba_1768263824409.mp4',
    title: 'Snowy Cabin',
    genre: 'Cinematic',
  },
  {
    id: 'f6b90eb8-fc54-4a82-b8db-7592a601a0f6',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_f6b90eb8-fc54-4a82-b8db-7592a601a0f6_1768205766918.mp4',
    title: 'Whispers of the Verdant Grove',
    genre: 'Cinematic',
  },
  {
    id: '099597a1-0cbf-4d71-b000-7d140ab896d1',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171807679.mp4',
    title: 'Soaring Above Snowy Serenity',
    genre: 'Motivational',
  },
  {
    id: '1b0ac63f-643a-4d43-b8ed-44b8083257ed',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    title: 'Whimsical Chocolate Adventures',
    genre: 'Cinematic',
  },
  {
    id: 'dc255261-7bc3-465f-a9ec-ef2acd47b4fb',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    title: 'Silent Vigil in Ruined Valor',
    genre: 'Cinematic',
  },
  {
    id: '7434c756-78d3-4f68-8107-b205930027c4',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
    title: 'Skyward Over Fiery Majesty',
    genre: 'Cinematic',
  },
  {
    id: '5bd6da17-734b-452b-b8b0-3381e7c710e3',
    url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5bd6da17-734b-452b-b8b0-3381e7c710e3_1768069835550.mp4',
    title: "Owl of Wisdom's Twilight",
    genre: 'Cinematic',
  },
];

interface VideoCardProps {
  video: typeof CREATOR_VIDEOS[0];
  isActive: boolean;
  onClick: () => void;
}

function VideoCard({ video, isActive, onClick }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isHovered || isActive) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isHovered, isActive]);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative aspect-video rounded-2xl overflow-hidden cursor-pointer transition-all duration-500",
        "border border-white/[0.06]",
        isActive && "ring-2 ring-white/30 ring-offset-2 ring-offset-black"
      )}
    >
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-cover"
        loop
        muted
        playsInline
        preload="metadata"
      />
      
      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity",
        isHovered || isActive ? "opacity-100" : "opacity-60"
      )} />
      
      {/* Play indicator */}
      <AnimatePresence>
        {(isHovered || isActive) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center border border-white/20">
              <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">{video.genre}</span>
        <h4 className="text-sm font-semibold text-white truncate">{video.title}</h4>
      </div>
    </motion.div>
  );
}

export default function CreatorShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  
  const activeVideo = CREATOR_VIDEOS[activeIndex];

  useEffect(() => {
    if (mainVideoRef.current) {
      mainVideoRef.current.muted = isMuted;
      if (isPlaying) {
        mainVideoRef.current.play().catch(() => {});
      } else {
        mainVideoRef.current.pause();
      }
    }
  }, [isPlaying, isMuted, activeIndex]);

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % CREATOR_VIDEOS.length);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + CREATOR_VIDEOS.length) % CREATOR_VIDEOS.length);
  };

  return (
    <section className="relative z-10 py-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Sparkles className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">From Our Creators</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Made with Apex Studio
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real videos created by our community using AI-powered video generation.
          </p>
        </div>

        {/* Main Featured Video */}
        <div className="relative mb-8">
          <div className="relative aspect-video max-w-5xl mx-auto rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/50 border border-white/[0.08]">
            <video
              ref={mainVideoRef}
              key={activeVideo.id}
              src={activeVideo.url}
              className="w-full h-full object-cover"
              loop
              autoPlay
              muted={isMuted}
              playsInline
            />
            
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
            
            {/* Navigation arrows */}
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            
            {/* Video info */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-end justify-between">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-white/80 mb-3 border border-white/10">
                    {activeVideo.genre}
                  </span>
                  <h3 className="text-2xl lg:text-3xl font-bold text-white mb-1">{activeVideo.title}</h3>
                  <p className="text-white/50">AI Generated Sample</p>
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail carousel */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {CREATOR_VIDEOS.slice(0, 6).map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                isActive={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </div>

        {/* Counter */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center gap-2">
            {CREATOR_VIDEOS.slice(0, 12).map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === activeIndex
                    ? "w-8 bg-foreground"
                    : "bg-foreground/30 hover:bg-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
