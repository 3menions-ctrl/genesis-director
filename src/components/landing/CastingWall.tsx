/**
 * CastingWall — 24-tile wall of real Small Bridges-generated characters.
 *
 * Reads from `gallery_showcase` (avatar category) + falls back to
 * `avatar_catalog_entries` so the wall is always populated even before
 * any community contributions exist.
 *
 * Hover any tile → the small 2s autoplay video snippet plays (muted).
 * Click → opens the project's video URL in a new tab. No auth required.
 *
 * The Cast is intentional social proof: instead of corporate logos, the
 * audience sees the *output* of the platform — at scale, real, alive.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CastEntry {
  id: string;
  name: string;
  thumbnail_url: string | null;
  video_url: string | null;
  caption?: string | null;
}

const TILE_COUNT = 24;

export function CastingWall() {
  const [entries, setEntries] = useState<CastEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      // First pull avatar-category showcase rows (curated, public).
      const { data: showcase } = await supabase
        .from('gallery_showcase')
        .select('id, title, thumbnail_url, video_url, description')
        .eq('category', 'avatar')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(TILE_COUNT);

      const fromShowcase: CastEntry[] = (showcase ?? []).map((s) => ({
        id: s.id,
        name: s.title,
        thumbnail_url: s.thumbnail_url,
        video_url: s.video_url,
        caption: s.description,
      }));

      // Fill remaining tiles from the avatar catalog so the wall always
      // looks populated.
      let combined = [...fromShowcase];
      if (combined.length < TILE_COUNT) {
        const remaining = TILE_COUNT - combined.length;
        const { data: catalog } = await supabase
          .from('avatar_catalog_entries')
          .select('id, name, thumbnail_url, preview_video_url, category')
          .eq('enabled', true)
          .order('rank', { ascending: true })
          .limit(remaining);
        for (const e of catalog ?? []) {
          combined.push({
            id: e.id,
            name: e.name,
            thumbnail_url: e.thumbnail_url,
            video_url: (e as { preview_video_url?: string | null }).preview_video_url ?? null,
            caption: e.category,
          });
        }
      }

      if (cancelled) return;
      setEntries(combined);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative z-10 py-32 lg:py-40 px-6">
      <div className="max-w-[1480px] mx-auto">
        {/* Eyebrow */}
        <div className="text-center mb-10 lg:mb-14">
          <div className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">
            The Cast · This Week · Live
          </div>
          <h2
            className="font-display text-[36px] sm:text-[52px] lg:text-[64px] font-light text-white leading-[1.05]"
            style={{ fontVariant: 'small-caps' }}
          >
            Who&rsquo;s been cast in Small Bridges.
          </h2>
          <p className="text-white/55 text-[14px] sm:text-[16px] max-w-xl mx-auto mt-5 leading-relaxed">
            Characters built by our directors. Hover any tile to see them move.
          </p>
        </div>

        {/* Wall */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1 sm:gap-1.5 lg:gap-2">
          {(loading ? Array.from({ length: TILE_COUNT }) : entries.slice(0, TILE_COUNT)).map(
            (entry, i) =>
              entry ? (
                <CastTile key={(entry as CastEntry).id} entry={entry as CastEntry} index={i} />
              ) : (
                <SkeletonTile key={i} index={i} />
              ),
          )}
        </div>

        {/* Tail */}
        <div className="mt-8 flex items-center justify-center gap-3 text-[10px] font-mono uppercase tracking-[0.32em] text-white/30">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          <span>{entries.length || TILE_COUNT} characters ready to cast</span>
        </div>
      </div>
    </section>
  );
}

function CastTile({ entry, index }: { entry: CastEntry; index: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hover, setHover] = useState(false);

  const onEnter = () => {
    setHover(true);
    const v = videoRef.current;
    if (v && entry.video_url) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  };
  const onLeave = () => {
    setHover(false);
    videoRef.current?.pause();
  };

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      tabIndex={0}
      role="button"
      aria-label={`Cast member: ${entry.name}`}
      className="group relative aspect-[3/4] rounded-md overflow-hidden border border-white/[0.06] bg-glass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      style={{ animationDelay: `${index * 28}ms` }}
    >
      {entry.thumbnail_url ? (
        <img
          src={entry.thumbnail_url}
          alt={entry.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
      )}

      {entry.video_url && (
        <video
          ref={videoRef}
          src={entry.video_url}
          muted
          playsInline
          loop
          preload="none"
          className={[
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            hover ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      )}

      {/* Bottom name strip — appears on hover */}
      <div
        className={[
          'absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent transition-opacity',
          hover ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/85 truncate">
          {entry.name}
        </div>
      </div>

      {/* Card number — corner badge */}
      <div className="absolute top-1.5 left-1.5 font-mono text-[8px] uppercase tracking-[0.32em] text-white/55 tabular-nums px-1 py-0.5 rounded bg-black/40 backdrop-blur-md border border-white/10">
        #{String(index + 1).padStart(2, '0')}
      </div>
    </div>
  );
}

function SkeletonTile({ index }: { index: number }) {
  return (
    <div
      className="relative aspect-[3/4] rounded-md overflow-hidden border border-white/[0.05] bg-white/[0.015]"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: `app-shimmer ${2 + (index % 4) * 0.2}s linear infinite`,
        }}
      />
    </div>
  );
}

export default CastingWall;
