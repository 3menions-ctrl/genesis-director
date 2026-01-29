import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, X, ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
}

// Fetch public videos approved by admin
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
        .limit(30);
      
      if (error) throw error;
      
      // Filter to only include actual video files
      const videos = (data || []).filter(v => {
        const url = v.video_url?.toLowerCase() || '';
        return (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) 
          && !url.includes('manifest');
      });
      
      return videos;
    },
  });
};

// Fallback sample videos
const FALLBACK_VIDEOS: GalleryVideo[] = [
  { id: '1', title: 'Sunset Dreams', thumbnail_url: null, video_url: null },
  { id: '2', title: 'Urban Pulse', thumbnail_url: null, video_url: null },
  { id: '3', title: "Nature's Symphony", thumbnail_url: null, video_url: null },
  { id: '4', title: 'Digital Horizons', thumbnail_url: null, video_url: null },
  { id: '5', title: 'Abstract Flow', thumbnail_url: null, video_url: null },
  { id: '6', title: 'Character Story', thumbnail_url: null, video_url: null },
  { id: '7', title: 'Cosmic Journey', thumbnail_url: null, video_url: null },
  { id: '8', title: 'Ocean Depths', thumbnail_url: null, video_url: null },
];

// Premium 3D room with flowing lines - green/white/black/grey palette
function GalleryRoom() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Deep black base */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Animated flowing lines - SVG based */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-60"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* White/silver gradient */}
          <linearGradient id="whiteLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="30%" stopColor="#4a4a4a" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#4a4a4a" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </linearGradient>
          
          {/* Grey gradient */}
          <linearGradient id="greyLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="40%" stopColor="#3a3a3a" />
            <stop offset="60%" stopColor="#3a3a3a" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Horizontal flowing lines - creating 3D room depth */}
        <motion.path
          d="M -100,200 Q 500,180 960,200 T 2020,200"
          fill="none"
          stroke="url(#whiteLine)"
          strokeWidth="2"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <motion.path
          d="M -100,280 Q 600,260 960,280 T 2020,280"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 3.5, delay: 0.2, ease: "easeInOut" }}
        />
        <motion.path
          d="M -100,360 Q 400,340 960,360 T 2020,360"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 4, delay: 0.4, ease: "easeInOut" }}
        />
        
        {/* Center prominent white lines */}
        <motion.path
          d="M -100,480 C 300,450 600,510 960,480 S 1600,510 2020,480"
          fill="none"
          stroke="url(#whiteLine)"
          strokeWidth="3"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.5, delay: 0.3, ease: "easeInOut" }}
        />
        <motion.path
          d="M -100,520 C 400,550 700,490 960,520 S 1500,490 2020,520"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 2.8, delay: 0.5, ease: "easeInOut" }}
        />
        <motion.path
          d="M -100,560 C 350,530 650,590 960,560 S 1550,530 2020,560"
          fill="none"
          stroke="url(#whiteLine)"
          strokeWidth="1.5"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 3.2, delay: 0.7, ease: "easeInOut" }}
        />
        
        {/* Lower section lines */}
        <motion.path
          d="M -100,680 Q 500,700 960,680 T 2020,680"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.4 }}
          transition={{ duration: 3.5, delay: 0.6, ease: "easeInOut" }}
        />
        <motion.path
          d="M -100,760 Q 600,780 960,760 T 2020,760"
          fill="none"
          stroke="url(#whiteLine)"
          strokeWidth="1.5"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 4, delay: 0.8, ease: "easeInOut" }}
        />
        <motion.path
          d="M -100,840 Q 400,820 960,840 T 2020,840"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.4 }}
          transition={{ duration: 4.5, delay: 1, ease: "easeInOut" }}
        />
        
        {/* Vertical perspective lines for 3D room feel */}
        <motion.path
          d="M 100,0 C 120,300 80,600 100,1080"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="0.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.3 }}
          transition={{ duration: 3, delay: 1.2, ease: "easeInOut" }}
        />
        <motion.path
          d="M 1820,0 C 1800,300 1840,600 1820,1080"
          fill="none"
          stroke="url(#greyLine)"
          strokeWidth="0.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.3 }}
          transition={{ duration: 3, delay: 1.4, ease: "easeInOut" }}
        />
      </svg>
      
      {/* Corner vignette for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.04) 0%, transparent 40%),
            radial-gradient(ellipse at 100% 100%, rgba(255,255,255,0.02) 0%, transparent 40%),
            radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 80%)
          `,
        }}
      />
      
      {/* Ambient silver glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }}
      />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

interface FramedVideoProps {
  video: GalleryVideo;
  index: number;
  onClick: () => void;
  rowIndex: number;
}

function FramedVideo({ video, index, onClick, rowIndex }: FramedVideoProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Vary sizes for gallery wall effect
  const sizes = [
    { w: 180, h: 240 },
    { w: 220, h: 160 },
    { w: 160, h: 200 },
    { w: 200, h: 280 },
    { w: 180, h: 180 },
    { w: 240, h: 180 },
  ];
  const size = sizes[index % sizes.length];
  
  return (
    <motion.div
      className="flex-shrink-0 cursor-pointer"
      style={{ 
        width: size.w,
        height: size.h,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="relative w-full h-full group">
        {/* Frame shadow with green tint */}
        <div 
          className="absolute -inset-1 rounded-sm blur-md transition-all duration-300"
          style={{ 
            transform: 'translate(8px, 8px)',
            background: isHovered ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.6)'
          }}
        />
        
        {/* Outer frame - dark with subtle green accent */}
        <div 
          className={cn(
            "absolute -inset-3 transition-all duration-300",
            "bg-gradient-to-br from-zinc-800 via-zinc-900 to-black",
            "shadow-xl",
            isHovered && "from-emerald-950/50 via-zinc-900 to-black"
          )}
        />
        
        {/* Inner mat */}
        <div className="absolute -inset-1.5 bg-black" />
        
        {/* Image/video area */}
        <div className="relative w-full h-full overflow-hidden bg-zinc-950">
          {video.thumbnail_url ? (
            <img 
              src={video.thumbnail_url} 
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
              <Film className="w-10 h-10 text-emerald-500/30" />
            </div>
          )}
          
          {/* Hover overlay with green accent */}
          <motion.div 
            className="absolute inset-0 bg-black/60 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: isHovered ? 1 : 0.5 }}
              className="w-12 h-12 rounded-full bg-emerald-500/20 backdrop-blur-xl flex items-center justify-center border border-emerald-400/40"
            >
              <Play className="w-5 h-5 text-emerald-100 fill-emerald-100 ml-0.5" />
            </motion.div>
          </motion.div>
        </div>
        
        {/* Title plaque with green accent */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[90%]">
          <div className="bg-zinc-950/95 backdrop-blur px-2 py-1 text-center border border-emerald-900/30">
            <span className="text-zinc-300 text-xs font-medium truncate block">{video.title}</span>
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current && video.video_url) {
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (err) {
          console.warn('Autoplay failed:', err);
        }
      }
    };
    playVideo();
  }, [video.video_url]);
  
  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      setHasError(true);
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
      <div 
        className="absolute inset-0 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {video.video_url && !hasError ? (
          <video
            ref={videoRef}
            src={video.video_url}
            className="w-full h-full object-contain"
            loop
            muted={isMuted}
            playsInline
            onClick={togglePlay}
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-emerald-500/30 flex items-center justify-center bg-emerald-500/10">
              <Film className="w-10 h-10 text-emerald-400/60" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{video.title}</h2>
            <p className="text-zinc-500 text-sm">Video preview</p>
          </div>
        )}
        
        {video.video_url && !hasError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button 
              className="w-12 h-12 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-100 backdrop-blur-xl border border-emerald-500/30"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button 
              className="w-12 h-12 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-100 backdrop-blur-xl border border-emerald-500/30"
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); if(videoRef.current) videoRef.current.muted = !isMuted; }}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>
      
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700/50 z-10"
      >
        <X className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<GalleryVideo | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { data: realVideos, isLoading } = useGalleryVideos();
  const videos = realVideos && realVideos.length > 0 ? realVideos : FALLBACK_VIDEOS;
  
  // Split videos into rows for gallery wall layout
  const row1 = videos.filter((_, i) => i % 2 === 0);
  const row2 = videos.filter((_, i) => i % 2 === 1);
  
  // Access control
  useEffect(() => {
    const fromAnimation = location.state?.fromAnimation === true;
    const sessionAccess = sessionStorage.getItem('gallery_access') === 'true';
    
    if (fromAnimation || sessionAccess) {
      if (fromAnimation) sessionStorage.setItem('gallery_access', 'true');
      setHasAccess(true);
    } else {
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  // Scroll handlers
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'left' ? -400 : 400;
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <GalleryRoom />
      
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-zinc-500 hover:text-emerald-400 transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back</span>
      </motion.button>
      
      {/* Navigation arrows */}
      <button
        onClick={() => scroll('left')}
        className="fixed left-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-zinc-900/50 hover:bg-emerald-900/30 border border-zinc-800 hover:border-emerald-700/50 flex items-center justify-center text-zinc-500 hover:text-emerald-400 transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => scroll('right')}
        className="fixed right-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-zinc-900/50 hover:bg-emerald-900/30 border border-zinc-800 hover:border-emerald-700/50 flex items-center justify-center text-zinc-500 hover:text-emerald-400 transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      
      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      )}
      
      {/* 3D Gallery Wall - Angled perspective */}
      <div 
        className="min-h-screen flex items-center"
        style={{ 
          perspective: '1200px',
          perspectiveOrigin: '20% 50%',
        }}
      >
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{
            transform: 'rotateY(-25deg) translateX(15%)',
            transformStyle: 'preserve-3d',
            transformOrigin: 'left center',
          }}
        >
          <div className="min-w-max py-20 px-32">
            {/* Wall content - Two rows of framed videos */}
            <div className="flex flex-col gap-16">
              {/* Top row */}
              <div className="flex items-end gap-8 pl-12">
                {row1.map((video, index) => (
                  <FramedVideo
                    key={video.id}
                    video={video}
                    index={index}
                    rowIndex={0}
                    onClick={() => setSelectedVideo(video)}
                  />
                ))}
              </div>
              
              {/* Bottom row - offset for gallery wall feel */}
              <div className="flex items-start gap-8 pl-24">
                {row2.map((video, index) => (
                  <FramedVideo
                    key={video.id}
                    video={video}
                    index={index + row1.length}
                    rowIndex={1}
                    onClick={() => setSelectedVideo(video)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gallery title with green accent */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-40"
      >
        <h1 className="text-emerald-400/50 text-sm tracking-[0.3em] uppercase font-light">Gallery</h1>
      </motion.div>
      
      {/* Fullscreen player */}
      <AnimatePresence>
        {selectedVideo && (
          <FullscreenPlayer 
            video={selectedVideo} 
            onClose={() => setSelectedVideo(null)} 
          />
        )}
      </AnimatePresence>
      
      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
