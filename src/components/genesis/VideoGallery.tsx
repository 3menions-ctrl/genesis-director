import { useState, memo, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, ThumbsUp, ThumbsDown, Star, Clock, User, 
  MapPin, Calendar, Play, ExternalLink, Filter 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGenesisVideos, useVoteOnVideo, useUserVideoVote } from '@/hooks/useGenesisUniverse';
import { useAuth } from '@/contexts/AuthContext';
import type { GenesisVideo } from '@/types/genesis';
import { formatDistanceToNow } from 'date-fns';
import { SafeComponent } from '@/components/ui/error-boundary';

interface VideoGalleryProps {
  locationId?: string;
  eraId?: string;
}

// VideoCard with forwardRef for AnimatePresence
const VideoCard = memo(forwardRef<HTMLDivElement, { video: GenesisVideo; index: number }>(
  function VideoCard({ video, index }, ref) {
    const { user } = useAuth();
    const voteOnVideo = useVoteOnVideo();
    const { data: userVote } = useUserVideoVote(video.id);
    
    const handleVote = useCallback((type: 'up' | 'down') => {
      if (!user) return;
      
      // If clicking same vote, remove it
      if (userVote?.vote_type === type) {
        voteOnVideo.mutate({ videoId: video.id, voteType: null });
      } else {
        voteOnVideo.mutate({ videoId: video.id, voteType: type });
      }
    }, [user, userVote, voteOnVideo, video.id]);

    const canonBadge = {
      canon: { label: 'Canon', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      featured: { label: 'Featured', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      pending: { label: 'Pending', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      non_canon: { label: 'Non-Canon', className: 'bg-muted text-muted-foreground' },
    };

    const badge = canonBadge[video.canon_status] || canonBadge.pending;

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className="overflow-hidden group hover:shadow-lg transition-all">
          {/* Thumbnail */}
          <div className="relative aspect-video bg-muted">
            {video.thumbnail_url ? (
              <img 
                src={video.thumbnail_url} 
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            
            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button size="icon" variant="secondary" className="rounded-full h-14 w-14">
                <Play className="h-6 w-6" />
              </Button>
            </div>
            
            {/* Canon badge */}
            <div className="absolute top-2 left-2">
              <Badge className={badge.className}>
                {video.canon_status === 'canon' && <Star className="h-3 w-3 mr-1" />}
                {badge.label}
              </Badge>
            </div>
            
            {/* Duration */}
            {video.duration_seconds && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          <CardContent className="p-4 space-y-3">
            {/* Title */}
            <h3 className="font-semibold line-clamp-1">{video.title}</h3>
            
            {/* Meta */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {video.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {video.location.name}
                </span>
              )}
              {video.era && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {video.era.name}
                </span>
              )}
            </div>

            {/* Voting & Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-1 ${userVote?.vote_type === 'up' ? 'text-green-500' : ''}`}
                  onClick={() => handleVote('up')}
                  disabled={!user}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>{video.upvotes}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-1 ${userVote?.vote_type === 'down' ? 'text-red-500' : ''}`}
                  onClick={() => handleVote('down')}
                  disabled={!user}
                >
                  <ThumbsDown className="h-4 w-4" />
                  <span>{video.downvotes}</span>
                </Button>
              </div>
              
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
));

// Inner gallery component
const VideoGalleryInner = memo(forwardRef<HTMLDivElement, VideoGalleryProps>(
  function VideoGalleryInner({ locationId, eraId }, ref) {
    const [sortBy, setSortBy] = useState<'recent' | 'votes' | 'canon'>('recent');
    const [canonFilter, setCanonFilter] = useState<string>('all');
    
    const { data: videos, isLoading } = useGenesisVideos({
      locationId,
      eraId,
      canonStatus: canonFilter === 'all' ? undefined : canonFilter,
      sortBy,
    });

    if (isLoading) {
      return (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Stories</h2>
            <Badge variant="secondary">{videos?.length || 0}</Badge>
          </div>
          
          <div className="flex gap-2">
            <Select value={canonFilter} onValueChange={setCanonFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stories</SelectItem>
                <SelectItem value="canon">Canon</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="votes">Most Voted</SelectItem>
                <SelectItem value="canon">Canon First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Video Grid */}
        {!videos?.length ? (
          <Card className="p-12 text-center">
            <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Stories Yet</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to contribute a story to this part of the universe!
            </p>
            <Button>Create a Story</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {videos.map((video, index) => (
                <VideoCard key={video.id} video={video} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }
));

// Exported wrapper with SafeComponent
export function VideoGallery(props: VideoGalleryProps) {
  return (
    <SafeComponent name="VideoGallery">
      <VideoGalleryInner {...props} />
    </SafeComponent>
  );
}
