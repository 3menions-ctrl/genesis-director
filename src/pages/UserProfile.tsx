import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { 
  UserPlus, UserMinus, Video, Users, Heart, 
  Play, ArrowLeft, ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ProfileBackground from '@/components/profile/ProfileBackground';

const glassCard = "backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { profile, isLoading, videos, videosLoading, followUser, unfollowUser } = usePublicProfile(userId);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

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
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-48 rounded-3xl bg-white/[0.03]" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-xl bg-white/[0.03]" />
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
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">User Not Found</h1>
          <p className="text-white/60 mb-6">This profile doesn't exist or is private.</p>
          <Link to="/creators">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Browse Creators
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <ProfileBackground />
      <AppHeader />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Profile Header */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-3xl p-6 sm:p-8", glassCard)}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32 ring-4 ring-white/10">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-400">
                {(profile.display_name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {profile.display_name || 'Anonymous Creator'}
              </h1>

              {/* Stats */}
              <div className="flex items-center justify-center sm:justify-start gap-6 text-sm text-white/60 mb-4">
                <div className="flex items-center gap-1.5">
                  <Video className="w-4 h-4" />
                  <span><strong className="text-white">{profile.videos_count}</strong> videos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span><strong className="text-white">{profile.followers_count}</strong> followers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4" />
                  <span><strong className="text-white">{profile.following_count}</strong> following</span>
                </div>
              </div>

              {/* Actions */}
              {!isOwnProfile && (
                <Button
                  onClick={handleFollow}
                  disabled={followUser.isPending || unfollowUser.isPending}
                  variant={profile.is_following ? "outline" : "default"}
                  className={cn(
                    "gap-2",
                    !profile.is_following && "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  {profile.is_following ? (
                    <>
                      <UserMinus className="w-4 h-4" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </Button>
              )}

              {isOwnProfile && (
                <Link to="/profile">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Edit Profile
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </motion.section>

        {/* Videos Grid */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-400" />
            Public Videos
          </h2>

          {videosLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-xl bg-white/[0.03]" />
              ))}
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {videos.map((video, index) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group relative aspect-video rounded-xl overflow-hidden cursor-pointer",
                      glassCard
                    )}
                    onClick={() => setSelectedVideo(video.video_url)}
                  >
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
                        <Video className="w-8 h-8 text-white/20" />
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-medium truncate">{video.title}</p>
                        <div className="flex items-center gap-2 text-white/60 text-xs mt-1">
                          <Heart className="w-3 h-3" />
                          <span>{video.likes_count}</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className={cn("rounded-2xl p-12 text-center", glassCard)}>
              <Video className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No public videos yet</p>
            </div>
          )}
        </section>
      </main>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl w-full aspect-video rounded-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <video
                src={selectedVideo}
                controls
                autoPlay
                className="w-full h-full object-contain bg-black"
              />
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
