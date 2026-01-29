import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, X, Sparkles, ArrowRight, 
  Film, Star, Eye, Clock, ArrowLeft, Zap, Crown
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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  'Cinematic': { bg: 'from-amber-500/30 to-orange-500/20', text: 'text-amber-200', glow: 'rgba(251,146,60,0.3)' },
  'Motion': { bg: 'from-pink-500/30 to-rose-500/20', text: 'text-pink-200', glow: 'rgba(236,72,153,0.3)' },
  'Nature': { bg: 'from-emerald-500/30 to-green-500/20', text: 'text-emerald-200', glow: 'rgba(16,185,129,0.3)' },
  'Sci-Fi': { bg: 'from-cyan-500/30 to-blue-500/20', text: 'text-cyan-200', glow: 'rgba(6,182,212,0.3)' },
  'Abstract': { bg: 'from-purple-500/30 to-violet-500/20', text: 'text-purple-200', glow: 'rgba(139,92,246,0.3)' },
  'Avatar': { bg: 'from-blue-500/30 to-indigo-500/20', text: 'text-blue-200', glow: 'rgba(59,130,246,0.3)' },
};

const CATEGORIES = ['All', 'Cinematic', 'Motion', 'Nature', 'Sci-Fi', 'Abstract', 'Avatar'];

interface VideoCardProps {
  video: typeof SHOWCASE_VIDEOS[0];
  index: number;
  onPlay: () => void;
}

function VideoCard({ video, index, onPlay }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const categoryStyle = CATEGORY_COLORS[video.category] || CATEGORY_COLORS['Cinematic'];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.8, 
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      <motion.div 
        className="relative"
        whileHover={{ y: -12, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
      >
        {/* Dynamic ambient glow */}
        <motion.div
          className="absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${categoryStyle.glow} 0%, transparent 70%)` }}
        />
        
        {/* Featured indicator */}
        {video.featured && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.08 + 0.3, type: 'spring' }}
            className="absolute -top-3 -right-3 z-20"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Crown className="w-5 h-5 text-white" />
            </div>
          </motion.div>
        )}
        
        {/* Card */}
        <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl border border-white/[0.1] rounded-3xl overflow-hidden transition-all duration-500 group-hover:border-white/[0.2] group-hover:shadow-2xl">
          {/* Thumbnail */}
          <div className="relative aspect-[16/10] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
              <Film className="w-16 h-16 text-white/10" />
            </div>
            
            {/* Animated gradient overlay */}
            <motion.div 
              className="absolute inset-0"
              animate={{
                background: isHovered 
                  ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)'
                  : 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)'
              }}
              transition={{ duration: 0.4 }}
            />
            
            {/* Play button */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{ opacity: isHovered ? 1 : 0 }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ 
                  scale: isHovered ? 1 : 0.5, 
                  opacity: isHovered ? 1 : 0 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-2xl flex items-center justify-center border border-white/30 shadow-2xl"
              >
                <Play className="w-9 h-9 text-white fill-white ml-1" />
              </motion.div>
            </motion.div>
            
            {/* Category badge */}
            <Badge 
              className={cn(
                "absolute top-4 left-4 text-xs font-semibold backdrop-blur-2xl border bg-gradient-to-r px-4 py-1.5 rounded-full shadow-lg",
                categoryStyle.bg,
                categoryStyle.text,
                "border-white/20"
              )}
            >
              {video.category}
            </Badge>
            
            {/* Duration & Stats */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl text-xs text-white/80 border border-white/10">
                  <Clock className="w-3.5 h-3.5" />
                  {video.duration}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl text-xs text-white/80 border border-white/10">
                  <Eye className="w-3.5 h-3.5" />
                  {video.views}
                </div>
              </div>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-xl text-xs text-amber-200 border border-amber-500/30">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {video.rating}
              </div>
            </div>
          </div>
          
          {/* Info */}
          <div className="p-6 space-y-3">
            <h3 className="font-bold text-white text-xl truncate group-hover:text-white/95 transition-colors">
              {video.title}
            </h3>
            <p className="text-sm text-white/40 line-clamp-2 leading-relaxed">
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
  
  const categoryStyle = CATEGORY_COLORS[video.category] || CATEGORY_COLORS['Cinematic'];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-5xl bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient glow */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top, ${categoryStyle.glow} 0%, transparent 50%)` }}
        />
        
        {/* Video area */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <div className="text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10"
            >
              <Film className="w-12 h-12 text-white/40" />
            </motion.div>
            <p className="text-white/50 font-medium text-lg">Video Preview</p>
            <p className="text-white/30 text-sm mt-2">{video.title}</p>
          </div>
          
          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
            <div className="flex items-center gap-4">
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/10 transition-all"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/10 transition-all"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="w-1/3 h-full bg-white/50 rounded-full" />
              </div>
              
              <Badge className={cn(
                "backdrop-blur-xl border bg-gradient-to-r px-4 py-1.5 rounded-full text-sm",
                categoryStyle.bg,
                categoryStyle.text,
                "border-white/20"
              )}>
                {video.category}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Info section */}
        <div className="p-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-3">{video.title}</h2>
              <p className="text-white/50 text-lg leading-relaxed">{video.description}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{video.rating}</span>
              </div>
              <div className="flex items-center gap-4 text-white/40 text-sm">
                <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {video.views}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {video.duration}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
        >
          <X className="w-6 h-6" />
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
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95]);
  
  // Check if user came through the animation
  useEffect(() => {
    const fromAnimation = location.state?.fromAnimation === true;
    const sessionAccess = sessionStorage.getItem('gallery_access') === 'true';
    
    if (fromAnimation) {
      sessionStorage.setItem('gallery_access', 'true');
      setHasAccess(true);
    } else if (sessionAccess) {
      setHasAccess(true);
    } else {
      // Redirect to landing with a message
      navigate('/', { replace: true });
    }
  }, [location, navigate]);
  
  const filteredVideos = selectedCategory === 'All' 
    ? SHOWCASE_VIDEOS 
    : SHOWCASE_VIDEOS.filter(v => v.category === selectedCategory);
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#030303] overflow-hidden relative">
      {/* Premium animated background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-black to-black" />
        
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full opacity-20 blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)' }}
          animate={{ 
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full opacity-15 blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)' }}
          animate={{ 
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] rounded-full opacity-10 blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.4) 0%, transparent 70%)' }}
          animate={{ 
            x: [0, 60, 0],
            y: [0, -80, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 10 }}
        />
        
        {/* Noise overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 text-white/60 hover:text-white transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium hidden md:block">Back to Home</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-black">A</span>
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Apex Gallery</span>
          </div>
          
          <Button
            onClick={() => navigate('/auth')}
            className="h-10 px-6 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90"
          >
            <Zap className="w-4 h-4 mr-2" />
            Create Now
          </Button>
        </div>
      </nav>
      
      {/* Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-10 min-h-[70vh] flex flex-col items-center justify-center px-6 pt-20"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-block mb-8"
          >
            <Badge className="px-6 py-2.5 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-white/20 text-white/90 backdrop-blur-xl rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Creations
            </Badge>
          </motion.div>
          
          {/* Title with 3D letters */}
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tight mb-8">
            <span className="inline-flex">
              {'GALLERY'.split('').map((letter, i) => (
                <motion.span
                  key={i}
                  className="inline-block text-white relative"
                  initial={{ opacity: 0, y: 60, rotateX: -40 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.3 + i * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={{
                    y: -10,
                    scale: 1.1,
                    transition: { duration: 0.2 }
                  }}
                  style={{
                    textShadow: '0 4px 60px rgba(139,92,246,0.3), 0 0 120px rgba(6,182,212,0.2)',
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          </h1>
          
          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed"
          >
            Explore stunning AI-generated videos. From cinematic masterpieces to abstract art — 
            witness the future of creative expression.
          </motion.p>
        </motion.div>
      </motion.section>
      
      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="relative z-10 px-6 py-8"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          {CATEGORIES.map((category, i) => (
            <motion.button
              key={category}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 + i * 0.05 }}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                selectedCategory === category
                  ? "bg-white text-black shadow-lg shadow-white/20"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
              )}
            >
              {category}
            </motion.button>
          ))}
        </div>
      </motion.div>
      
      {/* Video Grid */}
      <section className="relative z-10 px-6 py-12 pb-32">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
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
              className="text-center py-20"
            >
              <Film className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No videos in this category yet</p>
            </motion.div>
          )}
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Create?
          </h2>
          <p className="text-lg text-white/40 mb-10 max-w-xl mx-auto">
            Join thousands of creators using Apex Studio to bring their visions to life.
          </p>
          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="group h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.15)] transition-all duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.25)]"
          >
            Start Creating Free
            <ArrowRight className="w-5 h-5 ml-3 transition-transform group-hover:translate-x-1" />
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
