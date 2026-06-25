/**
 * useReelsFeed — the data behind the vertical For-You feed.
 *
 * Primary source is the `published_reels` table (same shape the Lobby uses),
 * decorated with creator profile info from `profiles_public`. If that returns
 * nothing (fresh project / offline / no public reels yet), we fall back to the
 * bundled static FILMS library so the feed is never empty in development or
 * on first run.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FILMS } from '@/data/filmsLibrary';

export interface FeedItem {
  id: string;
  title: string | null;
  synopsis: string | null;
  video_url: string;
  thumbnail_url: string | null;
  tags: string[];
  play_count: number;
  like_count: number;
  remix_count: number;
  creator_id: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  /** True for items sourced from the static fallback (no like/remix backend). */
  isStatic: boolean;
}

interface ReelRow {
  id: string;
  title: string | null;
  synopsis: string | null;
  video_url: string;
  thumbnail_url: string | null;
  tags: string[] | null;
  play_count: number | null;
  like_count: number | null;
  remix_count: number | null;
  creator_id: string;
}

function staticFeed(): FeedItem[] {
  // One card per film (first clip), filtered to entries that actually have a URL.
  return FILMS.filter((f) => f.clips?.[0]).map((f) => ({
    id: f.id,
    title: f.title,
    synopsis: null,
    video_url: f.clips[0],
    thumbnail_url: null,
    tags: [],
    play_count: 0,
    like_count: 0,
    remix_count: 0,
    creator_id: null,
    creator_name: 'Small Bridges',
    creator_avatar: null,
    isStatic: true,
  }));
}

export function useReelsFeed(limit = 30) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('published_reels' as never)
          .select(
            'id, title, synopsis, video_url, thumbnail_url, tags, play_count, like_count, remix_count, creator_id',
          )
          .eq('is_taken_down', false)
          .order('play_count', { ascending: false })
          .limit(limit);

        if (error) throw error;

        const reels = ((data ?? []) as unknown as ReelRow[]).filter((r) => r.video_url);
        if (reels.length === 0) {
          if (!cancelled) {
            setItems(staticFeed());
            setLoading(false);
          }
          return;
        }

        // Decorate with creator display name + avatar.
        const creatorIds = Array.from(new Set(reels.map((r) => r.creator_id))).filter(Boolean);
        const byId = new Map<string, { display_name: string | null; avatar_url: string | null }>();
        if (creatorIds.length) {
          const { data: profs } = await supabase
            .from('profiles_public' as never)
            .select('id, display_name, avatar_url')
            .in('id', creatorIds);
          for (const p of (profs ?? []) as Array<{
            id: string;
            display_name: string | null;
            avatar_url: string | null;
          }>) {
            byId.set(p.id, p);
          }
        }

        const decorated: FeedItem[] = reels.map((r) => {
          const p = r.creator_id ? byId.get(r.creator_id) : undefined;
          return {
            id: r.id,
            title: r.title,
            synopsis: r.synopsis,
            video_url: r.video_url,
            thumbnail_url: r.thumbnail_url,
            tags: r.tags ?? [],
            play_count: r.play_count ?? 0,
            like_count: r.like_count ?? 0,
            remix_count: r.remix_count ?? 0,
            creator_id: r.creator_id,
            creator_name: p?.display_name ?? null,
            creator_avatar: p?.avatar_url ?? null,
            isStatic: false,
          };
        });

        if (!cancelled) {
          setItems(decorated);
          setLoading(false);
        }
      } catch {
        // Network/permission error → still give the user a populated feed.
        if (!cancelled) {
          setItems(staticFeed());
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading };
}
