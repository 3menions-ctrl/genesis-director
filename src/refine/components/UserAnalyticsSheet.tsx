/**
 * UserAnalyticsSheet — the per-user analytics pop-up (slide-over).
 * Fetches analytics_user_summary(uid) and renders a comprehensive profile:
 * engagement, time-on-site, money (spend history + LTV), product, top pages,
 * searches, conversion. Opens from the Users list; the full page lives at
 * /admin/users/:id.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Eye, MousePointerClick, Timer, Coins, FolderKanban, Film, Search as SearchIcon, ArrowUpRight, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { AdminCard, StatusPill, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";

const RATE = 0.10; // $ per credit
const dur = (s: number) => { s = Math.round(s || 0); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`; };
const ago = (t?: string) => { if (!t) return "—"; const d = Math.round((Date.now() - new Date(t).getTime()) / 86400000); return d <= 0 ? "today" : `${d}d ago`; };

interface Bundle {
  profile?: { display_name?: string; account_type?: string; created_at?: string; onboarding_completed?: boolean };
  engagement?: { events?: number; pageviews?: number; sessions?: number; searches?: number; first_seen?: string; last_seen?: string };
  time_seconds?: number;
  top_pages?: { path: string; views: number }[];
  searches?: { q: string; n: number }[];
  product?: { projects?: number; completed?: number; published?: number };
  money?: { credits_purchased?: number; credits_spent?: number; balance?: number; paid?: boolean };
  spend_history?: { transaction_type: string; amount: number; balance_after: number; created_at: string }[];
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <AdminCard className="p-4">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
        <Icon className="h-3 w-3" style={{ color: ACCENT_HSL }} /> {label}
      </div>
      <div className="mt-2 font-display text-[22px] font-semibold tabular-nums text-white">{value}</div>
    </AdminCard>
  );
}

export function UserAnalyticsSheet({ userId, label, open, onClose }: { userId: string | null; label?: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true); setData(null);
    (async () => {
      const { data: res } = await supabase.rpc("analytics_user_summary" as never, { _uid: userId } as never);
      setData((res as Bundle) ?? {});
      setLoading(false);
    })();
  }, [open, userId]);

  const m = data?.money ?? {};
  const e = data?.engagement ?? {};
  const ltv = (m.credits_purchased ?? 0) * RATE;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-white/[0.06] bg-[#06070a] p-0 text-white sm:max-w-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#06070a]/80 px-6 py-5 backdrop-blur-xl">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: ACCENT_HSL }}>User analytics</div>
            <div className="mt-1 font-display text-[20px] font-semibold">{data?.profile?.display_name || label || (userId ? userId.slice(0, 8) : "")}</div>
            <div className="mt-1 flex items-center gap-2">
              {data?.profile?.account_type && <StatusPill tone="neutral">{data.profile.account_type}</StatusPill>}
              {m.paid ? <StatusPill tone="accent">Paid</StatusPill> : <StatusPill tone="neutral">Free</StatusPill>}
              <span className="font-mono text-[10px] text-white/35">joined {ago(data?.profile?.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userId && <Link to={`/admin/users/${userId}`} onClick={onClose} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 hover:bg-white/[0.1] hover:text-white">Full profile <ArrowUpRight className="h-3 w-3" /></Link>}
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading analytics…</div>
        ) : (
          <div className="space-y-6 px-6 pb-10">
            {/* engagement */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={Activity} label="Events" value={(e.events ?? 0).toLocaleString()} />
              <Stat icon={MousePointerClick} label="Sessions" value={(e.sessions ?? 0).toLocaleString()} />
              <Stat icon={Eye} label="Pageviews" value={(e.pageviews ?? 0).toLocaleString()} />
              <Stat icon={Timer} label="Time on site" value={dur(data?.time_seconds ?? 0)} />
            </div>

            {/* money */}
            <AdminCard className="p-5">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Monetization</div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div><div className="font-display text-[20px] font-semibold tabular-nums" style={{ color: ACCENT_HSL }}>${ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">LTV (est)</div></div>
                <div><div className="font-display text-[20px] font-semibold tabular-nums text-white">{(m.credits_purchased ?? 0).toLocaleString()}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Purchased</div></div>
                <div><div className="font-display text-[20px] font-semibold tabular-nums text-white">{(m.credits_spent ?? 0).toLocaleString()}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Spent</div></div>
                <div><div className="font-display text-[20px] font-semibold tabular-nums text-white">{(m.balance ?? 0).toLocaleString()}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Balance</div></div>
              </div>
            </AdminCard>

            {/* product */}
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={FolderKanban} label="Projects" value={(data?.product?.projects ?? 0).toLocaleString()} />
              <Stat icon={Activity} label="Completed" value={(data?.product?.completed ?? 0).toLocaleString()} />
              <Stat icon={Film} label="Published" value={(data?.product?.published ?? 0).toLocaleString()} />
            </div>

            {/* top pages + searches */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminCard className="p-5">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Top pages</div>
                {(data?.top_pages ?? []).length === 0 ? <div className="py-4 text-[12px] font-light text-white/40">No pageviews.</div> : (data?.top_pages ?? []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1 font-mono text-[12px]"><span className="truncate text-white/70">{p.path}</span><span className="tabular-nums text-white/45">{p.views}</span></div>
                ))}
              </AdminCard>
              <AdminCard className="p-5">
                <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40"><SearchIcon className="h-3 w-3" /> Searches</div>
                {(data?.searches ?? []).length === 0 ? <div className="py-4 text-[12px] font-light text-white/40">No searches.</div> : (data?.searches ?? []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-[12px]"><span className="truncate text-white/70">{s.q}</span><span className="tabular-nums text-white/45">{s.n}</span></div>
                ))}
              </AdminCard>
            </div>

            {/* spend history */}
            <AdminCard className="p-5">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Spend history</div>
              {(data?.spend_history ?? []).length === 0 ? <div className="py-4 text-[12px] font-light text-white/40">No transactions.</div> : (
                <div className="space-y-1.5">
                  {(data?.spend_history ?? []).map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="font-mono text-white/60">{t.transaction_type}</span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums" style={{ color: t.amount >= 0 ? CYAN : "rgba(255,255,255,0.55)" }}>{t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString()}</span>
                        <span className="font-mono text-[10px] text-white/30">{new Date(t.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default UserAnalyticsSheet;
