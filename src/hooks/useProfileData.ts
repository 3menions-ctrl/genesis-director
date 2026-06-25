/**
 * Profile data hooks — follow counts/lists, liked reels, and drafts for the
 * comprehensive mobile profile. All read against real tables; each list hook is
 * gated by `enabled` so we only fetch a tab/sheet when it's actually shown.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Person { id: string; display_name: string | null; avatar_url: string | null }
export interface GridItem { id: string; title: string; thumbnail_url: string | null; video_url: string | null; status?: string; play_count?: number }

/** Followers (who follow me) + following (whom I follow) counts. */
export function useFollowCounts(userId?: string) {
  const [c, setC] = useState({ followers: 0, following: 0 });
  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          supabase.from('user_follows' as never).select('*', { count: 'exact', head: true }).eq('following_id', userId),
          supabase.from('user_follows' as never).select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        ]);
        if (!cancel) setC({ followers: a.count ?? 0, following: b.count ?? 0 });
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [userId]);
  return c;
}

/** The people in a user's followers / following list. */
export function useFollowList(userId: string | undefined, kind: 'followers' | 'following', enabled: boolean) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!userId || !enabled) return;
    let cancel = false; setLoading(true);
    (async () => {
      try {
        const matchCol = kind === 'followers' ? 'following_id' : 'follower_id';
        const pickCol = kind === 'followers' ? 'follower_id' : 'following_id';
        const { data } = await supabase.from('user_follows' as never).select(pickCol).eq(matchCol, userId).order('created_at', { ascending: false }).limit(100);
        const ids = ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[pickCol]).filter(Boolean);
        if (!ids.length) { if (!cancel) { setPeople([]); setLoading(false); } return; }
        const { data: profs } = await supabase.from('profiles_public' as never).select('id, display_name, avatar_url').in('id', ids);
        if (!cancel) { setPeople((profs ?? []) as unknown as Person[]); setLoading(false); }
      } catch { if (!cancel) { setPeople([]); setLoading(false); } }
    })();
    return () => { cancel = true; };
  }, [userId, kind, enabled]);
  return { people, loading };
}

/** Reels the user has liked. */
export function useLikedReels(userId: string | undefined, enabled: boolean) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!userId || !enabled) return;
    let cancel = false; setLoading(true);
    (async () => {
      try {
        const { data: likes } = await supabase.from('reel_likes' as never).select('reel_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
        const ids = ((likes ?? []) as unknown as { reel_id: string }[]).map((l) => l.reel_id);
        if (!ids.length) { if (!cancel) { setItems([]); setLoading(false); } return; }
        const { data: reels } = await supabase.from('published_reels' as never).select('id, title, thumbnail_url, video_url, play_count').in('id', ids).eq('is_taken_down', false);
        if (!cancel) { setItems(((reels ?? []) as unknown as GridItem[]).map((r) => ({ ...r, title: r.title ?? 'Untitled' }))); setLoading(false); }
      } catch { if (!cancel) { setItems([]); setLoading(false); } }
    })();
    return () => { cancel = true; };
  }, [userId, enabled]);
  return { items, loading };
}

/** Pinned/featured reels for the highlights rail, in pinned order. */
export function usePinnedReels(ids: string[] | undefined) {
  const key = (ids ?? []).join(',');
  const [items, setItems] = useState<GridItem[]>([]);
  useEffect(() => {
    if (!ids?.length) { setItems([]); return; }
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.from('published_reels' as never).select('id, title, thumbnail_url, video_url, play_count').in('id', ids).eq('is_taken_down', false);
        const byId = new Map(((data ?? []) as unknown as GridItem[]).map((r) => [r.id, { ...r, title: r.title ?? 'Untitled' }]));
        if (!cancel) setItems(ids.map((id) => byId.get(id)).filter(Boolean) as GridItem[]);
      } catch { if (!cancel) setItems([]); }
    })();
    return () => { cancel = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return items;
}

/** Daily creation counts for the last ~12 weeks (activity heatmap). */
export function useActivityHeatmap(userId: string | undefined) {
  const [days, setDays] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      try {
        const since = new Date(Date.now() - 84 * 86400000).toISOString();
        const { data } = await supabase.from('movie_projects' as never).select('created_at').eq('user_id', userId).gte('created_at', since).limit(1000);
        const m: Record<string, number> = {};
        for (const r of (data ?? []) as unknown as { created_at: string }[]) {
          const k = (r.created_at ?? '').slice(0, 10);
          if (k) m[k] = (m[k] ?? 0) + 1;
        }
        if (!cancel) setDays(m);
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [userId]);
  return days;
}

/** The user's in-progress / draft projects. */
export function useDrafts(userId: string | undefined, enabled: boolean) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!userId || !enabled) return;
    let cancel = false; setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.from('movie_projects' as never)
          .select('id, title, thumbnail_url, video_url, status')
          .eq('user_id', userId)
          .neq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(60);
        if (!cancel) { setItems(((data ?? []) as unknown as GridItem[]).map((r) => ({ ...r, title: r.title ?? 'Untitled' }))); setLoading(false); }
      } catch { if (!cancel) { setItems([]); setLoading(false); } }
    })();
    return () => { cancel = true; };
  }, [userId, enabled]);
  return { items, loading };
}
