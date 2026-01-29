import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, X, Sparkles, ArrowRight, 
  Film, Star, Eye, Clock, ArrowLeft, Zap, Crown, Hexagon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Premium showcase videos
const SHOWCASE_VIDEOS = [
  {
    id: '1',
    title: 'Sunset Dreams',
    description: 'A cinematic journey through golden hour landscapes with breathtaking color gradients',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Cinematic',
    duration: '0:32',
    views: '12.4K',
    rating: 4.9,
    featured: true,
  },
  {
    id: '2',
    title: 'Urban Pulse',
    description: 'Dynamic city life captured in motion with neon-lit streets and flowing traffic',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Motion',
    duration: '0:45',
    views: '8.7K',
    rating: 4.8,
  },
  {
    id: '3',
    title: "Nature's Symphony",
    description: 'Breathtaking wildlife in their natural habitat with stunning 4K detail',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Nature',
    duration: '1:12',
    views: '15.2K',
    rating: 5.0,
    featured: true,
  },
  {
    id: '4',
    title: 'Digital Horizons',
    description: 'Futuristic visions brought to life with cutting-edge AI generation',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Sci-Fi',
    duration: '0:58',
    views: '9.3K',
    rating: 4.7,
  },
  {
    id: '5',
    title: 'Abstract Flow',
    description: 'Mesmerizing patterns and colors in motion, pure visual poetry',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Abstract',
    duration: '0:38',
    views: '7.1K',
    rating: 4.6,
  },
  {
    id: '6',
    title: 'Character Story',
    description: 'AI-generated characters with consistent identity across scenes',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Avatar',
    duration: '1:05',
    views: '11.8K',
    rating: 4.9,
  },
  {
    id: '7',
    title: 'Ocean Depths',
    description: 'Explore the mysterious underwater world with stunning bioluminescence',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Nature',
    duration: '0:52',
    views: '6.4K',
    rating: 4.8,
  },
  {
    id: '8',
    title: 'Neon Dreams',
    description: 'Cyberpunk aesthetics with vibrant neon colors and rain-soaked streets',
    thumbnail: '/placeholder.svg',
    videoUrl: null,
    category: 'Sci-Fi',
    duration: '0:41',
    views: '13.5K',
    rating: 4.9,
    featured: true,
  },
];

const CATEGORY_CONFIG: Record<string, { gradient: string; text: string; glow: string; accent: string }> = {
  'Cinematic': { gradient: 'from-amber-500 via-orange-500 to-rose-500', text: 'text-amber-100', glow: 'rgba(251,146,60,0.4)', accent: '#fb923c' },
  'Motion': { gradient: 'from-pink-500 via-rose-500 to-red-500', text: 'text-pink-100', glow: 'rgba(236,72,153,0.4)', accent: '#ec4899' },
  'Nature': { gradient: 'from-emerald-500 via-green-500 to-teal-500', text: 'text-emerald-100', glow: 'rgba(16,185,129,0.4)', accent: '#10b981' },
  'Sci-Fi': { gradient: 'from-cyan-500 via-blue-500 to-indigo-500', text: 'text-cyan-100', glow: 'rgba(6,182,212,0.4)', accent: '#06b6d4' },
  'Abstract': { gradient: 'from-purple-500 via-violet-500 to-fuchsia-500', text: 'text-purple-100', glow: 'rgba(139,92,246,0.4)', accent: '#8b5cf6' },
  'Avatar': { gradient: 'from-blue-500 via-indigo-500 to-purple-500', text: 'text-blue-100', glow: 'rgba(59,130,246,0.4)', accent: '#3b82f6' },
};

const CATEGORIES = ['All', 'Cinematic', 'Motion', 'Nature', 'Sci-Fi', 'Abstract', 'Avatar'];

// Floating geometric shapes for background
function FloatingShapes() {
  const shapes = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    type: i % 4,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 20 + Math.random() * 60,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 10,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className="absolute"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
            width: shape.size,
            height: shape.size,
          }}
          initial={{ opacity: 0, rotate: shape.rotation }}
          animate={{
            opacity: [0, 0.08, 0.04, 0.08, 0],
            rotate: shape.rotation + 360,
            y: [0, -100, 0],
            x: [0, shape.id % 2 === 0 ? 50 : -50, 0],
          }}
          transition={{
            duration: shape.duration,
            delay: shape.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {shape.type === 0 && (
            <div className="w-full h-full border border-white/20 rounded-full" />
          )}
          {shape.type === 1 && (
            <div className="w-full h-full border border-purple-500/20 rotate-45" />
          )}
          {shape.type === 2 && (
            <Hexagon className="w-full h-full text-cyan-500/10" strokeWidth={0.5} />
          )}
          {shape.type === 3 && (
            <div className="w-full h-full border border-amber-500/15 rounded-2xl rotate-12" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Abstract flowing lines
function AbstractLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" preserveAspectRatio="none">
      <defs>
        <linearGradient id="line-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(139,92,246,0)" />
          <stop offset="30%" stopColor="rgba(139,92,246,0.3)" />
          <stop offset="50%" stopColor="rgba(6,182,212,0.4)" />
          <stop offset="70%" stopColor="rgba(251,146,60,0.3)" />
          <stop offset="100%" stopColor="rgba(251,146,60,0)" />
        </linearGradient>
        <linearGradient id="line-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(236,72,153,0)" />
          <stop offset="40%" stopColor="rgba(236,72,153,0.2)" />
          <stop offset="60%" stopColor="rgba(16,185,129,0.3)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,300 Q200,100 400,250 T800,200 T1200,350 T1600,150 T2000,300"
        fill="none"
        stroke="url(#line-gradient-1)"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 3, ease: 'easeOut' }}
      />
      <motion.path
        d="M0,500 Q300,300 600,450 T1000,350 T1400,500 T1800,300 T2000,450"
        fill="none"
        stroke="url(#line-gradient-2)"
        strokeWidth="1.5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 3.5, ease: 'easeOut', delay: 0.5 }}
      />
    </svg>
  );
}

interface VideoCardProps {
  video: typeof SHOWCASE_VIDEOS[0];
  index: number;
  onPlay: () => void;
}

function VideoCard({ video, index, onPlay }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = CATEGORY_CONFIG[video.category] || CATEGORY_CONFIG['Cinematic'];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 80, rotateX: -15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ 
        duration: 1, 
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="group cursor-pointer perspective-1000"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      <motion.div 
        className="relative"
        whileHover={{ 
          y: -16, 
          rotateY: 5,
          rotateX: 5,
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } 
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Multi-layer ambient glow */}
        <motion.div
          className="absolute -inset-6 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all duration-700 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${config.glow} 0%, transparent 70%)` }}
        />
        <motion.div
          className="absolute -inset-3 rounded-[2rem] opacity-0 group-hover:opacity-60 transition-all duration-500 pointer-events-none"
          style={{ 
            background: `linear-gradient(135deg, ${config.accent}20 0%, transparent 50%, ${config.accent}10 100%)`,
            filter: 'blur(20px)',
          }}
        />
        
        {/* Featured crown */}
        {video.featured && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: index * 0.1 + 0.4, type: 'spring', stiffness: 300 }}
            className="absolute -top-4 -right-4 z-20"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl border border-white/20",
              `bg-gradient-to-br ${config.gradient}`
            )}>
              <Crown className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
          </motion.div>
        )}
        
        {/* Card with glass morphism */}
        <div className="relative bg-gradient-to-br from-white/[0.12] to-white/[0.04] backdrop-blur-3xl border border-white/[0.15] rounded-[1.5rem] overflow-hidden transition-all duration-700 group-hover:border-white/[0.3] group-hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ x: '-100%', opacity: 0 }}
            animate={isHovered ? { x: '200%', opacity: 1 } : { x: '-100%', opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              width: '50%',
            }}
          />
          
          {/* Thumbnail */}
          <div className="relative aspect-[16/10] overflow-hidden">
            <div className={cn(
              "absolute inset-0 flex items-center justify-center",
              `bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900`
            )}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
              >
                <Hexagon className="w-20 h-20 text-white/5" strokeWidth={0.5} />
              </motion.div>
            </div>
            
            {/* Gradient category accent */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{ background: `linear-gradient(135deg, ${config.accent}40 0%, transparent 60%)` }}
            />
            
            {/* Overlay */}
            <motion.div 
              className="absolute inset-0"
              animate={{
                background: isHovered 
                  ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.2) 100%)'
                  : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)'
              }}
              transition={{ duration: 0.5 }}
            />
            
            {/* Play button */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{ opacity: isHovered ? 1 : 0 }}
            >
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ 
                  scale: isHovered ? 1 : 0.4, 
                  opacity: isHovered ? 1 : 0 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center border-2 shadow-2xl",
                  "bg-white/10 backdrop-blur-2xl border-white/40"
                )}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Play className="w-10 h-10 text-white fill-white ml-1.5" />
                </motion.div>
              </motion.div>
            </motion.div>
            
            {/* Category badge */}
            <div className="absolute top-4 left-4">
              <Badge 
                className={cn(
                  "text-xs font-bold backdrop-blur-2xl px-4 py-2 rounded-xl shadow-xl border-0",
                  `bg-gradient-to-r ${config.gradient} text-white`
                )}
              >
                {video.category}
              </Badge>
            </div>
            
            {/* Stats row */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-xl text-xs text-white/90 border border-white/10">
                  <Clock className="w-3.5 h-3.5" />
                  {video.duration}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-xl text-xs text-white/90 border border-white/10">
                  <Eye className="w-3.5 h-3.5" />
                  {video.views}
                </div>
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl text-xs font-semibold border",
                "bg-amber-500/30 text-amber-100 border-amber-400/30"
              )}>
                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                {video.rating}
              </div>
            </div>
          </div>
          
          {/* Info */}
          <div className="p-6 space-y-3 relative">
            {/* Accent line */}
            <div 
              className={cn("absolute top-0 left-6 right-6 h-px", `bg-gradient-to-r ${config.gradient}`)}
              style={{ opacity: 0.3 }}
            />
            
            <h3 className="font-bold text-white text-xl truncate group-hover:text-white transition-colors">
              {video.title}
            </h3>
            <p className="text-sm text-white/50 line-clamp-2 leading-relaxed group-hover:text-white/60 transition-colors">
              {video.description}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface VideoModalProps {
  video: typeof SHOWCASE_VIDEOS[0] | null;
  onClose: () => void;
}

function VideoModal({ video, onClose }: VideoModalProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  
  if (!video) return null;
  
  const config = CATEGORY_CONFIG[video.category] || CATEGORY_CONFIG['Cinematic'];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl"
      onClick={onClose}
    >
      {/* Background accent */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ background: `radial-gradient(ellipse at center, ${config.glow} 0%, transparent 50%)` }}
      />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 60, rotateX: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 60, rotateX: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-6xl bg-gradient-to-br from-white/[0.1] to-white/[0.02] backdrop-blur-3xl rounded-[2rem] overflow-hidden border border-white/[0.1] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent gradient */}
        <div className={cn("absolute top-0 left-0 right-0 h-1", `bg-gradient-to-r ${config.gradient}`)} />
        
        {/* Video area */}
        <div className="relative aspect-video bg-black/80 flex items-center justify-center overflow-hidden">
          {/* Abstract background pattern */}
          <motion.div
            className="absolute inset-0 opacity-20"
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-white/10"
                style={{
                  width: `${(i + 1) * 150}px`,
                  height: `${(i + 1) * 150}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </motion.div>
          
          <div className="text-center relative z-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className={cn(
                "w-28 h-28 rounded-3xl flex items-center justify-center mx-auto mb-8 border-2",
                `bg-gradient-to-br ${config.gradient} border-white/20`
              )}
            >
              <Film className="w-14 h-14 text-white" />
            </motion.div>
            <p className="text-white/60 font-medium text-xl">Video Preview</p>
            <p className="text-white/30 mt-2">{video.title}</p>
          </div>
          
          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
            <div className="flex items-center gap-4">
              <button 
                className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all hover:scale-105"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button 
                className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all hover:scale-105"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden mx-4">
                <motion.div 
                  className={cn("h-full rounded-full", `bg-gradient-to-r ${config.gradient}`)}
                  initial={{ width: '0%' }}
                  animate={{ width: '35%' }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                />
              </div>
              
              <Badge className={cn(
                "px-5 py-2 rounded-xl text-sm font-bold border-0",
                `bg-gradient-to-r ${config.gradient} text-white`
              )}>
                {video.category}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Info section */}
        <div className="p-10">
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <h2 className="text-4xl font-black text-white mb-4">{video.title}</h2>
              <p className="text-white/50 text-lg leading-relaxed">{video.description}</p>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/20 text-amber-100 border border-amber-400/30">
                <Star className="w-6 h-6 fill-amber-300 text-amber-300" />
                <span className="font-bold text-xl">{video.rating}</span>
              </div>
              <div className="flex items-center gap-6 text-white/40 text-sm">
                <span className="flex items-center gap-2"><Eye className="w-5 h-5" /> {video.views}</span>
                <span className="flex items-center gap-2"><Clock className="w-5 h-5" /> {video.duration}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-14 h-14 rounded-2xl bg-black/50 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10 hover:scale-105"
        >
          <X className="w-7 h-7" />
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedVideo, setSelectedVideo] = useState<typeof SHOWCASE_VIDEOS[0] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [hasAccess, setHasAccess] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.9]);
  const heroY = useTransform(scrollY, [0, 500], [0, 100]);
  
  useEffect(() => {
    const fromAnimation = location.state?.fromAnimation === true;
    const sessionAccess = sessionStorage.getItem('gallery_access') === 'true';
    
    if (fromAnimation) {
      sessionStorage.setItem('gallery_access', 'true');
      setHasAccess(true);
    } else if (sessionAccess) {
      setHasAccess(true);
    } else {
      navigate('/', { replace: true });
    }
  }, [location, navigate]);
  
  const filteredVideos = selectedCategory === 'All' 
    ? SHOWCASE_VIDEOS 
    : SHOWCASE_VIDEOS.filter(v => v.category === selectedCategory);
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-white/20 border-t-purple-500 rounded-full"
        />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#030303] overflow-hidden relative">
      {/* Epic animated background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Deep gradient base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0f0f1a_0%,_#030303_50%,_#000000_100%)]" />
        
        {/* Abstract flowing lines */}
        <AbstractLines />
        
        {/* Floating geometric shapes */}
        <FloatingShapes />
        
        {/* Premium gradient orbs */}
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-[1000px] h-[1000px] rounded-full opacity-30 blur-[200px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 60%)' }}
          animate={{ 
            x: [0, 150, 0],
            y: [0, 100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/4 -right-1/4 w-[900px] h-[900px] rounded-full opacity-25 blur-[180px]"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.5) 0%, transparent 60%)' }}
          animate={{ 
            x: [0, -120, 0],
            y: [0, 150, 0],
            scale: [1, 1.4, 1],
          }}
          transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 w-[700px] h-[700px] rounded-full opacity-20 blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.5) 0%, transparent 60%)' }}
          animate={{ 
            x: [0, 80, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 10 }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full opacity-15 blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 60%)' }}
          animate={{ 
            x: [0, -60, 0],
            y: [0, 80, 0],
            scale: [1, 1.25, 1],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 15 }}
        />
        
        {/* Noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-6">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-7xl mx-auto flex items-center justify-between"
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 text-white/60 hover:text-white transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all group-hover:scale-105">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium hidden md:block">Back to Home</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-sm font-black text-white">A</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Apex Gallery</span>
          </div>
          
          <Button
            onClick={() => navigate('/auth')}
            className="h-12 px-8 text-sm font-semibold rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90 shadow-lg shadow-purple-500/30 border-0"
          >
            <Zap className="w-4 h-4 mr-2" />
            Create Now
          </Button>
        </motion.div>
      </nav>
      
      {/* Epic Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative z-10 min-h-[85vh] flex flex-col items-center justify-center px-6 pt-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-5xl mx-auto"
        >
          {/* Floating badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="inline-block mb-10"
          >
            <Badge className="px-8 py-3 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-amber-500/20 border border-white/20 text-white backdrop-blur-2xl rounded-2xl text-sm font-semibold shadow-2xl">
              <Sparkles className="w-5 h-5 mr-3" />
              AI-Powered Creative Showcase
            </Badge>
          </motion.div>
          
          {/* Epic title with layered effects */}
          <div className="relative mb-8">
            {/* Background glow for title */}
            <motion.div
              className="absolute inset-0 blur-[100px] pointer-events-none"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.5) 0%, rgba(6,182,212,0.5) 50%, rgba(251,146,60,0.5) 100%)' }}
            />
            
            <h1 className="relative text-7xl md:text-9xl lg:text-[12rem] font-black tracking-tight leading-none">
              <span className="inline-flex">
                {'GALLERY'.split('').map((letter, i) => (
                  <motion.span
                    key={i}
                    className="inline-block relative"
                    initial={{ opacity: 0, y: 100, rotateX: -60, scale: 0.5 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                    transition={{
                      duration: 1,
                      delay: 0.4 + i * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={{
                      y: -20,
                      scale: 1.15,
                      transition: { duration: 0.3 }
                    }}
                    style={{
                      background: i < 3 
                        ? 'linear-gradient(180deg, #ffffff 0%, #a78bfa 100%)'
                        : i < 5
                        ? 'linear-gradient(180deg, #ffffff 0%, #06b6d4 100%)'
                        : 'linear-gradient(180deg, #ffffff 0%, #fb923c 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 4px 60px rgba(139,92,246,0.4))',
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            </h1>
          </div>
          
          {/* Animated subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="text-xl md:text-2xl text-white/40 max-w-3xl mx-auto leading-relaxed font-light"
          >
            Discover breathtaking AI-generated masterpieces. From cinematic epics to abstract poetry — 
            <span className="text-white/60"> witness creativity reimagined.</span>
          </motion.p>
          
          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="w-48 h-px mx-auto mt-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        </motion.div>
      </motion.section>
      
      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.8 }}
        className="relative z-10 px-6 py-10"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          {CATEGORIES.map((category, i) => {
            const isActive = selectedCategory === category;
            const config = CATEGORY_CONFIG[category];
            
            return (
              <motion.button
                key={category}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.3 + i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-7 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 border",
                  isActive
                    ? category === 'All'
                      ? "bg-white text-black shadow-xl shadow-white/20 border-transparent"
                      : `bg-gradient-to-r ${config?.gradient} text-white shadow-xl border-transparent`
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border-white/10 hover:border-white/20"
                )}
              >
                {category}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
      
      {/* Video Grid */}
      <section className="relative z-10 px-6 py-12 pb-32">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
            >
              {filteredVideos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  onPlay={() => setSelectedVideo(video)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
          
          {filteredVideos.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24"
            >
              <Hexagon className="w-20 h-20 text-white/10 mx-auto mb-6" strokeWidth={0.5} />
              <p className="text-white/40 text-lg">No videos in this category yet</p>
            </motion.div>
          )}
        </div>
      </section>
      
      {/* Grand CTA Section */}
      <section className="relative z-10 py-32 px-6">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="relative inline-block mb-8"
          >
            <div className="absolute inset-0 blur-[100px] bg-gradient-to-r from-purple-500/40 via-cyan-500/40 to-amber-500/40 rounded-full" />
            <h2 className="relative text-5xl md:text-7xl font-black text-white">
              Ready to Create?
            </h2>
          </motion.div>
          
          <p className="text-xl text-white/40 mb-14 max-w-2xl mx-auto leading-relaxed">
            Join the creative revolution. Transform your imagination into stunning visual experiences.
          </p>
          
          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="group h-16 px-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-purple-500 via-cyan-500 to-amber-500 text-white hover:opacity-90 shadow-[0_20px_60px_-15px_rgba(139,92,246,0.5)] transition-all duration-300 hover:shadow-[0_30px_80px_-15px_rgba(139,92,246,0.6)] border-0"
          >
            Start Creating Free
            <ArrowRight className="w-6 h-6 ml-4 transition-transform group-hover:translate-x-2" />
          </Button>
        </motion.div>
      </section>
      
      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
