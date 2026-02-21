import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyVideoThumbnail } from '@/components/ui/LazyVideoThumbnail';
import { UniversalVideoPlayer } from '@/components/player';
import { VideoCommentsSection } from '@/components/social/VideoCommentsSection';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, GATEKEEPER_PRESETS, getGatekeeperMessage } from '@/hooks/useGatekeeperLoading';
import {
  Search, Play, Heart, Sparkles, Clock, X, ArrowRight, Video, Eye, MessageCircle, UserPlus, UserCheck
} from 'lucide-react';
// STABILITY: Static shims replace real framer-motion to prevent 60+ concurrent animations crashing Safari
import { forwardRef } from 'react';

const MotionDiv = forwardRef<HTMLDivElement, any>(({ children, className, style, onClick, onMouseEnter, onMouseLeave, ...rest }, ref) => (
  <div ref={ref} className={className} style={style} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>{children}</div>
));
MotionDiv.displayName = 'MotionDiv';
const MotionH1 = forwardRef<HTMLHeadingElement, any>(({ children, className, style, ...rest }, ref) => (
  <h1 ref={ref} className={className} style={style}>{children}</h1>
));
MotionH1.displayName = 'MotionH1';
const MotionP = forwardRef<HTMLParagraphElement, any>(({ children, className, style, ...rest }, ref) => (
  <p ref={ref} className={className} style={style}>{children}</p>
));
MotionP.displayName = 'MotionP';

const motion = { div: MotionDiv, h1: MotionH1, p: MotionP };
const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>;
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Creators() {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
    user_id?: string;
    creator?: { display_name: string | null; avatar_url: string | null };
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: discoverVideos, isLoading } = useQuery({
    queryKey: ['discover-videos', debouncedQuery],
    queryFn: async () => {
      let query = supabase
        .from('movie_projects')
        .select('id, title, thumbnail_url, video_url, video_clips, likes_count, created_at, user_id, pending_video_tasks')
        .eq('is_public', true)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(60);

      if (debouncedQuery?.trim()) {
        query = query.ilike('title', `%${debouncedQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) return [];
      const projects = data || [];

      // Fetch creator profiles for all videos
      const creatorIds = [...new Set(projects.map(p => p.user_id).filter(Boolean))];
      let creatorMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, avatar_url')
          .in('id', creatorIds);
        profiles?.forEach(p => creatorMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url }));
      }

      // Fetch first clip URLs for thumbnails
      let clipMap = new Map<string, string>();
      if (projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        const { data: clips } = await supabase
          .from('video_clips')
          .select('project_id, video_url')
          .in('project_id', projectIds)
          .eq('shot_index', 0)
          .not('video_url', 'is', null);
        clips?.forEach(c => {
          if (c.video_url && c.video_url.includes('.mp4')) {
            clipMap.set(c.project_id, c.video_url);
          }
        });
      }

      return projects.map(p => {
        let clipUrl = clipMap.get(p.id) || null;
        if (!clipUrl && p.video_clips && Array.isArray(p.video_clips) && p.video_clips.length > 0) {
          const firstMp4 = (p.video_clips as string[]).find((u: string) => u.includes('.mp4'));
          if (firstMp4) clipUrl = firstMp4;
        }
        let effectiveVideoUrl = p.video_url;
        if (!effectiveVideoUrl) {
          const tasks = p.pending_video_tasks as Record<string, unknown> | null;
          if (tasks?.hlsPlaylistUrl) effectiveVideoUrl = tasks.hlsPlaylistUrl as string;
          else if (tasks?.manifestUrl) effectiveVideoUrl = tasks.manifestUrl as string;
        }
        const creator = creatorMap.get(p.user_id) || { display_name: null, avatar_url: null };
        return { ...p, video_url: effectiveVideoUrl, first_clip_url: clipUrl, creator };
      });
    },
    staleTime: 60000,
  });

  // FIX: Proper debounce with cleanup (old version leaked timeouts)
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // GATEKEEPER: Unified loading with CinemaLoader
  const { loading: authLoading } = useAuth();
  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.discover,
    authLoading,
    dataLoading: isLoading,
    dataSuccess: !!discoverVideos,
  });

  // User likes
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

  // User follows — track who the current user follows
  const { data: userFollows } = useQuery({
    queryKey: ['user-follows-list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);
      if (error) return [];
      return data.map(f => f.following_id);
    },
    enabled: !!user,
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: async ({ targetUserId, isFollowing }: { targetUserId: string; isFollowing: boolean }) => {
      if (!user) throw new Error('Must be logged in');
      if (targetUserId === user.id) return; // Can't follow yourself
      if (isFollowing) {
        await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
      } else {
        const { error } = await supabase.from('user_follows').insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
        await supabase.from('notifications').insert({
          user_id: targetUserId, type: 'follow', title: 'New Follower!',
          body: 'Someone started following you', data: { follower_id: user.id },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-follows-list'] });
      queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  const handleFollow = useCallback((e: React.MouseEvent, targetUserId: string, isFollowing: boolean) => {
    e.stopPropagation();
    if (!user) { toast.error('Please log in to follow creators'); return; }
    if (targetUserId === user.id) return;
    followMutation.mutate({ targetUserId, isFollowing });
  }, [user, followMutation]);

  const likeMutation = useMutation({
    mutationFn: async ({ projectId, isLiked, ownerId }: { projectId: string; isLiked: boolean; ownerId?: string }) => {
      if (!user) throw new Error('Must be logged in to like');
      if (isLiked) {
        const { error } = await supabase.from('video_likes').delete().eq('user_id', user.id).eq('project_id', projectId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('video_likes').insert({ user_id: user.id, project_id: projectId });
        if (error) throw error;
        // Auto-follow the video creator when liking (if not already following and not own video)
        if (ownerId && ownerId !== user.id && !userFollows?.includes(ownerId)) {
          await supabase.from('user_follows').insert({ follower_id: user.id, following_id: ownerId }).then(({ error: followErr }) => {
            if (!followErr) {
              supabase.from('notifications').insert({
                user_id: ownerId, type: 'follow', title: 'New Follower!',
                body: 'Someone liked your video and started following you', data: { follower_id: user.id },
              });
            }
          });
        }
        if (ownerId && ownerId !== user.id) {
          await supabase.from('notifications').insert({
            user_id: ownerId, type: 'like', title: 'Someone liked your video!',
            body: 'Your video received a new like', data: { liker_id: user.id, project_id: projectId },
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-videos'] });
      queryClient.invalidateQueries({ queryKey: ['user-likes'] });
      queryClient.invalidateQueries({ queryKey: ['user-follows-list'] });
    },
    onError: () => toast.error("Couldn't update your like"),
  });

  const handleLike = useCallback((e: React.MouseEvent, projectId: string, isLiked: boolean, ownerId?: string) => {
    e.stopPropagation();
    if (!user) { toast.error('Please log in to like videos'); return; }
    likeMutation.mutate({ projectId, isLiked, ownerId });
  }, [user, likeMutation]);

  const totalVideos = discoverVideos?.length || 0;

  // Split videos: first 3 are "featured", rest in grid
  const featuredVideos = discoverVideos?.slice(0, 3) || [];
  const gridVideos = discoverVideos?.slice(3) || [];

  // CRITICAL: Gate content rendering behind loader to prevent mounting 60+ video thumbnails while loading
  if (gatekeeper.isLoading) {
    return (
      <CinemaLoader
        isVisible={true}
        message={getGatekeeperMessage(gatekeeper.phase, GATEKEEPER_PRESETS.discover.messages)}
        progress={gatekeeper.progress}
        variant="fullscreen"
      />
    );
  }

  return (
    <>
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#030303]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-violet-600/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[400px] bg-fuchsia-600/[0.04] rounded-full blur-[100px]" />
      </div>

      <AppHeader />

      <main className="relative z-10">
        {/* ═══ HERO SECTION ═══ */}
        <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.08] mb-8"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-300">
                Community Gallery
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-5"
            >
              <span className="text-white">Explore </span>
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                AI Films
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-white/35 text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
            >
              Watch stunning videos created by our community — then make your own.
            </motion.p>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="max-w-xl mx-auto mb-6"
            >
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25 group-focus-within:text-violet-400 transition-colors" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-14 pr-12 h-14 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 rounded-2xl focus:border-violet-500/40 focus:bg-white/[0.06] transition-all text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>

            {/* Stats pill */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="inline-flex items-center gap-3 text-xs text-white/30"
            >
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                {totalVideos} videos
              </span>
              <span className="w-1 h-1 rounded-full bg-white/15" />
              <span>Updated live</span>
            </motion.div>
          </div>
        </section>

        {/* ═══ FEATURED VIDEOS ═══ */}
        {!isLoading && featuredVideos.length >= 3 && !searchQuery && (
          <section className="px-4 sm:px-6 lg:px-8 pb-16">
            <div className="max-w-7xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {/* Large featured card */}
                <div
                  className="md:col-span-2 md:row-span-2 group relative rounded-3xl overflow-hidden cursor-pointer bg-white/[0.02] border border-white/[0.06]"
                  onClick={() => setSelectedVideo({ id: featuredVideos[0].id, title: featuredVideos[0].title, user_id: featuredVideos[0].user_id, creator: featuredVideos[0].creator })}
                  onMouseEnter={() => setHoveredId(featuredVideos[0].id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="aspect-video md:aspect-auto md:h-full relative">
                    <VideoThumbnail
                      thumbnailUrl={featuredVideos[0].thumbnail_url}
                      videoUrl={featuredVideos[0].video_url}
                      firstClipUrl={featuredVideos[0].first_clip_url}
                      title={featuredVideos[0].title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-semibold uppercase tracking-wider mb-3">
                        <Sparkles className="w-3 h-3" />
                        Featured
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 line-clamp-2">{featuredVideos[0].title}</h3>
                      <CreatorRow
                        creatorName={featuredVideos[0].creator?.display_name}
                        creatorAvatar={featuredVideos[0].creator?.avatar_url}
                        creatorId={featuredVideos[0].user_id}
                        isFollowing={userFollows?.includes(featuredVideos[0].user_id) || false}
                        onFollow={(e) => handleFollow(e, featuredVideos[0].user_id, userFollows?.includes(featuredVideos[0].user_id) || false)}
                        isOwnVideo={featuredVideos[0].user_id === user?.id}
                      />
                      <VideoMeta likesCount={featuredVideos[0].likes_count} createdAt={featuredVideos[0].created_at} isLiked={userLikes?.includes(featuredVideos[0].id)} onLike={(e) => handleLike(e, featuredVideos[0].id, userLikes?.includes(featuredVideos[0].id) || false, featuredVideos[0].user_id)} />
                    </div>
                    <PlayOverlay />
                  </div>
                </div>

                {/* Two smaller featured cards */}
                {featuredVideos.slice(1, 3).map((video, i) => (
                  <div
                    key={video.id}
                    className="group relative rounded-3xl overflow-hidden cursor-pointer bg-white/[0.02] border border-white/[0.06]"
                    onClick={() => setSelectedVideo({ id: video.id, title: video.title, user_id: video.user_id, creator: video.creator })}
                    onMouseEnter={() => setHoveredId(video.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="aspect-video relative">
                      <VideoThumbnail
                        thumbnailUrl={video.thumbnail_url}
                        videoUrl={video.video_url}
                        firstClipUrl={video.first_clip_url}
                        title={video.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h3 className="text-sm font-semibold text-white truncate mb-1">{video.title}</h3>
                        <CreatorRow
                          creatorName={video.creator?.display_name}
                          creatorAvatar={video.creator?.avatar_url}
                          creatorId={video.user_id}
                          isFollowing={userFollows?.includes(video.user_id) || false}
                          onFollow={(e) => handleFollow(e, video.user_id, userFollows?.includes(video.user_id) || false)}
                          isOwnVideo={video.user_id === user?.id}
                        />
                        <VideoMeta likesCount={video.likes_count} createdAt={video.created_at} isLiked={userLikes?.includes(video.id)} onLike={(e) => handleLike(e, video.id, userLikes?.includes(video.id) || false, video.user_id)} />
                      </div>
                      <PlayOverlay />
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

        {/* ═══ VIDEO GRID ═══ */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            {!searchQuery && !isLoading && gridVideos.length > 0 && (
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-semibold text-white/80">All Videos</h2>
                <span className="text-xs text-white/25">{gridVideos.length} videos</span>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.06]">
                    <Skeleton className="aspect-video bg-white/[0.04]" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4 bg-white/[0.04]" />
                      <Skeleton className="h-3 w-1/3 bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (searchQuery ? discoverVideos : gridVideos)?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(searchQuery ? discoverVideos : gridVideos)?.map((video, index) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.4) }}
                    className="group rounded-2xl overflow-hidden cursor-pointer bg-white/[0.02] border border-white/[0.06] hover:border-primary/30 hover:bg-white/[0.04] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_12px_40px_-10px_hsl(263_70%_58%/0.15)] holo-shine"
                    onClick={() => setSelectedVideo({ id: video.id, title: video.title, user_id: video.user_id, creator: video.creator })}
                    onMouseEnter={() => setHoveredId(video.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <VideoThumbnail
                        thumbnailUrl={video.thumbnail_url}
                        videoUrl={video.video_url}
                        firstClipUrl={video.first_clip_url}
                        title={video.title}
                      />
                      <PlayOverlay />
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm text-white truncate group-hover:text-violet-300 transition-colors">{video.title}</h3>
                      <CreatorRow
                        creatorName={video.creator?.display_name}
                        creatorAvatar={video.creator?.avatar_url}
                        creatorId={video.user_id}
                        isFollowing={userFollows?.includes(video.user_id) || false}
                        onFollow={(e) => handleFollow(e, video.user_id, userFollows?.includes(video.user_id) || false)}
                        isOwnVideo={video.user_id === user?.id}
                      />
                      <VideoMeta likesCount={video.likes_count} createdAt={video.created_at} isLiked={userLikes?.includes(video.id)} onLike={(e) => handleLike(e, video.id, userLikes?.includes(video.id) || false, video.user_id)} />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-20 text-center">
                <Video className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No videos found</h3>
                <p className="text-white/30 text-sm">
                  {searchQuery ? 'Try a different search term' : 'Be the first to share a video!'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ═══ CTA SECTION ═══ */}
        <section className="px-4 sm:px-6 lg:px-8 pb-24">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden p-12 sm:p-16 text-center"
            >
              {/* CTA background */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent border border-violet-500/20 rounded-3xl" />
              <div className="absolute inset-0 bg-[#030303]/40" />

              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Ready to create your own?
                </h2>
                <p className="text-white/40 text-base mb-8 max-w-md mx-auto">
                  Turn any idea into a cinematic AI video in minutes. No experience needed.
                </p>
                <Button
                  onClick={() => navigate(user ? '/projects' : '/auth?mode=signup')}
                  size="lg"
                  className="h-13 px-8 text-sm font-semibold rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.4)] transition-all duration-300"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {user ? 'Start Creating' : 'Get Started Free'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <VideoPlayerModal
            video={selectedVideo}
            onClose={() => setSelectedVideo(null)}
            isLiked={userLikes?.includes(selectedVideo.id)}
            onLike={(e) => handleLike(e, selectedVideo.id, userLikes?.includes(selectedVideo.id) || false, selectedVideo.user_id)}
            isFollowing={selectedVideo.user_id ? (userFollows?.includes(selectedVideo.user_id) || false) : false}
            onFollow={selectedVideo.user_id ? (e) => handleFollow(e, selectedVideo.user_id!, userFollows?.includes(selectedVideo.user_id!) || false) : undefined}
            isOwnVideo={selectedVideo.user_id === user?.id}
          />
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

/* ═══ Sub-components ═══ */

function PlayOverlay() {
  return (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
      <div className="w-14 h-14 rounded-full bg-white/0 group-hover:bg-white/15 backdrop-blur-md border border-white/0 group-hover:border-white/20 flex items-center justify-center transform scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300">
        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
      </div>
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
  const playableVideoUrl = videoUrl && !videoUrl.endsWith('.json') ? videoUrl : null;
  const clipSrc = firstClipUrl || playableVideoUrl;

  return (
    <div className="w-full h-full bg-white/[0.02]">
      {clipSrc ? (
        <LazyVideoThumbnail
          src={clipSrc}
          posterUrl={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Video className="w-8 h-8 text-white/10" />
        </div>
      )}
    </div>
  );
}

function VideoMeta({ likesCount, createdAt, isLiked, onLike }: { likesCount?: number | null; createdAt: string; isLiked?: boolean; onLike?: (e: React.MouseEvent) => void }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-white/25 font-medium">
      <button
        onClick={onLike}
        className={cn(
          "flex items-center gap-1 transition-colors",
          isLiked ? "text-red-400" : "hover:text-white/50"
        )}
      >
        <Heart className={cn("w-3 h-3", isLiked && "fill-red-400")} />
        {likesCount ?? 0}
      </button>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
}

function CreatorRow({
  creatorName,
  creatorAvatar,
  creatorId,
  isFollowing,
  onFollow,
  isOwnVideo,
}: {
  creatorName?: string | null;
  creatorAvatar?: string | null;
  creatorId: string;
  isFollowing: boolean;
  onFollow: (e: React.MouseEvent) => void;
  isOwnVideo: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        to={`/profile/${creatorId}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
      >
        {creatorAvatar ? (
          <img src={creatorAvatar} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-violet-300">
              {(creatorName || '?')[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-[11px] text-white/40 truncate">{creatorName || 'Creator'}</span>
      </Link>
      {!isOwnVideo && (
        <button
          onClick={onFollow}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all flex-shrink-0",
            isFollowing
              ? "bg-white/[0.06] text-white/40 border border-white/[0.08]"
              : "bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30"
          )}
        >
          {isFollowing ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

function VideoPlayerModal({
  video,
  onClose,
  isLiked,
  onLike,
  isFollowing,
  onFollow,
  isOwnVideo,
}: {
  video: { id: string; title: string; user_id?: string; creator?: { display_name: string | null; avatar_url: string | null } };
  onClose: () => void;
  isLiked?: boolean;
  onLike?: (e: React.MouseEvent) => void;
  isFollowing?: boolean;
  onFollow?: (e: React.MouseEvent) => void;
  isOwnVideo?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white/60 hover:text-white hover:bg-white/10 z-10"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="mb-3 space-y-2">
          <h2 className="text-lg font-semibold text-white">{video.title}</h2>
          {video.user_id && (
            <div className="flex items-center justify-between">
              <Link
                to={`/profile/${video.user_id}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {video.creator?.avatar_url ? (
                  <img src={video.creator.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-violet-300">
                      {(video.creator?.display_name || '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm text-white/50">{video.creator?.display_name || 'Creator'}</span>
              </Link>
              {!isOwnVideo && onFollow && (
                <button
                  onClick={onFollow}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    isFollowing
                      ? "bg-white/[0.06] text-white/40 border border-white/[0.08]"
                      : "bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30"
                  )}
                >
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onLike}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                isLiked
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-white/[0.06] text-white/50 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-red-400")} />
              {isLiked ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                showComments
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/[0.06] text-white/50 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white"
              )}
            >
              <MessageCircle className="w-4 h-4" />
              Comments
            </button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-black aspect-video ring-1 ring-white/[0.06]">
          <UniversalVideoPlayer
            source={{ projectId: video.id }}
            mode="inline"
            autoPlay
            className="w-full h-full"
          />
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 overflow-hidden"
            >
              <VideoCommentsSection projectId={video.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
