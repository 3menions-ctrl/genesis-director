import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  | 'mention'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  link?: string | null;
  actor_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

/**
 * Urgent categories surface a sonner toast in addition to landing in the
 * inbox. Everything else lands silently in the bell so the room stays
 * calm — only mentions, render-completes, and admin replies interrupt.
 */
const URGENT_TYPES = new Set<NotificationType>([
  'mention',
  'video_complete',
  'video_failed',
  'message',
]);

function isUrgent(n: Partial<Notification> | undefined): boolean {
  if (!n?.type) return false;
  if (URGENT_TYPES.has(n.type)) return true;
  // Support-replies from admin land as type='system' with an
  // admin_reply marker — surface those too.
  const d = (n.data ?? {}) as Record<string, unknown>;
  if (typeof d.admin_reply === 'boolean' && d.admin_reply) return true;
  return false;
}

const LAST_SEEN_KEY = 'smallbridges.notifications.lastSeen';

function readLastSeen(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(LAST_SEEN_KEY); } catch { return null; }
}
function writeLastSeen(iso: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LAST_SEEN_KEY, iso); } catch { /* ignore */ }
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Number of rows the query fetches. Bumps in increments of 50 when
  // the bell's "Load more" button is tapped at the bottom of the list.
  const [pageSize, setPageSize] = useState(50);

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id, pageSize],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(pageSize);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  // "New since you last visited" — persisted lastSeen timestamp.
  const [lastSeen, setLastSeen] = useState<string | null>(readLastSeen);
  const newSinceLastSeen = useMemo(() => {
    if (!notifications || !lastSeen) return notifications?.length ?? 0;
    return notifications.filter((n) => n.created_at > lastSeen).length;
  }, [notifications, lastSeen]);

  /** Pin the lastSeen marker — called when the popover opens. */
  const markSeen = useCallback(() => {
    const iso = new Date().toISOString();
    writeLastSeen(iso);
    setLastSeen(iso);
  }, []);

  const loadMore = useCallback(() => {
    setPageSize((n) => n + 50);
  }, []);

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
          if (!n?.title) return;
          // Toast bridge — only urgent categories interrupt the room.
          // The rest land silently in the bell so nothing buzzes during
          // deep work unless it really matters.
          if (isUrgent(n)) {
            const link = (n.link ?? (n.data as Record<string, unknown>)?.link) as string | undefined;
            toast(n.title, {
              description: n.body ?? undefined,
              duration: 6000,
              action: link
                ? {
                    label: 'Open',
                    onClick: () => { window.location.assign(link); },
                  }
                : undefined,
            });
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
    /** Canonical list of recent notifications (capped at pageSize). */
    notifications,
    /** Spec-style alias — `items` is the verbiage in the master backlog. */
    items: notifications ?? [],
    isLoading,
    unreadCount,
    /** Count of rows created after the user's last visit to the bell. */
    newSinceLastSeen,
    /** Pin the lastSeen marker — call when the popover opens. */
    markSeen,
    /** Append 50 more rows to the page. */
    loadMore,
    markAsRead,
    /** Spec-style alias for the single-row mark-as-read mutator. */
    markRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead,
    /** Spec-style alias for "mark every unread row as read". */
    markAllRead: () => markAllAsRead.mutate(),
    deleteNotification,
    clearAll,
  };
}
