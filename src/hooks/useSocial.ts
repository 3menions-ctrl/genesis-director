import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface UniverseMessage {
  id: string;
  universe_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  likes_count: number;
  created_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export function useSocial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch followers count
  const { data: followersCount } = useQuery({
    queryKey: ['followers-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Fetch following count
  const { data: followingCount } = useQuery({
    queryKey: ['following-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Check if following a user
  const checkFollowing = async (userId: string): Promise<boolean> => {
    if (!user) return false;
    
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  };

  // Follow mutation
  const followUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: user.id,
          following_id: userId,
        });
      
      if (error) throw error;

      // Create notification for the followed user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'follow',
          title: 'New Follower!',
          body: 'Someone started following you',
          data: { follower_id: user.id },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  // Unfollow mutation
  const unfollowUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  return {
    followersCount,
    followingCount,
    checkFollowing,
    followUser,
    unfollowUser,
  };
}

export function useDirectMessages(otherUserId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch conversations list
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['dm-conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get distinct users we've messaged with
      const { data: sent, error: sentError } = await supabase
        .from('direct_messages')
        .select('recipient_id, created_at')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });
      
      const { data: received, error: receivedError } = await supabase
        .from('direct_messages')
        .select('sender_id, created_at')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });
      
      if (sentError || receivedError) throw sentError || receivedError;
      
      // Combine and deduplicate
      const userIds = new Set<string>();
      const conversations: { userId: string; lastMessage: string }[] = [];
      
      [...(sent || []), ...(received || [])].forEach(msg => {
        const otherId = 'recipient_id' in msg ? msg.recipient_id : msg.sender_id;
        if (!userIds.has(otherId)) {
          userIds.add(otherId);
          conversations.push({ userId: otherId, lastMessage: msg.created_at });
        }
      });
      
      return conversations;
    },
    enabled: !!user,
  });

  // Fetch messages with a specific user
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['direct-messages', user?.id, otherUserId],
    queryFn: async () => {
      if (!user || !otherUserId) return [];
      
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as DirectMessage[];
    },
    enabled: !!user && !!otherUserId,
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user || !otherUserId) return;

    const channel = supabase
      .channel(`dm-${user.id}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const msg = payload.new as DirectMessage;
          if (
            (msg.sender_id === user.id && msg.recipient_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.recipient_id === user.id)
          ) {
            queryClient.invalidateQueries({ queryKey: ['direct-messages', user.id, otherUserId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId, queryClient]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ recipientId, content }: { recipientId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content,
        });
      
      if (error) throw error;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'message',
          title: 'New Message',
          body: content.substring(0, 100),
          data: { sender_id: user.id },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-messages'] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
    },
  });

  return {
    conversations,
    conversationsLoading,
    messages,
    messagesLoading,
    sendMessage,
  };
}

export function useUniverseChat(universeId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['universe-messages', universeId],
    queryFn: async () => {
      if (!universeId) return [];
      
      const { data, error } = await supabase
        .from('universe_messages')
        .select('*')
        .eq('universe_id', universeId)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      return data as UniverseMessage[];
    },
    enabled: !!universeId,
  });

  // Subscribe to realtime
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
        () => {
          queryClient.invalidateQueries({ queryKey: ['universe-messages', universeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [universeId, queryClient]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!user || !universeId) throw new Error('Not authenticated or no universe');
      
      const { error } = await supabase
        .from('universe_messages')
        .insert({
          universe_id: universeId,
          user_id: user.id,
          content,
          reply_to_id: replyToId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-messages', universeId] });
    },
  });

  return {
    messages,
    isLoading,
    sendMessage,
  };
}

export function useProjectComments(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments, isLoading } = useQuery({
    queryKey: ['project-comments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ProjectComment[];
    },
    enabled: !!projectId,
  });

  // Subscribe to realtime
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-comments-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_comments',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  // Add comment
  const addComment = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!user || !projectId) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          user_id: user.id,
          content,
          reply_to_id: replyToId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] });
    },
  });

  // Like comment
  const likeComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: user.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] });
    },
  });

  return {
    comments,
    isLoading,
    addComment,
    likeComment,
  };
}
