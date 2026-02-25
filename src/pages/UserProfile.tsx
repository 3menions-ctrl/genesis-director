import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyVideoThumbnail } from '@/components/ui/LazyVideoThumbnail';
import { MessageUserButton } from '@/components/social/DirectMessagePanel';
import { UniversalVideoPlayer } from '@/components/player';
import { 
  UserPlus, UserMinus, Video, Users, Heart, 
  Play, ArrowLeft, ExternalLink, X, Eye, Calendar,
  Sparkles, Crown, Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ProfileBackground from '@/components/profile/ProfileBackground';

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { profile, isLoading, videos, videosLoading, followUser, unfollowUser } = usePublicProfile(userId);
  const [selectedVideoProject, setSelectedVideoProject] = useState<{ id: string; title: string } | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  const isOwnProfile = user?.id === userId;

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow creators');
      return;
    }
    try {
      if (profile?.is_following) {
        await unfollowUser.mutateAsync();
        toast.success('Unfollowed');
      } else {
        await followUser.mutateAsync();
        toast.success('Following!');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303]">
        <ProfileBackground />
        <AppHeader />
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
          {/* Hero skeleton */}
          <div className="relative rounded-3xl overflow-hidden">
            <Skeleton className="h-[320px] rounded-3xl bg-white/[0.03]" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#030303]">
        <ProfileBackground />
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-white/20" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 font-['Sora']">Creator Not Found</h1>
          <p className="text-white/40 mb-8 max-w-sm mx-auto">This profile doesn't exist or hasn't been made public yet.</p>
          <Link to="/creators">
            <Button variant="outline" className="gap-2 border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]">
              <ArrowLeft className="w-4 h-4" />
              Browse Creators
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || 'Anonymous Creator';
  const initials = displayName.charAt(0).toUpperCase();
  const memberSince = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <ProfileBackground />
      <AppHeader />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ═══════════════════════════════════════════════════════════
            CINEMATIC HERO CARD
        ═══════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[32px] overflow-hidden"
        >
          {/* Glass surface */}
          <div className="relative backdrop-blur-2xl bg-white/[0.025] border border-white/[0.06] rounded-[32px] p-8 sm:p-10">
            {/* Ambient glow orbs */}
            <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-violet-500/[0.06] blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-fuchsia-500/[0.04] blur-[80px] pointer-events-none" />
            {/* Top accent line */}
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

            <div className="relative flex flex-col sm:flex-row items-center gap-8">
              {/* Avatar with ring */}
              <div className="relative group shrink-0">
                <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-violet-500/50 to-fuchsia-500/50 blur-md opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                <Avatar className="relative w-28 h-28 sm:w-32 sm:h-32 ring-[3px] ring-white/10 shadow-2xl">
                  <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator */}
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-[3px] border-[#030303] shadow-lg" />
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white font-['Sora'] tracking-tight truncate">
                    {displayName}
                  </h1>
                  {profile.videos_count > 10 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20">
                      <Crown className="w-3 h-3 text-violet-400" />
                      <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">Pro</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-white/30 mb-5 flex items-center justify-center sm:justify-start gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {memberSince}
                </p>

                {/* Stats pills */}
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-6">
                  {[
                    { icon: Film, value: profile.videos_count, label: 'videos' },
                    { icon: Users, value: profile.followers_count, label: 'followers' },
                    { icon: Heart, value: profile.following_count, label: 'following' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <stat.icon className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-sm font-bold text-white">{stat.value}</span>
                      <span className="text-xs text-white/30 hidden sm:inline">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  {!isOwnProfile && (
                    <>
                      <Button
                        onClick={handleFollow}
                        disabled={followUser.isPending || unfollowUser.isPending}
                        className={cn(
                          "gap-2 rounded-xl h-10 px-6 font-semibold text-sm transition-all duration-300",
                          profile.is_following
                            ? "bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/[0.1]"
                            : "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-[0_0_24px_rgba(124,58,237,0.25)]"
                        )}
                      >
                        {profile.is_following ? (
                          <><UserMinus className="w-4 h-4" /> Following</>
                        ) : (
                          <><UserPlus className="w-4 h-4" /> Follow</>
                        )}
                      </Button>
                      <MessageUserButton 
                        userId={userId!}
                        userName={profile.display_name || undefined}
                        userAvatar={profile.avatar_url || undefined}
                      />
                    </>
                  )}
                  {isOwnProfile && (
                    <Link to="/profile">
                      <Button className="gap-2 rounded-xl h-10 px-6 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/[0.08]">
                        <ExternalLink className="w-4 h-4" />
                        Edit Profile
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════════════════════════════════════════════════════════
            VIDEO SHOWCASE GRID
        ═══════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Video className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-['Sora']">Showcase</h2>
                <p className="text-xs text-white/30">{profile.videos_count} public video{profile.videos_count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {videosLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="sync">
                {videos.map((video, index) => {
                  const playableUrl = (video as any).playable_url || (video as any).first_clip_url || video.video_url;
                  const isHovered = hoveredVideo === video.id;

                  return (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.04, duration: 0.4 }}
                      className={cn(
                        "group relative aspect-video rounded-2xl overflow-hidden",
                        "bg-white/[0.02] border border-white/[0.06]",
                        "hover:border-violet-500/20 transition-all duration-500",
                        playableUrl ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                      )}
                      onClick={() => playableUrl && setSelectedVideoProject({ id: video.id, title: video.title })}
                      onMouseEnter={() => setHoveredVideo(video.id)}
                      onMouseLeave={() => setHoveredVideo(null)}
                    >
                      {/* Thumbnail */}
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (video as any).first_clip_url ? (
                        <LazyVideoThumbnail 
                          src={(video as any).first_clip_url!} 
                          posterUrl={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : video.video_url ? (
                        <LazyVideoThumbnail 
                          src={video.video_url} 
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/[0.03] flex items-center justify-center">
                          <Video className="w-8 h-8 text-white/10" />
                        </div>
                      )}

                      {/* Always-visible bottom gradient with title */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12 pb-3 px-4">
                        <p className="text-white text-sm font-semibold truncate">{video.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-white/40 text-xs">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {video.likes_count}
                          </span>
                        </div>
                      </div>

                      {/* Hover play button */}
                      {playableUrl && (
                        <div className={cn(
                          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                          isHovered ? "opacity-100" : "opacity-0"
                        )}>
                          <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-110">
                            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Hover glow */}
                      <div className={cn(
                        "absolute inset-0 pointer-events-none transition-opacity duration-500",
                        isHovered ? "opacity-100" : "opacity-0"
                      )}>
                        <div className="absolute inset-0 ring-1 ring-inset ring-violet-500/20 rounded-2xl" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Film className="w-7 h-7 text-white/15" />
              </div>
              <p className="text-white/40 text-sm mb-1">No public videos yet</p>
              <p className="text-white/20 text-xs">This creator hasn't shared any videos publicly.</p>
            </div>
          )}
        </motion.section>

        {/* Back link */}
        <div className="text-center pb-8">
          <Link 
            to="/creators" 
            className="text-xs text-white/20 hover:text-white/40 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" />
            Browse all creators
          </Link>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════
          FULLSCREEN VIDEO MODAL
      ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedVideoProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-sm"
            onClick={() => setSelectedVideoProject(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative max-w-5xl w-full aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-white/[0.06] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <UniversalVideoPlayer
                source={{ projectId: selectedVideoProject.id }}
                mode="inline"
                autoPlay
                className="w-full h-full"
              />
              <button
                onClick={() => setSelectedVideoProject(null)}
                className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute top-4 left-4 z-40">
                <p className="text-white/80 text-sm font-medium bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/[0.06]">
                  {selectedVideoProject.title}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
