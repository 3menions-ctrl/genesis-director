/**
 * Discover — browse worlds, trending films, and unified search of reels +
 * creators. Wired to channel_worlds / published_reels / search_everything.
 * Aurora language; borderless. Falls back to the static film library so the
 * grid is never empty on first run / offline.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Compass } from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MasonryGrid, MediaTile } from '@/components/native/MediaTile';
import { useWorlds, useTrending, useSearchEverything, type ReelHit } from '@/hooks/useDiscover';
import { FILMS } from '@/data/filmsLibrary';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const STATIC: ReelHit[] = FILMS.filter((f) => f.clips?.[0]).slice(0, 18).map((f) => ({ id: f.id, title: f.title, thumbnail_url: null, world_slug: null, play_count: 0, creator_id: '' }));

export default function Discover() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [world, setWorld] = useState<string | null>(null);
  const worlds = useWorlds();
  const trending = useTrending(world);
  const search = useSearchEverything(query);
  const searching = query.trim().length > 0;

  const trendingReels = !trending.loading && trending.reels.length === 0 && !world ? STATIC : trending.reels;

  return (
    <div className="fixed inset-0 text-white">
      <AuroraBackdrop />
      <div className="relative z-10 h-full overflow-y-auto px-4" style={{ paddingTop: 'calc(var(--safe-top,0px) + 14px)', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)' }}>
        {/* Search */}
        <div className="surface-1 flex h-12 items-center gap-2.5 rounded-full px-4">
          <Search className="h-[18px] w-[18px] text-white/50" strokeWidth={1.8} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search films & creators" className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35" />
          {query && <button onClick={() => setQuery('')} aria-label="Clear" className="text-white/40"><X className="h-[18px] w-[18px]" /></button>}
        </div>

        {searching ? (
          search.loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
          ) : search.results.reels.length + search.results.creators.length === 0 ? (
            <Empty label={`No results for “${query.trim()}”`} />
          ) : (
            <div>
              {search.results.creators.length > 0 && (
                <Section title="Creators">
                  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                    {search.results.creators.map((c) => (
                      <button key={c.id} onClick={() => navigate(`/c/${c.id}`)} className="surface-1 flex w-[112px] flex-none flex-col items-center gap-2 rounded-2xl p-3 text-center">
                        {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] text-[15px] font-bold">{(c.display_name?.[0] ?? '?').toUpperCase()}</span>}
                        <span className="w-full truncate text-[12.5px] font-semibold">{c.display_name ?? 'Anonymous'}</span>
                        <span className="font-mono text-[9px] text-white/40">{compact(c.follower_count)} followers</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
              {search.results.reels.length > 0 && (
                <Section title="Films"><ReelGrid reels={search.results.reels} onOpen={(id) => navigate(`/r/${id}`)} /></Section>
              )}
            </div>
          )
        ) : (
          <div>
            {/* Worlds */}
            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
              <WorldChip label="All" active={!world} onClick={() => { void hapticTap(); setWorld(null); }} />
              {worlds.map((w) => (
                <WorldChip key={w.id} glyph={w.glyph} label={w.name} accent={w.accent_hsl} active={world === w.slug} onClick={() => { void hapticTap(); setWorld(world === w.slug ? null : w.slug); }} />
              ))}
            </div>

            {/* Trending */}
            <Section title={world ? `Top in ${worlds.find((w) => w.slug === world)?.name ?? world}` : 'Trending'} icon={Compass}>
              {trending.loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
              ) : trendingReels.length === 0 ? (
                <Empty label="Nothing here yet." />
              ) : (
                <ReelGrid reels={trendingReels} onOpen={(id) => navigate(`/r/${id}`)} />
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function ReelGrid({ reels, onOpen }: { reels: ReelHit[]; onOpen: (id: string) => void }) {
  // Each tile takes its media's own aspect ratio (no crop), flowed as masonry.
  return (
    <MasonryGrid cols={2}>
      {reels.map((r) => (
        <MediaTile key={r.id} src={r.thumbnail_url} title={r.title} play={r.play_count} onClick={() => onOpen(r.id)} />
      ))}
    </MasonryGrid>
  );
}

function WorldChip({ glyph, label, accent, active, onClick }: { glyph?: string | null; label: string; accent?: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors', active ? 'text-white' : 'text-white/55')}
      style={active ? { background: accent ? `hsl(${accent} / 0.22)` : 'rgba(143,180,255,.22)', boxShadow: `0 0 22px ${accent ? `hsl(${accent} / 0.3)` : 'rgba(143,180,255,.3)'}` } : { background: 'rgba(255,255,255,.05)' }}>
      {glyph && <span style={accent ? { color: `hsl(${accent})` } : undefined}>{glyph}</span>}
      {label}
    </button>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Compass; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-white/45" strokeWidth={1.8} />}
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-14 text-center text-[13px] text-white/40">{label}</div>;
}
