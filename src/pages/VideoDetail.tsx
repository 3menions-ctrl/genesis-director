/**
 * VideoDetailPage - Full page for watching a video with reactions and comments
 * Premium cinematic aesthetic matching the Projects page
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Eye, Calendar, User, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigationWithLoading } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UniversalVideoPlayer } from '@/components/player';
import { VideoReactionsBar, VideoCommentsSection } from '@/components/social';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoDetails {
  id: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_public: boolean;
  mode: string | null;
  genre: string;
  likes_count: number;
  creator?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { navigateTo } = useNavigationWithLoading();
  const { user } = useAuth();
  
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!videoId) return;

      setIsLoading(true);
      try {
        // Fetch video details
        const { data: videoData, error: videoError } = await supabase
          .from('movie_projects')
          .select('id, title, video_url, thumbnail_url, created_at, updated_at, user_id, is_public, mode, genre, likes_count')
          .eq('id', videoId)
          .eq('is_public', true)
          .single();

        if (videoError) throw videoError;

        // Fetch creator profile (use public view for security)
        const { data: creatorData } = await supabase
          .from('profiles_public')
          .select('id, display_name, avatar_url')
          .eq('id', videoData.user_id)
          .single();

        setVideo({
          ...videoData,
          creator: creatorData || undefined,
        });

        // Log view (could be used for analytics)
        setViewCount(videoData.likes_count || 0);
      } catch (err) {
        console.error('Failed to fetch video:', err);
        toast.error('Video not found');
        navigateTo('/discover');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideo();
  }, [videoId, navigate]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const creatorDisplayName = video?.creator?.display_name || 'Anonymous';
  const creatorInitials = creatorDisplayName.slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-500">Video not found</p>
        <Button onClick={() => navigateTo('/discover')}>Back to Discover</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white truncate flex-1">
            {video.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="border-white/10 hover:bg-white/5"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-white/[0.06]">
              {video.video_url ? (
                <UniversalVideoPlayer
                  source={
                    video.video_url.endsWith('.json')
                      ? { manifestUrl: video.video_url }
                      : { urls: [video.video_url] }
                  }
                  autoPlay
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  Video not available
                </div>
              )}
            </div>

            {/* Reactions Bar */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.06]">
              <VideoReactionsBar projectId={video.id} />
            </div>

            {/* Video Info */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.06] space-y-4">
              <h2 className="text-lg font-semibold text-white">{video.title}</h2>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  {viewCount} reactions
                </span>
                {video.genre && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                    {video.genre}
                  </span>
                )}
              </div>

              {/* Creator Info */}
              <div 
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                onClick={() => navigate(`/user/${video.user_id}`)}
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={video.creator?.avatar_url || undefined} />
                  <AvatarFallback className="bg-zinc-800 text-zinc-400">
                    {creatorInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-white">{creatorDisplayName}</p>
                  <p className="text-sm text-zinc-500">View profile</p>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Comments Column */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.06] min-h-[500px]">
              <VideoCommentsSection projectId={video.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
