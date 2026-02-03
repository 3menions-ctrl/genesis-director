import React, { useState, useEffect, useRef, useCallback, forwardRef, memo, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, X, ChevronLeft, ChevronRight, Film, Type, Image, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { safePlay, safePause, safeSeek, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from '@/lib/navigation';

// Video category type
type VideoCategory = 'all' | 'text-to-video' | 'image-to-video' | 'avatar';

interface GalleryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  all_clips?: string[];
  category?: VideoCategory;
  mode?: string | null;
}

interface ManifestClip {
  index: number;
  videoUrl: string;
  duration: number;
}

interface VideoManifest {
  clips: ManifestClip[];
  totalDuration: number;
}

const ADMIN_USER_ID = 'd600868d-651a-46f6-a621-a727b240ac7c';

// Category configuration
const CATEGORIES: { id: VideoCategory; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'all', label: 'All Videos', icon: Sparkles, description: 'Browse our complete collection' },
  { id: 'text-to-video', label: 'Text to Video', icon: Type, description: 'Transform words into cinematic scenes' },
  { id: 'image-to-video', label: 'Image to Video', icon: Image, description: 'Bring static images to life' },
  { id: 'avatar', label: 'AI Avatar', icon: User, description: 'Realistic talking avatars' },
];

// Helper to determine video category from project mode
const getVideoCategory = (mode: string | null): VideoCategory => {
  if (!mode) return 'text-to-video';
  const lowerMode = mode.toLowerCase();
  if (lowerMode.includes('avatar') || lowerMode.includes('talking')) return 'avatar';
  if (lowerMode.includes('image') || lowerMode.includes('img2vid')) return 'image-to-video';
  return 'text-to-video';
};

const useGalleryVideos = () => {
  return useQuery({
    queryKey: ['gallery-videos-admin'],
    queryFn: async (): Promise<GalleryVideo[]> => {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, video_url, thumbnail_url, mode, title')
        .eq('user_id', ADMIN_USER_ID)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      if (!data || data.length === 0) return [];
      
      const videosWithClips = await Promise.all(
        data.map(async (project) => {
          const url = project.video_url || '';
          const category = getVideoCategory(project.mode);
          
          if (url.endsWith('.json')) {
            try {
              const response = await fetch(url);
              const manifest: VideoManifest = await response.json();
              
              if (manifest.clips && manifest.clips.length > 0) {
                return {
                  id: project.id,
                  title: project.title || '',
                  thumbnail_url: project.thumbnail_url,
                  video_url: manifest.clips[0].videoUrl,
                  all_clips: manifest.clips.map(c => c.videoUrl),
                  category,
                  mode: project.mode,
                };
              }
            } catch (e) {
              console.error('Failed to fetch manifest:', e);
            }
          }
          
          if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
            return {
              id: project.id,
              title: project.title || '',
              thumbnail_url: project.thumbnail_url,
              video_url: url,
              all_clips: [url],
              category,
              mode: project.mode,
            };
          }
          
          return null;
        })
      );
      
      return videosWithClips.filter((v): v is NonNullable<typeof v> => v !== null);
    },
  });
};

// Ambient sound manager
const useAmbientSounds = () => {
  const transitionSoundRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Create subtle whoosh sound for transitions
    transitionSoundRef.current = new Audio();
    transitionSoundRef.current.volume = 0.1;
    
    return () => {
      transitionSoundRef.current = null;
    };
  }, []);
  
  const playTransition = useCallback(() => {
    // Transition sound effect placeholder - edge function not deployed
    // Silent no-op to prevent 404 errors
  }, []);
  
  return { playTransition };
};

// Premium background with parallax
function ImmersiveBackground({ scrollProgress }: { scrollProgress: number }) {
  const parallaxY = scrollProgress * -50;
  
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      
      {/* Parallax layer 1 - Deep ambient */}
      <motion.div 
        className="absolute inset-0"
        style={{ y: parallaxY * 0.3 }}
      >
        <div 
          className="absolute top-1/4 left-1/4 w-[800px] h-[800px] rounded-full blur-[200px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] rounded-full blur-[180px] opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.3) 0%, transparent 70%)' }}
        />
      </motion.div>
      
      {/* Parallax layer 2 - Silver lines */}
      <motion.svg 
        className="absolute inset-0 w-full h-full opacity-30"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ y: parallaxY * 0.5 }}
      >
        <defs>
          <linearGradient id="silverLineGallery" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="#4b5563" />
            <stop offset="50%" stopColor="#9ca3af" />
            <stop offset="70%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="blueLineGallery" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="40%" stopColor="#1e40af" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        <line x1="0" y1="200" x2="1920" y2="200" stroke="url(#silverLineGallery)" strokeWidth="1" />
        <line x1="0" y1="400" x2="1920" y2="400" stroke="url(#blueLineGallery)" strokeWidth="1.5" />
        <line x1="0" y1="600" x2="1920" y2="600" stroke="url(#silverLineGallery)" strokeWidth="1" />
        <line x1="0" y1="800" x2="1920" y2="800" stroke="url(#blueLineGallery)" strokeWidth="1" />
      </motion.svg>
      
      {/* Parallax layer 3 - Floating particles */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ y: parallaxY * 0.8 }}
      >
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-blue-400/30"
            style={{
              left: `${10 + (i * 4.5) % 80}%`,
              top: `${15 + (i * 7) % 70}%`,
            }}
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>
      
      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)',
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

// 3D Tilt video card
interface TiltVideoCardProps {
  video: GalleryVideo;
  isActive: boolean;
  onClick: () => void;
}

const TiltVideoCard = forwardRef<HTMLDivElement, TiltVideoCardProps>(function TiltVideoCard({ video, isActive, onClick }, ref) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailReady, setThumbnailReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // CRITICAL: Synchronous ref merger - merges internal cardRef with forwarded ref
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    }
  }, [ref]);
  
  // Motion values for 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotateX = useTransform(y, [-0.5, 0.5], [15, -15]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-15, 15]);
  
  const springConfig = { stiffness: 300, damping: 30 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / rect.width);
    y.set((e.clientY - centerY) / rect.height);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };
  
  const videoSrc = video.video_url || (video.all_clips && video.all_clips[0]) || null;
  
  // Initialize thumbnail
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoSrc) return;
    
    let mounted = true;
    
    const initThumbnail = async () => {
      try {
        vid.src = videoSrc;
        vid.load();
        
        await new Promise<void>((resolve) => {
          vid.onloadedmetadata = () => resolve();
          setTimeout(() => resolve(), 3000);
        });
        
        if (!mounted) return;
        const targetTime = vid.duration && isFinite(vid.duration) ? Math.min(vid.duration * 0.1, 0.5) : 0;
        vid.currentTime = targetTime;
        
        await new Promise<void>((resolve) => {
          vid.onseeked = () => resolve();
          setTimeout(() => resolve(), 1000);
        });
        
        if (mounted) setThumbnailReady(true);
      } catch {
        if (mounted) setThumbnailReady(true);
      }
    };
    
    initThumbnail();
    return () => { mounted = false; };
  }, [videoSrc]);
  
  // Auto-play on hover with proper readyState checks
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoSrc) return;
    
    if (isHovered) {
      vid.muted = true;
      
      const attemptPlay = () => {
        // STABILITY FIX: Use safe video operations
        if (!videoRef.current) return;
        safePlay(videoRef.current);
      };
      
      if (vid.readyState >= 3) {
        attemptPlay();
      } else {
        const onCanPlay = () => {
          vid.removeEventListener('canplay', onCanPlay);
          attemptPlay();
        };
        vid.addEventListener('canplay', onCanPlay);
        if (vid.readyState === 0) vid.load();
      }
    } else {
      // STABILITY FIX: Use safe video operations
      safePause(vid);
      const targetTime = isSafeVideoNumber(vid.duration) ? Math.min(vid.duration * 0.1, 0.5) : 0;
      safeSeek(vid, targetTime);
    }
  }, [isHovered, videoSrc]);
  
  // Fallback timeout
  useEffect(() => {
    if (thumbnailReady) return;
    const timeout = setTimeout(() => setThumbnailReady(true), 2500);
    return () => clearTimeout(timeout);
  }, [thumbnailReady]);
  
  return (
    <motion.div
      ref={mergedRef}
      className="relative cursor-pointer"
      style={{
        perspective: 1000,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: isActive ? 1 : 0.4, 
        scale: isActive ? 1 : 0.85,
      }}
      whileHover={{ scale: isActive ? 1.02 : 0.9 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="relative w-[280px] h-[400px] md:w-[400px] md:h-[560px] rounded-2xl overflow-hidden"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Glow effect */}
        <div 
          className={cn(
            "absolute -inset-1 rounded-2xl blur-xl transition-all duration-500",
            isHovered ? "opacity-60" : "opacity-0"
          )}
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(148,163,184,0.3) 100%)' }}
        />
        
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-950 border border-white/10">
          {videoSrc ? (
            <>
              <video
                ref={videoRef}
                src={videoSrc}
                className={cn(
                  "w-full h-full object-cover transition-all duration-700",
                  !thumbnailReady && "opacity-0",
                  isHovered && "scale-105"
                )}
                muted
                playsInline
                loop
                preload="auto"
                onError={(e) => {
                  e.preventDefault?.();
                  e.stopPropagation?.();
                }}
              />
              
              {!thumbnailReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
              <Film className="w-12 h-12 text-zinc-600" />
            </div>
          )}
          
          {/* Play icon overlay */}
          <motion.div 
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-blue-500/20 backdrop-blur-xl flex items-center justify-center border border-blue-400/40"
              initial={{ scale: 0.5 }}
              animate={{ scale: isHovered ? 1 : 0.5 }}
            >
              <Play className="w-7 h-7 text-blue-100 fill-blue-100 ml-1" />
            </motion.div>
          </motion.div>
          
          {/* Reflection effect */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
});

// Fullscreen immersive player
interface FullscreenPlayerProps {
  video: GalleryVideo;
  onClose: () => void;
}

function FullscreenPlayer({ video, onClose }: FullscreenPlayerProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<'A' | 'B'>('A');
  const isTransitioningRef = useRef(false);
  const triggerTransitionRef = useRef<() => void>(() => {});
  
  const clips = video.all_clips && video.all_clips.length > 0 
    ? video.all_clips 
    : video.video_url ? [video.video_url] : [];
  
  const totalClips = clips.length;
  
  const getActiveVideoRef = useCallback(() => {
    return activeVideo === 'A' ? videoARef : videoBRef;
  }, [activeVideo]);
  
  const getInactiveVideoRef = useCallback(() => {
    return activeVideo === 'A' ? videoBRef : videoARef;
  }, [activeVideo]);
  
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
    
    inactiveVideo.currentTime = 0;
    inactiveVideo.muted = isMuted;
    inactiveVideo.play().catch(() => {});
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setActiveVideo(prev => prev === 'A' ? 'B' : 'A');
        setCurrentClipIndex(nextIndex);
        activeVideoEl.pause();
        isTransitioningRef.current = false;
        
        setTimeout(() => {
          const newNextIndex = (nextIndex + 1) % totalClips;
          const newInactiveVideo = activeVideoEl;
          if (newInactiveVideo && clips[newNextIndex]) {
            newInactiveVideo.src = clips[newNextIndex];
            newInactiveVideo.load();
            newInactiveVideo.muted = true;
          }
        }, 100);
      });
    });
  }, [totalClips, currentClipIndex, clips, getInactiveVideoRef, getActiveVideoRef, isMuted]);
  
  useEffect(() => {
    triggerTransitionRef.current = triggerTransition;
  }, [triggerTransition]);
  
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (!vid.duration || isTransitioningRef.current) return;
    if (vid.currentTime >= vid.duration - 0.05) {
      triggerTransitionRef.current();
    }
  }, []);
  
  const handleClipEnded = useCallback(() => {
    if (!isTransitioningRef.current) {
      triggerTransitionRef.current();
    }
  }, []);
  
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
          
          if (videoB && clips.length > 1) {
            videoB.src = clips[1];
            videoB.load();
            videoB.muted = true;
          }
        } catch (err) {
          console.warn('Autoplay failed:', err);
        }
      }
    };
    startPlayback();
  }, [clips]);
  
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
    } catch {
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
        {clips.length > 0 && !hasError ? (
          <>
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
              onError={(e) => {
                // Prevent crash - gracefully handle video errors
                e.preventDefault?.();
                e.stopPropagation?.();
                try {
                  const video = e.target as HTMLVideoElement;
                  console.debug('[Gallery] Video A error:', video?.error?.message || 'Unknown');
                  setHasError(true);
                } catch {}
              }}
              onEnded={handleClipEnded}
              onTimeUpdate={handleTimeUpdate}
            />
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
              onError={(e) => {
                // Prevent crash - gracefully handle video errors
                e.preventDefault?.();
                e.stopPropagation?.();
                try {
                  const video = e.target as HTMLVideoElement;
                  console.debug('[Gallery] Video B error:', video?.error?.message || 'Unknown');
                  setHasError(true);
                } catch {}
              }}
              onEnded={handleClipEnded}
              onTimeUpdate={handleTimeUpdate}
            />
          </>
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-slate-500/30 flex items-center justify-center bg-slate-500/10">
              <Film className="w-10 h-10 text-slate-400/60" />
            </div>
            <p className="text-zinc-500 text-sm">Video preview</p>
          </div>
        )}
        
        {clips.length > 0 && !hasError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            {totalClips > 1 && (
              <div className="flex items-center gap-1.5 mb-2">
                {clips.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1 rounded-full transition-all",
                      idx === currentClipIndex 
                        ? "bg-white w-8" 
                        : "bg-white/30 w-2"
                    )}
                  />
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <button 
                className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const newMuted = !isMuted;
                  setIsMuted(newMuted);
                  // Immediately update video elements for instant feedback
                  if (videoARef.current) videoARef.current.muted = newMuted;
                  if (videoBRef.current) videoBRef.current.muted = newMuted;
                }}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700/50 z-10 transition-all"
      >
        <X className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// Main Gallery component with hook resilience
const GalleryContent = memo(function GalleryContent() {
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  const { getSignal, isMounted } = useNavigationAbort();
  
  let location: ReturnType<typeof useLocation>;
  try {
    location = useLocation();
  } catch {
    location = { state: null, pathname: '/', search: '', hash: '', key: '' };
  }
  
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<GalleryVideo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<VideoCategory>('all');
  
  const { data: videos = [], isLoading } = useGalleryVideos();
  const { playTransition } = useAmbientSounds();
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    setSelectedVideo(null);
    sessionStorage.removeItem('gallery_access');
  }, []);
  
  // Filter videos by category
  const filteredVideos = useMemo(() => {
    if (activeCategory === 'all') return videos;
    return videos.filter(v => v.category === activeCategory);
  }, [videos, activeCategory]);
  
  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<VideoCategory, number> = {
      'all': videos.length,
      'text-to-video': 0,
      'image-to-video': 0,
      'avatar': 0,
    };
    videos.forEach(v => {
      if (v.category && v.category !== 'all') {
        counts[v.category]++;
      }
    });
    return counts;
  }, [videos]);
  
  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeCategory]);
  
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
  
  // Scroll/wheel navigation with debounce
  const lastScrollTime = useRef(0);
  const scrollThreshold = 300; // ms between scroll events
  
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedVideo) return;
      
      const now = Date.now();
      if (now - lastScrollTime.current < scrollThreshold) return;
      
      // Determine scroll direction (support both vertical and horizontal scroll)
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      
      if (delta > 20 && currentIndex < filteredVideos.length - 1) {
        lastScrollTime.current = now;
        setCurrentIndex(prev => prev + 1);
        setScrollProgress(prev => prev + 0.1);
        playTransition();
      } else if (delta < -20 && currentIndex > 0) {
        lastScrollTime.current = now;
        setCurrentIndex(prev => prev - 1);
        setScrollProgress(prev => prev - 0.1);
        playTransition();
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentIndex, filteredVideos.length, selectedVideo, playTransition]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedVideo) return;
      
      if (e.key === 'ArrowRight' && currentIndex < filteredVideos.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setScrollProgress(prev => prev + 0.1);
        playTransition();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setScrollProgress(prev => prev - 0.1);
        playTransition();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredVideos.length, selectedVideo, playTransition]);
  
  const goNext = () => {
    if (currentIndex < filteredVideos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setScrollProgress(prev => prev + 0.1);
      playTransition();
    }
  };
  
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setScrollProgress(prev => prev - 0.1);
      playTransition();
    }
  };
  
  const handleCategoryChange = (category: VideoCategory) => {
    setActiveCategory(category);
    playTransition();
  };
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-500/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <ImmersiveBackground scrollProgress={scrollProgress} />
      
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
      
      {/* Gallery title & Category tabs */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed top-4 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 z-40 flex flex-col items-end md:items-center gap-2 md:gap-4"
      >
        <h1 className="text-slate-400/50 text-sm tracking-[0.3em] uppercase font-light">Gallery</h1>
        
        {/* Mobile: Compact icon-only tabs */}
        <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-xl rounded-full border border-white/10">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const count = categoryCounts[cat.id];
            
            return (
              <motion.button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full text-sm font-medium transition-all duration-300",
                  // Mobile: smaller padding, icon + count only
                  "px-2.5 py-1.5 md:px-4 md:py-2",
                  isActive 
                    ? "text-white" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeCategory"
                    className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-blue-500/60 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  {/* Label: hidden on mobile, shown on md+ */}
                  <span className="hidden md:inline">{cat.label}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-white/20" : "bg-white/5"
                  )}>
                    {count}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
        
        {/* Active category description - hidden on mobile for space */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeCategory}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="hidden md:block text-zinc-500 text-xs"
          >
            {CATEGORIES.find(c => c.id === activeCategory)?.description}
          </motion.p>
        </AnimatePresence>
      </motion.div>
      
      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="w-10 h-10 border-2 border-slate-500/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}
      
      {/* Immersive video showcase */}
      {!isLoading && filteredVideos.length > 0 && (
        <div className="fixed inset-0 flex items-center justify-center pt-24">
          {/* Video cards carousel */}
          <div className="relative flex items-center justify-center gap-4 md:gap-8">
            {filteredVideos.map((video, index) => {
              const distance = index - currentIndex;
              const isVisible = Math.abs(distance) <= 2;
              
              if (!isVisible) return null;
              
              return (
                <motion.div
                  key={video.id}
                  className="absolute"
                  animate={{
                    x: distance * 320,
                    z: distance === 0 ? 0 : -100,
                    opacity: distance === 0 ? 1 : 0.4,
                  }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                >
                  <TiltVideoCard
                    video={video}
                    isActive={distance === 0}
                    onClick={() => setSelectedVideo(video)}
                  />
                </motion.div>
              );
            })}
          </div>
          
          {/* Navigation arrows */}
          <AnimatePresence>
            {currentIndex > 0 && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={goPrev}
                className="fixed left-8 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </motion.button>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {currentIndex < filteredVideos.length - 1 && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={goNext}
                className="fixed right-8 top-1/2 -translate-y-1/2 z-50 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </motion.button>
            )}
          </AnimatePresence>
          
          {/* Progress indicator */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
            {filteredVideos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  playTransition();
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === currentIndex 
                    ? "bg-blue-400 w-8" 
                    : "bg-white/20 hover:bg-white/40 w-1.5"
                )}
              />
            ))}
          </div>
          
          {/* Video counter */}
          <div className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-1">
            <span className="text-white/30 text-sm font-mono">
              {String(currentIndex + 1).padStart(2, '0')} / {String(filteredVideos.length).padStart(2, '0')}
            </span>
            {activeCategory !== 'all' && (
              <span className="text-blue-400/50 text-xs">
                {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Empty state for category */}
      {!isLoading && filteredVideos.length === 0 && (
        <div className="fixed inset-0 flex items-center justify-center pt-24">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              {(() => {
                const Icon = CATEGORIES.find(c => c.id === activeCategory)?.icon || Film;
                return <Icon className="w-8 h-8 text-zinc-600" />;
              })()}
            </div>
            <p className="text-zinc-500 text-sm mb-2">No videos in this category yet</p>
            <button
              onClick={() => handleCategoryChange('all')}
              className="text-blue-400 text-sm hover:underline"
            >
              View all videos
            </button>
          </div>
        </div>
      )}
      
      {/* Sign Up button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        onClick={() => navigate('/auth')}
        className="fixed bottom-8 left-8 z-50 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-all"
      >
        Sign Up Free
      </motion.button>
      
      {/* Fullscreen player */}
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
});

// Wrapper with error boundary
export default function Gallery() {
  return (
    <ErrorBoundary>
      <GalleryContent />
    </ErrorBoundary>
  );
}
