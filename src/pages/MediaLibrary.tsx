import { useMemo, useState } from 'react';
import { PageShell, PageHeader, SegmentedControl } from '@/components/shell';
import { useMediaLibrary, MediaKind, MediaAsset } from '@/hooks/useMediaLibrary';
import { Button } from '@/components/ui/button';
import {
  Image as ImageIcon, Music, Film, Download, Heart, Trash2, Loader2, Library,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TABS: Array<{ id: 'all' | MediaKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
];

function fmtBytes(n: number | null) {
  if (!n) return '';
  const u = ['B','KB','MB','GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${u[i]}`;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

function AssetCard({ a, onRemove, onFavorite }: { a: MediaAsset; onRemove: (id: string) => void; onFavorite: (a: MediaAsset) => void }) {
  const isVideo = a.media_type === 'video';
  const isAudio = a.media_type === 'audio';
  const isImage = a.media_type === 'image';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] transition-colors">
      <div className="relative aspect-[16/10] bg-black/40">
        {isImage && (
          <img src={a.asset_url} alt={a.title ?? a.prompt ?? 'image'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {isVideo && (
          a.thumbnail_url
            ? <img src={a.thumbnail_url} alt={a.title ?? 'video'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            : <video src={a.asset_url} className="absolute inset-0 h-full w-full object-cover" preload="metadata" muted playsInline />
        )}
        {isAudio && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
            <Music className="h-12 w-12 text-blue-400/80" strokeWidth={1.25} />
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/80 backdrop-blur">
            {a.media_type}
          </span>
          {a.generation_mode && (
            <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur">
              {a.generation_mode}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => onFavorite(a)} aria-label="Favorite">
            <Heart className={cn('h-4 w-4', a.is_favorite && 'fill-rose-400 text-rose-400')} />
          </Button>
          <a href={a.asset_url} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/10" aria-label="Open">
            <ExternalLink className="h-4 w-4" />
          </a>
          <a href={a.asset_url} download className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/10" aria-label="Download">
            <Download className="h-4 w-4" />
          </a>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-rose-500/20 hover:text-rose-200" onClick={() => onRemove(a.id)} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        <div className="truncate font-display text-sm text-white/90">{a.title ?? a.prompt?.slice(0, 60) ?? 'Untitled'}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
          <span>{fmtDate(a.created_at)}</span>
          {a.duration_seconds ? <><span>·</span><span>{Math.round(a.duration_seconds)}s</span></> : null}
          {a.engine ? <><span>·</span><span className="truncate">{a.engine}</span></> : null}
          {a.file_size_bytes ? <><span>·</span><span>{fmtBytes(a.file_size_bytes)}</span></> : null}
        </div>
        {isAudio && (
          <audio controls preload="none" src={a.asset_url} className="mt-2 w-full" />
        )}
      </div>
    </div>
  );
}

export default function MediaLibrary() {
  const [tab, setTab] = useState<'all' | MediaKind>('all');
  const { assets, loading, error, remove, toggleFavorite, refresh } = useMediaLibrary({
    mediaType: tab === 'all' ? null : tab,
    limit: 300,
  });

  const counts = useMemo(() => ({
    all: assets.length,
    image: assets.filter(a => a.media_type === 'image').length,
    video: assets.filter(a => a.media_type === 'video').length,
    audio: assets.filter(a => a.media_type === 'audio').length,
  }), [assets]);

  const handleRemove = async (id: string) => {
    try { await remove(id); toast.success('Removed from library'); }
    catch (e) { toast.error(`Could not remove: ${(e as Error).message}`); }
  };

  return (
    <PageShell width="full" className="max-w-[1800px]">
      <PageHeader
        eyebrow="Library"
        title="Media"
        description="Every image, audio, and video your account has generated — permanent and downloadable."
        actions={
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        }
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as any)}
          options={TABS.map(t => ({
            value: t.id,
            label: `${t.label}${tab === 'all' ? ` (${counts[t.id] ?? counts.all})` : ''}`,
          }))}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading && assets.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[16/10] animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.03]" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]">
            <Library className="h-8 w-8 text-muted-foreground" strokeWidth={1.25} />
          </div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Your library is empty</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Generated images, voiceovers, music, and video clips will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((a) => (
            <AssetCard key={a.id} a={a} onRemove={handleRemove} onFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </PageShell>
  );
}