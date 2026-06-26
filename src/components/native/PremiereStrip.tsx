/**
 * PremiereStrip — surfaces upcoming/live premieres (Discover). Backend already
 * had premieres + rsvp_premiere; this is the missing native UI. Tap a card to
 * watch (live → the reel); tap RSVP to reserve (idempotent rsvp_premiere, which
 * notifies the creator + bumps the count).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Premiere { id: string; title: string; starts_at: string; status: string; rsvp_count: number; creator_id: string; reel_id: string | null; host?: { name: string; avatar: string | null } }

function whenLabel(iso: string, status: string): string {
  if (status === 'live') return 'LIVE';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'starting';
  const h = Math.round(ms / 3.6e6);
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 6e4))}m`;
  if (h < 24) return `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}

export function PremiereStrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<Premiere[]>([]);
  const [going, setGoing] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.from('premieres' as never)
          .select('id, title, starts_at, status, rsvp_count, creator_id, reel_id')
          .in('status', ['scheduled', 'live']).order('starts_at', { ascending: true }).limit(10);
        const rows = (data ?? []) as unknown as Premiere[];
        if (!rows.length) { if (!cancel) setItems([]); return; }
        const ids = [...new Set(rows.map((r) => r.creator_id))];
        const { data: pd } = await supabase.from('profiles_public' as never).select('id, display_name, avatar_url').in('id', ids);
        const profs: Record<string, { name: string; avatar: string | null }> = {};
        for (const p of ((pd ?? []) as unknown as { id: string; display_name: string | null; avatar_url: string | null }[])) profs[p.id] = { name: p.display_name ?? 'Creator', avatar: p.avatar_url };
        if (user) {
          const { data: mine } = await supabase.from('premiere_rsvps' as never).select('premiere_id').eq('user_id', user.id).in('premiere_id', rows.map((r) => r.id));
          if (!cancel) setGoing(new Set(((mine ?? []) as unknown as { premiere_id: string }[]).map((r) => r.premiere_id)));
        }
        if (!cancel) setItems(rows.map((r) => ({ ...r, host: profs[r.creator_id] })));
      } catch { if (!cancel) setItems([]); }
    })();
    return () => { cancel = true; };
  }, [user]);

  const rsvp = async (p: Premiere) => {
    void hapticTap();
    if (!user) { navigate('/auth'); return; }
    setGoing((g) => new Set(g).add(p.id));
    setItems((its) => its.map((x) => (x.id === p.id ? { ...x, rsvp_count: x.rsvp_count + 1 } : x)));
    try { const { error } = await supabase.rpc('rsvp_premiere' as never, { p_premiere_id: p.id } as never); if (error) throw error; toast.success(`You're going to "${p.title}"`); }
    catch { setGoing((g) => { const n = new Set(g); n.delete(p.id); return n; }); }
  };

  if (!items.length) return null;

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45"><Radio className="h-3.5 w-3.5 text-[#ff8aa0]" />Premieres</div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {items.map((p) => {
          const live = p.status === 'live';
          const isGoing = going.has(p.id);
          return (
            <button key={p.id} onClick={() => { void hapticTap(); if (live) { if (p.reel_id) navigate(`/r/${p.reel_id}`); } else rsvp(p); }}
              aria-label={live ? `Watch ${p.title}` : isGoing ? `Going to ${p.title}` : `RSVP to ${p.title}`}
              className="flex w-[86px] shrink-0 flex-col items-center text-center transition-transform active:scale-95">
              {/* Circular card — story-ring tells you live (red) / RSVP'd (green) / upcoming (blue) */}
              <span className={cn('relative grid place-items-center rounded-full p-[2.5px]', live ? 'bg-gradient-to-br from-[#ff3b5c] to-[#ff8a3b]' : isGoing ? 'bg-[#5ee08a]/75' : 'bg-[#7aa2ff]/45')}>
                {p.host?.avatar
                  ? <img src={p.host.avatar} alt="" className="h-[70px] w-[70px] rounded-full object-cover" />
                  : <span className="grid h-[70px] w-[70px] place-items-center rounded-full bg-[#241a3d] font-display text-xl font-bold">{(p.host?.name ?? 'P').charAt(0)}</span>}
                {live ? (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#ff3b5c] px-1.5 py-[1px] font-mono text-[8px] font-bold uppercase tracking-wide ring-2 ring-[#0b0b14]">Live</span>
                ) : (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-1.5 py-[1px] font-mono text-[8px] font-semibold backdrop-blur-md ring-2 ring-[#0b0b14]">{whenLabel(p.starts_at, p.status)}</span>
                )}
                {isGoing && !live && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#5ee08a] ring-2 ring-[#0b0b14]"><Check className="h-3 w-3 text-black" strokeWidth={3} /></span>}
              </span>
              <span className="mt-2.5 line-clamp-1 w-full text-[11.5px] font-medium">{p.title}</span>
              <span className="text-[10px] text-white/45">{p.rsvp_count} going</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
