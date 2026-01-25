import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Clock, Heart, Film, Search, TrendingUp, Sparkles } from 'lucide-react';
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
}

type SortOption = 'recent' | 'popular';

export default function Discover() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedVideo, setSelectedVideo] = useState<PublicVideo | null>(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ['public-videos', sortBy],
    queryFn: async () => {
      const query = supabase
        .from('movie_projects')
        .select('id, title, synopsis, thumbnail_url, video_url, genre, mood, created_at, target_duration_minutes, user_id, likes_count')
        .eq('is_public', true)
        .not('video_url', 'is', null)
        .order(sortBy === 'popular' ? 'likes_count' : 'created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as PublicVideo[];
    },
  });

  // Fetch user's likes
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

  const filteredVideos = videos?.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.synopsis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatGenre = (genre: string) => {
    return genre.charAt(0).toUpperCase() + genre.slice(1).replace(/_/g, ' ');
  };

  return (
    <div className="min-h-screen bg-black">
      <AppHeader />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Community <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Showcase</span>
            </h1>
            <p className="text-lg text-white/60 mb-8">
              Discover amazing AI-generated videos created by our community
            </p>

            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos by title, genre, or description..."
                className="w-full h-12 pl-12 pr-4 bg-white/[0.05] border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-white/20 focus:ring-white/10"
              />
            </div>

            {/* Sort Options */}
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortBy('recent')}
                className={cn(
                  "rounded-full gap-2",
                  sortBy === 'recent' 
                    ? "bg-white/10 text-white" 
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
                    ? "bg-white/10 text-white" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Popular
              </Button>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
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
              visible: {
                transition: { staggerChildren: 0.05 }
              }
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
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Film className="w-10 h-10 text-white/30" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No public videos yet</h3>
            <p className="text-white/50 max-w-md mx-auto mb-6">
              {searchQuery 
                ? "No videos match your search. Try different keywords."
                : "Be the first to share your creation with the community!"}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => navigate('/create')}
                className="bg-white text-black hover:bg-white/90 rounded-full px-6"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Your First Video
              </Button>
            )}
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
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 mb-3">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
            <Film className="w-12 h-12 text-white/20" />
          </div>
        )}
        
        {/* Overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: isHovered ? 1 : 0.8 }}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </motion.div>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 text-xs text-white font-medium">
          {video.target_duration_minutes} min
        </div>

        {/* Genre Badge */}
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white/90 border-none text-xs"
        >
          {formatGenre(video.genre)}
        </Badge>

        {/* Like Button */}
        <button
          onClick={onLike}
          className={cn(
            "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all",
            isLiked 
              ? "bg-red-500/90 text-white" 
              : "bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70"
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
        </button>
      </div>

      {/* Info */}
      <div className="space-y-1">
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
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-5xl bg-zinc-900/90 rounded-2xl overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Player */}
        <div className="aspect-video bg-black">
          {video.video_url ? (
            video.video_url.endsWith('.json') ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
                {video.thumbnail_url && (
                  <img 
                    src={video.thumbnail_url} 
                    alt={video.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <Film className="w-8 h-8 text-white/50" />
                  </div>
                  <p className="text-white/70 font-medium mb-1">Multi-Clip Production</p>
                  <p className="text-white/40 text-sm">Open in full studio to view this cinematic project</p>
                </div>
              </div>
            ) : (
              <video
                src={video.video_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              Video not available
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white mb-2">{video.title}</h2>
              <div className="flex items-center gap-3 text-sm text-white/50 mb-4">
                <Badge variant="outline" className="text-white/70 border-white/20">
                  {formatGenre(video.genre)}
                </Badge>
                {video.mood && (
                  <Badge variant="outline" className="text-white/70 border-white/20">
                    {video.mood}
                  </Badge>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </span>
              </div>
              {video.synopsis && (
                <p className="text-white/60">{video.synopsis}</p>
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
              {video.likes_count || 0} {video.likes_count === 1 ? 'Like' : 'Likes'}
            </Button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
}
