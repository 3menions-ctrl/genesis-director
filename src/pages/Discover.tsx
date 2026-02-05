import { useState, useRef, useEffect, useMemo, useCallback, memo, forwardRef, Suspense, lazy } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Clock, Heart, Film, Sparkles, 
  X, Volume2, VolumeX, Pause, Palette, User, Image, Wand2, ArrowRight, Maximize2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { UniversalVideoPlayer } from '@/components/player';
import { safePlay, safePause, safeSeek } from '@/lib/video/safeVideoOperations';
import { useRouteCleanup, useNavigationAbort, useSafeNavigation } from '@/lib/navigation';
import type { VideoGenerationMode } from '@/types/video-modes';

// Lazy load heavy components
const DiscoverBackground = lazy(() => import('@/components/discover/DiscoverBackground'));
const DiscoverHero = lazy(() => import('@/components/discover/DiscoverHero').then(m => ({ default: m.DiscoverHero })));

interface PublicVideo {
  id: string;
  title: string;
  synopsis: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  genre: string;
  mood: string | null;
  created_at: string;
  target_duration_minutes: number;
  user_id: string;
  likes_count: number;
  mode?: VideoGenerationMode;
}

type SortOption = 'recent' | 'popular';

// Mode icon mapping
const getModeIcon = (mode?: VideoGenerationMode) => {
  switch (mode) {
    case 'video-to-video': return Palette;
    case 'avatar': return User;
    case 'image-to-video': return Image;
    case 'motion-transfer': return Sparkles;
    case 'b-roll': return Film;
    default: return Wand2;
  }
};

const getModeLabel = (mode?: VideoGenerationMode) => {
  switch (mode) {
    case 'video-to-video': return 'Style Transfer';
    case 'avatar': return 'AI Avatar';
    case 'image-to-video': return 'Animated';
    case 'motion-transfer': return 'Motion';
    case 'b-roll': return 'B-Roll';
    default: return 'Cinematic';
  }
};

const getModeColor = (mode?: VideoGenerationMode) => {
  switch (mode) {
    case 'video-to-video': return 'from-purple-500/30 to-purple-600/10 border-purple-500/40 text-purple-200';
    case 'avatar': return 'from-blue-500/30 to-blue-600/10 border-blue-500/40 text-blue-200';
    case 'image-to-video': return 'from-amber-500/30 to-amber-600/10 border-amber-500/40 text-amber-200';
    case 'motion-transfer': return 'from-pink-500/30 to-pink-600/10 border-pink-500/40 text-pink-200';
    case 'b-roll': return 'from-emerald-500/30 to-emerald-600/10 border-emerald-500/40 text-emerald-200';
    default: return 'from-cyan-500/30 to-cyan-600/10 border-cyan-500/40 text-cyan-200';
  }
};

// Fallback components
const BackgroundFallback = () => <div className="fixed inset-0 bg-[#030303]" />;
const HeroFallback = () => <div className="pt-28 pb-12" />;

// Main content component with hook resilience
const DiscoverContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function DiscoverContent(_, ref) {
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  const { getSignal, isMounted } = useNavigationAbort();
  
  let authData: { user: any };
  try {
    authData = useAuth();
  } catch {
    authData = { user: null };
  }
  const { user } = authData;
  
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedVideo, setSelectedVideo] = useState<PublicVideo | null>(null);
  const [modeFilter, setModeFilter] = useState<VideoGenerationMode | 'all'>('all');
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    // Close any open modals
    setSelectedVideo(null);
    // Clear search state to prevent stale UI on return
    setSearchQuery('');
  }, []);

  const { data: videos, isLoading } = useQuery({
    queryKey: ['public-videos', sortBy],
    queryFn: async () => {
      const query = supabase
        .from('movie_projects')
        .select('id, title, synopsis, thumbnail_url, video_url, genre, mood, created_at, target_duration_minutes, user_id, likes_count, mode')
        .eq('is_public', true)
        .not('video_url', 'is', null)
        .order(sortBy === 'popular' ? 'likes_count' : 'created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as PublicVideo[];
    },
  });

  const { data: userLikes } = useQuery({
    queryKey: ['user-likes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('video_likes')
        .select('project_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(like => like.project_id);
    },
    enabled: !!user,
  });

  const likeMutation = useMutation({
    mutationFn: async ({ projectId, isLiked }: { projectId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Must be logged in to like');
      
      if (isLiked) {
        const { error } = await supabase
          .from('video_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('project_id', projectId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('video_likes')
          .insert({ user_id: user.id, project_id: projectId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-videos'] });
      queryClient.invalidateQueries({ queryKey: ['user-likes'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update like');
    },
  });

  const handleLike = useCallback((e: React.MouseEvent, projectId: string, isLiked: boolean) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please log in to like videos');
      return;
    }
    likeMutation.mutate({ projectId, isLiked });
  }, [user, likeMutation]);

  const filteredVideos = useMemo(() => {
    return videos?.filter(video => {
      const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.synopsis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.genre.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMode = modeFilter === 'all' || video.mode === modeFilter;
      
      return matchesSearch && matchesMode;
    });
  }, [videos, searchQuery, modeFilter]);

  const formatGenre = useCallback((genre: string) => {
    return genre.charAt(0).toUpperCase() + genre.slice(1).replace(/_/g, ' ');
  }, []);

  // Count videos by mode for filter badges
  const modeCounts = useMemo(() => {
    return videos?.reduce((acc, video) => {
      const mode = video.mode || 'text-to-video';
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
  }, [videos]);

  const handleSelectVideo = useCallback((video: PublicVideo) => {
    setSelectedVideo(video);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  const handleNavigateCreate = useCallback(() => {
    navigate('/create');
  }, [navigate]);

  return (
    <div className="min-h-screen text-white relative bg-[#030303] overflow-hidden">
      {/* Premium Cinematic Background - CSS-based, no flickering */}
      <Suspense fallback={<BackgroundFallback />}>
        <DiscoverBackground />
      </Suspense>
      
      <AppHeader />

      {/* Hero Section */}
      <Suspense fallback={<HeroFallback />}>
        <DiscoverHero
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          modeFilter={modeFilter}
          setModeFilter={setModeFilter}
          modeCounts={modeCounts}
        />
      </Suspense>


      {/* Video Grid */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Grid Stats Bar */}
        {filteredVideos && filteredVideos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between mb-8"
          >
            <p className="text-white/30 text-sm">
              Showing <span className="text-white/60 font-medium">{filteredVideos.length}</span> videos
            </p>
            <div className="flex items-center gap-2 text-white/30 text-sm">
              <Film className="w-4 h-4" />
              <span>AI-Generated</span>
            </div>
          </motion.div>
        )}
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-video w-full rounded-2xl bg-white/[0.04]" />
                <Skeleton className="h-5 w-3/4 bg-white/[0.04]" />
                <Skeleton className="h-4 w-1/2 bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : filteredVideos && filteredVideos.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } }
            }}
          >
            {filteredVideos.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                onPlay={() => handleSelectVideo(video)}
                isLiked={userLikes?.includes(video.id) || false}
                onLike={(e) => handleLike(e, video.id, userLikes?.includes(video.id) || false)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center py-32"
          >
            {/* Premium Empty State */}
            <div className="relative inline-block mb-10">
              <div className="relative w-24 h-24 rounded-full bg-white/[0.05] backdrop-blur-xl flex items-center justify-center border border-white/[0.1]">
                <Film className="w-10 h-10 text-white/30" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-white mb-4">No videos found</h3>
            <p className="text-white/40 max-w-md mx-auto mb-8">
              {searchQuery || modeFilter !== 'all'
                ? "Try adjusting your filters or search query."
                : "Be the first to share your creation with the community!"}
            </p>
            <Button
              onClick={handleNavigateCreate}
              className="h-12 px-8 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-400 hover:to-teal-400"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Your First Video
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <VideoModal
            video={selectedVideo}
            formatGenre={formatGenre}
            onClose={handleCloseModal}
            isLiked={userLikes?.includes(selectedVideo.id) || false}
            onLike={(e) => handleLike(e, selectedVideo.id, userLikes?.includes(selectedVideo.id) || false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}));

// Wrapper for route compatibility
export default function Discover() {
  return <DiscoverContent />;
}

// ============= VIDEO CARD COMPONENT =============

interface VideoCardProps {
  video: PublicVideo;
  onPlay: () => void;
  isLiked: boolean;
  onLike: (e: React.MouseEvent) => void;
}

const VideoCard = memo(forwardRef<HTMLDivElement, VideoCardProps>(function VideoCard({ video, onPlay, isLiked, onLike }, ref) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canplayListenerRef = useRef<(() => void) | null>(null);
  
  // CRITICAL: Synchronous ref merger to prevent AnimatePresence crashes
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    internalRef.current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    }
  }, [ref]);

  const ModeIcon = getModeIcon(video.mode);
  const isManifest = video.video_url?.endsWith('.json');

  // Resolve video URL once on mount - stable reference
  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      if (!video.video_url) {
        setIsLoading(false);
        return;
      }

      if (!isManifest) {
        setVideoUrl(video.video_url);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(video.video_url);
        const manifest = await res.json();
        const firstClipUrl = manifest?.clips?.[0]?.url;
        if (!cancelled && firstClipUrl) {
          setVideoUrl(firstClipUrl);
        }
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    resolveUrl();
    return () => { cancelled = true; };
  }, [video.video_url, isManifest]);

  // Simple hover play/pause - no complex state dependencies
  // HARDENED: All operations wrapped with try-catch and validation
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    try {
      const videoEl = videoRef.current;
      if (!videoEl || !videoUrl) return;
      
      videoEl.muted = true;
      
      // STABILITY FIX: Use safe video operations pattern
      const attemptPlay = () => {
        if (!videoRef.current) return;
        const v = videoRef.current;
        safeSeek(v, 0);
        safePlay(v);
      };
      
      // If video has enough data, play immediately
      if (videoEl.readyState >= 3) {
        attemptPlay();
      } else {
        // Wait for video to be ready
        // MEMORY FIX: Store listener reference for cleanup
        const onCanPlay = () => {
          videoEl.removeEventListener('canplay', onCanPlay);
          canplayListenerRef.current = null;
          attemptPlay();
        };
        // Remove any previous listener before adding new one
        if (canplayListenerRef.current) {
          videoEl.removeEventListener('canplay', canplayListenerRef.current);
        }
        canplayListenerRef.current = onCanPlay;
        videoEl.addEventListener('canplay', onCanPlay);
        
        // Also try loading if not started
        if (videoEl.readyState === 0) {
          videoEl.load();
        }
      }
    } catch {
      // Silently ignore hover play errors
    }
  }, [videoUrl]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // MEMORY FIX: Clean up any pending canplay listener
    const videoEl = videoRef.current;
    if (videoEl && canplayListenerRef.current) {
      videoEl.removeEventListener('canplay', canplayListenerRef.current);
      canplayListenerRef.current = null;
    }
    // STABILITY FIX: Use safe video operations
    if (videoEl) {
      safePause(videoEl);
      safeSeek(videoEl, 0);
    }
  }, []);

  return (
    <motion.div
      ref={mergedRef}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
      }}
      className="group cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onPlay}
    >
      <div className="relative">
        {/* Ambient glow on hover */}
        <div 
          className="absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg, hsl(185 100% 50% / 0.15), hsl(190 100% 45% / 0.1))' }}
        />
        
        <div className="relative rounded-xl overflow-hidden transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-black/50">
          <div className="relative aspect-video bg-zinc-900/50 rounded-xl overflow-hidden">
            {/* Loading state */}
            {isLoading && (
              <div className="absolute inset-0 bg-zinc-800/80 flex items-center justify-center">
                <Film className="w-8 h-8 text-zinc-600" />
              </div>
            )}
            
            {/* Paused frame thumbnail - shows when not hovered */}
            {videoUrl && !isHovered && (
              <PausedFrameVideo
                src={videoUrl}
                className="absolute inset-0 w-full h-full object-cover rounded-xl"
                showLoader={false}
              />
            )}
            
            {/* Interactive video element - shows on hover for playback */}
            {videoUrl && isHovered && (
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                preload="auto"
                autoPlay
                onError={(e) => {
                  e.preventDefault?.();
                  e.stopPropagation?.();
                }}
                className="absolute inset-0 w-full h-full object-cover rounded-xl scale-105 transition-transform duration-300"
              />
            )}

            {/* Fallback when no video */}
            {!videoUrl && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50">
                <Film className="w-10 h-10 text-zinc-700" />
              </div>
            )}
            
            {/* Hover overlay */}
            <div className={cn(
              "absolute inset-0 transition-opacity duration-300 bg-gradient-to-t from-black/60 via-transparent to-transparent",
              isHovered ? "opacity-100" : "opacity-0"
            )} />

            {/* Play Button on hover */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20">
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </div>
            </div>

            {/* Mode Badge */}
            <Badge 
              className={cn(
                "absolute top-3 left-3 text-[10px] font-medium backdrop-blur-xl border bg-gradient-to-r px-2.5 py-1 rounded-full",
                getModeColor(video.mode)
              )}
            >
              <ModeIcon className="w-3 h-3 mr-1" />
              {getModeLabel(video.mode)}
            </Badge>

            {/* Like Button */}
            <button
              onClick={onLike}
              className={cn(
                "absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-xl border",
                isLiked 
                  ? "bg-red-500/80 text-white border-red-400/50" 
                  : "bg-black/40 text-white/60 border-white/10 hover:text-white hover:bg-black/60"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}));

// ============= VIDEO MODAL COMPONENT =============

interface VideoModalProps {
  video: PublicVideo;
  formatGenre: (genre: string) => string;
  onClose: () => void;
  isLiked: boolean;
  onLike: (e: React.MouseEvent) => void;
}

const VideoModal = memo(forwardRef<HTMLDivElement, VideoModalProps>(function VideoModal({ video, formatGenre, onClose, isLiked, onLike }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // CRITICAL: Merge forwarded ref with internal container ref for fullscreen support
  const mergedContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    }
  }, [ref]);

  const ModeIcon = getModeIcon(video.mode);
  const isManifest = video.video_url?.endsWith('.json');
  const isDirectVideo = video.video_url && !isManifest;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // HARDENED: Safe video autoplay with proper error suppression
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !isDirectVideo) return;

    let cancelled = false;

    const attemptPlay = async () => {
      try {
        // Check mount state before any operation
        if (cancelled || !isMountedRef.current) return;
        
        // CRITICAL: Check readyState before playing
        if (videoEl.readyState < 1) {
          // Wait for video to be ready
          const onCanPlay = () => {
            videoEl.removeEventListener('canplay', onCanPlay);
            if (!cancelled && isMountedRef.current) {
              attemptPlay();
            }
          };
          videoEl.addEventListener('canplay', onCanPlay);
          return;
        }
        
        await videoEl.play();
        if (!cancelled && isMountedRef.current) setIsVideoPlaying(true);
      } catch (err) {
        // CRITICAL: Suppress all video errors - they're harmless
        const errorName = (err as Error)?.name || '';
        if (['AbortError', 'NotAllowedError', 'NotSupportedError', 'InvalidStateError'].includes(errorName)) {
          return; // Silently ignore
        }
        
        // Fallback: try muted
        if (!cancelled && isMountedRef.current) {
          try {
            videoEl.muted = true;
            setIsMuted(true);
            await videoEl.play();
            if (!cancelled && isMountedRef.current) setIsVideoPlaying(true);
          } catch {
            // Silent fail - video won't autoplay
          }
        }
      }
    };

    attemptPlay();
    
    return () => { cancelled = true; };
  }, [isDirectVideo]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const togglePlayback = useCallback(() => {
    try {
      const video = videoRef.current;
      if (!video) return;
      
      // HARDENED: Check if video is connected and in valid state
      if (!video.isConnected) return;
      
      if (isVideoPlaying) {
        safePause(video);
        setIsVideoPlaying(false);
      } else {
        safePlay(video).then(success => {
          if (success && isMountedRef.current) {
            setIsVideoPlaying(true);
          }
        });
      }
    } catch {
      // Silently ignore toggle errors
    }
  }, [isVideoPlaying]);

  const toggleFullscreen = useCallback(() => {
    // DEFENSIVE: Null-check containerRef before accessing
    if (!containerRef.current) {
      console.warn('toggleFullscreen: containerRef not ready');
      return;
    }
    
    const container = containerRef.current;
    const elem = container as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element;
    };
    
    const isCurrentlyFullscreen = document.fullscreenElement || doc.webkitFullscreenElement;
    
    if (isCurrentlyFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-5xl bg-zinc-900/95 backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Player */}
        <div ref={mergedContainerRef} className="relative aspect-video bg-black">
          {isDirectVideo ? (
            <>
              <video
                ref={videoRef}
                src={video.video_url!}
                className="w-full h-full object-contain"
                muted={isMuted}
                loop
                playsInline
                onClick={togglePlayback}
              />
              
              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={togglePlayback}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/10"
                    >
                      {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleMute}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/10"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleFullscreen}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/10"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Badge className={cn(
                    "text-xs backdrop-blur-xl border bg-gradient-to-r px-3 py-1 rounded-full",
                    getModeColor(video.mode)
                  )}>
                    <ModeIcon className="w-3 h-3 mr-1.5" />
                    {getModeLabel(video.mode)}
                  </Badge>
                </div>
              </div>
            </>
          ) : isManifest ? (
            <div className="w-full h-full">
              <UniversalVideoPlayer 
                source={{ manifestUrl: video.video_url! }} 
                mode="inline"
                autoPlay
                className="w-full h-full" 
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
              {video.thumbnail_url && (
                <img 
                  src={video.thumbnail_url} 
                  alt={video.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10 text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                  <Film className="w-8 h-8 text-white/50" />
                </div>
                <Badge className={cn(
                  "text-sm backdrop-blur-xl border bg-gradient-to-r px-4 py-2 rounded-full",
                  getModeColor(video.mode)
                )}>
                  <ModeIcon className="w-4 h-4 mr-2" />
                  {getModeLabel(video.mode)} Production
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-white truncate">{video.title}</h2>
              <p className="text-white/40 text-sm mt-1">
                {formatGenre(video.genre)} • {video.target_duration_minutes} min
              </p>
            </div>
            <button
              onClick={onLike}
              className={cn(
                "shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all border",
                isLiked 
                  ? "bg-red-500/20 text-red-400 border-red-500/30" 
                  : "bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10"
              )}
            >
              <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
            </button>
          </div>
          
          {video.synopsis && (
            <p className="text-white/50 text-sm leading-relaxed">{video.synopsis}</p>
          )}
          
          <div className="flex items-center gap-4 text-sm text-white/40 pt-2 border-t border-white/[0.06]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1.5">
              <Heart className={cn("w-4 h-4", isLiked && "fill-current text-red-400")} />
              {video.likes_count || 0} likes
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}));
