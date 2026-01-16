import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  GenesisStoryArc,
  GenesisStoryConnection,
  GenesisCharacterAppearance,
  GenesisCharacterInteraction,
  GenesisContinuityAnchor,
} from '@/types/genesis';

// Fetch all story arcs
export function useGenesisStoryArcs(filters?: {
  status?: string;
  arcType?: string;
  eraId?: string;
}) {
  return useQuery({
    queryKey: ['genesis-story-arcs', filters],
    queryFn: async () => {
      let query = supabase
        .from('genesis_story_arcs')
        .select(`
          *,
          genesis_eras!genesis_story_arcs_era_id_fkey(id, name),
          genesis_locations!genesis_story_arcs_location_id_fkey(id, name)
        `);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.arcType) {
        query = query.eq('arc_type', filters.arcType);
      }
      if (filters?.eraId) {
        query = query.eq('era_id', filters.eraId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data as any[]).map(arc => ({
        ...arc,
        era: arc.genesis_eras,
        location: arc.genesis_locations,
      })) as GenesisStoryArc[];
    },
  });
}

// Fetch a single story arc with its connections
export function useGenesisStoryArc(arcId: string | undefined) {
  return useQuery({
    queryKey: ['genesis-story-arc', arcId],
    queryFn: async () => {
      if (!arcId) return null;

      const { data, error } = await supabase
        .from('genesis_story_arcs')
        .select(`
          *,
          genesis_eras!genesis_story_arcs_era_id_fkey(id, name),
          genesis_locations!genesis_story_arcs_location_id_fkey(id, name)
        `)
        .eq('id', arcId)
        .single();

      if (error) throw error;

      // Fetch connections separately
      const { data: connections } = await supabase
        .from('genesis_story_connections')
        .select(`
          *,
          genesis_videos!genesis_story_connections_video_id_fkey(id, title, thumbnail_url, canon_status)
        `)
        .eq('arc_id', arcId)
        .order('sequence_order', { ascending: true });

      return {
        ...data,
        era: (data as any).genesis_eras,
        location: (data as any).genesis_locations,
        connections: (connections as any[])?.map(c => ({
          ...c,
          video: c.genesis_videos,
        })) || [],
      } as GenesisStoryArc;
    },
    enabled: !!arcId,
  });
}

// Create a new story arc
export function useCreateStoryArc() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (arc: {
      title: string;
      description?: string;
      arcType: 'main' | 'side' | 'character' | 'event';
      eraId?: string;
      locationId?: string;
      synopsis?: string;
      themes?: string[];
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('genesis_story_arcs')
        .insert({
          title: arc.title,
          description: arc.description,
          arc_type: arc.arcType,
          era_id: arc.eraId,
          location_id: arc.locationId,
          synopsis: arc.synopsis,
          themes: arc.themes,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genesis-story-arcs'] });
      toast.success('Story arc created!');
    },
    onError: (error) => {
      toast.error('Failed to create arc: ' + error.message);
    },
  });
}

// Connect a video to a story arc
export function useConnectVideoToArc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connection: {
      arcId: string;
      videoId: string;
      connectionType: GenesisStoryConnection['connection_type'];
      chapterNumber?: number;
      narrativeNotes?: string;
    }) => {
      // Get current max sequence order
      const { data: existing } = await supabase
        .from('genesis_story_connections')
        .select('sequence_order')
        .eq('arc_id', connection.arcId)
        .order('sequence_order', { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sequence_order || 0) + 1;

      const { data, error } = await supabase
        .from('genesis_story_connections')
        .insert({
          arc_id: connection.arcId,
          video_id: connection.videoId,
          connection_type: connection.connectionType,
          chapter_number: connection.chapterNumber,
          sequence_order: nextOrder,
          narrative_notes: connection.narrativeNotes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { arcId }) => {
      queryClient.invalidateQueries({ queryKey: ['genesis-story-arc', arcId] });
      queryClient.invalidateQueries({ queryKey: ['genesis-story-arcs'] });
      toast.success('Video connected to story arc!');
    },
    onError: (error) => {
      toast.error('Failed to connect: ' + error.message);
    },
  });
}

// Fetch character appearances for a video
export function useCharacterAppearances(videoId: string | undefined) {
  return useQuery({
    queryKey: ['genesis-character-appearances', videoId],
    queryFn: async () => {
      if (!videoId) return [];

      const { data, error } = await supabase
        .from('genesis_character_appearances')
        .select('*')
        .eq('video_id', videoId)
        .order('role_type');

      if (error) throw error;
      return data as unknown as GenesisCharacterAppearance[];
    },
    enabled: !!videoId,
  });
}

// Add character appearance to a video
export function useAddCharacterAppearance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appearance: {
      videoId: string;
      characterName: string;
      characterId?: string;
      roleType: GenesisCharacterAppearance['role_type'];
      firstAppearance?: boolean;
      description?: string;
      outfitDescription?: string;
      emotionalState?: string;
    }) => {
      const { data, error } = await supabase
        .from('genesis_character_appearances')
        .insert({
          video_id: appearance.videoId,
          character_name: appearance.characterName,
          character_id: appearance.characterId,
          role_type: appearance.roleType,
          first_appearance_video: appearance.firstAppearance || false,
          description: appearance.description,
          outfit_description: appearance.outfitDescription,
          emotional_state: appearance.emotionalState,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: ['genesis-character-appearances', videoId] });
      toast.success('Character added to video!');
    },
  });
}

// Fetch character interactions for a video
export function useCharacterInteractions(videoId: string | undefined) {
  return useQuery({
    queryKey: ['genesis-character-interactions', videoId],
    queryFn: async () => {
      if (!videoId) return [];

      const { data, error } = await supabase
        .from('genesis_character_interactions')
        .select('*')
        .eq('video_id', videoId);

      if (error) throw error;
      return data as unknown as GenesisCharacterInteraction[];
    },
    enabled: !!videoId,
  });
}

// Add character interaction
export function useAddCharacterInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interaction: {
      videoId: string;
      character1Name: string;
      character1Id?: string;
      character2Name: string;
      character2Id?: string;
      interactionType: GenesisCharacterInteraction['interaction_type'];
      interactionOutcome?: GenesisCharacterInteraction['interaction_outcome'];
      description?: string;
      isFirstMeeting?: boolean;
      changesRelationship?: boolean;
      newRelationshipStatus?: string;
    }) => {
      const { data, error } = await supabase
        .from('genesis_character_interactions')
        .insert({
          video_id: interaction.videoId,
          character_1_name: interaction.character1Name,
          character_1_id: interaction.character1Id,
          character_2_name: interaction.character2Name,
          character_2_id: interaction.character2Id,
          interaction_type: interaction.interactionType,
          interaction_outcome: interaction.interactionOutcome,
          description: interaction.description,
          is_first_meeting: interaction.isFirstMeeting || false,
          changes_relationship: interaction.changesRelationship || false,
          new_relationship_status: interaction.newRelationshipStatus,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { videoId }) => {
      queryClient.invalidateQueries({ queryKey: ['genesis-character-interactions', videoId] });
      toast.success('Character interaction recorded!');
    },
  });
}

// Fetch continuity anchors
export function useContinuityAnchors(filters?: {
  anchorType?: string;
  isCanon?: boolean;
}) {
  return useQuery({
    queryKey: ['genesis-continuity-anchors', filters],
    queryFn: async () => {
      let query = supabase
        .from('genesis_continuity_anchors')
        .select(`
          *,
          genesis_eras!genesis_continuity_anchors_era_id_fkey(id, name),
          genesis_locations!genesis_continuity_anchors_location_id_fkey(id, name)
        `);

      if (filters?.anchorType) {
        query = query.eq('anchor_type', filters.anchorType);
      }
      if (filters?.isCanon !== undefined) {
        query = query.eq('is_canon', filters.isCanon);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data as any[]).map(anchor => ({
        ...anchor,
        era: anchor.genesis_eras,
        location: anchor.genesis_locations,
      })) as GenesisContinuityAnchor[];
    },
  });
}

// Propose a continuity anchor
export function useProposeAnchor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (anchor: {
      anchorType: GenesisContinuityAnchor['anchor_type'];
      title: string;
      description: string;
      dateInUniverse?: string;
      eraId?: string;
      locationId?: string;
      affectedCharacters?: string[];
      sourceVideoId?: string;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('genesis_continuity_anchors')
        .insert({
          anchor_type: anchor.anchorType,
          title: anchor.title,
          description: anchor.description,
          date_in_universe: anchor.dateInUniverse,
          era_id: anchor.eraId,
          location_id: anchor.locationId,
          affected_characters: anchor.affectedCharacters,
          source_video_id: anchor.sourceVideoId,
          established_by: user.id,
          is_immutable: false, // User-proposed anchors are not immutable by default
          is_canon: false, // Requires community approval
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genesis-continuity-anchors'] });
      toast.success('Continuity anchor proposed! The community will vote on it.');
    },
    onError: (error) => {
      toast.error('Failed to propose anchor: ' + error.message);
    },
  });
}

// Get all characters that have appeared in the Genesis Universe
export function useGenesisCharacters() {
  return useQuery({
    queryKey: ['genesis-characters-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genesis_character_appearances')
        .select('character_name, character_id, role_type, first_appearance_video')
        .order('character_name');

      if (error) throw error;

      // Deduplicate by character name
      const characterMap = new Map<string, {
        name: string;
        id: string | null;
        appearances: number;
        isProtagonist: boolean;
      }>();

      (data as any[]).forEach(app => {
        const existing = characterMap.get(app.character_name);
        if (existing) {
          existing.appearances++;
          if (app.role_type === 'protagonist') {
            existing.isProtagonist = true;
          }
        } else {
          characterMap.set(app.character_name, {
            name: app.character_name,
            id: app.character_id,
            appearances: 1,
            isProtagonist: app.role_type === 'protagonist',
          });
        }
      });

      return Array.from(characterMap.values()).sort((a, b) => b.appearances - a.appearances);
    },
  });
}

// Get continuity stats
export function useContinuityStats() {
  return useQuery({
    queryKey: ['genesis-continuity-stats'],
    queryFn: async () => {
      const [arcs, characters, interactions, anchors] = await Promise.all([
        supabase.from('genesis_story_arcs').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_character_appearances').select('character_name'),
        supabase.from('genesis_character_interactions').select('id', { count: 'exact', head: true }),
        supabase.from('genesis_continuity_anchors').select('id', { count: 'exact', head: true }).eq('is_canon', true),
      ]);

      // Count unique characters
      const uniqueCharacters = new Set((characters.data as any[])?.map(c => c.character_name) || []);

      return {
        totalArcs: arcs.count || 0,
        totalCharacters: uniqueCharacters.size,
        totalInteractions: interactions.count || 0,
        canonAnchors: anchors.count || 0,
      };
    },
  });
}
