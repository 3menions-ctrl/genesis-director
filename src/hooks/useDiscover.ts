/**
 * Discover data — worlds (browse), trending reels, and unified search.
 * Wired to channel_worlds + published_reels + the search_everything RPC (same
 * sources the web Lobby / SearchHub use).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface World { id: string; slug: string; name: string; accent_hsl: string; glyph: string | null }
export interface ReelHit { id: string; title: string; thumbnail_url: string | null; video_url?: string | null; world_slug: string | null; play_count: number; creator_id: string; creator_name?: string | null; creator_avatar?: string | null }
export interface CreatorHit { id: string; display_name: string | null; avatar_url: string | null; tagline?: string | null; follower_count: number; reel_count: number }

const WORLDS_FALLBACK: World[] = [
  { id: '1', slug: 'noir', name: 'Noir', accent_hsl: '38 80% 60%', glyph: '◐' },
  { id: '2', slug: 'scifi', name: 'Sci-Fi', accent_hsl: '213 100% 60%', glyph: '◊' },
  { id: '3', slug: 'fantasy', name: 'Fantasy', accent_hsl: '270 80% 65%', glyph: '✦' },
  { id: '4', slug: 'nature', name: 'Nature', accent_hsl: '150 60% 55%', glyph: '❧' },
  { id: '5', slug: 'anime', name: 'Anime', accent_hsl: '330 85% 65%', glyph: '✿' },
  { id: '6', slug: 'horror', name: 'Horror', accent_hsl: '0 70% 55%', glyph: '☾' },
];

export function useWorlds() {
  const [worlds, setWorlds] = useState<World[]>(WORLDS_FALLBACK);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.from('channel_worlds' as never).select('id, slug, name, accent_hsl, glyph').order('name');
        const w = (data ?? []) as unknown as World[];
        if (!cancel && w.length) setWorlds(w);
      } catch { /* keep fallback */ }
    })();
    return () => { cancel = true; };
  }, []);
  return worlds;
}

/**
 * Reels list for Discover.
 *  - 'videos': full films (duration_sec > 5 or unset), most-played first.
 *  - 'reels' : short reels ONLY — clips of 5 seconds or less — newest first.
 *    A reel is, by definition, a ≤5s clip.
 */
const PAGE = 24;
async function fetchListPage(kind: 'videos' | 'reels', world: string | null | undefined, page: number): Promise<ReelHit[]> {
  let q = supabase.from('published_reels' as never)
    .select('id, title, thumbnail_url, video_url, world_slug, play_count, like_count, creator_id, created_at, duration_sec')
    .eq('is_taken_down', false);
  if (kind === 'reels') q = q.gt('duration_sec', 0).lte('duration_sec', 5);
  else q = q.or('duration_sec.gt.5,duration_sec.is.null');
  if (world) q = q.eq('world_slug', world);
  const from = page * PAGE;
  const { data } = await q.order(kind === 'reels' ? 'created_at' : 'play_count', { ascending: false }).range(from, from + PAGE - 1);
  return ((data ?? []) as unknown as ReelHit[]).map((r) => ({ ...r, title: r.title ?? 'Untitled' }));
}

export function useReelsList(kind: 'videos' | 'reels', world?: string | null) {
  const [reels, setReels] = useState<ReelHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const pageRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancel = false; setLoading(true); pageRef.current = 0;
    (async () => {
      try { const rows = await fetchListPage(kind, world, 0); if (!cancel) { setReels(rows); setHasMore(rows.length === PAGE); } }
      catch { if (!cancel) { setReels([]); setHasMore(false); } }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [kind, world, reloadKey]);

  const refresh = useCallback(() => { busyRef.current = false; setReloadKey((k) => k + 1); }, []);
  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore || loading) return;
    busyRef.current = true; setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const rows = await fetchListPage(kind, world, next);
      pageRef.current = next;
      setReels((prev) => { const seen = new Set(prev.map((p) => p.id)); return [...prev, ...rows.filter((r) => !seen.has(r.id))]; });
      setHasMore(rows.length === PAGE);
    } catch { setHasMore(false); }
    finally { busyRef.current = false; setLoadingMore(false); }
  }, [kind, world, hasMore, loading]);

  return { reels, loading, loadingMore, hasMore, refresh, loadMore };
}

export interface DailyPrompt { id?: string; prompt_text: string; prompt_hint?: string | null; cover_url?: string | null; world_slug?: string | null }

/** Today's creative challenge (current_daily_prompt RPC → Json). */
export function useDailyPrompt() {
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('current_daily_prompt' as never);
        const d = data as unknown as DailyPrompt[] | DailyPrompt | null;
        const raw = (Array.isArray(d) ? (d[0] ?? null) : d) as DailyPrompt | null;
        if (!cancel && raw && raw.prompt_text) setPrompt(raw);
      } catch { /* no prompt today */ }
    })();
    return () => { cancel = true; };
  }, []);
  return prompt;
}

export function useSearchEverything(query: string) {
  const [results, setResults] = useState<{ reels: ReelHit[]; creators: CreatorHit[] }>({ reels: [], creators: [] });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = query.trim();
    if (!term) { setResults({ reels: [], creators: [] }); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // search_everything (ranked) AND a direct profiles_public name match, so
        // ANY registered user — including people who signed up on the web — is
        // findable, not just those who've published content. (find_friends_directory
        // returns 0 rows; profiles_public is the populated directory.)
        const [rpcRes, dirRes] = await Promise.all([
          supabase.rpc('search_everything' as never, { p_query: term, p_limit: 16 } as never),
          supabase.from('profiles_public' as never).select('id, display_name, avatar_url, tagline').ilike('display_name', `%${term}%`).limit(16),
        ]);
        const payload = (rpcRes.data as unknown as { reels?: ReelHit[]; creators?: CreatorHit[] }) ?? {};
        const dir = ((dirRes.data ?? []) as unknown as { id: string; display_name: string | null; avatar_url: string | null; tagline: string | null }[])
          .map((d) => ({ id: d.id, display_name: d.display_name, avatar_url: d.avatar_url, tagline: d.tagline, follower_count: 0, reel_count: 0 } as CreatorHit));
        const seen = new Set<string>();
        const creators = [...(payload.creators ?? []), ...dir].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
        setResults({ reels: payload.reels ?? [], creators });
      } catch { setResults({ reels: [], creators: [] }); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);
  return { results, loading };
}
