import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'achievement' 
  | 'challenge_complete'
  | 'message' 
  | 'universe_invite' 
  | 'character_borrow_request' 
  | 'level_up'
  | 'streak_milestone' 
  | 'video_complete' 
  | 'video_started'
  | 'video_failed'
  | 'low_credits'
  | 'mention';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  // Stable ref for queryClient to avoid re-subscribing on every render
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    // Channel name MUST be user-scoped — two open tabs of this hook would
    // otherwise collide on the same Supabase realtime topic and one tab
    // would silently lose updates. Audit gap K19.
    const channel = supabase
      .channel(`notifications-${user.id}`)
      // INSERT — new notification fan-out.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClientRef.current.invalidateQueries({ queryKey: ['notifications', user.id] });
          const n = (payload as unknown as { new?: Partial<Notification> }).new;
          if (n?.title) {
            toast(n.title, { description: n.body ?? undefined, duration: 4500 });
          }
        }
      )
      // UPDATE — read flag changes, etc. Replaces the onSuccess
      // invalidations that used to fire from each mutation.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClientRef.current.invalidateQueries({ queryKey: ['notifications', user.id] });
        },
      )
      // DELETE — single delete or clear-all.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClientRef.current.invalidateQueries({ queryKey: ['notifications', user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Mark as read mutation. We do NOT invalidate here — the realtime
  // channel (user-scoped above) will pick up the UPDATE and fire the
  // single invalidation. Calling invalidate from both onSuccess AND the
  // realtime listener caused a double-refetch on every read action.
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      if (error) throw error;
    },
    // No invalidation here — the realtime channel above observes the
    // delete and fires the single invalidate. Avoids double-refetch.
  });

  // Delete one
  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
      if (error) throw error;
    },
    // No invalidation here — the realtime channel above observes the
    // delete and fires the single invalidate. Avoids double-refetch.
  });

  // Clear all
  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
      if (error) throw error;
    },
    // No invalidation here — the realtime channel above observes the
    // delete and fires the single invalidate. Avoids double-refetch.
  });

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}
