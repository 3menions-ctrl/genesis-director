/**
 * MobileLibrary — manage your own content: published Films and Drafts
 * (movie_projects). Tap to open (reel viewer / editor); delete drafts (with
 * confirm). Media-native aspect tiles, borderless/floating glass over Aurora.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Loader2, Film, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMyFilms } from '@/hooks/useMyFilms';
import { useDrafts } from '@/hooks/useProfileData';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MasonryGrid, MediaTile } from '@/components/native/MediaTile';
import { confirmAsync } from '@/components/ui/global-confirm';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

type Tab = 'films' | 'drafts';

export default function MobileLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('films');
  const { films, loading: filmsLoading } = useMyFilms();
  const drafts = useDrafts(user?.id, tab === 'drafts');
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const del = async (id: string) => {
    void hapticTap();
    const ok = await confirmAsync({ title: 'Delete draft?', description: 'This permanently removes the project and its clips.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    setRemoved((p) => new Set(p).add(id));
    try {
      const { error } = await supabase.from('movie_projects' as never).delete().eq('id', id);
      if (error) throw error;
      toast.success('Draft deleted');
    } catch {
      setRemoved((p) => { const n = new Set(p); n.delete(id); return n; });
      toast.error('Could not delete');
    }
  };

  const draftItems = drafts.items.filter((d) => !removed.has(d.id));

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-semibold">Library</h1>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)' }}>
        <div className="mt-3 flex items-center justify-center gap-10">
          {([['films', Film, 'Films'], ['drafts', Layers, 'Drafts']] as const).map(([id, Icon, label]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => { void hapticTap(); setTab(id); }} className={cn('flex flex-col items-center gap-1.5 transition-colors active:scale-95', on ? 'text-[#8fb4ff]' : 'text-white/45')}>
                <span className="relative grid place-items-center">{on && <span className="pointer-events-none absolute h-8 w-8 rounded-full bg-[#3f78ff]/30 blur-md" />}<Icon className="relative h-[20px] w-[20px]" strokeWidth={on ? 2.1 : 1.8} /></span>
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {tab === 'films' ? (
            filmsLoading ? <Spin /> : films.length === 0 ? <Empty label="No published films yet." /> : (
              <MasonryGrid cols={2}>
                {films.map((f) => <MediaTile key={f.id} src={f.thumbnail_url} title={f.title} play={f.play_count} onClick={() => navigate(`/r/${f.id}`)} />)}
              </MasonryGrid>
            )
          ) : (
            drafts.loading ? <Spin /> : draftItems.length === 0 ? <Empty label="No drafts in progress." /> : (
              <MasonryGrid cols={2}>
                {draftItems.map((d) => (
                  <div key={d.id} className="lit-edge relative mb-3 w-full break-inside-avoid overflow-hidden rounded-[16px] bg-black/30 align-top">
                    <button onClick={() => navigate(`/editor/${d.id}`)} className="block w-full text-left">
                      {d.thumbnail_url ? <img src={d.thumbnail_url} alt={d.title} className="block w-full" /> : <div className="aspect-video w-full bg-gradient-to-br from-[#241a3a] to-[#0a0a0a]" />}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 truncate px-2.5 py-2 font-display text-[12.5px] font-semibold drop-shadow">{d.title}</span>
                      {d.status && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wide text-white/90">{d.status}</span>}
                    </button>
                    <button onClick={() => del(d.id)} aria-label="Delete draft" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur-md active:scale-90">
                      <Trash2 className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                ))}
              </MasonryGrid>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Spin() { return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>; }
function Empty({ label }: { label: string }) { return <div className="py-16 text-center text-[13px] text-white/40">{label}</div>; }
