import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Clock, Heart, Film, Search, TrendingUp, Sparkles, 
  X, Volume2, VolumeX, Pause, Palette, User, Image, Wand2, ArrowRight
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
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
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
    case 'video-to-video': return 'from-purple-500/30 to-purple-600/10 border-purple-500/40 text-purple-200';
    case 'avatar': return 'from-blue-500/30 to-blue-600/10 border-blue-500/40 text-blue-200';
    case 'image-to-video': return 'from-amber-500/30 to-amber-600/10 border-amber-500/40 text-amber-200';
    case 'motion-transfer': return 'from-pink-500/30 to-pink-600/10 border-pink-500/40 text-pink-200';
    case 'b-roll': return 'from-emerald-500/30 to-emerald-600/10 border-emerald-500/40 text-emerald-200';
    default: return 'from-white/15 to-white/5 border-white/25 text-white/90';
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
    <div className="min-h-screen text-white relative bg-black">
      {/* Premium Cinematic Background */}
      <DiscoverBackground />
      
      <AppHeader />

      {/* Hero Section - Premium Glass Container */}
      <div className="relative overflow-hidden pt-24 pb-8">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            {/* Floating Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="mb-6 px-4 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-200 backdrop-blur-xl rounded-full text-sm font-medium">
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Community Gallery
              </Badge>
            </motion.div>

            {/* Main Title with 3D Effect */}
            <motion.h1 
              className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Discover{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-200 to-rose-300">
                Creations
              </span>
            </motion.h1>

            <motion.p 
              className="text-lg text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Explore AI-generated videos from creators worldwide
            </motion.p>

            {/* Premium Search Container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative max-w-2xl mx-auto mb-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 rounded-2xl blur-xl" />
                <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-1.5">
                  <div className="relative flex items-center">
                    <Search className="absolute left-4 w-5 h-5 text-white/40" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by title, genre, or description..."
                      className="w-full h-12 pl-12 pr-4 bg-transparent border-0 text-white placeholder:text-white/30 focus:ring-0 focus-visible:ring-0 text-base"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Premium Filter Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {/* Sort Options */}
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy('recent')}
                  className={cn(
                    "h-8 px-4 rounded-full text-sm font-medium transition-all",
                    sortBy === 'recent' 
                      ? "bg-white/10 text-white shadow-lg" 
                      : "text-white/50 hover:text-white/80 hover:bg-transparent"
                  )}
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Recent
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy('popular')}
                  className={cn(
                    "h-8 px-4 rounded-full text-sm font-medium transition-all",
                    sortBy === 'popular' 
                      ? "bg-white/10 text-white shadow-lg" 
                      : "text-white/50 hover:text-white/80 hover:bg-transparent"
                  )}
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  Popular
                </Button>
              </div>
              
              <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block" />
              
              {/* Mode Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModeFilter('all')}
                  className={cn(
                    "h-8 px-3 rounded-full text-sm transition-all",
                    modeFilter === 'all' 
                      ? "bg-white/10 text-white border border-white/20" 
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
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
                      "h-8 px-3 rounded-full text-xs transition-all gap-1",
                      modeFilter === mode 
                        ? "bg-white/10 text-white border border-white/20" 
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    )}
                  >
                    {getModeLabel(mode as VideoGenerationMode)}
                    <span className="text-white/30 ml-0.5">({count})</span>
                  </Button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Trailer Generator - Admin Only */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <TrailerGenerator />
        </div>
      )}

      {/* Video Grid - Premium Cards */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-2xl bg-white/[0.03]" />
                <Skeleton className="h-5 w-3/4 bg-white/[0.03]" />
                <Skeleton className="h-4 w-1/2 bg-white/[0.03]" />
              </div>
            ))}
          </div>
        ) : filteredVideos && filteredVideos.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.08 } }
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            {/* Premium Empty State */}
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-2xl" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl flex items-center justify-center border border-white/[0.08]">
                <Film className="w-10 h-10 text-white/30" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">No videos found</h3>
            <p className="text-white/40 max-w-md mx-auto mb-8">
              {searchQuery || modeFilter !== 'all'
                ? "Try adjusting your filters or search query."
                : "Be the first to share your creation with the community!"}
            </p>
            <Button
              onClick={() => navigate('/create')}
              className="h-12 px-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-orange-500/20"
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

  // Allow both direct videos AND manifest files to be playable
  const isPlayableVideo = Boolean(video.video_url);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
      }}
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      {/* Premium Glass Card Container */}
      <div className="relative">
        {/* Ambient glow on hover */}
        <motion.div
          className="absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
          style={{ background: 'linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(234,88,12,0.1) 100%)' }}
        />
        
        {/* Card Content */}
        <div className="relative bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-500 group-hover:border-white/[0.15] group-hover:shadow-2xl group-hover:shadow-black/50">
          {/* Thumbnail / Video Preview */}
          <div className="relative aspect-video overflow-hidden">
            {/* Thumbnail Image */}
            {video.thumbnail_url && (
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                  isPlaying && "opacity-0",
                  isHovered && "scale-105"
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
                  "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
                  isPlaying ? "opacity-100" : "opacity-0"
                )}
              />
            )}

            {/* Fallback for no thumbnail */}
            {!video.thumbnail_url && !isPlayableVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800/50 to-zinc-900/50">
                <Film className="w-12 h-12 text-white/20" />
              </div>
            )}
            
            {/* Gradient Overlay */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-500",
              isHovered ? "opacity-100" : "opacity-70"
            )} />

            {/* Play Button */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={false}
              animate={{ opacity: isHovered ? 1 : 0 }}
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: isHovered ? 1 : 0.8 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-2xl"
              >
                <Play className="w-7 h-7 text-white fill-white ml-1" />
              </motion.div>
            </motion.div>

            {/* Mode Badge */}
            <Badge 
              className={cn(
                "absolute top-3 left-3 text-[11px] font-semibold backdrop-blur-xl border bg-gradient-to-r px-2.5 py-1 rounded-full",
                getModeColor(video.mode)
              )}
            >
              <ModeIcon className="w-3 h-3 mr-1.5" />
              {getModeLabel(video.mode)}
            </Badge>

            {/* Duration Badge */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl text-[11px] text-white font-medium border border-white/10">
              {video.target_duration_minutes} min
            </div>

            {/* Like Button */}
            <button
              onClick={onLike}
              className={cn(
                "absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all backdrop-blur-xl border",
                isLiked 
                  ? "bg-red-500/80 text-white border-red-400/50 shadow-lg shadow-red-500/20" 
                  : "bg-black/40 text-white/70 border-white/10 hover:text-white hover:bg-black/60 hover:border-white/20"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            </button>
          </div>

          {/* Info Section */}
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-white text-base truncate group-hover:text-white/90 transition-colors">
              {video.title}
            </h3>
            <div className="flex items-center gap-3 text-sm text-white/40">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-current text-red-400")} />
                {video.likes_count || 0}
              </span>
            </div>
            {video.synopsis && (
              <p className="text-sm text-white/30 line-clamp-2 leading-relaxed">{video.synopsis}</p>
            )}
          </div>
        </div>
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
  const isManifest = video.video_url?.endsWith('.json');
  const isDirectVideo = video.video_url && !isManifest;

  // Attempt autoplay on mount for direct videos only
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !isDirectVideo) return;

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
  }, [isDirectVideo]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-5xl bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Player */}
        <div className="relative aspect-video bg-black">
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
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={togglePlayback}
                      className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/10"
                    >
                      {isVideoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleMute}
                      className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/10"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
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
              <ManifestVideoPlayer manifestUrl={video.video_url!} className="w-full h-full" />
            </div>
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
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10 backdrop-blur-xl">
                  <Film className="w-9 h-9 text-white/40" />
                </div>
                <p className="text-white/70 font-medium mb-1">Video Unavailable</p>
                <p className="text-white/40 text-sm">This video could not be loaded</p>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-6 bg-gradient-to-b from-transparent to-zinc-950/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white mb-3">{video.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant="outline" className="text-white/70 border-white/15 bg-white/5 rounded-full px-3">
                  {formatGenre(video.genre)}
                </Badge>
                {video.mood && (
                  <Badge variant="outline" className="text-white/70 border-white/15 bg-white/5 rounded-full px-3">
                    {video.mood}
                  </Badge>
                )}
                <span className="flex items-center gap-1.5 text-sm text-white/40">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </span>
              </div>
              {video.synopsis && (
                <p className="text-white/50 leading-relaxed">{video.synopsis}</p>
              )}
            </div>
            
            {/* Like Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onLike}
              className={cn(
                "gap-2 rounded-full px-5",
                isLiked 
                  ? "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 hover:text-red-200" 
                  : "border-white/15 text-white/70 hover:text-white hover:bg-white/10"
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
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>
  );
}
