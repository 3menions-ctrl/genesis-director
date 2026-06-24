/**
 * AdminTrafficPage — web/traffic analytics over the first-party pageview stream.
 * Visitors · sessions · bounce rate · session duration · pages/session, a daily
 * visitors trend, top pages with time-on-page, top searches, and device/region
 * segments. All from our own analytics_events. No third party.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Activity, Search as SearchIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";

interface Traffic { visitors: number; sessions: number; pageviews: number; bounce_rate: number; avg_session_seconds: number; pages_per_session: number }
interface Daily { day: string; visitors: number; sessions: number; pageviews: number }
interface Page { path: string; views: number; visitors: number; avg_seconds: number }
interface SearchRow { query: string; searches: number; actors: number; avg_results: number }
interface Seg { key: string; sessions: number; visitors: number }

const dur = (s: number) => { s = Math.round(s); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

/** Inline loading / error / empty state used inside the shell body. */
function State({ kind, title, hint }: { kind: "loading" | "error" | "empty"; title: string; hint?: string }) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : Activity;
  const color = kind === "error" ? "hsl(350 90% 70%)" : "rgba(255,255,255,0.25)";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Icon className={`h-7 w-7 ${kind === "loading" ? "animate-spin" : ""}`} style={{ color }} />
      <p className="text-[15px] text-white/70">{title}</p>
      {hint && <p className="max-w-md text-[12px] text-white/40">{hint}</p>}
    </div>
  );
}

/** Borderless horizontal-bar segment list (devices / browsers / regions). */
function SegBars({ rows }: { rows: Seg[] }) {
  const max = Math.max(...rows.map((r) => r.sessions), 1);
  if (rows.length === 0) return <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No data yet.</div>;
  return (
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const [tr, dl, pg, sr, dv, br, rg] = await Promise.all([
        supabase.rpc("analytics_traffic" as never, {} as never),
        supabase.rpc("analytics_visitors_daily" as never, {} as never),
        supabase.rpc("analytics_top_pages" as never, {} as never),
        supabase.rpc("analytics_top_searches" as never, {} as never),
        supabase.rpc("analytics_segment" as never, { _dim: "device" } as never),
        supabase.rpc("analytics_segment" as never, { _dim: "browser" } as never),
        supabase.rpc("analytics_segment" as never, { _dim: "tz" } as never),
      ]);
      const firstErr = [tr, dl, pg, sr, dv, br, rg].find((r) => r.error)?.error;
      if (firstErr) { setError(firstErr.message); setLoading(false); return; }
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

  const pageRows = useMemo(() => pages.map((p, i) => ({
    _key: (p.path || "/") + i,
    path: <span className="font-mono text-[12.5px] text-white/85">{p.path || "/"}</span>,
    views: <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(p.views).toLocaleString()}</span>,
    visitors: <span className="tabular-nums text-white/60">{Number(p.visitors).toLocaleString()}</span>,
    avg_seconds: <span className="tabular-nums text-white/60">{dur(Number(p.avg_seconds))}</span>,
  })), [pages]);

  const searchRows = useMemo(() => searches.map((s, i) => ({
    _key: s.query + i,
    query: <span className="text-white/85">{s.query}</span>,
    searches: <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(s.searches).toLocaleString()}</span>,
    actors: <span className="tabular-nums text-white/60">{Number(s.actors).toLocaleString()}</span>,
    avg_results: <span className="tabular-nums text-white/60">{Number(s.avg_results)}</span>,
  })), [searches]);

  const isEmpty = !t && daily.length === 0 && pages.length === 0 && searches.length === 0;

  return (
    <AdminPageShell
      eyebrow="09 // TRAFFIC"
      code="TRF"
      title="Traffic"
      italic="& Engagement."
      description="Who's visiting, how long they stay, what they look at and search — straight from your own event stream. No third party."
      stats={[
        { label: "Visitors", value: (t?.visitors ?? 0).toLocaleString(), tone: "blue" },
        { label: "Sessions", value: (t?.sessions ?? 0).toLocaleString(), tone: "emerald" },
        { label: "Pageviews", value: (t?.pageviews ?? 0).toLocaleString(), tone: "neutral" },
        { label: "Bounce rate", value: `${t?.bounce_rate ?? 0}%`, tone: "amber", sub: "1-page sessions" },
        { label: "Avg session", value: dur(t?.avg_session_seconds ?? 0), tone: "neutral" },
        { label: "Pages / session", value: (t?.pages_per_session ?? 0).toLocaleString(), tone: "neutral" },
      ]}
    >
      {error ? (
        <State kind="error" title="Couldn't load traffic analytics" hint={error} />
      ) : loading ? (
        <State kind="loading" title="Loading traffic…" />
      ) : isEmpty ? (
        <State kind="empty" title="No traffic captured yet" hint="Visitors, sessions and pageviews appear here as your event stream fills." />
      ) : (
        <div className="space-y-14">
          <FloatSection title="Visitors" meta="last 30 days">
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
          </FloatSection>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="Top pages" meta="time-on-page">
              <FloatTable
                columns={[
                  { key: "path", label: "Page" },
                  { key: "views", label: "Views", align: "right" },
                  { key: "visitors", label: "Visitors", align: "right" },
                  { key: "avg_seconds", label: "Avg time", align: "right" },
                ]}
                rows={pageRows}
                empty="No pageviews yet."
              />
            </FloatSection>
            <FloatSection title={<span className="inline-flex items-center gap-2"><SearchIcon className="h-3.5 w-3.5" /> Top searches</span>}>
              <FloatTable
                columns={[
                  { key: "query", label: "Query" },
                  { key: "searches", label: "Searches", align: "right" },
                  { key: "actors", label: "People", align: "right" },
                  { key: "avg_results", label: "Avg results", align: "right" },
                ]}
                rows={searchRows}
                empty="No searches tracked yet."
              />
            </FloatSection>
          </div>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-3">
            <FloatSection title="Devices"><SegBars rows={device} /></FloatSection>
            <FloatSection title="Browsers"><SegBars rows={browser} /></FloatSection>
            <FloatSection title="Regions" meta="timezone"><SegBars rows={region} /></FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
