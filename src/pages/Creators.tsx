import { useState, useMemo } from 'react';
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

const glassCard = "backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]";

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

  // Fetch public videos for discover tab (no creator info exposed)
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
      return data || [];
    },
    staleTime: 60000,
  });

  // Debounced search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => setDebouncedQuery(value), 300);
    return () => clearTimeout(timeoutId);
  };

  // Calculate stats for the hero
  const totalCreators = creators?.length || 0;
  const totalVideos = creators?.reduce((sum, c) => sum + c.video_count, 0) || 0;

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <CreatorsBackground />
      <AppHeader />

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Premium Hero Header matching Clips page */}
        <CreatorsHero 
          title="Discover Creators"
          subtitle="Find and follow talented creators, watch their latest videos, and get inspired"
          stats={{ totalCreators, totalVideos }}
        />

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-md mx-auto"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              type="text"
              placeholder="Search creators..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-violet-500/50"
            />
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue={user ? "feed" : "discover"} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/[0.03] border border-white/[0.08]">
            {user && (
              <TabsTrigger value="feed" className="gap-2 data-[state=active]:bg-violet-600">
                <Sparkles className="w-4 h-4" />
                Your Feed
              </TabsTrigger>
            )}
            <TabsTrigger value="discover" className="gap-2 data-[state=active]:bg-violet-600">
              <TrendingUp className="w-4 h-4" />
              {user ? 'Discover' : 'All Creators'}
            </TabsTrigger>
            {!user && (
              <TabsTrigger value="discover" className="gap-2 data-[state=active]:bg-violet-600" disabled>
                <Sparkles className="w-4 h-4" />
                Sign in for Feed
              </TabsTrigger>
            )}
          </TabsList>

          {/* Feed Tab */}
          {user && (
            <TabsContent value="feed" className="space-y-6">
              {feedLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={cn("rounded-2xl overflow-hidden", glassCard)}>
                      <Skeleton className="aspect-video bg-white/[0.03]" />
                      <div className="p-4 space-y-3">
                        <Skeleton className="h-5 w-3/4 bg-white/[0.03]" />
                        <Skeleton className="h-4 w-1/2 bg-white/[0.03]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : feedVideos && feedVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="sync">
                    {feedVideos.map((video, index) => (
                      <motion.div
                        key={video.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn("group rounded-2xl overflow-hidden cursor-pointer", glassCard)}
                        onClick={() => setSelectedVideo({
                          id: video.id,
                          title: video.title,
                          creator: video.creator,
                        })}
                      >
                        {/* Thumbnail with fallback chain */}
                        <div className="relative aspect-video overflow-hidden">
                          {video.thumbnail_url ? (
                            <img 
                              src={video.thumbnail_url} 
                              alt={video.title}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (video as { first_clip_url?: string }).first_clip_url ? (
                            <PausedFrameVideo 
                              src={(video as { first_clip_url?: string }).first_clip_url!} 
                              className="w-full h-full object-cover"
                              showLoader={false}
                            />
                          ) : video.video_url ? (
                            <PausedFrameVideo 
                              src={video.video_url} 
                              className="w-full h-full object-cover"
                              showLoader={false}
                            />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              <Video className="w-10 h-10 text-white/20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <Play className="w-6 h-6 text-white fill-white ml-1" />
                            </div>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-white truncate mb-2">{video.title}</h3>
                          <Link 
                            to={`/user/${video.user_id}`}
                            className="flex items-center gap-2 group/creator"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={video.creator?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-violet-600/20 text-violet-400">
                                {(video.creator?.display_name || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-white/60 group-hover/creator:text-violet-400 transition-colors">
                              {video.creator?.display_name || 'Anonymous'}
                            </span>
                          </Link>
                          <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {video.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(video.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className={cn("rounded-2xl p-12 text-center", glassCard)}>
                  <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Your feed is empty</h3>
                  <p className="text-white/60 mb-6">Follow some creators to see their videos here!</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const tab = document.querySelector('[data-state="inactive"][value="discover"]') as HTMLButtonElement;
                      tab?.click();
                    }}
                    className="gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Discover Creators
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {/* Discover Tab — Video-focused grid, no creator names */}
          <TabsContent value="discover" className="space-y-6">
            {discoverLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className={cn("rounded-2xl overflow-hidden", glassCard)}>
                    <Skeleton className="aspect-video bg-white/[0.03]" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4 bg-white/[0.03]" />
                      <Skeleton className="h-3 w-1/3 bg-white/[0.03]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : discoverVideos && discoverVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="sync">
                  {discoverVideos.map((video, index) => (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.04 }}
                      className={cn("group rounded-2xl overflow-hidden cursor-pointer", glassCard)}
                      onClick={() => setSelectedVideo({
                        id: video.id,
                        title: video.title,
                      })}
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video overflow-hidden">
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url} 
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : video.video_url ? (
                          <PausedFrameVideo 
                            src={video.video_url} 
                            className="w-full h-full object-cover"
                            showLoader={false}
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <Video className="w-10 h-10 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-6 h-6 text-white fill-white ml-1" />
                          </div>
                        </div>
                      </div>

                      {/* Info — title and stats only, no creator name */}
                      <div className="p-4">
                        <h3 className="font-semibold text-white truncate">{video.title}</h3>
                        <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {video.likes_count ?? 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(video.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className={cn("rounded-2xl p-12 text-center", glassCard)}>
                <Video className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No videos found</h3>
                <p className="text-white/60">
                  {searchQuery ? 'Try a different search term' : 'Be the first to share a video!'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Video Player Modal - Uses UniversalVideoPlayer with projectId for multi-clip playback */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-white hover:bg-white/10"
                onClick={() => setSelectedVideo(null)}
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Video title and creator */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white">{selectedVideo.title}</h2>
                {selectedVideo.creator?.display_name && (
                  <p className="text-white/60 text-sm">by {selectedVideo.creator.display_name}</p>
                )}
              </div>

              {/* UniversalVideoPlayer with projectId for ALL clips */}
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <UniversalVideoPlayer
                  source={{ projectId: selectedVideo.id }}
                  mode="inline"
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
