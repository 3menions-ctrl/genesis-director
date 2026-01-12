import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CharacterLoan, LendableCharacter, LendingPermission } from '@/types/universe';

export function useCharacterLending() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch characters available for borrowing (public or in shared universes)
  const { data: lendableCharacters, isLoading: loadingLendable } = useQuery({
    queryKey: ['lendable-characters', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .neq('user_id', user!.id)
        .in('lending_permission', ['public', 'universe_only', 'specific_users']);
      
      if (error) throw error;
      return data as unknown as LendableCharacter[];
    },
    enabled: !!user,
  });

  // Fetch my characters with lending enabled
  const { data: myLendableCharacters, isLoading: loadingMy } = useQuery({
    queryKey: ['my-lendable-characters', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user!.id)
        .neq('lending_permission', 'none');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch loan requests I've received
  const { data: incomingRequests, isLoading: loadingIncoming } = useQuery({
    queryKey: ['incoming-loan-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('character_loans')
        .select('*')
        .eq('owner_id', user!.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as CharacterLoan[];
    },
    enabled: !!user,
  });

  // Fetch loan requests I've sent
  const { data: outgoingRequests, isLoading: loadingOutgoing } = useQuery({
    queryKey: ['outgoing-loan-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('character_loans')
        .select(`
          *,
          character:characters(name, appearance)
        `)
        .eq('borrower_id', user!.id)
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data as CharacterLoan[];
    },
    enabled: !!user,
  });

  // Request to borrow a character
  const requestLoan = useMutation({
    mutationFn: async ({ 
      characterId, 
      ownerId, 
      projectId, 
      notes 
    }: { 
      characterId: string; 
      ownerId: string; 
      projectId?: string; 
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('character_loans')
        .insert({
          character_id: characterId,
          owner_id: ownerId,
          borrower_id: user!.id,
          project_id: projectId,
          usage_notes: notes,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outgoing-loan-requests'] });
      toast.success('Loan request sent!');
    },
    onError: (error) => {
      toast.error('Failed to request: ' + error.message);
    },
  });

  // Approve or deny a loan request
  const respondToLoan = useMutation({
    mutationFn: async ({ 
      loanId, 
      approved, 
      expiresAt 
    }: { 
      loanId: string; 
      approved: boolean; 
      expiresAt?: string;
    }) => {
      const { error } = await supabase
        .from('character_loans')
        .update({
          status: approved ? 'approved' : 'denied',
          responded_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .eq('id', loanId);
      
      if (error) throw error;
        
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['incoming-loan-requests'] });
      toast.success(approved ? 'Loan approved!' : 'Loan denied');
    },
  });

  // Revoke an approved loan
  const revokeLoan = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from('character_loans')
        .update({ status: 'revoked' })
        .eq('id', loanId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-loan-requests'] });
      toast.success('Loan revoked');
    },
  });

  // Update character lending settings
  const updateLendingSettings = useMutation({
    mutationFn: async ({ 
      characterId, 
      permission, 
      credits 
    }: { 
      characterId: string; 
      permission: LendingPermission; 
      credits?: number;
    }) => {
      const { error } = await supabase
        .from('characters')
        .update({
          lending_permission: permission,
          lending_credits_required: credits || 0,
        })
        .eq('id', characterId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lendable-characters'] });
      toast.success('Lending settings updated');
    },
  });

  return {
    lendableCharacters,
    myLendableCharacters,
    incomingRequests,
    outgoingRequests,
    isLoading: loadingLendable || loadingMy || loadingIncoming || loadingOutgoing,
    requestLoan,
    respondToLoan,
    revokeLoan,
    updateLendingSettings,
  };
}
