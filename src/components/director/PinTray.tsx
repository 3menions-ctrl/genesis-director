/**
 * PinTray — persistent focus tray that follows the user across the app.
 *
 * Renders a small horizontal strip at the bottom-right of every protected
 * page showing the user's currently pinned projects. Each pin opens its
 * Production page on click. Click the X to unpin.
 *
 * Backed by `director_pins`. Hidden on routes where it would feel out of
 * place (auth, onboarding, public-share pages). Limited to 4 visible pins;
 * a chevron expands to show all.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Pin, X, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';

interface PinRow {
  id: string;
  project_id: string;
  position: number;
  project: {
    title: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
    status: string;
  };
}

const HIDDEN_ROUTES = [
  '/auth',
  '/start',
  '/onboarding',
  '/welcome',
  '/forgot-password',
  '/reset-password',
  '/p/',
];

export function PinTray() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const { navigate } = useSafeNavigation();
  const [pins, setPins] = useState<PinRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  const shouldHide = HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!user || shouldHide) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('director_pins')
        .select(`
          id, project_id, position,
          movie_projects:project_id ( title, thumbnail_url, video_url, status )
        `)
        .eq('user_id', user.id)
        .order('position', { ascending: true })
        .limit(8);
      if (cancelled) return;
      const mapped: PinRow[] = (data ?? []).map((p: {
        id: string; project_id: string; position: number;
        movie_projects?: { title?: string | null; thumbnail_url?: string | null; video_url?: string | null; status?: string };
      }) => ({
        id: p.id,
        project_id: p.project_id,
        position: p.position,
        project: {
          title: p.movie_projects?.title ?? null,
          thumbnail_url: p.movie_projects?.thumbnail_url ?? null,
          video_url: p.movie_projects?.video_url ?? null,
          status: p.movie_projects?.status ?? 'unknown',
        },
      }));
      setPins(mapped);
    })();
    return () => { cancelled = true; };
  }, [user, location.pathname, shouldHide]);

  const unpin = async (id: string) => {
    await supabase.from('director_pins').delete().eq('id', id);
    setPins((p) => p.filter((x) => x.id !== id));
  };

  if (shouldHide || !user || !profile?.onboarding_completed || pins.length === 0) return null;

  const visible = expanded ? pins : pins.slice(0, 4);

  return (
    <div className="fixed bottom-5 left-5 z-[58] pointer-events-none director-mode-mute">
      <div className="inline-flex items-end gap-1.5 pointer-events-auto">
        {visible.map((p) => (
          <PinTile key={p.id} pin={p} onOpen={() => navigate(`/production/${p.project_id}`)} onUnpin={() => unpin(p.id)} />
        ))}
        {pins.length > 4 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-10 h-14 rounded-md border border-white/[0.08] bg-black/55 backdrop-blur-md text-white/55 hover:text-white flex items-center justify-center"
            aria-label={expanded ? 'Collapse pins' : 'Expand pins'}
          >
            <ChevronUp className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}

function PinTile({
  pin,
  onOpen,
  onUnpin,
}: {
  pin: PinRow;
  onOpen: () => void;
  onUnpin: () => void;
}) {
  return (
    <div className="group relative w-20 h-14 rounded-md overflow-hidden border border-white/[0.08] bg-black/55 backdrop-blur-md shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)]">
      <button onClick={onOpen} className="absolute inset-0 focus-visible:outline-none">
        {pin.project.thumbnail_url ? (
          <img
            src={pin.project.thumbnail_url}
            alt={pin.project.title ?? 'Pinned project'}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
        )}
        <div className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 bg-gradient-to-t from-black/90 to-transparent">
          <div className="text-[9px] text-white/95 truncate">
            {pin.project.title ?? 'Untitled'}
          </div>
        </div>
        <Pin className="absolute top-1 left-1 w-2.5 h-2.5 text-brand-light" />
      </button>
      <button
        onClick={onUnpin}
        aria-label="Unpin"
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/65 border border-white/15 text-white/85 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

export default PinTray;
