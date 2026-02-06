/**
 * useWorldChat - Global public chat hook with realtime updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WorldChatMessage {
  id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useWorldChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch recent messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['world-chat'],
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('world_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profiles for all users
      const userIds = [...new Set((msgs || []).map(m => m.user_id))];
      
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );

      return (msgs || []).map(msg => ({
        ...msg,
        profile: profileMap.get(msg.user_id) || null,
      })).reverse() as WorldChatMessage[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('world-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'world_chat_messages',
        },
        () => {
          if (isMountedRef.current) {
            queryClient.invalidateQueries({ queryKey: ['world-chat'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('world_chat_messages')
        .insert({
          user_id: user.id,
          content: content.trim(),
          reply_to_id: replyToId || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world-chat'] });
    },
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('world_chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['world-chat'] });
    },
  });

  return {
    messages: messages || [],
    isLoading,
    sendMessage,
    deleteMessage,
  };
}
