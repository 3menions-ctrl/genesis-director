import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCreatorDiscovery, useFollowingFeed } from '@/hooks/usePublicProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Users, Video, Play, Heart, 
  TrendingUp, Sparkles, Clock, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import CreatorsBackground from '@/components/creators/CreatorsBackground';
import { CreatorsHero } from '@/components/creators/CreatorsHero';
import { UniversalVideoPlayer } from '@/components/player';

const glassCard = "backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300";

export default function Creators() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
    creator?: { display_name: string | null; avatar_url: string | null };
  } | null>(null);
  
  const { data: creators, isLoading: creatorsLoading } = useCreatorDiscovery(debouncedQuery);
  const { data: feedVideos, isLoading: feedLoading } = useFollowingFeed();

  const { data: discoverVideos, isLoading: discoverLoading } = useQuery({
    queryKey: ['discover-videos', debouncedQuery],
    queryFn: async () => {
      let query = supabase
        .from('movie_projects')
        .select('id, title, thumbnail_url, video_url, likes_count, created_at')
        .eq('is_public', true)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (debouncedQuery?.trim()) {
        query = query.ilike('title', `%${debouncedQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) return [];
      const projects = data || [];

      // Fetch first clip mp4 for each project (for PausedFrameVideo thumbnails)
      if (projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        const { data: clips } = await supabase
          .from('video_clips')
          .select('project_id, video_url')
          .in('project_id', projectIds)
          .eq('shot_index', 0)
          .not('video_url', 'is', null);

        const clipMap = new Map<string, string>();
        clips?.forEach(c => {
          if (c.video_url && c.video_url.includes('.mp4')) {
            clipMap.set(c.project_id, c.video_url);
          }
        });

        return projects.map(p => ({
          ...p,
          first_clip_url: clipMap.get(p.id) || null,
        }));
      }

      return projects.map(p => ({ ...p, first_clip_url: null }));
    },
    staleTime: 60000,
  });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => setDebouncedQuery(value), 300);
    return () => clearTimeout(timeoutId);
  };

  const totalCreators = creators?.length || 0;
  const totalVideos = creators?.reduce((sum, c) => sum + c.video_count, 0) || 0;

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <CreatorsBackground />
      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <CreatorsHero 
          title="Discover Creators"
          subtitle="Explore outstanding work from the community's most talented filmmakers"
          stats={{ totalVideos }}
        />

        {/* Search bar — refined */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-lg mx-auto"
        >
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-violet-400 transition-colors" />
            <Input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-11 h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-violet-500/40 focus:bg-white/[0.05] transition-all"
            />
          </div>
        </motion.div>

        {/* Tabs — sleeker */}
        <Tabs defaultValue={user ? "feed" : "discover"} className="space-y-8">
          <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2 bg-white/[0.02] border border-white/[0.06] h-10 rounded-xl p-0.5">
            {user && (
              <TabsTrigger value="feed" className="gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                Your Feed
              </TabsTrigger>
            )}
            <TabsTrigger value="discover" className="gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/20">
              <TrendingUp className="w-3.5 h-3.5" />
              {user ? 'Discover' : 'All Videos'}
            </TabsTrigger>
            {!user && (
              <TabsTrigger value="discover" className="gap-1.5 text-xs font-medium rounded-lg" disabled>
                <Sparkles className="w-3.5 h-3.5" />
                Sign in for Feed
              </TabsTrigger>
            )}
          </TabsList>

          {/* Feed Tab */}
          {user && (
            <TabsContent value="feed" className="space-y-6">
              <FeedContent
                feedLoading={feedLoading}
                feedVideos={feedVideos}
                onSelectVideo={setSelectedVideo}
              />
            </TabsContent>
          )}

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            <DiscoverContent
              discoverLoading={discoverLoading}
              discoverVideos={discoverVideos}
              searchQuery={searchQuery}
              onSelectVideo={setSelectedVideo}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <VideoPlayerModal
            video={selectedVideo}
            onClose={() => setSelectedVideo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sub-components ─── */

function VideoCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={cn("rounded-2xl overflow-hidden", glassCard)}>
          <Skeleton className="aspect-video bg-white/[0.03]" />
          <div className="p-4 space-y-2.5">
            <Skeleton className="h-4 w-3/4 bg-white/[0.03]" />
            <Skeleton className="h-3 w-1/3 bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoThumbnail({ 
  thumbnailUrl, 
  videoUrl, 
  firstClipUrl, 
  title 
}: { 
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  firstClipUrl?: string | null;
  title: string;
}) {
  // Only use videoUrl for PausedFrameVideo if it's an actual video file, not a JSON manifest
  const playableVideoUrl = videoUrl && !videoUrl.endsWith('.json') ? videoUrl : null;
  const clipSrc = firstClipUrl || playableVideoUrl;

  return (
    <div className="relative aspect-video overflow-hidden bg-black/20">
      {clipSrc ? (
        <PausedFrameVideo 
          src={clipSrc} 
          className="w-full h-full object-cover"
          showLoader={false}
        />
      ) : thumbnailUrl ? (
        <img 
          src={thumbnailUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-white/[0.02] flex items-center justify-center">
          <Video className="w-8 h-8 text-white/10" />
        </div>
      )}
      {/* Hover overlay with play button */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300">
          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
        </div>
      </div>
    </div>
  );
}

function VideoMeta({ likesCount, createdAt }: { likesCount?: number | null; createdAt: string }) {
  return (
    <div className="flex items-center gap-4 text-[11px] text-white/25 font-medium">
      <span className="flex items-center gap-1">
        <Heart className="w-3 h-3" />
        {likesCount ?? 0}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
}

function FeedContent({ 
  feedLoading, 
  feedVideos, 
  onSelectVideo 
}: { 
  feedLoading: boolean;
  feedVideos: any[] | undefined;
  onSelectVideo: (v: any) => void;
}) {
  if (feedLoading) return <VideoCardSkeleton count={6} />;
  
  if (feedVideos && feedVideos.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence mode="sync">
          {feedVideos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.04 }}
              className={cn("group rounded-2xl overflow-hidden cursor-pointer", glassCard)}
              onClick={() => onSelectVideo({
                id: video.id,
                title: video.title,
                creator: video.creator,
              })}
            >
              <VideoThumbnail
                thumbnailUrl={video.thumbnail_url}
                videoUrl={video.video_url}
                firstClipUrl={(video as any).first_clip_url}
                title={video.title}
              />
              <div className="p-4 space-y-2.5">
                <h3 className="font-semibold text-sm text-white truncate">{video.title}</h3>
                <Link 
                  to={`/user/${video.user_id}`}
                  className="flex items-center gap-2 group/creator"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={video.creator?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-violet-600/20 text-violet-400">
                      {(video.creator?.display_name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white/40 group-hover/creator:text-violet-400 transition-colors">
                    {video.creator?.display_name || 'Anonymous'}
                  </span>
                </Link>
                <VideoMeta likesCount={video.likes_count} createdAt={video.created_at} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl p-16 text-center", glassCard)}>
      <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Your feed is empty</h3>
      <p className="text-white/40 text-sm mb-6">Follow some creators to see their videos here</p>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => {
          const tab = document.querySelector('[data-state="inactive"][value="discover"]') as HTMLButtonElement;
          tab?.click();
        }}
        className="gap-2 text-xs"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Discover Videos
      </Button>
    </div>
  );
}

function DiscoverContent({ 
  discoverLoading, 
  discoverVideos, 
  searchQuery, 
  onSelectVideo 
}: { 
  discoverLoading: boolean;
  discoverVideos: any[] | undefined;
  searchQuery: string;
  onSelectVideo: (v: any) => void;
}) {
  if (discoverLoading) return <VideoCardSkeleton count={9} />;
  
  if (discoverVideos && discoverVideos.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence mode="sync">
          {discoverVideos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.035 }}
              className={cn("group rounded-2xl overflow-hidden cursor-pointer", glassCard)}
              onClick={() => onSelectVideo({
                id: video.id,
                title: video.title,
              })}
            >
              <VideoThumbnail
                thumbnailUrl={video.thumbnail_url}
                videoUrl={video.video_url}
                firstClipUrl={video.first_clip_url}
                title={video.title}
              />
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-sm text-white truncate">{video.title}</h3>
                <VideoMeta likesCount={video.likes_count} createdAt={video.created_at} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl p-16 text-center", glassCard)}>
      <Video className="w-12 h-12 text-white/10 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">No videos found</h3>
      <p className="text-white/40 text-sm">
        {searchQuery ? 'Try a different search term' : 'Be the first to share a video!'}
      </p>
    </div>
  );
}

function VideoPlayerModal({ 
  video, 
  onClose 
}: { 
  video: { id: string; title: string; creator?: { display_name: string | null; avatar_url: string | null } };
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">{video.title}</h2>
          {video.creator?.display_name && (
            <p className="text-white/40 text-xs mt-0.5">by {video.creator.display_name}</p>
          )}
        </div>

        <div className="rounded-xl overflow-hidden bg-black aspect-video ring-1 ring-white/[0.06]">
          <UniversalVideoPlayer
            source={{ projectId: video.id }}
            mode="inline"
            autoPlay
            className="w-full h-full"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
