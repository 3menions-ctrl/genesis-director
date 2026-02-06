import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface PublicProfileWithStats extends PublicProfile {
  followers_count: number;
  following_count: number;
  videos_count: number;
  is_following: boolean;
}

export interface PublicVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  created_at: string;
  likes_count: number;
}

// Fetch a single public profile by user ID
export function usePublicProfile(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Fetch basic profile from public view
      const { data: profileData, error: profileError } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.debug('[usePublicProfile] Profile error:', profileError.message);
        return null;
      }

      // Fetch followers count
      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      // Fetch following count
      const { count: followingCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      // Fetch public videos count
      const { count: videosCount } = await supabase
        .from('movie_projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_public', true);

      // Check if current user is following this user
      let isFollowing = false;
      if (user && user.id !== userId) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .single();
        isFollowing = !!followData;
      }

      return {
        ...profileData,
        followers_count: followersCount ?? 0,
        following_count: followingCount ?? 0,
        videos_count: videosCount ?? 0,
        is_following: isFollowing,
      } as PublicProfileWithStats;
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch public videos for this user
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['public-videos', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, title, thumbnail_url, video_url, created_at, likes_count')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.debug('[usePublicProfile] Videos error:', error.message);
        return [];
      }

      return data as PublicVideo[];
    },
    enabled: !!userId,
  });

  // Follow mutation
  const followUser = useMutation({
    mutationFn: async () => {
      if (!user || !userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: user.id,
          following_id: userId,
        });

      if (error) throw error;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'follow',
          title: 'New Follower!',
          body: 'Someone started following you',
          data: { follower_id: user.id },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  // Unfollow mutation
  const unfollowUser = useMutation({
    mutationFn: async () => {
      if (!user || !userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  return {
    profile,
    isLoading,
    videos,
    videosLoading,
    followUser,
    unfollowUser,
  };
}

// Discover creators (users with public videos)
export function useCreatorDiscovery(searchQuery?: string) {
  return useQuery({
    queryKey: ['creators', searchQuery],
    queryFn: async () => {
      // First, get unique user_ids who have public videos
      const { data: projectsData, error: projectsError } = await supabase
        .from('movie_projects')
        .select('user_id')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.debug('[useCreatorDiscovery] Projects error:', projectsError.message);
        return [];
      }

      // Count videos per user
      const videoCountMap = new Map<string, number>();
      projectsData?.forEach(project => {
        if (project.user_id) {
          videoCountMap.set(project.user_id, (videoCountMap.get(project.user_id) || 0) + 1);
        }
      });

      const uniqueUserIds = Array.from(videoCountMap.keys());
      if (uniqueUserIds.length === 0) return [];

      // Now fetch profile data for these users from profiles_public view
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .in('id', uniqueUserIds);

      if (profilesError) {
        console.debug('[useCreatorDiscovery] Profiles error:', profilesError.message);
        return [];
      }

      // Build creators list with video counts
      let creators = profilesData?.map(profile => ({
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        video_count: videoCountMap.get(profile.id) || 0,
      })) || [];

      // Filter by search query
      if (searchQuery?.trim()) {
        const query = searchQuery.toLowerCase();
        creators = creators.filter(c => 
          c.display_name?.toLowerCase().includes(query)
        );
      }

      // Sort by video count
      creators.sort((a, b) => b.video_count - a.video_count);

      return creators.slice(0, 50);
    },
    staleTime: 60000, // 1 minute
  });
}

// Feed of videos from followed creators
export function useFollowingFeed() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['following-feed', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get list of users we follow
      const { data: follows, error: followsError } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError || !follows?.length) {
        return [];
      }

      const followingIds = follows.map(f => f.following_id);

      // Get public videos from followed users
      const { data: videos, error: videosError } = await supabase
        .from('movie_projects')
        .select(`
          id,
          title,
          thumbnail_url,
          video_url,
          created_at,
          likes_count,
          user_id
        `)
        .in('user_id', followingIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(30);

      if (videosError) {
        console.debug('[useFollowingFeed] Videos error:', videosError.message);
        return [];
      }

      // Fetch creator profiles separately
      const creatorIds = [...new Set(videos?.map(v => v.user_id).filter(Boolean) || [])];
      
      let profilesMap = new Map<string, PublicProfile>();
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, avatar_url')
          .in('id', creatorIds);
        
        profiles?.forEach(p => {
          profilesMap.set(p.id, p as PublicProfile);
        });
      }

      return videos?.map(v => ({
        ...v,
        creator: profilesMap.get(v.user_id) || { id: v.user_id, display_name: null, avatar_url: null },
      })) || [];
    },
    enabled: !!user,
    staleTime: 30000,
  });
}
