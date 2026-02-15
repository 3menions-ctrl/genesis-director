import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Universe, UniverseMember, UniverseContinuityEvent, UniverseRole } from '@/types/universe';
import type { Json } from '@/integrations/supabase/types';

export function useUniverses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all universes user has access to
  const { data: universes, isLoading } = useQuery({
    queryKey: ['universes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universes')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Universe[];
    },
    enabled: !!user,
  });

  // Create universe
  const createUniverse = useMutation({
    mutationFn: async (universe: Partial<Universe>) => {
      const { data, error } = await supabase
        .from('universes')
        .insert({
          name: universe.name || 'Untitled Universe',
          description: universe.description,
          setting: universe.setting,
          time_period: universe.time_period,
          rules: universe.rules,
          user_id: user!.id,
          is_public: universe.is_public || false,
          cover_image_url: universe.cover_image_url,
          lore_document: universe.lore_document,
          tags: universe.tags || [],
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      toast.success('Universe created!');
    },
    onError: () => {
      toast.error('Couldn\'t create your universe. Please try again.', {
        action: { label: 'Retry', onClick: () => createUniverse.reset() },
      });
    },
  });

  // Update universe
  const updateUniverse = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Universe> & { id: string }) => {
      const { style_guide, ...rest } = updates;
      const { data, error } = await supabase
        .from('universes')
        .update({ ...rest, style_guide: style_guide as Json })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      toast.success('Universe updated!');
    },
  });

  // Delete universe
  const deleteUniverse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('universes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universes'] });
      toast.success('Universe deleted');
    },
  });

  return {
    universes,
    isLoading,
    createUniverse,
    updateUniverse,
    deleteUniverse,
  };
}

export function useUniverseMembers(universeId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ['universe-members', universeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universe_members')
        .select('*')
        .eq('universe_id', universeId!);
      
      if (error) throw error;
      return data as unknown as UniverseMember[];
    },
    enabled: !!universeId,
  });

  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: UniverseRole }) => {
      const { data, error } = await supabase
        .from('universe_invitations')
        .insert({
          universe_id: universeId!,
          invited_email: email,
          invited_by: (await supabase.auth.getUser()).data.user!.id,
          role,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Invitation sent!');
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: UniverseRole }) => {
      const { error } = await supabase
        .from('universe_members')
        .update({ role })
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-members', universeId] });
      toast.success('Member role updated');
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('universe_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-members', universeId] });
      toast.success('Member removed');
    },
  });

  return {
    members,
    isLoading,
    inviteMember,
    updateMemberRole,
    removeMember,
  };
}

export function useUniverseContinuity(universeId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ['universe-continuity', universeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universe_continuity')
        .select('*')
        .eq('universe_id', universeId!)
        .order('timeline_position', { ascending: true });
      
      if (error) throw error;
      return data as UniverseContinuityEvent[];
    },
    enabled: !!universeId,
  });

  const addEvent = useMutation({
    mutationFn: async (event: Partial<UniverseContinuityEvent>) => {
      const { data, error } = await supabase
        .from('universe_continuity')
        .insert({
          universe_id: universeId!,
          created_by: (await supabase.auth.getUser()).data.user!.id,
          event_type: event.event_type || 'story_event',
          title: event.title!,
          description: event.description,
          timeline_position: event.timeline_position,
          date_in_universe: event.date_in_universe,
          affected_characters: event.affected_characters || [],
          source_project_id: event.source_project_id,
          is_canon: event.is_canon ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as UniverseContinuityEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-continuity', universeId] });
      toast.success('Event added to timeline');
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UniverseContinuityEvent> & { id: string }) => {
      const { error } = await supabase
        .from('universe_continuity')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-continuity', universeId] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('universe_continuity')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-continuity', universeId] });
      toast.success('Event removed');
    },
  });

  return {
    events,
    isLoading,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
