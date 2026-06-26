/**
 * Discover data — worlds (browse), trending reels, and unified search.
 * Wired to channel_worlds + published_reels + the search_everything RPC (same
 * sources the web Lobby / SearchHub use).
 */
import { useEffect, useState } from 'react';
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

/** Reels list for Discover. 'plays' = popular (Videos), 'new' = freshest (Reels). */
export function useReelsList(sort: 'plays' | 'new') {
  const [reels, setReels] = useState<ReelHit[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false; setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.from('published_reels' as never)
          .select('id, title, thumbnail_url, video_url, world_slug, play_count, like_count, creator_id, created_at')
          .eq('is_taken_down', false)
          .order(sort === 'plays' ? 'play_count' : 'created_at', { ascending: false })
          .limit(30);
        if (!cancel) { setReels(((data ?? []) as unknown as ReelHit[]).map((r) => ({ ...r, title: r.title ?? 'Untitled' }))); setLoading(false); }
      } catch { if (!cancel) { setReels([]); setLoading(false); } }
    })();
    return () => { cancel = true; };
  }, [sort]);
  return { reels, loading };
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
        const { data } = await supabase.rpc('search_everything' as never, { p_query: term, p_limit: 16 } as never);
        const payload = (data as unknown as { reels?: ReelHit[]; creators?: CreatorHit[] }) ?? {};
        setResults({ reels: payload.reels ?? [], creators: payload.creators ?? [] });
      } catch { setResults({ reels: [], creators: [] }); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);
  return { results, loading };
}
