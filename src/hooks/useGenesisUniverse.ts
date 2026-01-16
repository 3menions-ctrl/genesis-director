import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { GenesisLocation, GenesisEra, GenesisVideo, GenesisVideoVote, GenesisLore } from '@/types/genesis';

// Fetch all locations
export function useGenesisLocations() {
  return useQuery({
    queryKey: ['genesis-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as unknown as GenesisLocation[];
    },
  });
}

// Fetch all eras
export function useGenesisEras() {
  return useQuery({
    queryKey: ['genesis-eras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_eras')
        .select('*')
        .order('era_order');
      
      if (error) throw error;
      return data as unknown as GenesisEra[];
    },
  });
}

// Fetch videos with filters
export function useGenesisVideos(filters?: {
  locationId?: string;
  eraId?: string;
  canonStatus?: string;
  sortBy?: 'recent' | 'votes' | 'canon';
}) {
  return useQuery({
    queryKey: ['genesis-videos', filters],
    queryFn: async () => {
      let query = supabase
        .from('genesis_videos')
        .select(`
          *,
          genesis_locations!genesis_videos_location_id_fkey(id, name, image_url, location_type),
          genesis_eras!genesis_videos_era_id_fkey(id, name, era_order)
        `);
      
      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId);
      }
      if (filters?.eraId) {
        query = query.eq('era_id', filters.eraId);
      }
      if (filters?.canonStatus) {
        query = query.eq('canon_status', filters.canonStatus);
      }
      
      // Sorting
      switch (filters?.sortBy) {
        case 'votes':
          query = query.order('vote_score', { ascending: false });
          break;
        case 'canon':
          query = query.order('canon_at', { ascending: false, nullsFirst: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      
      // Transform joined data
      return (data as any[]).map(v => ({
        ...v,
        location: v.genesis_locations,
        era: v.genesis_eras,
      })) as GenesisVideo[];
    },
  });
}

// Get user's vote for a video
export function useUserVideoVote(videoId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['genesis-vote', videoId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('genesis_video_votes')
        .select('*')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as GenesisVideoVote | null;
    },
    enabled: !!user && !!videoId,
  });
}

// Vote on a video
export function useVoteOnVideo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ videoId, voteType }: { videoId: string; voteType: 'up' | 'down' | null }) => {
      if (!user) throw new Error('Must be logged in to vote');
      
      // If voteType is null, remove the vote
      if (voteType === null) {
        const { error } = await supabase
          .from('genesis_video_votes')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);
        
        if (error) throw error;
        return null;
      }
      
      // Upsert the vote
      const { data, error } = await supabase
        .from('genesis_video_votes')
        .upsert({
          video_id: videoId,
          user_id: user.id,
          vote_type: voteType,
        }, {
          onConflict: 'video_id,user_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: ['genesis-videos'] });
      queryClient.invalidateQueries({ queryKey: ['genesis-vote', videoId] });
    },
  });
}

// Submit video to Genesis Universe
export function useSubmitToGenesis() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (video: {
      projectId: string;
      title: string;
      description?: string;
      locationId?: string;
      eraId?: string;
      thumbnailUrl?: string;
      videoUrl?: string;
      tags?: string[];
    }) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('genesis_videos')
        .insert({
          project_id: video.projectId,
          user_id: user.id,
          title: video.title,
          description: video.description,
          location_id: video.locationId,
          era_id: video.eraId,
          thumbnail_url: video.thumbnailUrl,
          video_url: video.videoUrl,
          tags: video.tags,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genesis-videos'] });
      toast.success('Video submitted to Genesis Universe!');
    },
    onError: (error) => {
      toast.error('Failed to submit: ' + error.message);
    },
  });
}

// Fetch lore entries
export function useGenesisLore(filters?: {
  locationId?: string;
  eraId?: string;
  loreType?: string;
}) {
  return useQuery({
    queryKey: ['genesis-lore', filters],
    queryFn: async () => {
      let query = supabase
        .from('genesis_lore')
        .select('*');
      
      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId);
      }
      if (filters?.eraId) {
        query = query.eq('era_id', filters.eraId);
      }
      if (filters?.loreType) {
        query = query.eq('lore_type', filters.loreType);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as GenesisLore[];
    },
  });
}

// Universe statistics
export function useGenesisStats() {
  return useQuery({
    queryKey: ['genesis-stats'],
    queryFn: async () => {
      const [locations, eras, videos, canonVideos] = await Promise.all([
        supabase.from('genesis_locations').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_eras').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_videos').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_videos').select('id', { count: 'exact', head: true }).eq('canon_status', 'canon'),
      ]);
      
      return {
        totalLocations: locations.count || 0,
        totalEras: eras.count || 0,
        totalVideos: videos.count || 0,
        canonVideos: canonVideos.count || 0,
      };
    },
  });
}
