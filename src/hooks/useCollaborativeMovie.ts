import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  GenesisScreenplay,
  GenesisScene,
  GenesisPresetCharacter,
  GenesisCharacterCasting,
  GenesisSceneClip,
  CollaborativeMovieStats
} from '@/types/collaborative-movie';

// Fetch the main screenplay
export function useGenesisScreenplay() {
  return useQuery({
    queryKey: ['genesis-screenplay'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_screenplay')
        .select('*')
        .eq('status', 'casting')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as GenesisScreenplay | null;
    }
  });
}

// Fetch all preset characters
export function useGenesisPresetCharacters(screenplayId?: string) {
  return useQuery({
    queryKey: ['genesis-preset-characters', screenplayId],
    queryFn: async () => {
      if (!screenplayId) return [];
      
      const { data, error } = await supabase
        .from('genesis_preset_characters')
        .select(`
          *,
          casting:genesis_character_castings(
            id,
            user_id,
            face_image_url,
            status,
            created_at
          )
        `)
        .eq('screenplay_id', screenplayId)
        .order('role_type', { ascending: true })
        .order('total_scenes', { ascending: false });
      
      if (error) throw error;
      
      // Transform to include only approved or user's own casting
      return (data || []).map(char => ({
        ...char,
        casting: char.casting?.find((c: any) => c.status === 'approved') || char.casting?.[0] || null
      })) as GenesisPresetCharacter[];
    },
    enabled: !!screenplayId
  });
}

// Fetch scenes with characters
export function useGenesisScenes(screenplayId?: string, actNumber?: number) {
  return useQuery({
    queryKey: ['genesis-scenes', screenplayId, actNumber],
    queryFn: async () => {
      if (!screenplayId) return [];
      
      let query = supabase
        .from('genesis_scenes')
        .select(`
          *,
          location:genesis_locations(name),
          era:genesis_eras(name),
          characters:genesis_scene_characters(
            *,
            character:genesis_preset_characters(id, name, role_type, is_cast, reference_image_url)
          )
        `)
        .eq('screenplay_id', screenplayId)
        .order('scene_number', { ascending: true });
      
      if (actNumber) {
        query = query.eq('act_number', actNumber);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as GenesisScene[];
    },
    enabled: !!screenplayId
  });
}

// Fetch user's castings
export function useUserCastings() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-castings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('genesis_character_castings')
        .select(`
          *,
          character:genesis_preset_characters(*)
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as (GenesisCharacterCasting & { character: GenesisPresetCharacter | null })[];
    },
    enabled: !!user?.id
  });
}

// Submit casting for a character
export function useSubmitCasting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ characterId, faceImageFile }: { characterId: string; faceImageFile: File }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      // Upload image to storage
      const fileExt = faceImageFile.name.split('.').pop();
      const fileName = `${user.id}/${characterId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('genesis-castings')
        .upload(fileName, faceImageFile);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('genesis-castings')
        .getPublicUrl(fileName);
      
      // Create casting record with consent
      const { data, error } = await supabase
        .from('genesis_character_castings')
        .insert({
          character_id: characterId,
          user_id: user.id,
          face_image_url: publicUrl,
          status: 'pending',
          image_consent_given: true,
          consent_given_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genesis-preset-characters'] });
      queryClient.invalidateQueries({ queryKey: ['user-castings'] });
      queryClient.invalidateQueries({ queryKey: ['collaborative-movie-stats'] });
      toast.success('Casting submitted! Awaiting approval.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit casting');
    }
  });
}

// Submit a scene clip
export function useSubmitSceneClip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      sceneId, 
      videoUrl, 
      thumbnailUrl,
      projectId,
      durationSeconds 
    }: { 
      sceneId: string; 
      videoUrl: string;
      thumbnailUrl?: string;
      projectId?: string;
      durationSeconds?: number;
    }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('genesis_scene_clips')
        .insert({
          scene_id: sceneId,
          submitted_by: user.id,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          project_id: projectId,
          duration_seconds: durationSeconds || 32,
          status: 'submitted'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genesis-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['scene-clips'] });
      queryClient.invalidateQueries({ queryKey: ['collaborative-movie-stats'] });
      toast.success('Scene clip submitted for review!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit clip');
    }
  });
}

// Get clips for a scene
export function useSceneClips(sceneId?: string) {
  return useQuery({
    queryKey: ['scene-clips', sceneId],
    queryFn: async () => {
      if (!sceneId) return [];
      
      const { data, error } = await supabase
        .from('genesis_scene_clips')
        .select('*')
        .eq('scene_id', sceneId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GenesisSceneClip[];
    },
    enabled: !!sceneId
  });
}

// Get collaborative movie stats
export function useCollaborativeMovieStats(screenplayId?: string) {
  return useQuery({
    queryKey: ['collaborative-movie-stats', screenplayId],
    queryFn: async (): Promise<CollaborativeMovieStats> => {
      if (!screenplayId) {
        return {
          totalCharacters: 0,
          castCharacters: 0,
          totalScenes: 0,
          readyScenes: 0,
          submittedClips: 0,
          approvedClips: 0,
          castingProgress: 0,
          filmingProgress: 0
        };
      }
      
      // Get character stats
      const { data: characters } = await supabase
        .from('genesis_preset_characters')
        .select('id, is_cast')
        .eq('screenplay_id', screenplayId);
      
      const totalCharacters = characters?.length || 0;
      const castCharacters = characters?.filter(c => c.is_cast).length || 0;
      
      // Get scene stats
      const { data: scenes } = await supabase
        .from('genesis_scenes')
        .select('id, status')
        .eq('screenplay_id', screenplayId);
      
      const totalScenes = scenes?.length || 0;
      const readyScenes = scenes?.filter(s => ['ready', 'filming', 'submitted', 'approved'].includes(s.status)).length || 0;
      
      // Get clip stats
      const { data: clips } = await supabase
        .from('genesis_scene_clips')
        .select('id, status, scene_id')
        .in('scene_id', scenes?.map(s => s.id) || []);
      
      const submittedClips = clips?.length || 0;
      const approvedClips = clips?.filter(c => c.status === 'approved' || c.status === 'selected').length || 0;
      
      return {
        totalCharacters,
        castCharacters,
        totalScenes,
        readyScenes,
        submittedClips,
        approvedClips,
        castingProgress: totalCharacters > 0 ? Math.round((castCharacters / totalCharacters) * 100) : 0,
        filmingProgress: totalScenes > 0 ? Math.round((approvedClips / totalScenes) * 100) : 0
      };
    },
    enabled: !!screenplayId
  });
}

// Check if user can cast a character
export function useCanCastCharacter(characterId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['can-cast-character', characterId, user?.id],
    queryFn: async () => {
      if (!characterId || !user?.id) return { canCast: false, reason: 'Not logged in' };
      
      // Check if character is already cast
      const { data: character } = await supabase
        .from('genesis_preset_characters')
        .select('is_cast, cast_by')
        .eq('id', characterId)
        .single();
      
      if (character?.is_cast && character?.cast_by !== user.id) {
        return { canCast: false, reason: 'Character already cast by another user' };
      }
      
      // Check if user already has a pending casting for this character
      const { data: existingCasting } = await supabase
        .from('genesis_character_castings')
        .select('id, status')
        .eq('character_id', characterId)
        .eq('user_id', user.id)
        .single();
      
      if (existingCasting) {
        if (existingCasting.status === 'pending') {
          return { canCast: false, reason: 'You already have a pending casting' };
        }
        if (existingCasting.status === 'approved') {
          return { canCast: false, reason: 'You are already cast as this character' };
        }
      }
      
      return { canCast: true, reason: null };
    },
    enabled: !!characterId && !!user?.id
  });
}
