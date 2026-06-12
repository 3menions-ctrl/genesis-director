/**
 * AtomLibrary — generic library page rendered for Cast / Locations / Looks /
 * Voices. Each surface differs only in its underlying table, displayed
 * fields, and CTA copy. By colocating, all four pages share the same UX
 * (drag-to-reorder pins, hover-preview, inline rename, single-tap delete).
 *
 * Routed at /library/cast, /library/locations, /library/looks, /library/voices.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, MapPin, Palette, Mic2, Plus, Pin, PinOff, Trash2, Loader2, Inbox } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/shell/PageShell';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BetaHero } from '@/components/ui/BetaHero';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

type Atom = 'cast' | 'locations' | 'looks' | 'voices';

const ATOM_META: Record<Atom, {
  table: string;
  label: string;
  singular: string;
  icon: React.ElementType;
  intro: string;
  imageField: string;
  emptyTitle: string;
  emptyDescription: string;
}> = {
  cast: {
    table: 'director_cast',
    label: 'Cast',
    singular: 'character',
    icon: Users,
    intro: 'Characters with locked visual consistency. Drop any of them into a new project and the model recognizes them automatically.',
    imageField: 'reference_image_url',
    emptyTitle: 'No characters yet',
    emptyDescription: 'When you generate a character you like, save them to the Cast — they carry their look across every future project.',
  },
  locations: {
    table: 'director_locations',
    label: 'Locations',
    singular: 'location',
    icon: MapPin,
    intro: 'Sets and environments you keep returning to. Frame-accurate continuity, locked-in time of day, vibe defaults.',
    imageField: 'reference_image_url',
    emptyTitle: 'No locations yet',
    emptyDescription: 'Save environments you love — "the warehouse at dusk" stays consistent across every shot you place in it.',
  },
  looks: {
    table: 'director_looks',
    label: 'Looks',
    singular: 'look',
    icon: Palette,
    intro: 'Saved style presets — palette, grading, lens behavior, mood. Apply your signature with one click on any project.',
    imageField: 'reference_image_url',
    emptyTitle: 'No saved looks yet',
    emptyDescription: 'When a generated shot has the exact mood you want, save it as a Look. Small Bridges makes future shots match.',
  },
  voices: {
    table: 'director_voices',
    label: 'Voices',
    singular: 'voice',
    icon: Mic2,
    intro: 'Narrators and characters whose voice you trust. Reusable across avatar shots, voice-overs, and dubbed scenes.',
    imageField: 'preview_audio_url',
    emptyTitle: 'No saved voices yet',
    emptyDescription: 'Save voices you love — they\'re instantly available next time you reach for narration or dialogue.',
  },
};

interface AtomRow {
  id: string;
  name: string;
  description: string | null;
  pinned: boolean;
  reference_image_url?: string | null;
  preview_video_url?: string | null;
  preview_audio_url?: string | null;
  use_count?: number;
  appearance_count?: number;
  updated_at: string;
  tags?: string[] | null;
}

export default function AtomLibrary() {
  const params = useParams<{ atom: Atom }>();
  const atom = (params.atom ?? 'cast') as Atom;
  const meta = ATOM_META[atom] ?? ATOM_META.cast;

  usePageMeta({
    title: `${meta.label} — Library — Small Bridges`,
    description: meta.intro,
  });

  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const [rows, setRows] = useState<AtomRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from(meta.table)
      .select('*')
      .eq('user_id', user.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    setRows((data ?? []) as AtomRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user, atom]);

  const togglePin = async (row: AtomRow) => {
    const { error } = await supabase
      .from(meta.table)
      .update({ pinned: !row.pinned, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success(row.pinned ? 'Unpinned' : 'Pinned');
    void load();
  };

  const remove = async (row: AtomRow) => {
    if (!confirm(`Delete this ${meta.singular}? Projects that already used it keep working — only the library entry is removed.`)) return;
    const { error } = await supabase.from(meta.table).delete().eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success(`${meta.label.slice(0, -1)} removed`);
    void load();
  };

  const Icon = meta.icon;

  return (
    <PageShell width="wide">
      <BetaHero
        badge={`THE ${meta.label.toUpperCase()}`}
        eyebrow="Director's archive"
        title={<>{meta.label}.</>}
        body={meta.intro}
        actions={
          <PrimaryCTA
            size="lg"
            icon={Plus}
            onClick={() => toast.info('Saving from a project: open any clip → "Save to library".')}
          >
            Save a {meta.singular}
          </PrimaryCTA>
        }
      />

      {/* Body */}
      {loading ? (
        <div className="mt-16 flex items-center justify-center gap-3 text-white/45">
          <Spinner size="sm" tone="muted" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading library…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Icon}
            title={meta.emptyTitle}
            description={meta.emptyDescription}
            cta={{
              label: 'Open the studio',
              onClick: () => navigate('/create'),
            }}
            secondaryCta={{
              label: 'Browse the Gallery',
              onClick: () => navigate('/gallery'),
            }}
          />
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
          {rows.map((row, i) => (
            <AtomTile
              key={row.id}
              row={row}
              index={i}
              imageField={meta.imageField}
              onPin={() => togglePin(row)}
              onDelete={() => remove(row)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function AtomTile({
  row,
  index,
  imageField,
  onPin,
  onDelete,
}: {
  row: AtomRow;
  index: number;
  imageField: string;
  onPin: () => void;
  onDelete: () => void;
}) {
  const heroUrl =
    (row as unknown as Record<string, string | null>)[imageField] ??
    row.preview_video_url ??
    null;
  const isVideo = !!row.preview_video_url;

  return (
    <div
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/[0.07] bg-glass transition-all hover:border-white/15"
      style={{ animationDelay: `${index * 25}ms` }}
    >
      {heroUrl && !isVideo ? (
        <img
          src={heroUrl}
          alt={row.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
        />
      ) : heroUrl && isVideo ? (
        <video
          src={heroUrl}
          muted
          playsInline
          loop
          preload="none"
          className="absolute inset-0 w-full h-full object-cover"
          onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
      )}

      {/* Bottom info strip */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/30 to-transparent">
        <div className="text-[13px] text-white truncate font-display">{row.name}</div>
        {row.description && (
          <div className="text-[10px] text-white/55 truncate mt-0.5">{row.description}</div>
        )}
      </div>

      {/* Action chips */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onPin}
          aria-label={row.pinned ? 'Unpin' : 'Pin'}
          className="w-7 h-7 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/85 hover:text-white hover:bg-black/75"
        >
          {row.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="w-7 h-7 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/85 hover:text-rose-300 hover:bg-black/75"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Pinned badge */}
      {row.pinned && (
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand/30 border border-brand/50 backdrop-blur-md">
          <Pin className="w-2.5 h-2.5 text-white" />
          <span className="font-mono text-[8px] uppercase tracking-[0.32em] text-white">Pin</span>
        </div>
      )}
    </div>
  );
}
