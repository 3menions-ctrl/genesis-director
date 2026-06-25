/**
 * useMyFilms — the signed-in user's published films + aggregate stats, for the
 * mobile You/profile screen. Reads `published_reels` by creator (same source as
 * the web ProfileDashboard). Returns empty (not an error) when signed out.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyFilm {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  play_count: number;
  like_count: number;
  created_at: string | null;
}

export interface MyFilmsResult {
  films: MyFilm[];
  totalLikes: number;
  totalPlays: number;
  /** Consecutive-day creation streak ending today (0 if none today/yesterday). */
  streak: number;
  loading: boolean;
}

function computeStreak(dates: string[]): number {
  // Unique day keys (YYYY-MM-DD) the user published on.
  const days = new Set(dates.map((d) => (d ? d.slice(0, 10) : '')).filter(Boolean));
  if (days.size === 0) return 0;
  // Walk back from today while each day is present.
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to count if they posted today OR yesterday (grace).
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useMyFilms(): MyFilmsResult {
  const { user } = useAuth();
  const [films, setFilms] = useState<MyFilm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFilms([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('published_reels' as never)
          .select('id, title, thumbnail_url, video_url, play_count, like_count, created_at')
          .eq('creator_id', user.id)
          .eq('is_taken_down', false)
          .order('created_at', { ascending: false })
          .limit(60);
        if (error) throw error;
        const mapped = ((data ?? []) as unknown as Array<{
          id: string;
          title: string | null;
          thumbnail_url: string | null;
          video_url: string | null;
          play_count: number | null;
          like_count: number | null;
          created_at: string | null;
        }>).map((r) => ({
          id: r.id,
          title: r.title ?? 'Untitled',
          thumbnail_url: r.thumbnail_url,
          video_url: r.video_url,
          play_count: r.play_count ?? 0,
          like_count: r.like_count ?? 0,
          created_at: r.created_at,
        }));
        if (!cancelled) {
          setFilms(mapped);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFilms([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalLikes = films.reduce((s, f) => s + f.like_count, 0);
  const totalPlays = films.reduce((s, f) => s + f.play_count, 0);
  const streak = computeStreak(films.map((f) => f.created_at ?? ''));

  return { films, totalLikes, totalPlays, streak, loading };
}
