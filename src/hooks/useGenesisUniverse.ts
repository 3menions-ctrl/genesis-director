import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { 
  GenesisLocation, 
  GenesisEra, 
  GenesisVideo, 
  GenesisVideoVote, 
  GenesisLore,
  GenesisEnvironmentTemplate,
  GenesisUniverseRule,
  GenesisLocationRequest
} from '@/types/genesis';

// Fetch all cities (top-level locations)
export function useGenesisCities() {
  return useQuery({
    queryKey: ['genesis-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_locations')
        .select('*')
        .is('parent_location_id', null)
        .eq('location_type', 'city')
        .eq('approval_status', 'approved')
        .order('name');
      
      if (error) throw error;
      return data as unknown as GenesisLocation[];
    },
  });
}

// Fetch landmarks for a specific city
export function useGenesisLandmarks(cityId: string | null) {
  return useQuery({
    queryKey: ['genesis-landmarks', cityId],
    queryFn: async () => {
      if (!cityId) return [];
      
      const { data, error } = await supabase
        .from('genesis_locations')
        .select('*')
        .eq('parent_location_id', cityId)
        .eq('approval_status', 'approved')
        .order('name');
      
      if (error) throw error;
      return data as unknown as GenesisLocation[];
    },
    enabled: !!cityId,
  });
}

// Fetch all locations (hierarchical)
export function useGenesisLocations() {
  return useQuery({
    queryKey: ['genesis-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_locations')
        .select('*')
        .eq('approval_status', 'approved')
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

// Fetch environment templates for a location+era combination
export function useGenesisEnvironmentTemplates(locationId?: string, eraId?: string) {
  return useQuery({
    queryKey: ['genesis-templates', locationId, eraId],
    queryFn: async () => {
      let query = supabase
        .from('genesis_environment_templates')
        .select('*');
      
      if (locationId) {
        query = query.eq('location_id', locationId);
      }
      if (eraId) {
        query = query.eq('era_id', eraId);
      }
      
      const { data, error } = await query.order('is_default', { ascending: false });
      
      if (error) throw error;
      return data as unknown as GenesisEnvironmentTemplate[];
    },
    enabled: !!(locationId || eraId),
  });
}

// Fetch universe rules
export function useGenesisUniverseRules() {
  return useQuery({
    queryKey: ['genesis-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_universe_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority');
      
      if (error) throw error;
      return data as unknown as GenesisUniverseRule[];
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
          genesis_locations!genesis_videos_location_id_fkey(id, name, image_url, location_type, parent_location_id),
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

// Request a new location
export function useRequestLocation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: {
      parentLocationId?: string;
      name: string;
      description?: string;
      locationType: 'city' | 'district' | 'landmark' | 'venue' | 'street';
      reason?: string;
      referenceImages?: string[];
    }) => {
      if (!user) throw new Error('Must be logged in to request locations');
      
      const { data, error } = await supabase
        .from('genesis_location_requests')
        .insert({
          requested_by: user.id,
          parent_location_id: request.parentLocationId,
          name: request.name,
          description: request.description,
          location_type: request.locationType,
          reason: request.reason,
          reference_images: request.referenceImages,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genesis-location-requests'] });
      toast.success('Location request submitted! An admin will review it.');
    },
    onError: (error) => {
      toast.error('Failed to submit request: ' + error.message);
    },
  });
}

// Fetch user's location requests
export function useMyLocationRequests() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['genesis-location-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('genesis_location_requests')
        .select('*')
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as GenesisLocationRequest[];
    },
    enabled: !!user,
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
      const [cities, landmarks, eras, videos, canonVideos] = await Promise.all([
        supabase.from('genesis_locations').select('id', { count: 'exact', head: true }).is('parent_location_id', null),
        supabase.from('genesis_locations').select('id', { count: 'exact', head: true }).not('parent_location_id', 'is', null),
        supabase.from('genesis_eras').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_videos').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_videos').select('id', { count: 'exact', head: true }).eq('canon_status', 'canon'),
      ]);
      
      return {
        totalCities: cities.count || 0,
        totalLandmarks: landmarks.count || 0,
        totalEras: eras.count || 0,
        totalVideos: videos.count || 0,
        canonVideos: canonVideos.count || 0,
      };
    },
  });
}

// Get environment template for video generation
export function useGetEnvironmentPrompt(locationId?: string, eraId?: string) {
  return useQuery({
    queryKey: ['genesis-environment-prompt', locationId, eraId],
    queryFn: async () => {
      if (!locationId) return null;
      
      // Get location data
      const { data: location, error: locError } = await supabase
        .from('genesis_locations')
        .select('*')
        .eq('id', locationId)
        .single();
      
      if (locError) throw locError;
      
      // Get environment template if era specified
      let template: GenesisEnvironmentTemplate | null = null;
      if (eraId) {
        const { data: templateData } = await supabase
          .from('genesis_environment_templates')
          .select('*')
          .eq('location_id', locationId)
          .eq('era_id', eraId)
          .eq('is_default', true)
          .maybeSingle();
        
        template = templateData as unknown as GenesisEnvironmentTemplate;
      }
      
      // Build prompt modifiers from location and template
      const promptParts: string[] = [];
      
      if (template?.prompt_prefix) {
        promptParts.push(template.prompt_prefix);
      } else if ((location as any)?.prompt_modifiers) {
        promptParts.push(...((location as any).prompt_modifiers as string[]));
      }
      
      return {
        location: location as unknown as GenesisLocation,
        template,
        promptPrefix: promptParts.join(', '),
        promptSuffix: template?.prompt_suffix || '',
        atmosphere: template?.atmosphere || '',
      };
    },
    enabled: !!locationId,
  });
}
