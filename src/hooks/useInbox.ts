/**
 * useInbox — the user's DM conversations: one row per other person with the last
 * message, time, and unread count. Built from direct_messages (content is plain
 * text) + profiles_public for names/avatars.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Conversation {
  userId: string;
  name: string | null;
  avatar: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  mine: boolean;
}

/** Lightweight unread DM count for header badges. */
export function useUnreadDMCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return; let cancel = false;
    (async () => {
      try {
        const { count: n } = await supabase.from('direct_messages' as never).select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null);
        if (!cancel) setCount(n ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [user]);
  return count;
}

export function useInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('direct_messages' as never)
        .select('id, sender_id, recipient_id, content, created_at, read_at')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200);
      const rows = (data ?? []) as unknown as { sender_id: string; recipient_id: string; content: string; created_at: string; read_at: string | null }[];
      const byOther = new Map<string, Conversation & { _ts: number }>();
      for (const m of rows) {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (!byOther.has(other)) {
          byOther.set(other, { userId: other, name: null, avatar: null, lastMessage: m.content, lastAt: m.created_at, unread: 0, mine: m.sender_id === user.id, _ts: Date.parse(m.created_at) || 0 });
        }
        if (m.recipient_id === user.id && !m.read_at) byOther.get(other)!.unread++;
      }
      const others = [...byOther.keys()];
      if (others.length) {
        const { data: profs } = await supabase.from('profiles_public' as never).select('id, display_name, avatar_url').in('id', others);
        for (const p of ((profs ?? []) as unknown as { id: string; display_name: string | null; avatar_url: string | null }[])) {
          const c = byOther.get(p.id);
          if (c) { c.name = p.display_name; c.avatar = p.avatar_url; }
        }
      }
      setItems([...byOther.values()].sort((a, b) => b._ts - a._ts));
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  return { items, loading, reload: load };
}
