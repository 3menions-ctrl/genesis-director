import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { UniversalVideoPlayer } from '@/components/player';
import {
  Search, Play, Heart, Sparkles, Clock, X, ArrowRight, Video, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Creators() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: discoverVideos, isLoading } = useQuery({
    queryKey: ['discover-videos', debouncedQuery],
    queryFn: async () => {
      let query = supabase
        .from('movie_projects')
        .select('id, title, thumbnail_url, video_url, video_clips, likes_count, created_at, user_id')
        .eq('is_public', true)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60);

      if (debouncedQuery?.trim()) {
        query = query.ilike('title', `%${debouncedQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) return [];
      const projects = data || [];

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

        return projects.map(p => {
          let clipUrl = clipMap.get(p.id) || null;
          if (!clipUrl && p.video_clips && Array.isArray(p.video_clips) && p.video_clips.length > 0) {
            const firstMp4 = (p.video_clips as string[]).find((u: string) => u.includes('.mp4'));
            if (firstMp4) clipUrl = firstMp4;
          }
          return { ...p, first_clip_url: clipUrl };
        });
      }

      return projects.map(p => {
        let clipUrl: string | null = null;
        if (p.video_clips && Array.isArray(p.video_clips) && p.video_clips.length > 0) {
          const firstMp4 = (p.video_clips as string[]).find((u: string) => u.includes('.mp4'));
          if (firstMp4) clipUrl = firstMp4;
        }
        return { ...p, first_clip_url: clipUrl };
      });
    },
    staleTime: 60000,
  });

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => setDebouncedQuery(value), 300);
    return () => clearTimeout(timeoutId);
  }, []);

  const totalVideos = discoverVideos?.length || 0;

  // Split videos: first 3 are "featured", rest in grid
  const featuredVideos = discoverVideos?.slice(0, 3) || [];
  const gridVideos = discoverVideos?.slice(3) || [];

  return (
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
                  onClick={() => setSelectedVideo({ id: featuredVideos[0].id, title: featuredVideos[0].title })}
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
                      <VideoMeta likesCount={featuredVideos[0].likes_count} createdAt={featuredVideos[0].created_at} />
                    </div>
                    <PlayOverlay />
                  </div>
                </div>

                {/* Two smaller featured cards */}
                {featuredVideos.slice(1, 3).map((video, i) => (
                  <div
                    key={video.id}
                    className="group relative rounded-3xl overflow-hidden cursor-pointer bg-white/[0.02] border border-white/[0.06]"
                    onClick={() => setSelectedVideo({ id: video.id, title: video.title })}
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
                        <VideoMeta likesCount={video.likes_count} createdAt={video.created_at} />
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
                    className="group rounded-2xl overflow-hidden cursor-pointer bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all duration-300"
                    onClick={() => setSelectedVideo({ id: video.id, title: video.title })}
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
                      <VideoMeta likesCount={video.likes_count} createdAt={video.created_at} />
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
          />
        )}
      </AnimatePresence>
    </div>
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
        <div className="w-full h-full flex items-center justify-center">
          <Video className="w-8 h-8 text-white/10" />
        </div>
      )}
    </div>
  );
}

function VideoMeta({ likesCount, createdAt }: { likesCount?: number | null; createdAt: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-white/25 font-medium">
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

function VideoPlayerModal({
  video,
  onClose
}: {
  video: { id: string; title: string };
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
