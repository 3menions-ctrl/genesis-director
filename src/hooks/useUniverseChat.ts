import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UniverseMessage {
  id: string;
  universe_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useUniverseChat(universeId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeMessages, setRealtimeMessages] = useState<UniverseMessage[]>([]);

  // Fetch initial messages
  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['universe-messages', universeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universe_messages')
        .select('*')
        .eq('universe_id', universeId!)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      
      // Fetch profiles for messages
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      })) as UniverseMessage[];
    },
    enabled: !!universeId,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!universeId) return;

    const channel = supabase
      .channel(`universe-chat-${universeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'universe_messages',
          filter: `universe_id=eq.${universeId}`,
        },
        async (payload) => {
          const newMessage = payload.new as UniverseMessage;
          
          // Fetch profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', newMessage.user_id)
            .single();
          
          setRealtimeMessages(prev => [...prev, {
            ...newMessage,
            profile: profile || undefined,
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [universeId]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      const { data, error } = await supabase
        .from('universe_messages')
        .insert({
          universe_id: universeId!,
          user_id: user!.id,
          content,
          reply_to_id: replyToId || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Combine initial and realtime messages
  const messages = [...(initialMessages || []), ...realtimeMessages].filter(
    (msg, index, self) => self.findIndex(m => m.id === msg.id) === index
  );

  return {
    messages,
    isLoading,
    sendMessage,
  };
}
