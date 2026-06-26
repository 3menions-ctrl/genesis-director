/**
 * PremiereStrip — surfaces upcoming/live premieres (Discover). Backend already
 * had premieres + rsvp_premiere; this is the missing native UI. Tap a card to
 * watch (live → the reel); tap RSVP to reserve (idempotent rsvp_premiere, which
 * notifies the creator + bumps the count).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Calendar, Check, Users, Play, CalendarPlus } from 'lucide-react';
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
            <div key={p.id} className="lit-edge relative w-[230px] shrink-0 overflow-hidden rounded-[18px] bg-gradient-to-b from-[#241a3d] to-[#0b0b12]">
              <button onClick={() => { void hapticTap(); if (p.reel_id) navigate(`/r/${p.reel_id}`); }} className="block w-full text-left">
                {p.host?.avatar && <img src={p.host.avatar} alt="" className="h-28 w-full object-cover opacity-80" />}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-t from-[#0b0b12] to-transparent" />
                <span className={cn('absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide backdrop-blur-md', live ? 'bg-[#ff3b5c] text-white' : 'bg-black/55 text-white/85')}>
                  {live ? <><span className="h-1.5 w-1.5 rounded-full bg-white" />Live</> : <><Calendar className="h-2.5 w-2.5" />{whenLabel(p.starts_at, p.status)}</>}
                </span>
              </button>
              <div className="px-3 pb-3 pt-1.5">
                <div className="truncate font-display text-[14px] font-semibold">{p.title}</div>
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-white/50"><Users className="h-3 w-3" />{p.rsvp_count} going · {p.host?.name ?? 'Creator'}</div>
                <div className="flex justify-center">
                  <button onClick={() => { void hapticTap(); if (live) { if (p.reel_id) navigate(`/r/${p.reel_id}`); } else rsvp(p); }} disabled={!live && isGoing}
                    aria-label={live ? 'Watch live' : isGoing ? 'Going' : 'RSVP'}
                    className={cn('grid h-11 w-11 place-items-center drop-shadow-[0_2px_8px_rgba(0,0,0,.7)] transition-transform active:scale-90',
                      live ? 'text-[#ff7a96]' : isGoing ? 'text-white/55' : 'text-[#9fc6ff]')}>
                    {live ? <Play className="h-[22px] w-[22px] fill-current" /> : isGoing ? <Check className="h-[22px] w-[22px]" strokeWidth={2.6} /> : <CalendarPlus className="h-[22px] w-[22px]" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
