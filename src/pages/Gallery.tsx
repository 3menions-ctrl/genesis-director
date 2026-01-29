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

// Abstract room/wall background with depth
function GalleryRoom() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Deep dark base */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      
      {/* Abstract wall texture - dark navy like reference */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0d1420 0%, #151a28 30%, #0a0f18 70%, #080c14 100%)',
        }}
      />
      
      {/* Floor gradient for room depth */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[40%]"
        style={{
          background: 'linear-gradient(to top, rgba(20,15,10,0.9) 0%, transparent 100%)',
        }}
      />
      
      {/* Subtle geometric patterns */}
      <div className="absolute inset-0 opacity-[0.03]">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute border border-white/20"
            style={{
              width: `${100 + i * 50}px`,
              height: `${100 + i * 50}px`,
              left: `${10 + (i % 5) * 20}%`,
              top: `${10 + Math.floor(i / 5) * 25}%`,
              transform: `rotate(${i * 15}deg)`,
            }}
          />
        ))}
      </div>
      
      {/* Ambient light from left side */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 0% 30%, rgba(100,120,180,0.08) 0%, transparent 50%)',
        }}
      />
      
      {/* Subtle spotlight on wall */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.03) 0%, transparent 40%)',
        }}
      />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
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
        {/* Frame shadow */}
        <div 
          className="absolute -inset-1 rounded-sm bg-black/60 blur-md transition-all duration-300"
          style={{ transform: 'translate(8px, 8px)' }}
        />
        
        {/* Outer frame */}
        <div 
          className={cn(
            "absolute -inset-3 transition-all duration-300",
            "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900",
            "shadow-xl",
            isHovered && "from-zinc-600 via-zinc-700 to-zinc-800"
          )}
        />
        
        {/* Inner mat */}
        <div className="absolute -inset-1.5 bg-zinc-950" />
        
        {/* Image/video area */}
        <div className="relative w-full h-full overflow-hidden bg-black">
          {video.thumbnail_url ? (
            <img 
              src={video.thumbnail_url} 
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
              <Film className="w-10 h-10 text-white/20" />
            </div>
          )}
          
          {/* Hover overlay */}
          <motion.div 
            className="absolute inset-0 bg-black/60 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: isHovered ? 1 : 0.5 }}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/30"
            >
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </motion.div>
          </motion.div>
        </div>
        
        {/* Title plaque */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[90%]">
          <div className="bg-zinc-900/90 backdrop-blur px-2 py-1 text-center border border-white/5">
            <span className="text-white/80 text-xs font-medium truncate block">{video.title}</span>
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
            <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-white/20 flex items-center justify-center bg-white/5">
              <Film className="w-10 h-10 text-white/60" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{video.title}</h2>
            <p className="text-white/40 text-sm">Video preview</p>
          </div>
        )}
        
        {video.video_url && !hasError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button 
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button 
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20"
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); if(videoRef.current) videoRef.current.muted = !isMuted; }}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>
      
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 border border-white/20 z-10"
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
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back</span>
      </motion.button>
      
      {/* Navigation arrows */}
      <button
        onClick={() => scroll('left')}
        className="fixed left-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => scroll('right')}
        className="fixed right-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      
      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      
      {/* 3D Gallery Wall - Angled perspective like reference image */}
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
      
      {/* Gallery title */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-40"
      >
        <h1 className="text-white/30 text-sm tracking-[0.3em] uppercase font-light">Gallery</h1>
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
