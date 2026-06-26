/**
 * Discover — categories (Videos · Reels · People) + unified search.
 * Videos = popular reels, Reels = freshest reels (both masonry, media-native
 * aspect). People = a swipe deck (right to follow). Search overrides the
 * category and returns reels + creators (search_everything).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Clapperboard, Sparkles, Users } from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MasonryGrid, MediaTile } from '@/components/native/MediaTile';
import { PeopleSwipe } from '@/components/discover/PeopleSwipe';
import { useAuth } from '@/contexts/AuthContext';
import { useReelsList, useSearchEverything, useDailyPrompt, useWorlds, type ReelHit } from '@/hooks/useDiscover';
import { FILMS } from '@/data/filmsLibrary';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const STATIC: ReelHit[] = FILMS.filter((f) => f.clips?.[0]).slice(0, 18).map((f) => ({ id: f.id, title: f.title, thumbnail_url: null, video_url: f.clips[0], world_slug: null, play_count: 0, creator_id: '' }));

type Cat = 'videos' | 'reels' | 'people';
const CATS = [
  { id: 'videos', label: 'Videos', icon: Clapperboard },
  { id: 'reels', label: 'Reels', icon: Sparkles },
  { id: 'people', label: 'People', icon: Users },
] as const;

export default function Discover() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<Cat>('videos');
  const [world, setWorld] = useState<string | null>(null);
  const worlds = useWorlds();
  const list = useReelsList(cat === 'reels' ? 'reels' : 'videos', world);
  const daily = useDailyPrompt();
  const search = useSearchEverything(query);
  const searching = query.trim().length > 0;

  // Only Videos falls back to the bundled films when empty; Reels (≤5s) stays accurate.
  const reels = !list.loading && list.reels.length === 0 && cat === 'videos' ? STATIC : list.reels;

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

        {/* Categories — borderless, floating icons with labels */}
        {!searching && (
          <div className="mt-5 flex items-center justify-around">
            {CATS.map((c) => {
              const on = cat === c.id;
              return (
                <button key={c.id} onClick={() => { void hapticTap(); setCat(c.id); }}
                  className={cn('flex flex-col items-center gap-1.5 transition-colors active:scale-95', on ? 'text-[#8fb4ff]' : 'text-white/45')}>
                  <span className="relative grid place-items-center">
                    {on && <span className="pointer-events-none absolute h-8 w-8 rounded-full bg-[#3f78ff]/30 blur-md" />}
                    <c.icon className="relative h-[22px] w-[22px]" strokeWidth={on ? 2.1 : 1.8} />
                  </span>
                  <span className="text-[11px] font-semibold">{c.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {!searching && daily && (
          <button onClick={() => { void hapticTap(); navigate(`/studio?tab=create&prompt=${encodeURIComponent(daily.prompt_text)}`); }}
            className="lit-edge relative mt-5 block w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2f6bff]/25 to-[#7a3bff]/15 p-4 text-left active:scale-[0.99]">
            {daily.cover_url && <img src={daily.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#7a3bff]/30 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9ab4ff]"><Sparkles className="h-3 w-3" /> Today's prompt</div>
              <div className="mt-1.5 font-display text-[16px] font-semibold leading-snug">{daily.prompt_text}</div>
              {daily.prompt_hint && <div className="mt-1 text-[12.5px] text-white/55">{daily.prompt_hint}</div>}
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">Make it →</div>
            </div>
          </button>
        )}

        {/* Worlds filter — borderless chips (Videos/Reels only) */}
        {!searching && cat !== 'people' && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <WorldChip label="All worlds" on={world === null} onClick={() => { void hapticTap(); setWorld(null); }} />
            {worlds.map((w) => <WorldChip key={w.slug} label={w.name} accent={`hsl(${w.accent_hsl})`} glyph={w.glyph} on={world === w.slug} onClick={() => { void hapticTap(); setWorld(w.slug); }} />)}
          </div>
        )}

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
                      <button key={c.id} onClick={() => navigate(`/u/${c.id}`)} className="surface-1 flex w-[112px] flex-none flex-col items-center gap-2 rounded-2xl p-3 text-center">
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
        ) : cat === 'people' ? (
          user ? <PeopleSwipe userId={user.id} /> : <Empty label="Sign in to discover creators." />
        ) : (
          <div className="mt-5">
            {list.loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
            ) : reels.length === 0 ? (
              <Empty label="Nothing here yet." />
            ) : (
              <ReelGrid reels={reels} onOpen={(id) => navigate(`/r/${id}`)} />
            )}
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
        <MediaTile key={r.id} src={r.thumbnail_url} videoSrc={r.video_url} title={r.title} play={r.play_count} onClick={() => onOpen(r.id)} />
      ))}
    </MasonryGrid>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{title}</div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-14 text-center text-[13px] text-white/40">{label}</div>;
}

function WorldChip({ label, on, accent, glyph, onClick }: { label: string; on: boolean; accent?: string; glyph?: string | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/55')}>
      {glyph && <span style={{ color: on ? '#fff' : accent }}>{glyph}</span>}{label}
    </button>
  );
}
