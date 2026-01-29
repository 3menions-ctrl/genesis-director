import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, X, ChevronLeft, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  all_clips?: string[]; // All clips for full stitched playback
}

// Manifest structure for stitched videos
interface ManifestClip {
  index: number;
  videoUrl: string;
  duration: number;
}

interface VideoManifest {
  clips: ManifestClip[];
  totalDuration: number;
}

// Fetch stitched/completed project videos from public projects (Gallery showcase)
const useGalleryVideos = () => {
  return useQuery({
    queryKey: ['gallery-videos-stitched'],
    queryFn: async (): Promise<GalleryVideo[]> => {
      // Fetch completed stitched projects that are public
      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, video_url, thumbnail_url')
        .eq('is_public', true)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      if (!data || data.length === 0) return [];
      
      // For each project, fetch manifest and extract first clip URL
      const videosWithClips = await Promise.all(
        data.map(async (project) => {
          const url = project.video_url || '';
          
          // If it's a manifest JSON, fetch and extract first clip
          if (url.endsWith('.json')) {
            try {
              const response = await fetch(url);
              const manifest: VideoManifest = await response.json();
              
              if (manifest.clips && manifest.clips.length > 0) {
                // Use first clip's video URL for playback
                return {
                  id: project.id,
                  title: '',
                  thumbnail_url: project.thumbnail_url,
                  video_url: manifest.clips[0].videoUrl,
                  all_clips: manifest.clips.map(c => c.videoUrl), // Store all clips for full playback
                };
              }
            } catch (e) {
              console.error('Failed to fetch manifest:', e);
            }
          }
          
          // Direct video URL (MP4, WebM, etc.)
          if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
            return {
              id: project.id,
              title: '',
              thumbnail_url: project.thumbnail_url,
              video_url: url,
              all_clips: [url],
            };
          }
          
          return null;
        })
      );
      
      // Filter out nulls and return valid videos
      return videosWithClips.filter((v): v is GalleryVideo & { all_clips: string[] } => v !== null);
    },
  });
};


// Premium 3D room with perspective-aligned flowing lines - silver/blue/white/black palette
function GalleryRoom() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Deep black base */}
      <div className="absolute inset-0 bg-black" />
      
      {/* 3D Perspective-aligned lines container - matches gallery wall rotation */}
      <div 
        className="absolute inset-0"
        style={{
          perspective: '1200px',
          perspectiveOrigin: '20% 50%',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: 'rotateY(-25deg) translateX(15%)',
            transformStyle: 'preserve-3d',
            transformOrigin: 'left center',
          }}
        >
          {/* SVG lines that follow the 3D plane */}
          <svg 
            className="absolute inset-0 w-[200%] h-full opacity-70"
            viewBox="0 0 3840 1080"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Silver/white gradient */}
              <linearGradient id="silverLine3D" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0a0a0a" />
                <stop offset="20%" stopColor="#4b5563" />
                <stop offset="50%" stopColor="#d1d5db" />
                <stop offset="80%" stopColor="#4b5563" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>
              
              {/* Blue accent gradient */}
              <linearGradient id="blueLine3D" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0a0a0a" />
                <stop offset="25%" stopColor="#1e3a5f" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="75%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>
              
              {/* Grey gradient */}
              <linearGradient id="greyLine3D" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0a0a0a" />
                <stop offset="30%" stopColor="#27272a" />
                <stop offset="50%" stopColor="#3f3f46" />
                <stop offset="70%" stopColor="#27272a" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>
              
              {/* Glow filter */}
              <filter id="glow3D" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Horizontal lines following the tilted wall plane */}
            {/* Top section - gallery ceiling area */}
            <motion.line
              x1="-200" y1="120" x2="4000" y2="120"
              stroke="url(#greyLine3D)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="200" x2="4000" y2="200"
              stroke="url(#silverLine3D)"
              strokeWidth="1.5"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 2.2, delay: 0.1, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="280" x2="4000" y2="280"
              stroke="url(#blueLine3D)"
              strokeWidth="1"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2.4, delay: 0.2, ease: "easeOut" }}
            />
            
            {/* Upper gallery wall lines */}
            <motion.line
              x1="-200" y1="360" x2="4000" y2="360"
              stroke="url(#greyLine3D)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.35 }}
              transition={{ duration: 2.5, delay: 0.3, ease: "easeOut" }}
            />
            
            {/* Center section - main gallery wall */}
            <motion.line
              x1="-200" y1="440" x2="4000" y2="440"
              stroke="url(#silverLine3D)"
              strokeWidth="2.5"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 2, delay: 0.4, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="500" x2="4000" y2="500"
              stroke="url(#blueLine3D)"
              strokeWidth="2"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ duration: 2.2, delay: 0.5, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="560" x2="4000" y2="560"
              stroke="url(#silverLine3D)"
              strokeWidth="2"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 2.4, delay: 0.6, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="620" x2="4000" y2="620"
              stroke="url(#greyLine3D)"
              strokeWidth="1.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2.6, delay: 0.7, ease: "easeOut" }}
            />
            
            {/* Lower gallery wall lines */}
            <motion.line
              x1="-200" y1="720" x2="4000" y2="720"
              stroke="url(#blueLine3D)"
              strokeWidth="1.5"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 2.5, delay: 0.8, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="800" x2="4000" y2="800"
              stroke="url(#silverLine3D)"
              strokeWidth="1.5"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2.7, delay: 0.9, ease: "easeOut" }}
            />
            
            {/* Floor section lines */}
            <motion.line
              x1="-200" y1="880" x2="4000" y2="880"
              stroke="url(#greyLine3D)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 2.8, delay: 1, ease: "easeOut" }}
            />
            <motion.line
              x1="-200" y1="960" x2="4000" y2="960"
              stroke="url(#blueLine3D)"
              strokeWidth="1"
              filter="url(#glow3D)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 3, delay: 1.1, ease: "easeOut" }}
            />
          </svg>
        </div>
      </div>
      
      {/* Additional ambient lines in normal space for depth layering */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ambientGrey" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#27272a" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        {/* Subtle ambient horizontal lines */}
        <motion.line
          x1="0" y1="300" x2="1920" y2="300"
          stroke="url(#ambientGrey)"
          strokeWidth="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2, delay: 1.5 }}
        />
        <motion.line
          x1="0" y1="540" x2="1920" y2="540"
          stroke="url(#ambientGrey)"
          strokeWidth="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 2, delay: 1.7 }}
        />
        <motion.line
          x1="0" y1="780" x2="1920" y2="780"
          stroke="url(#ambientGrey)"
          strokeWidth="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2, delay: 1.9 }}
        />
      </svg>
      
      {/* Corner vignette for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, rgba(96,165,250,0.05) 0%, transparent 35%),
            radial-gradient(ellipse at 100% 100%, rgba(148,163,184,0.04) 0%, transparent 35%),
            radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.75) 85%)
          `,
        }}
      />
      
      {/* Ambient silver/blue glow - centered */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          background: 'radial-gradient(ellipse at 40% 50%, rgba(148,163,184,0.2) 0%, transparent 45%)',
        }}
      />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
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

function FramedVideo({ video, index, onClick }: FramedVideoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbnailReady, setThumbnailReady] = useState(false);
  
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
  
  // Seek to a frame to show as thumbnail
  const handleVideoLoaded = useCallback(() => {
    const vid = videoRef.current;
    if (vid && vid.duration > 0) {
      // Seek to 10% of video for a good thumbnail frame
      vid.currentTime = Math.min(vid.duration * 0.1, 1);
    }
  }, []);
  
  const handleSeeked = useCallback(() => {
    setThumbnailReady(true);
  }, []);
  
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
        {/* Frame shadow with blue tint on hover */}
        <div 
          className="absolute -inset-1 rounded-sm blur-md transition-all duration-300"
          style={{ 
            transform: 'translate(8px, 8px)',
            background: isHovered ? 'rgba(96,165,250,0.25)' : 'rgba(0,0,0,0.6)'
          }}
        />
        
        {/* Outer frame - dark with subtle blue accent on hover */}
        <div 
          className={cn(
            "absolute -inset-3 transition-all duration-300",
            "bg-gradient-to-br from-zinc-800 via-zinc-900 to-black",
            "shadow-xl",
            isHovered && "from-slate-800/60 via-zinc-900 to-black"
          )}
        />
        
        {/* Inner mat */}
        <div className="absolute -inset-1.5 bg-black" />
        
        {/* Video/thumbnail area */}
        <div className="relative w-full h-full overflow-hidden bg-zinc-950">
          {video.video_url ? (
            <>
              {/* Video element paused at thumbnail frame */}
              <video
                ref={videoRef}
                src={video.video_url}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-500 group-hover:scale-110",
                  !thumbnailReady && "opacity-0"
                )}
                muted
                playsInline
                preload="auto"
                onLoadedData={handleVideoLoaded}
                onSeeked={handleSeeked}
              />
              {/* Loading state while thumbnail extracts */}
              {!thumbnailReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : video.thumbnail_url ? (
            <img 
              src={video.thumbnail_url} 
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
              <Film className="w-10 h-10 text-slate-500/30" />
            </div>
          )}
          
          {/* Hover overlay with blue accent */}
          <motion.div 
            className="absolute inset-0 bg-black/60 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: isHovered ? 1 : 0.5 }}
              className="w-12 h-12 rounded-full bg-blue-500/20 backdrop-blur-xl flex items-center justify-center border border-blue-400/40"
            >
              <Play className="w-5 h-5 text-blue-100 fill-blue-100 ml-0.5" />
            </motion.div>
          </motion.div>
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
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  
  // Dual video refs for crossfade transitions
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<'A' | 'B'>('A');
  const isTransitioningRef = useRef(false);
  const nextClipReadyRef = useRef(false);
  const triggerTransitionRef = useRef<() => void>(() => {});
  
  // Get all clips
  const clips = video.all_clips && video.all_clips.length > 0 
    ? video.all_clips 
    : video.video_url ? [video.video_url] : [];
  
  const totalClips = clips.length;
  
  // Get video refs based on active state
  const getActiveVideoRef = useCallback(() => {
    return activeVideo === 'A' ? videoARef : videoBRef;
  }, [activeVideo]);
  
  const getInactiveVideoRef = useCallback(() => {
    return activeVideo === 'A' ? videoBRef : videoARef;
  }, [activeVideo]);
  
  // Preload next clip into inactive video element (called early)
  const preloadNextClip = useCallback(() => {
    if (totalClips <= 1) return;
    
    const nextIndex = (currentClipIndex + 1) % totalClips;
    const inactiveVideo = getInactiveVideoRef().current;
    
    if (!inactiveVideo || inactiveVideo.src === clips[nextIndex]) return;
    
    console.log('[Gallery] Preloading next clip:', nextIndex);
    inactiveVideo.src = clips[nextIndex];
    inactiveVideo.load();
    inactiveVideo.muted = true; // Keep muted during preload
    nextClipReadyRef.current = false;
    
    inactiveVideo.oncanplaythrough = () => {
      nextClipReadyRef.current = true;
      console.log('[Gallery] Next clip ready:', nextIndex);
      inactiveVideo.oncanplaythrough = null;
    };
  }, [totalClips, currentClipIndex, clips, getInactiveVideoRef]);
  
  // Instant crossfade transition - no waiting, clips already preloaded
  const triggerTransition = useCallback(() => {
    if (isTransitioningRef.current || totalClips <= 1) return;
    isTransitioningRef.current = true;
    
    const nextIndex = (currentClipIndex + 1) % totalClips;
    const inactiveVideo = getInactiveVideoRef().current;
    const activeVideoEl = getActiveVideoRef().current;
    
    if (!inactiveVideo || !activeVideoEl) {
      isTransitioningRef.current = false;
      return;
    }
    
    console.log('[Gallery] Triggering transition to clip:', nextIndex);
    
    // Start the next clip immediately - it's already preloaded
    inactiveVideo.currentTime = 0;
    inactiveVideo.muted = isMuted;
    inactiveVideo.play().catch(() => {});
    
    // Both videos visible at 100% for ~30ms (True Overlap)
    // Use double-rAF to ensure browser painted the new frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Swap active video
        setActiveVideo(prev => prev === 'A' ? 'B' : 'A');
        setCurrentClipIndex(nextIndex);
        
        // Pause and reset the old video
        activeVideoEl.pause();
        
        isTransitioningRef.current = false;
        
        // Preload the next-next clip
        setTimeout(() => {
          const newNextIndex = (nextIndex + 1) % totalClips;
          const newInactiveVideo = activeVideoEl; // Now the old one is inactive
          if (newInactiveVideo && clips[newNextIndex]) {
            newInactiveVideo.src = clips[newNextIndex];
            newInactiveVideo.load();
            newInactiveVideo.muted = true;
            nextClipReadyRef.current = false;
            newInactiveVideo.oncanplaythrough = () => {
              nextClipReadyRef.current = true;
              newInactiveVideo.oncanplaythrough = null;
            };
          }
        }, 100);
      });
    });
  }, [totalClips, currentClipIndex, clips, getInactiveVideoRef, getActiveVideoRef, isMuted]);
  
  // Keep ref updated for event handlers
  useEffect(() => {
    triggerTransitionRef.current = triggerTransition;
  }, [triggerTransition]);
  
  // Handle time update - trigger transition 50ms before clip ends
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!video.duration || isTransitioningRef.current) return;
    
    // Trigger 50ms before end for seamless overlap
    if (video.currentTime >= video.duration - 0.05) {
      triggerTransitionRef.current();
    }
  }, []);
  
  // Handle clip ended (fallback if timeupdate didn't catch it)
  const handleClipEnded = useCallback(() => {
    if (!isTransitioningRef.current) {
      triggerTransitionRef.current();
    }
  }, []);
  
  // Initial playback setup + preload second clip
  useEffect(() => {
    const startPlayback = async () => {
      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      
      if (videoA && clips.length > 0) {
        videoA.src = clips[0];
        videoA.load();
        
        try {
          await videoA.play();
          setIsPlaying(true);
          
          // Immediately preload second clip into video B
          if (videoB && clips.length > 1) {
            videoB.src = clips[1];
            videoB.load();
            videoB.muted = true;
            videoB.oncanplaythrough = () => {
              nextClipReadyRef.current = true;
              console.log('[Gallery] Second clip preloaded');
              videoB.oncanplaythrough = null;
            };
          }
        } catch (err) {
          console.warn('Autoplay failed:', err);
        }
      }
    };
    startPlayback();
  }, [clips]);
  
  // Sync muted state across both videos
  useEffect(() => {
    if (videoARef.current) videoARef.current.muted = isMuted;
    if (videoBRef.current) videoBRef.current.muted = isMuted;
  }, [isMuted]);
  
  const togglePlay = async () => {
    const activeVideoEl = getActiveVideoRef().current;
    if (!activeVideoEl) return;
    try {
      if (isPlaying) {
        activeVideoEl.pause();
        setIsPlaying(false);
      } else {
        await activeVideoEl.play();
        setIsPlaying(true);
      }
    } catch (err) {
      setHasError(true);
    }
  };
  
  const jumpToClip = (idx: number) => {
    if (idx === currentClipIndex) return;
    
    const activeVideoEl = getActiveVideoRef().current;
    const inactiveVideoEl = getInactiveVideoRef().current;
    
    if (activeVideoEl) {
      activeVideoEl.src = clips[idx];
      activeVideoEl.load();
      activeVideoEl.play().catch(() => {});
      setCurrentClipIndex(idx);
      setIsPlaying(true);
      
      // Preload next clip after this one
      if (inactiveVideoEl && clips[(idx + 1) % totalClips]) {
        const nextIdx = (idx + 1) % totalClips;
        inactiveVideoEl.src = clips[nextIdx];
        inactiveVideoEl.load();
        inactiveVideoEl.muted = true;
      }
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
        {clips.length > 0 && !hasError ? (
          <>
            {/* Video A - always visible when active, both visible during overlap */}
            <video
              ref={videoARef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ 
                opacity: activeVideo === 'A' ? 1 : 0,
                zIndex: activeVideo === 'A' ? 2 : 1,
              }}
              muted={isMuted}
              playsInline
              onClick={togglePlay}
              onError={() => setHasError(true)}
              onEnded={handleClipEnded}
              onTimeUpdate={handleTimeUpdate}
            />
            {/* Video B - always visible when active, both visible during overlap */}
            <video
              ref={videoBRef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ 
                opacity: activeVideo === 'B' ? 1 : 0,
                zIndex: activeVideo === 'B' ? 2 : 1,
              }}
              muted={isMuted}
              playsInline
              onClick={togglePlay}
              onError={() => setHasError(true)}
              onEnded={handleClipEnded}
              onTimeUpdate={handleTimeUpdate}
            />
          </>
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-slate-500/30 flex items-center justify-center bg-slate-500/10">
              <Film className="w-10 h-10 text-slate-400/60" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{video.title}</h2>
            <p className="text-zinc-500 text-sm">Video preview</p>
          </div>
        )}
        
        {clips.length > 0 && !hasError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            {/* Clip progress indicator */}
            {totalClips > 1 && (
              <div className="flex items-center gap-1.5 mb-2">
                {clips.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); jumpToClip(idx); }}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentClipIndex 
                        ? "bg-white w-6" 
                        : "bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            )}
            
            {/* Controls */}
            <div className="flex items-center gap-3">
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20"
                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
            
            {/* Clip counter */}
            {totalClips > 1 && (
              <span className="text-white/50 text-xs">
                Clip {currentClipIndex + 1} of {totalClips}
              </span>
            )}
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
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const { data: videos = [], isLoading } = useGalleryVideos();
  
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

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Multiplier for scroll speed
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
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
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-zinc-500 hover:text-blue-400 transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back</span>
      </motion.button>
      
      
      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="w-8 h-8 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
        </div>
      )}
      
      {/* Gallery Wall - Scroll container is flat, content has 3D visual effect */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          "min-h-screen flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 3D perspective wrapper - visual only, doesn't affect scroll */}
        <div 
          className="min-w-max"
          style={{ 
            perspective: '1200px',
            perspectiveOrigin: '20% 50%',
          }}
        >
          <div
            className="py-20 px-32"
            style={{
              transform: 'rotateY(-25deg) translateX(15%)',
              transformStyle: 'preserve-3d',
              transformOrigin: 'left center',
            }}
          >
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
        <h1 className="text-slate-400/50 text-sm tracking-[0.3em] uppercase font-light">Gallery</h1>
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
