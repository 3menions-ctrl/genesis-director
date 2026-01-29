import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

// Premium showcase videos
const SHOWCASE_VIDEOS = [
  {
    id: '1',
    title: 'Sunset Dreams',
    description: 'A cinematic journey through golden hour landscapes',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '2',
    title: 'Urban Pulse',
    description: 'Dynamic city life captured in motion',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '3',
    title: "Nature's Symphony",
    description: 'Breathtaking wildlife in their natural habitat',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '4',
    title: 'Digital Horizons',
    description: 'Futuristic visions brought to life',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '5',
    title: 'Abstract Flow',
    description: 'Mesmerizing patterns and colors in motion',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '6',
    title: 'Character Story',
    description: 'AI-generated characters with consistent identity',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '7',
    title: 'Ocean Depths',
    description: 'Explore the mysterious underwater world',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
  {
    id: '8',
    title: 'Neon Dreams',
    description: 'Cyberpunk aesthetics with vibrant neon colors',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
  },
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
          className="w-[150vmax] h-[150vmax] rounded-full overflow-hidden opacity-60"
          style={{
            background: `url(${landingAbstractBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
          }}
        />
      </div>
      
      {/* Subtle radial overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.8) 80%)',
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
  video: typeof SHOWCASE_VIDEOS[0];
  index: number;
  onClick: () => void;
  isActive: boolean;
}

function PaintingCard({ video, index, onClick, isActive }: PaintingCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Staggered vertical positions for painting wall effect
  const verticalOffset = index % 2 === 0 ? -20 : 20;
  
  return (
    <motion.div
      className="flex-shrink-0 cursor-pointer"
      style={{ 
        width: '320px',
        marginTop: verticalOffset,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: isActive ? 1.05 : 1,
      }}
      transition={{ 
        duration: 0.5,
        delay: index * 0.08,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Painting frame */}
      <div className="relative group">
        {/* Outer frame - gold/brass effect */}
        <div 
          className={cn(
            "absolute -inset-3 rounded-sm transition-all duration-500",
            "bg-gradient-to-br from-zinc-700 via-zinc-600 to-zinc-800",
            "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]",
            isHovered && "shadow-[0_30px_80px_-15px_rgba(255,255,255,0.15)]"
          )}
        />
        
        {/* Inner mat/passepartout */}
        <div className="absolute -inset-1 bg-zinc-900 rounded-sm" />
        
        {/* Canvas/Image area */}
        <div 
          className="relative aspect-[4/5] overflow-hidden rounded-sm bg-zinc-950"
        >
          {/* Placeholder artwork */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-white/10 flex items-center justify-center">
                <Play className="w-6 h-6 text-white/30" />
              </div>
            </div>
          </div>
          
          {/* Hover overlay */}
          <motion.div 
            className="absolute inset-0 bg-black/60 flex items-center justify-center"
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
              className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/30"
            >
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </motion.div>
          </motion.div>
        </div>
        
        {/* Title plaque */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-4/5">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded px-4 py-2 text-center">
            <h3 className="text-white text-sm font-medium truncate">{video.title}</h3>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface FullscreenPlayerProps {
  video: typeof SHOWCASE_VIDEOS[0];
  onClose: () => void;
}

function FullscreenPlayer({ video, onClose }: FullscreenPlayerProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      {/* Video area - full screen */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Placeholder for video */}
        <div className="w-full h-full flex items-center justify-center bg-black">
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
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-white/50"
            >
              {video.description}
            </motion.p>
          </div>
        </div>
        
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
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <button 
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
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
  const [selectedVideo, setSelectedVideo] = useState<typeof SHOWCASE_VIDEOS[0] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const isDragging = useRef(false);
  
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
  const cardWidth = 320;
  const cardGap = 60;
  const totalWidth = SHOWCASE_VIDEOS.length * (cardWidth + cardGap);
  
  // Swipe navigation
  const handleDragEnd = (event: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    
    let newIndex = activeIndex;
    
    if (offset < -threshold || velocity < -500) {
      newIndex = Math.min(activeIndex + 1, SHOWCASE_VIDEOS.length - 1);
    } else if (offset > threshold || velocity > 500) {
      newIndex = Math.max(activeIndex - 1, 0);
    }
    
    setActiveIndex(newIndex);
    const targetX = -(newIndex * (cardWidth + cardGap));
    animate(x, targetX, { type: 'spring', stiffness: 300, damping: 30 });
  };
  
  const goTo = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, SHOWCASE_VIDEOS.length - 1));
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
        animate={{ opacity: activeIndex < SHOWCASE_VIDEOS.length - 1 ? 1 : 0.3 }}
        onClick={goNext}
        disabled={activeIndex === SHOWCASE_VIDEOS.length - 1}
        className="fixed right-8 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-6 h-6" />
      </motion.button>
      
      {/* Main content - Tilted wall of paintings */}
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ 
          perspective: '2000px',
          perspectiveOrigin: 'center center',
        }}
      >
        <motion.div
          ref={containerRef}
          className="flex items-center gap-[60px] px-[50vw] py-20 cursor-grab active:cursor-grabbing"
          style={{ 
            x,
            transformStyle: 'preserve-3d',
            transform: 'rotateY(-15deg)',
          }}
          drag="x"
          dragConstraints={{
            left: -(totalWidth - window.innerWidth + 200),
            right: 200,
          }}
          dragElastic={0.1}
          onDragStart={() => { isDragging.current = true; }}
          onDragEnd={(e, info) => {
            handleDragEnd(e, info);
            setTimeout(() => { isDragging.current = false; }, 100);
          }}
        >
          {SHOWCASE_VIDEOS.map((video, index) => (
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
        {SHOWCASE_VIDEOS.map((_, index) => (
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
