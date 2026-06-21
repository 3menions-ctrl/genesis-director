/**
 * AdminEventsPage — live Event Explorer for our first-party analytics engine.
 *
 * Two panes: per-event rollups (analytics_event_counts RPC) and a live feed of
 * the most recent raw events (auto-refreshing). All data from our own
 * analytics_events table — no third party.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Radio, Hash, Users, RefreshCw } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminCard, KpiTile, accent, ACCENT_HSL } from "@/admin/ui/primitives";
import { DataTable } from "@/admin/ui/DataTable";
import { cn } from "@/lib/utils";

interface Count { event: string; hits: number; actors: number }
interface Evt { id: number; name: string | null; user_id: string | null; anonymous_id: string | null; path: string | null; occurred_at: string | null }

const col = createColumnHelper<Count>();
const REFRESH_MS = 6000;

export default function AdminEventsPage() {
  const [counts, setCounts] = useState<Count[]>([]);
  const [feed, setFeed] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  const load = useCallback(async () => {
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.rpc("analytics_event_counts" as never, {} as never),
      supabase.from("analytics_events").select("id,name,user_id,anonymous_id,path,occurred_at").order("occurred_at", { ascending: false }).limit(80),
    ]);
    setCounts(((c as Count[]) ?? []));
    setFeed(((f as Evt[]) ?? []));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const totalHits = useMemo(() => counts.reduce((a, c) => a + Number(c.hits), 0), [counts]);
  const totalActors = useMemo(() => Math.max(0, ...counts.map((c) => Number(c.actors))), [counts]);

  const columns = useMemo(() => [
    col.accessor("event", { header: "Event", cell: (c) => <span className="font-mono text-[13px] text-white/90">{c.getValue()}</span> }),
    col.accessor("hits", { header: "Hits", cell: (c) => <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(c.getValue()).toLocaleString()}</span> }),
    col.accessor("actors", { header: "Actors", cell: (c) => <span className="tabular-nums text-white/60">{Number(c.getValue()).toLocaleString()}</span> }),
  ], []);

  const actor = (e: Evt) => e.user_id ? e.user_id.slice(0, 8) : e.anonymous_id ? `anon·${e.anonymous_id.slice(0, 6)}` : "—";
  const ago = (t: string | null) => {
    if (!t) return "";
    const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));
    return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader
        eyebrow="First-party analytics"
        title={<>Event <span className="italic">explorer</span>.</>}
        sub="Live, owned product analytics — every tracked event in your own database. No third party, no limits."
        actions={
          <button onClick={() => setLive((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white">
            <Radio className={cn("h-3 w-3", live && "animate-pulse")} style={live ? { color: ACCENT_HSL } : undefined} />
            {live ? "Live" : "Paused"}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile index={0} label="Distinct events" value={counts.length} icon={Hash} />
        <KpiTile index={1} label="Hits · 7d" value={totalHits} icon={Activity} accentNumber />
        <KpiTile index={2} label="Peak actors" value={totalActors} icon={Users} />
        <KpiTile index={3} label="In feed" value={feed.length} icon={RefreshCw} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Events · last 7 days</div>
          {loading ? <div className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
            : <DataTable columns={columns as never} data={counts} dense empty="No events tracked yet — browse the app to generate some." />}
        </div>
        <div>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Live feed</div>
          <AdminCard className="max-h-[520px] overflow-y-auto p-2">
            {feed.length === 0 && <div className="px-3 py-10 text-center text-[13px] font-light text-white/40">Waiting for events…</div>}
            {feed.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT_HSL, boxShadow: `0 0 8px ${accent(0.8)}` }} />
                <span className="font-mono text-[12px] text-white/90">{e.name}</span>
                <span className="truncate font-mono text-[11px] text-white/35">{e.path}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-white/40">{actor(e)}</span>
                <span className="shrink-0 font-mono text-[10px] text-white/30">{ago(e.occurred_at)}</span>
              </div>
            ))}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
