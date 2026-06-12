/**
 * StoryboardWall — every shot from every one of the user's projects, flat
 * as a 4K wall grid. The visual experience is "scroll your entire catalog
 * like a wall of polaroids".
 *
 * Pulls every completed `video_clips` row for projects the user owns,
 * orders by recency, and renders them as a dense responsive grid with
 * hover-to-play autoplay snippets.
 */

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Search } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/shell/PageShell';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BetaHero, StatGrid, Stat } from '@/components/ui/BetaHero';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/empty-state';

interface ShotRow {
  id: string;
  project_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  shot_index: number | null;
  status: string;
  created_at: string;
  project_title: string;
}

export default function StoryboardWall() {
  usePageMeta({
    title: 'Storyboard Wall — Small Bridges',
    description: 'Every shot from every project, one wall.',
  });
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('video_clips')
        .select(`
          id, project_id, video_url, thumbnail_url, shot_index, status, created_at,
          movie_projects!inner ( user_id, title )
        `)
        .eq('movie_projects.user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(600);
      if (cancelled) return;
      const rows: ShotRow[] = (data ?? []).map((c: {
        id: string;
        project_id: string;
        video_url: string | null;
        thumbnail_url: string | null;
        shot_index: number | null;
        status: string;
        created_at: string;
        movie_projects?: { title?: string | null } | null;
      }) => ({
        id: c.id,
        project_id: c.project_id,
        video_url: c.video_url,
        thumbnail_url: c.thumbnail_url,
        shot_index: c.shot_index,
        status: c.status,
        created_at: c.created_at,
        project_title: c.movie_projects?.title ?? 'Untitled',
      }));
      setShots(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return shots;
    const q = search.toLowerCase();
    return shots.filter((s) => s.project_title.toLowerCase().includes(q));
  }, [shots, search]);

  const projectCount = useMemo(() => new Set(shots.map((s) => s.project_id)).size, [shots]);

  return (
    <PageShell width="gallery">
      <BetaHero
        badge="THE WALL"
        eyebrow="Director's archive"
        title={<>Every shot, on one wall.</>}
        body={<>Your whole catalog as polaroids. Search by project title. Hover to see a shot move.</>}
        rail={
          <StatGrid>
            <Stat label="Shots" value={shots.length} tone="blue" />
            <Stat label="Projects" value={projectCount} tone="emerald" />
            <Stat label="On display" value={filtered.length} tone="amber" />
          </StatGrid>
        }
      />

      {/* Search */}
      <div className="mt-8 relative max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by project title…"
          className="ds-input pl-9"
        />
      </div>

      {/* Wall */}
      {loading ? (
        <div className="mt-16 flex items-center justify-center gap-3 text-white/45">
          <Spinner size="sm" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">
            Hanging shots…
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={LayoutGrid}
            title="The wall is empty"
            description="Complete your first project and every shot will live here."
            cta={{ label: 'Open the studio', onClick: () => navigate('/create') }}
          />
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 lg:gap-2">
          {filtered.map((shot, i) => (
            <ShotTile key={shot.id} shot={shot} index={i} onClick={() => navigate(`/production/${shot.project_id}`)} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ShotTile({
  shot,
  index,
  onClick,
}: {
  shot: ShotRow;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-square rounded-md overflow-hidden border border-white/[0.06] bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      style={{ animationDelay: `${index * 18}ms` }}
    >
      {shot.thumbnail_url ? (
        <img
          src={shot.thumbnail_url}
          alt={`${shot.project_title} · shot ${(shot.shot_index ?? 0) + 1}`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
      )}
      {shot.video_url && (
        <video
          src={shot.video_url}
          muted
          playsInline
          loop
          preload="none"
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
        />
      )}
      <div className="absolute top-1.5 left-1.5 font-mono text-[8px] uppercase tracking-[0.32em] text-white/65 tabular-nums px-1 py-0.5 rounded bg-black/55 border border-white/10 backdrop-blur-md">
        {String((shot.shot_index ?? 0) + 1).padStart(2, '0')}
      </div>
    </button>
  );
}
