import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, X, ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
}

// Fetch public videos from discover/movie_projects
const useGalleryVideos = () => {
  return useQuery({
    queryKey: ['gallery-videos'],
    queryFn: async (): Promise<GalleryVideo[]> => {
      const { data, error } = await supabase
        .from('movie_projects_public')
        .select('id, title, thumbnail_url, video_url')
        .eq('is_public', true)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Fallback sample videos when no real data
const FALLBACK_VIDEOS: GalleryVideo[] = [
  { id: '1', title: 'Sunset Dreams', thumbnail_url: null, video_url: null },
  { id: '2', title: 'Urban Pulse', thumbnail_url: null, video_url: null },
  { id: '3', title: "Nature's Symphony", thumbnail_url: null, video_url: null },
  { id: '4', title: 'Digital Horizons', thumbnail_url: null, video_url: null },
  { id: '5', title: 'Abstract Flow', thumbnail_url: null, video_url: null },
  { id: '6', title: 'Character Story', thumbnail_url: null, video_url: null },
];

// Circular background with abstract pattern
function CircularBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Base black */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Circular masked abstract background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="w-[180vmax] h-[180vmax] rounded-full overflow-hidden opacity-50"
          style={{
            background: `url(${landingAbstractBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            maskImage: 'radial-gradient(circle, black 20%, transparent 60%)',
            WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 60%)',
          }}
        />
      </div>
      
      {/* Subtle radial overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.9) 70%)',
        }}
      />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

interface PaintingCardProps {
  video: GalleryVideo;
  index: number;
  onClick: () => void;
  isActive: boolean;
}

function PaintingCard({ video, index, onClick, isActive }: PaintingCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Staggered vertical positions for painting wall effect
  const verticalOffset = index % 3 === 0 ? -30 : index % 3 === 1 ? 20 : -10;
  
  return (
    <motion.div
      className="flex-shrink-0 cursor-pointer"
      style={{ 
        width: '280px',
        marginTop: verticalOffset,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: isActive ? 1.08 : 1,
      }}
      transition={{ 
        duration: 0.6,
        delay: index * 0.06,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Painting frame */}
      <div className="relative group">
        {/* Outer frame - elegant dark frame */}
        <div 
          className={cn(
            "absolute -inset-4 transition-all duration-500",
            "bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900",
            "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]",
            isHovered && "shadow-[0_40px_100px_-20px_rgba(255,255,255,0.1)]"
          )}
        />
        
        {/* Inner mat */}
        <div className="absolute -inset-2 bg-zinc-950" />
        
        {/* Canvas/Image area */}
        <div className="relative aspect-[3/4] overflow-hidden bg-black">
          {video.thumbnail_url ? (
            <img 
              src={video.thumbnail_url} 
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
              <Film className="w-12 h-12 text-white/20" />
            </div>
          )}
          
          {/* Hover overlay */}
          <motion.div 
            className="absolute inset-0 bg-black/70 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ 
                scale: isHovered ? 1 : 0.5, 
                opacity: isHovered ? 1 : 0 
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/30"
            >
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </motion.div>
          </motion.div>
        </div>
        
        {/* Title plaque */}
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-[90%]">
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 px-4 py-2.5 text-center">
            <h3 className="text-white text-sm font-medium truncate">{video.title}</h3>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface FullscreenPlayerProps {
  video: GalleryVideo;
  onClose: () => void;
}

function FullscreenPlayer({ video, onClose }: FullscreenPlayerProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && video.video_url) {
      videoRef.current.play().catch(() => {});
    }
  }, [video.video_url]);
  
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black"
      onClick={onClose}
    >
      {/* Video - full screen */}
      <div 
        className="absolute inset-0"
        onClick={(e) => e.stopPropagation()}
      >
        {video.video_url ? (
          <video
            ref={videoRef}
            src={video.video_url}
            className="w-full h-full object-contain"
            loop
            muted={isMuted}
            playsInline
            onClick={togglePlay}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <div className="w-32 h-32 mx-auto rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-xl">
                  <Play className="w-14 h-14 text-white/80 fill-white/80 ml-2" />
                </div>
              </motion.div>
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-6xl font-bold text-white mb-4"
              >
                {video.title}
              </motion.h2>
            </div>
          </div>
        )}
        
        {/* Minimal controls at bottom */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4"
        >
          <button 
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <button 
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </motion.div>
      </div>
      
      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onClose}
        className="absolute top-8 right-8 w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all border border-white/20 z-10"
      >
        <X className="w-6 h-6" />
      </motion.button>
    </motion.div>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<GalleryVideo | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const isDragging = useRef(false);
  
  // Fetch real videos
  const { data: realVideos, isLoading } = useGalleryVideos();
  const videos = realVideos && realVideos.length > 0 ? realVideos : FALLBACK_VIDEOS;
  
  // Access control
  useEffect(() => {
    const fromAnimation = location.state?.fromAnimation === true;
    const sessionAccess = sessionStorage.getItem('gallery_access') === 'true';
    
    if (fromAnimation || sessionAccess) {
      if (fromAnimation) {
        sessionStorage.setItem('gallery_access', 'true');
      }
      setHasAccess(true);
    } else {
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  // Calculate card width + gap
  const cardWidth = 280;
  const cardGap = 80;
  
  // Swipe navigation
  const handleDragEnd = (event: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    
    let newIndex = activeIndex;
    
    if (offset < -threshold || velocity < -500) {
      newIndex = Math.min(activeIndex + 1, videos.length - 1);
    } else if (offset > threshold || velocity > 500) {
      newIndex = Math.max(activeIndex - 1, 0);
    }
    
    setActiveIndex(newIndex);
    const targetX = -(newIndex * (cardWidth + cardGap));
    animate(x, targetX, { type: 'spring', stiffness: 300, damping: 30 });
  };
  
  const goTo = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, videos.length - 1));
    setActiveIndex(clampedIndex);
    const targetX = -(clampedIndex * (cardWidth + cardGap));
    animate(x, targetX, { type: 'spring', stiffness: 300, damping: 30 });
  };
  
  const goNext = () => goTo(activeIndex + 1);
  const goPrev = () => goTo(activeIndex - 1);
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <CircularBackground />
      
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        onClick={() => navigate('/')}
        className="fixed top-8 left-8 z-50 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back</span>
      </motion.button>
      
      {/* Navigation arrows */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: activeIndex > 0 ? 1 : 0.3 }}
        onClick={goPrev}
        disabled={activeIndex === 0}
        className="fixed left-8 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-6 h-6" />
      </motion.button>
      
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: activeIndex < videos.length - 1 ? 1 : 0.3 }}
        onClick={goNext}
        disabled={activeIndex === videos.length - 1}
        className="fixed right-8 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-6 h-6" />
      </motion.button>
      
      {/* Loading state */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      
      {/* Main content - Wall tilted 76° from horizontal (looking up at paintings) */}
      <div 
        className="min-h-screen flex items-center justify-center overflow-hidden"
        style={{ 
          perspective: '1500px',
          perspectiveOrigin: 'center 60%',
        }}
      >
        <motion.div
          ref={containerRef}
          className="flex items-end gap-20 px-[50vw] pb-32 cursor-grab active:cursor-grabbing"
          style={{ 
            x,
            transformStyle: 'preserve-3d',
            transform: 'rotateX(76deg) translateZ(-100px)',
            transformOrigin: 'center bottom',
          }}
          drag="x"
          dragConstraints={{
            left: -((videos.length - 1) * (cardWidth + cardGap)),
            right: 0,
          }}
          dragElastic={0.1}
          onDragStart={() => { isDragging.current = true; }}
          onDragEnd={(e, info) => {
            handleDragEnd(e, info);
            setTimeout(() => { isDragging.current = false; }, 100);
          }}
        >
          {videos.map((video, index) => (
            <PaintingCard
              key={video.id}
              video={video}
              index={index}
              isActive={index === activeIndex}
              onClick={() => {
                if (!isDragging.current) {
                  setSelectedVideo(video);
                }
              }}
            />
          ))}
        </motion.div>
      </div>
      
      {/* Progress indicator */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2"
      >
        {videos.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === activeIndex 
                ? "w-8 bg-white" 
                : "bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </motion.div>
      
      {/* Fullscreen video player */}
      <AnimatePresence>
        {selectedVideo && (
          <FullscreenPlayer 
            video={selectedVideo} 
            onClose={() => setSelectedVideo(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
