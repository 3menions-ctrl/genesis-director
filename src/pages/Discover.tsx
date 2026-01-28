import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Clock, Heart, Film, Search, TrendingUp, Sparkles, 
  X, Volume2, VolumeX, Pause, Palette, User, Image, Wand2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { TrailerGenerator } from '@/components/TrailerGenerator';
import DiscoverBackground from '@/components/landing/DiscoverBackground';
import type { VideoGenerationMode } from '@/types/video-modes';

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
    case 'video-to-video': return 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300';
    case 'avatar': return 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300';
    case 'image-to-video': return 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300';
    case 'motion-transfer': return 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-300';
    case 'b-roll': return 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300';
    default: return 'from-white/10 to-white/5 border-white/20 text-white/80';
  }
};

export default function Discover() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedVideo, setSelectedVideo] = useState<PublicVideo | null>(null);
  const [modeFilter, setModeFilter] = useState<VideoGenerationMode | 'all'>('all');

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
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update like');
    },
  });

  const handleLike = (e: React.MouseEvent, projectId: string, isLiked: boolean) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please log in to like videos');
      return;
    }
    likeMutation.mutate({ projectId, isLiked });
  };

  const filteredVideos = videos?.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.synopsis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMode = modeFilter === 'all' || video.mode === modeFilter;
    
    return matchesSearch && matchesMode;
  });

  const formatGenre = (genre: string) => {
    return genre.charAt(0).toUpperCase() + genre.slice(1).replace(/_/g, ' ');
  };

  // Count videos by mode for filter badges
  const modeCounts = videos?.reduce((acc, video) => {
    const mode = video.mode || 'text-to-video';
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="min-h-screen text-white relative">
      {/* Premium Cinematic Background */}
      <DiscoverBackground />
      
      <AppHeader />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="mb-4 bg-white/10 border-white/20 text-white/80 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Community Gallery
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/50">Creations</span>
            </h1>
            <p className="text-lg text-white/50 mb-8 max-w-xl mx-auto">
              Explore AI-generated videos from creators worldwide — from cinematic films to style transfers and AI avatars.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, genre, or description..."
                className="w-full h-12 pl-12 pr-4 bg-white/[0.05] border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-white/20 focus:ring-white/10 backdrop-blur-sm"
              />
            </div>

            {/* Sort & Filter Options */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortBy('recent')}
                className={cn(
                  "rounded-full gap-2",
                  sortBy === 'recent' 
                    ? "bg-white/10 text-white border border-white/20" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                <Clock className="w-4 h-4" />
                Recent
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortBy('popular')}
                className={cn(
                  "rounded-full gap-2",
                  sortBy === 'popular' 
                    ? "bg-white/10 text-white border border-white/20" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Popular
              </Button>
              
              <div className="h-4 w-px bg-white/20 mx-2 hidden sm:block" />
              
              {/* Mode Filters */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModeFilter('all')}
                className={cn(
                  "rounded-full gap-1.5",
                  modeFilter === 'all' 
                    ? "bg-white/10 text-white border border-white/20" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                All
              </Button>
              {Object.entries(modeCounts).map(([mode, count]) => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="sm"
                  onClick={() => setModeFilter(mode as VideoGenerationMode)}
                  className={cn(
                    "rounded-full gap-1.5 text-xs",
                    modeFilter === mode 
                      ? "bg-white/10 text-white border border-white/20" 
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  {getModeLabel(mode as VideoGenerationMode)}
                  <span className="text-white/40">({count})</span>
                </Button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trailer Generator - Admin Only */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <TrailerGenerator />
        </div>
      )}

      {/* Video Grid */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-xl bg-white/5" />
                <Skeleton className="h-5 w-3/4 bg-white/5" />
                <Skeleton className="h-4 w-1/2 bg-white/5" />
              </div>
            ))}
          </div>
        ) : filteredVideos && filteredVideos.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } }
            }}
          >
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                formatGenre={formatGenre}
                onPlay={() => setSelectedVideo(video)}
                isLiked={userLikes?.includes(video.id) || false}
                onLike={(e) => handleLike(e, video.id, userLikes?.includes(video.id) || false)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
              <Film className="w-10 h-10 text-white/30" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No videos found</h3>
            <p className="text-white/50 max-w-md mx-auto mb-6">
              {searchQuery || modeFilter !== 'all'
                ? "Try adjusting your filters or search query."
                : "Be the first to share your creation with the community!"}
            </p>
            <Button
              onClick={() => navigate('/create')}
              className="bg-white text-black hover:bg-white/90 rounded-full px-6"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Your First Video
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
            onClose={() => setSelectedVideo(null)}
            isLiked={userLikes?.includes(selectedVideo.id) || false}
            onLike={(e) => handleLike(e, selectedVideo.id, userLikes?.includes(selectedVideo.id) || false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface VideoCardProps {
  video: PublicVideo;
  formatGenre: (genre: string) => string;
  onPlay: () => void;
  isLiked: boolean;
  onLike: (e: React.MouseEvent) => void;
}

function VideoCard({ video, formatGenre, onPlay, isLiked, onLike }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  const ModeIcon = getModeIcon(video.mode);

  // Handle hover preview playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isHovered && !isPlaying) {
      hoverTimeoutRef.current = setTimeout(() => {
        video.currentTime = 0;
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }, 300);
    } else if (!isHovered && isPlaying) {
      video.pause();
      setIsPlaying(false);
    }

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [isHovered, isPlaying]);

  const isPlayableVideo = video.video_url && !video.video_url.endsWith('.json');

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      {/* Thumbnail / Video Preview */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-3 border border-white/[0.08] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Thumbnail Image */}
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-500",
              isPlaying && "opacity-0"
            )}
          />
        )}
        
        {/* Video Preview (loads on hover) */}
        {isPlayableVideo && (
          <video
            ref={videoRef}
            src={video.video_url!}
            muted
            loop
            playsInline
            preload="metadata"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              isPlaying ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        {/* Fallback for no thumbnail */}
        {!video.thumbnail_url && !isPlayableVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <Film className="w-12 h-12 text-white/20" />
          </div>
        )}
        
        {/* Hover Overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300",
          isHovered ? "opacity-100" : "opacity-50"
        )} />

        {/* Play Button */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: isHovered ? 1 : 0.8 }}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30"
          >
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </motion.div>
        </div>

        {/* Mode Badge */}
        <Badge 
          className={cn(
            "absolute top-2 left-2 text-[10px] font-medium backdrop-blur-sm border bg-gradient-to-r",
            getModeColor(video.mode)
          )}
        >
          <ModeIcon className="w-3 h-3 mr-1" />
          {getModeLabel(video.mode)}
        </Badge>

        {/* Duration */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-xs text-white font-medium">
          {video.target_duration_minutes} min
        </div>

        {/* Like Button */}
        <button
          onClick={onLike}
          className={cn(
            "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm",
            isLiked 
              ? "bg-red-500/90 text-white" 
              : "bg-black/50 text-white/70 hover:text-white hover:bg-black/70"
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
        </button>
      </div>

      {/* Info */}
      <div className="space-y-1.5">
        <h3 className="font-semibold text-white truncate group-hover:text-white/90 transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
          </span>
          <span className="flex items-center gap-1">
            <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-current text-red-400")} />
            {video.likes_count || 0}
          </span>
        </div>
        {video.synopsis && (
          <p className="text-sm text-white/40 line-clamp-2">{video.synopsis}</p>
        )}
      </div>
    </motion.div>
  );
}

interface VideoModalProps {
  video: PublicVideo;
  formatGenre: (genre: string) => string;
  onClose: () => void;
  isLiked: boolean;
  onLike: (e: React.MouseEvent) => void;
}

function VideoModal({ video, formatGenre, onClose, isLiked, onLike }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const ModeIcon = getModeIcon(video.mode);
  const isPlayableVideo = video.video_url && !video.video_url.endsWith('.json');

  // Attempt autoplay on mount
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !isPlayableVideo) return;

    const attemptPlay = async () => {
      try {
        await videoEl.play();
        setIsVideoPlaying(true);
      } catch {
        // Autoplay blocked - keep muted and try again
        videoEl.muted = true;
        setIsMuted(true);
        try {
          await videoEl.play();
          setIsVideoPlaying(true);
        } catch {
          // Still failed - user needs to click
        }
      }
    };

    attemptPlay();
  }, [isPlayableVideo]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-5xl bg-zinc-900/90 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Player */}
        <div className="relative aspect-video bg-black">
          {isPlayableVideo ? (
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
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    >
                      {isVideoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleMute}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                  </div>
                  
                  <Badge className={cn(
                    "text-xs backdrop-blur-sm border bg-gradient-to-r",
                    getModeColor(video.mode)
                  )}>
                    <ModeIcon className="w-3 h-3 mr-1" />
                    {getModeLabel(video.mode)}
                  </Badge>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
              {video.thumbnail_url && (
                <img 
                  src={video.thumbnail_url} 
                  alt={video.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 border border-white/20">
                  <Film className="w-8 h-8 text-white/50" />
                </div>
                <p className="text-white/70 font-medium mb-1">Multi-Clip Production</p>
                <p className="text-white/40 text-sm">Open in full studio to view this cinematic project</p>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-6 bg-gradient-to-b from-zinc-900/50 to-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white mb-3">{video.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant="outline" className="text-white/70 border-white/20 bg-white/5">
                  {formatGenre(video.genre)}
                </Badge>
                {video.mood && (
                  <Badge variant="outline" className="text-white/70 border-white/20 bg-white/5">
                    {video.mood}
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-sm text-white/50">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </span>
              </div>
              {video.synopsis && (
                <p className="text-white/60 leading-relaxed">{video.synopsis}</p>
              )}
            </div>
            
            {/* Like Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onLike}
              className={cn(
                "gap-2 rounded-full",
                isLiked 
                  ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 hover:text-red-300" 
                  : "border-white/20 text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
              {video.likes_count || 0}
            </Button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>
  );
}
