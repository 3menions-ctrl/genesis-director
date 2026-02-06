/**
 * useConversations - Fetches user's DM conversation list
 * Groups messages by conversation partner with last message preview
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Conversation {
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useConversations() {
  const { user } = useAuth();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async (): Promise<Conversation[]> => {
      if (!user) return [];

      // Get all messages involving this user
      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!messages || messages.length === 0) return [];

      // Group by conversation partner
      const conversationMap = new Map<string, {
        partnerId: string;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
      }>();

      for (const msg of messages) {
        const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          const isUnread = msg.recipient_id === user.id && !msg.read_at;
          conversationMap.set(partnerId, {
            partnerId,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: isUnread ? 1 : 0,
          });
        } else if (msg.recipient_id === user.id && !msg.read_at) {
          const conv = conversationMap.get(partnerId)!;
          conv.unreadCount++;
        }
      }

      // Fetch profile info for all partners
      const partnerIds = Array.from(conversationMap.keys());
      
      if (partnerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', partnerIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { name: p.display_name, avatar: p.avatar_url }])
      );

      // Build final conversation list
      const result: Conversation[] = [];
      for (const [partnerId, conv] of conversationMap) {
        const profile = profileMap.get(partnerId);
        result.push({
          recipientId: partnerId,
          recipientName: profile?.name || 'Anonymous',
          recipientAvatar: profile?.avatar || null,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount,
        });
      }

      // Sort by most recent
      result.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      return result;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  return {
    conversations: conversations || [],
    isLoading,
  };
}
