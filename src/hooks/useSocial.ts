import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch followers count
  const { data: followersCount } = useQuery({
    queryKey: ['followers-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);
      
      if (error) {
        console.debug('[useSocial] Followers count error:', error.message);
        return 0;
      }
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
      
      if (error) {
        console.debug('[useSocial] Following count error:', error.message);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Check if following a user
  const checkFollowing = async (userId: string): Promise<boolean> => {
    if (!user || !isMountedRef.current) return false;
    
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
      
      if (!isMountedRef.current) return false;
      if (error) {
        console.debug('[useSocial] Check following error:', error.message);
        return false;
      }
      return !!data;
    } catch {
      return false;
    }
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
      // The followed-user notification is created server-side by the
      // trg_notify_user_follow trigger (see 20260625000000_notifications.sql).
      // A client insert here would be rejected by RLS (notifications can't
      // be written for another user) and double up once the trigger runs.
    },
    onSuccess: () => {
      // Scope by user id so we don't invalidate other users' cached
      // counts. The followed user's followers and our own following are
      // both affected; the realtime channel covers cross-tab sync.
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['followers-count', user.id] });
        queryClient.invalidateQueries({ queryKey: ['following-count', user.id] });
      }
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
      // Scope by user id so we don't invalidate other users' cached
      // counts. The followed user's followers and our own following are
      // both affected; the realtime channel covers cross-tab sync.
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['followers-count', user.id] });
        queryClient.invalidateQueries({ queryKey: ['following-count', user.id] });
      }
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

  // Fetch decrypted messages with a specific user via RPC
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['direct-messages', user?.id, otherUserId],
    queryFn: async () => {
      if (!user || !otherUserId) return [];
      
      const { data, error } = await (supabase as any)
        .rpc('get_decrypted_messages', { p_other_user_id: otherUserId });
      
      if (error) throw error;
      return (data ?? []) as DirectMessage[];
    },
    enabled: !!user && !!otherUserId,
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user || !otherUserId) return;

    const channel = supabase
      // User-scoped, sorted ids so both sides of the conversation share
      // the same channel topic (audit gap K19).
      .channel(`dm-${[user.id, otherUserId].sort().join('-')}`)
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
    // LOGIC FIX L-6: depend on user?.id (stable), not the whole `user` object —
    // AuthContext replaces `user` on every TOKEN_REFRESHED (heavy-page nav / tab
    // focus), which tore down + recreated this DM channel each time while a
    // thread was open (subscription churn + briefly missed inserts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, otherUserId, queryClient]);

  // Send message mutation. Routes through send_direct_message RPC so the
  // recipient's privacy preference (dmPermission: everyone | followers |
  // nobody) and the blocklist are enforced server-side.
  const sendMessage = useMutation({
    mutationFn: async ({ recipientId, content }: { recipientId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('send_direct_message' as never, {
        p_recipient: recipientId,
        p_content: content,
      } as never);

      if (error) {
        // Surface the precise reason so the UI can show a useful error.
        const msg = error.message || '';
        if (msg.includes('recipient_dms_disabled')) throw new Error("This user isn't accepting messages.");
        if (msg.includes('recipient_dms_followers_only')) throw new Error("This user only accepts messages from people they follow.");
        if (msg.includes('blocked_by_recipient')) throw new Error("You can't message this user.");
        if (msg.includes('content_too_long')) throw new Error("Message is too long.");
        if (msg.includes('empty_content')) throw new Error("Message is empty.");
        throw error;
      }
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
      // The project-owner comment notification is created server-side by
      // the trg_notify_project_comment trigger (see
      // 20260625000000_notifications.sql) — a client insert for another
      // user would be rejected by RLS and double up with the trigger.
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

  // Delete comment. Realtime DELETE events are not reliably delivered for this
  // table, so we invalidate explicitly rather than waiting for the channel —
  // otherwise the deleted comment lingers in the list until a manual reload.
  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('project_comments')
        .delete()
        .eq('id', commentId);

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
    deleteComment,
  };
}
