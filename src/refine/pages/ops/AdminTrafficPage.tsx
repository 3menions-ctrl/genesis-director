/**
 * AdminTrafficPage — web/traffic analytics over the first-party pageview stream.
 * Visitors · sessions · bounce rate · session duration · pages/session, a daily
 * visitors trend, top pages with time-on-page, top searches, and device/region
 * segments. All from our own analytics_events. No third party.
 */
import { useEffect, useMemo, useState } from "react";
import { Users, MousePointerClick, Timer, Layers, TrendingDown, Eye, Search as SearchIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { createColumnHelper } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminCard, KpiTile, ChartCard, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";
import { DataTable } from "@/admin/ui/DataTable";

interface Traffic { visitors: number; sessions: number; pageviews: number; bounce_rate: number; avg_session_seconds: number; pages_per_session: number }
interface Daily { day: string; visitors: number; sessions: number; pageviews: number }
interface Page { path: string; views: number; visitors: number; avg_seconds: number }
interface SearchRow { query: string; searches: number; actors: number; avg_results: number }
interface Seg { key: string; sessions: number; visitors: number }

const dur = (s: number) => { s = Math.round(s); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
const pcol = createColumnHelper<Page>();
const scol = createColumnHelper<SearchRow>();

function SegBars({ title, rows }: { title: string; rows: Seg[] }) {
  const max = Math.max(...rows.map((r) => r.sessions), 1);
  return (
    <AdminCard className="p-5">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">{title}</div>
      {rows.length === 0 ? <div className="py-6 text-center text-[13px] font-light text-white/40">No data yet.</div> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="relative overflow-hidden rounded-lg px-3 py-2">
              <div aria-hidden className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(r.sessions / max) * 100}%`, background: accent(0.12) }} />
              <div className="relative flex items-center justify-between text-[12.5px]">
                <span className="text-white/75">{r.key}</span>
                <span className="tabular-nums text-white/45">{r.sessions.toLocaleString()} <span className="text-white/25">sess</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}

export default function AdminTrafficPage() {
  const [t, setT] = useState<Traffic | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [device, setDevice] = useState<Seg[]>([]);
  const [browser, setBrowser] = useState<Seg[]>([]);
  const [region, setRegion] = useState<Seg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tr, dl, pg, sr, dv, br, rg] = await Promise.all([
        supabase.rpc("analytics_traffic" as never, {} as never),
        supabase.rpc("analytics_visitors_daily" as never, {} as never),
        supabase.rpc("analytics_top_pages" as never, {} as never),
        supabase.rpc("analytics_top_searches" as never, {} as never),
        supabase.rpc("analytics_segment" as never, { _dim: "device" } as never),
        supabase.rpc("analytics_segment" as never, { _dim: "browser" } as never),
        supabase.rpc("analytics_segment" as never, { _dim: "tz" } as never),
      ]);
      setT(((tr.data as Traffic[]) ?? [])[0] ?? null);
      setDaily(((dl.data as Daily[]) ?? []).map((d) => ({ ...d, day: String(d.day).slice(5) })));
      setPages(((pg.data as Page[]) ?? []));
      setSearches(((sr.data as SearchRow[]) ?? []));
      setDevice(((dv.data as Seg[]) ?? []));
      setBrowser(((br.data as Seg[]) ?? []));
      setRegion(((rg.data as Seg[]) ?? []));
      setLoading(false);
    })();
  }, []);

  const pageCols = useMemo(() => [
    pcol.accessor("path", { header: "Page", cell: (c) => <span className="font-mono text-[12.5px] text-white/85">{c.getValue() || "/"}</span> }),
    pcol.accessor("views", { header: "Views", cell: (c) => <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(c.getValue()).toLocaleString()}</span> }),
    pcol.accessor("visitors", { header: "Visitors", cell: (c) => <span className="tabular-nums text-white/60">{Number(c.getValue()).toLocaleString()}</span> }),
    pcol.accessor("avg_seconds", { header: "Avg time", cell: (c) => <span className="tabular-nums text-white/60">{dur(Number(c.getValue()))}</span> }),
  ], []);
  const searchCols = useMemo(() => [
    scol.accessor("query", { header: "Query", cell: (c) => <span className="text-white/85">{c.getValue()}</span> }),
    scol.accessor("searches", { header: "Searches", cell: (c) => <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(c.getValue()).toLocaleString()}</span> }),
    scol.accessor("actors", { header: "People", cell: (c) => <span className="tabular-nums text-white/60">{Number(c.getValue()).toLocaleString()}</span> }),
    scol.accessor("avg_results", { header: "Avg results", cell: (c) => <span className="tabular-nums text-white/60">{Number(c.getValue())}</span> }),
  ], []);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="First-party analytics" title={<>Traffic.</>} sub="Who's visiting, how long they stay, what they look at and search — straight from your own event stream." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile index={0} label="Visitors" value={t?.visitors ?? 0} icon={Users} />
        <KpiTile index={1} label="Sessions" value={t?.sessions ?? 0} icon={MousePointerClick} accentNumber />
        <KpiTile index={2} label="Pageviews" value={t?.pageviews ?? 0} icon={Eye} />
        <KpiTile index={3} label="Bounce rate" value={`${t?.bounce_rate ?? 0}%`} icon={TrendingDown} deltaLabel="1-page sessions" />
        <KpiTile index={4} label="Avg session" value={dur(t?.avg_session_seconds ?? 0)} icon={Timer} />
        <KpiTile index={5} label="Pages / session" value={t?.pages_per_session ?? 0} icon={Layers} />
      </div>

      <ChartCard title="Visitors" meta="last 30 days" className="mb-6">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="tFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.55} /><stop offset="55%" stopColor={CYAN} stopOpacity={0.2} /><stop offset="100%" stopColor={CYAN} stopOpacity={0} /></linearGradient>
                <linearGradient id="tStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
              <Area type="monotone" dataKey="visitors" stroke="url(#tStroke)" strokeWidth={2.5} fill="url(#tFill)" dot={false} activeDot={{ r: 4, fill: CYAN }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Top pages · time-on-page</div>
          {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
            : <DataTable columns={pageCols as never} data={pages} dense empty="No pageviews yet." />}
        </div>
        <div>
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40"><SearchIcon className="h-3 w-3" /> Top searches</div>
          {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
            : <DataTable columns={searchCols as never} data={searches} dense empty="No searches tracked yet." />}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SegBars title="Devices" rows={device} />
        <SegBars title="Browsers" rows={browser} />
        <SegBars title="Regions · timezone" rows={region} />
      </div>
    </div>
  );
}
