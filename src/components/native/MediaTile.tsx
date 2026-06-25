/**
 * MediaTile + MasonryGrid — gallery tiles that take the media's OWN aspect ratio.
 *
 * The container is sized BY the media (img width 100%, height auto), so the
 * thumbnail is never cropped or letterboxed — the tile's aspect ratio always
 * equals the media's. Tiles flow in a CSS-columns masonry so mixed ratios stack
 * cleanly. Items with no thumbnail use a single sensible default ratio.
 */
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

export function MasonryGrid({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return <div className={cn(cols === 3 ? 'columns-3 gap-2.5' : 'columns-2 gap-3')}>{children}</div>;
}

export function MediaTile({
  src, title, play, badge, onClick, width, fallbackRatio = '16 / 9',
}: {
  src?: string | null;
  title?: string | null;
  play?: number | null;
  badge?: string | null;
  onClick?: () => void;
  /** Fixed width (e.g. for a horizontal rail). Omit for masonry (full column width). */
  width?: number;
  /** CSS aspect-ratio used only when there's no thumbnail to measure. */
  fallbackRatio?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('lit-edge relative block overflow-hidden rounded-[16px] bg-black/30 text-left align-top', width ? 'flex-none' : 'mb-3 w-full break-inside-avoid')}
      style={width ? { width } : undefined}
    >
      {src ? (
        // Natural aspect ratio: the tile is sized BY the image (never cropped).
        <img src={src} alt={title ?? ''} loading="lazy" className="block w-full" />
      ) : (
        <div className="w-full bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]" style={{ aspectRatio: fallbackRatio }} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent" />
      {title && <span className="absolute inset-x-0 bottom-0 truncate px-2.5 py-2 font-display text-[12.5px] font-semibold drop-shadow">{title}</span>}
      {badge && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white/90">{badge}</span>}
      {play != null && play > 0 && (
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] font-semibold"><Play className="h-2.5 w-2.5 fill-white" />{compact(play)}</span>
      )}
    </button>
  );
}
