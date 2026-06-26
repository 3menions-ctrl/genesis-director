/**
 * Leaderboard — global XP ranking (top 100) from the `leaderboard` view via
 * useGamification. Podium for the top 3, your row pinned + highlighted.
 */
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Crown, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/hooks/useGamification';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const PODIUM = ['#ffd76b', '#cbd5e1', '#e8a87c'];

export default function Leaderboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { leaderboard, leaderboardLoading } = useGamification();
  const rows = (leaderboard ?? []).filter((r) => r.user_id);
  // Podium only when there are 3+ ranks; otherwise show everyone as a plain list
  // (a 1-2 row board must NOT render blank).
  const hasPodium = rows.length >= 3;
  const top3 = hasPodium ? rows.slice(0, 3) : [];
  const rest = hasPodium ? rows.slice(3) : rows;
  const me = rows.find((r) => r.user_id === user?.id);

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-[18px] w-[18px]" /></button>
        <h1 className="font-display text-[20px] font-semibold">Leaderboard</h1>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 90px)' }}>
        {leaderboardLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-white/40">No ranks yet — make something to climb.</div>
        ) : (
          <>
            {/* Podium */}
            {top3.length === 3 && (
              <div className="mt-2 flex items-end justify-center gap-3">
                {[1, 0, 2].map((idx) => {
                  const r = top3[idx]; if (!r) return null;
                  const h = idx === 0 ? 'h-[112px]' : 'h-[88px]';
                  return (
                    <button key={r.user_id} onClick={() => { void hapticTap(); if (r.user_id && r.user_id !== user?.id) navigate(`/u/${r.user_id}`); }} className="flex w-1/3 flex-col items-center">
                      <div className="relative">
                        {r.avatar_url ? <img src={r.avatar_url} alt="" className={cn('rounded-full object-cover', idx === 0 ? 'h-16 w-16' : 'h-14 w-14')} style={{ boxShadow: `0 0 0 2px ${PODIUM[idx]}` }} /> : <span className={cn('grid place-items-center rounded-full bg-white/10 font-display font-bold', idx === 0 ? 'h-16 w-16 text-xl' : 'h-14 w-14 text-lg')} style={{ boxShadow: `0 0 0 2px ${PODIUM[idx]}` }}>{(r.display_name ?? '?').charAt(0)}</span>}
                        {idx === 0 && <Crown className="absolute -top-3 left-1/2 h-[18px] w-[18px] -translate-x-1/2 text-[#ffd76b]" />}
                      </div>
                      <span className="mt-1.5 max-w-full truncate text-[12.5px] font-semibold">{r.display_name ?? 'Anon'}</span>
                      <span className="font-mono text-[11px] text-[#8fb4ff]">{compact(r.xp_total ?? 0)} XP</span>
                      <div className={cn('mt-1.5 w-full rounded-t-xl bg-gradient-to-b from-white/[0.12] to-white/[0.03]', h)} style={{ boxShadow: `inset 0 1px 0 ${PODIUM[idx]}55` }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* The rest */}
            <div className="mt-5 space-y-2">
              {rest.map((r) => <Row key={r.user_id} r={r} me={r.user_id === user?.id} onClick={() => { if (r.user_id && r.user_id !== user?.id) navigate(`/u/${r.user_id}`); }} />)}
            </div>
          </>
        )}
      </div>

      {/* My pinned row */}
      {me && (me.rank ?? 0) > 3 && (
        <div className="fixed inset-x-0 z-20 px-4" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 12px)' }}>
          <Row r={me} me onClick={() => navigate('/you')} />
        </div>
      )}
    </div>
  );
}

function Row({ r, me, onClick }: { r: { user_id: string | null; display_name: string | null; avatar_url: string | null; level: number | null; xp_total: number | null; current_streak: number | null; rank: number | null }; me?: boolean; onClick: () => void }) {
  return (
    <button onClick={() => { void hapticTap(); onClick(); }} className={cn('flex w-full items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left', me ? 'msg-glass-accent' : 'msg-glass')}>
      <span className="w-7 shrink-0 text-center font-mono text-[13px] font-bold text-white/55">{r.rank ?? '—'}</span>
      {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 font-display font-bold">{(r.display_name ?? '?').charAt(0)}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{r.display_name ?? 'Anon'}{me && <span className="ml-1.5 text-[11px] text-[#8fb4ff]">You</span>}</span>
        <span className="flex items-center gap-2 text-[11.5px] text-white/45">Lv {r.level ?? 1}{(r.current_streak ?? 0) > 0 && <span className="flex items-center gap-0.5 text-[#ff8a3b]"><Flame className="h-3 w-3" />{r.current_streak}</span>}</span>
      </span>
      <span className="shrink-0 font-mono text-[13px] font-bold text-[#8fb4ff]">{compact(r.xp_total ?? 0)}<span className="text-[10px] text-white/40"> XP</span></span>
    </button>
  );
}
