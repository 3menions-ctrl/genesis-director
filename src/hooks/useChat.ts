/**
 * useChat - Premium unified chat system
 * Handles conversations, messages, reactions, presence, typing indicators
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface ChatConversation {
  id: string;
  type: 'dm' | 'group' | 'world';
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  members?: ConversationMember[];
  unread_count?: number;
  other_user?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface ConversationMember {
  user_id: string;
  role: string;
  last_read_at: string | null;
  is_muted: boolean;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  message_type: string;
  media_url: string | null;
  is_edited: boolean;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  reactions?: MessageReaction[];
  reply_to?: {
    content: string;
    profile?: { display_name: string | null };
  };
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  reacted_by_me: boolean;
}

export interface PresenceUser {
  user_id: string;
  status: 'online' | 'away' | 'offline';
  last_seen_at: string;
  typing_in_conversation: string | null;
}

const WORLD_CHAT_ID = '00000000-0000-0000-0000-000000000001';

// ═══════════════════════════════════════
// CONVERSATIONS LIST
// ═══════════════════════════════════════

export function useConversationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['chat-conversations', user?.id],
    queryFn: async (): Promise<ChatConversation[]> => {
      if (!user) return [];

      // Get conversations the user is a member of
      const { data: memberships, error: memError } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (memError) throw memError;

      const convIds = (memberships || []).map(m => m.conversation_id);
      const readMap = new Map((memberships || []).map(m => [m.conversation_id, m.last_read_at]));

      // Always include world chat even if user hasn't explicitly joined
      if (!convIds.includes(WORLD_CHAT_ID)) {
        convIds.push(WORLD_CHAT_ID);
      }

      if (!convIds.length) return [];

      // Get conversation details
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      // Get all members for these conversations (for DM naming + group info)
      const { data: allMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, role')
        .in('conversation_id', convIds);

      // Get unique user IDs for profile lookup
      const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
      
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .in('id', memberUserIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );

      // Count unread messages per conversation
      const results: ChatConversation[] = [];
      
      for (const conv of (convs || [])) {
        const lastRead = readMap.get(conv.id);
        
        // Get unread count
        let unreadCount = 0;
        if (lastRead) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id)
            .gt('created_at', lastRead);
          unreadCount = count || 0;
        }

        // For DMs, find the other user
        let otherUser = undefined;
        if (conv.type === 'dm') {
          const otherMember = (allMembers || []).find(
            m => m.conversation_id === conv.id && m.user_id !== user.id
          );
          if (otherMember) {
            const profile = profileMap.get(otherMember.user_id);
            otherUser = {
              id: otherMember.user_id,
              display_name: profile?.display_name || null,
              avatar_url: profile?.avatar_url || null,
            };
          }
        }

        results.push({
          ...conv,
          type: conv.type as 'dm' | 'group' | 'world',
          unread_count: unreadCount,
          other_user: otherUser,
        });
      }

      return results;
    },
    enabled: !!user,
    staleTime: 10000,
  });

  // Realtime subscription for new messages updating conversation list
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-list-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return { conversations: conversations || [], isLoading };
}

// ═══════════════════════════════════════
// MESSAGES FOR A CONVERSATION
// ═══════════════════════════════════════

export function useChatMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];

      const { data: msgs, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;

      // Get profiles
      const userIds = [...new Set((msgs || []).map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );

      // Get reactions
      const msgIds = (msgs || []).map(m => m.id);
      const { data: reactions } = msgIds.length > 0
        ? await supabase
            .from('chat_message_reactions')
            .select('*')
            .in('message_id', msgIds)
        : { data: [] };

      // Group reactions by message
      const reactionMap = new Map<string, MessageReaction[]>();
      for (const r of (reactions || [])) {
        if (!reactionMap.has(r.message_id)) reactionMap.set(r.message_id, []);
        const msgReactions = reactionMap.get(r.message_id)!;
        const existing = msgReactions.find(mr => mr.emoji === r.emoji);
        if (existing) {
          existing.count++;
          existing.users.push(r.user_id);
          if (r.user_id === user?.id) existing.reacted_by_me = true;
        } else {
          msgReactions.push({
            emoji: r.emoji,
            count: 1,
            users: [r.user_id],
            reacted_by_me: r.user_id === user?.id,
          });
        }
      }

      // Build reply references
      const replyIds = (msgs || []).filter(m => m.reply_to_id).map(m => m.reply_to_id!);
      const replyMsgs = new Map<string, { content: string; user_id: string }>();
      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from('chat_messages')
          .select('id, content, user_id')
          .in('id', replyIds);
        for (const r of (replies || [])) {
          replyMsgs.set(r.id, { content: r.content, user_id: r.user_id });
        }
      }

      return (msgs || []).map(msg => ({
        ...msg,
        profile: profileMap.get(msg.user_id) || null,
        reactions: reactionMap.get(msg.id) || [],
        reply_to: msg.reply_to_id && replyMsgs.has(msg.reply_to_id)
          ? {
              content: replyMsgs.get(msg.reply_to_id)!.content,
              profile: profileMap.get(replyMsgs.get(msg.reply_to_id)!.user_id) || null,
            }
          : undefined,
      })) as ChatMessage[];
    },
    enabled: !!conversationId && !!user,
  });

  // Realtime messages
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_message_reactions',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user, queryClient]);

  // Mark as read when viewing
  useEffect(() => {
    if (!conversationId || !user) return;
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .then();
  }, [conversationId, user, messages?.length]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, replyToId, mediaUrl, messageType }: {
      content: string;
      replyToId?: string;
      mediaUrl?: string;
      messageType?: string;
    }) => {
      if (!user || !conversationId) throw new Error('Not ready');

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          content: content.trim(),
          reply_to_id: replyToId || null,
          media_url: mediaUrl || null,
          message_type: messageType || 'text',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
    },
  });

  // Toggle reaction
  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if already reacted
      const { data: existing } = await supabase
        .from('chat_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from('chat_message_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('chat_message_reactions').insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
    },
  });

  return {
    messages: messages || [],
    isLoading,
    sendMessage,
    deleteMessage,
    toggleReaction,
  };
}

// ═══════════════════════════════════════
// PRESENCE & TYPING
// ═══════════════════════════════════════

export function usePresence(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Update presence on mount
  useEffect(() => {
    if (!user) return;

    const upsertPresence = async () => {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    };

    upsertPresence();

    // Heartbeat every 30s
    const interval = setInterval(upsertPresence, 30000);

    // Go offline on unmount
    return () => {
      clearInterval(interval);
      supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: 'offline',
          last_seen_at: new Date().toISOString(),
          typing_in_conversation: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .then();
    };
  }, [user]);

  // Get online users in conversation
  const { data: presenceData } = useQuery({
    queryKey: ['presence', conversationId],
    queryFn: async (): Promise<PresenceUser[]> => {
      if (!conversationId) return [];

      // Get members of conversation
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (!members?.length) return [];

      const { data: presence } = await supabase
        .from('user_presence')
        .select('*')
        .in('user_id', members.map(m => m.user_id))
        .eq('status', 'online');

      return (presence || []) as PresenceUser[];
    },
    enabled: !!conversationId,
    refetchInterval: 15000,
  });

  // Realtime presence
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`presence-${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['presence', conversationId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Set typing
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!user) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status: 'online',
        typing_in_conversation: isTyping ? conversationId : null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 5000);
    }
  }, [user, conversationId]);

  const typingUsers = (presenceData || []).filter(
    p => p.typing_in_conversation === conversationId && p.user_id !== user?.id
  );

  return {
    onlineUsers: presenceData || [],
    typingUsers,
    setTyping,
  };
}

// ═══════════════════════════════════════
// CONVERSATION ACTIONS
// ═══════════════════════════════════════

export function useChatActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const startDM = useMutation({
    mutationFn: async (otherUserId: string): Promise<string> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_or_create_dm_conversation', {
        p_other_user_id: otherUserId,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  const createGroup = useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }): Promise<string> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_name: name,
        p_member_ids: memberIds,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  // Join world chat
  const joinWorldChat = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('conversation_members')
        .upsert({
          conversation_id: WORLD_CHAT_ID,
          user_id: user.id,
          role: 'member',
        }, { onConflict: 'conversation_id,user_id' });

      return WORLD_CHAT_ID;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  return { startDM, createGroup, joinWorldChat, WORLD_CHAT_ID };
}

// ═══════════════════════════════════════
// USER SEARCH
// ═══════════════════════════════════════

export function useUserSearch(query: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, display_name, avatar_url')
        .neq('id', user?.id || '')
        .ilike('display_name', `%${query}%`)
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && query.length >= 2,
    staleTime: 5000,
  });
}
