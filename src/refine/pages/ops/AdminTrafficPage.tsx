/**
 * AdminTrafficPage — first-party web/traffic analytics over our own pageview
 * stream (analytics_events). HUMANS ONLY: admin browsing + headless/automation
 * UAs are filtered server-side (analytics_is_human), so the numbers are real.
 *
 * Surfaces: KPI cards with period-over-period deltas · daily visitors trend ·
 * new-vs-returning · acquisition funnel · channel attribution · hour×day
 * heatmap · top pages (time-on-page) · top searches · device/browser/region.
 * No third party.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Activity, Search as SearchIcon, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";

interface Traffic { visitors: number; sessions: number; pageviews: number; bounce_rate: number; avg_session_seconds: number; pages_per_session: number }
interface Daily { day: string; visitors: number; sessions: number; pageviews: number }
interface Page { path: string; views: number; visitors: number; avg_seconds: number }
interface SearchRow { query: string; searches: number; actors: number; avg_results: number }
interface Seg { key: string; sessions: number; visitors: number }
interface Channel { channel: string; sessions: number; visitors: number; pageviews: number }
interface NewRet { day: string; new_visitors: number; returning_visitors: number }
interface HeatCell { dow: number; hour: number; pageviews: number }
interface FunnelStep { step: string; step_order: number; actors: number }
interface Kpi { metric: string; current_value: number; previous_value: number; delta_pct: number | null }

const dur = (s: number) => { s = Math.round(s); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function SegBars({ rows, unit = "sess" }: { rows: Seg[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.sessions), 1);
  if (rows.length === 0) return <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No data yet.</div>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="relative overflow-hidden rounded-lg px-3 py-2">
          <div aria-hidden className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(r.sessions / max) * 100}%`, background: accent(0.12) }} />
          <div className="relative flex items-center justify-between text-[12.5px]">
            <span className="text-white/75">{r.key}</span>
            <span className="tabular-nums text-white/45">{r.sessions.toLocaleString()} <span className="text-white/25">{unit}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Acquisition funnel — horizontal bars with step-to-step drop-off. */
function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(steps[0]?.actors ?? 0, 1);
  if (steps.length === 0) return <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No funnel data yet.</div>;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const pct = (s.actors / top) * 100;
        const prev = i === 0 ? null : steps[i - 1].actors;
        const conv = prev ? Math.round((s.actors / Math.max(prev, 1)) * 100) : 100;
        return (
          <div key={s.step}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-white/75">{s.step}</span>
              <span className="tabular-nums text-white/45">{s.actors.toLocaleString()} {i > 0 && <span className="text-white/30">· {conv}%</span>}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT_HSL}, ${CYAN})` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Hour-of-day × day-of-week heatmap (visitor local time). */
function Heatmap({ cells }: { cells: HeatCell[] }) {
  const grid = useMemo(() => {
    const m = new Map<string, number>();
    let max = 1;
    for (const c of cells) { m.set(`${c.dow}-${c.hour}`, c.pageviews); if (c.pageviews > max) max = c.pageviews; }
    return { m, max };
  }, [cells]);
  if (cells.length === 0) return <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No data yet.</div>;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="ml-9 mb-1 grid" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
          {Array.from({ length: 24 }).map((_, h) => <div key={h} className="text-center font-mono text-[8px] text-white/25">{h % 6 === 0 ? `${h}h` : ""}</div>)}
        </div>
        {DOW.map((day, d) => (
          <div key={day} className="mb-0.5 flex items-center gap-1">
            <span className="w-8 font-mono text-[9px] uppercase tracking-wide text-white/35">{day}</span>
            <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
              {Array.from({ length: 24 }).map((_, h) => {
                const v = grid.m.get(`${d}-${h}`) ?? 0;
                const o = v === 0 ? 0.03 : 0.12 + (v / grid.max) * 0.78;
                return <div key={h} title={`${day} ${h}:00 — ${v} views`} className="aspect-square rounded-[2px]" style={{ background: v === 0 ? "rgba(255,255,255,0.03)" : accent(o) }} />;
              })}
            </div>
          </div>
        ))}
      </div>
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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newRet, setNewRet] = useState<NewRet[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [kpis, setKpis] = useState<Record<string, Kpi>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const [tr, dl, pg, sr, dv, br, rg, ch, nr, hm, fn, kp] = await Promise.all([
        supabase.rpc("analytics_traffic" as never, {} as never),
        supabase.rpc("analytics_visitors_daily" as never, {} as never),
        supabase.rpc("analytics_top_pages" as never, {} as never),
        supabase.rpc("analytics_top_searches" as never, {} as never),
        supabase.rpc("analytics_segment" as never, { _dim: "device" } as never),
        supabase.rpc("analytics_segment" as never, { _dim: "browser" } as never),
        supabase.rpc("analytics_segment" as never, { _dim: "tz" } as never),
        supabase.rpc("analytics_channels" as never, {} as never),
        supabase.rpc("analytics_new_returning" as never, {} as never),
        supabase.rpc("analytics_heatmap" as never, {} as never),
        supabase.rpc("analytics_funnel" as never, {} as never),
        supabase.rpc("analytics_kpis" as never, {} as never),
      ]);
      const firstErr = [tr, dl, pg, sr, dv, br, rg, ch, nr, hm, fn, kp].find((r) => r.error)?.error;
      if (firstErr) { setError(firstErr.message); setLoading(false); return; }
      setT(((tr.data as Traffic[]) ?? [])[0] ?? null);
      setDaily(((dl.data as Daily[]) ?? []).map((d) => ({ ...d, day: String(d.day).slice(5) })));
      setPages(((pg.data as Page[]) ?? []));
      setSearches(((sr.data as SearchRow[]) ?? []));
      setDevice(((dv.data as Seg[]) ?? []));
      setBrowser(((br.data as Seg[]) ?? []));
      setRegion(((rg.data as Seg[]) ?? []));
      setChannels(((ch.data as Channel[]) ?? []));
      setNewRet(((nr.data as NewRet[]) ?? []).map((d) => ({ ...d, day: String(d.day).slice(5) })));
      setHeat(((hm.data as HeatCell[]) ?? []));
      setFunnel(((fn.data as FunnelStep[]) ?? []));
      const km: Record<string, Kpi> = {};
      for (const k of ((kp.data as Kpi[]) ?? [])) km[k.metric] = k;
      setKpis(km);
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

  const delta = (metric: string): string | undefined => {
    const k = kpis[metric];
    if (!k || k.delta_pct === null || k.delta_pct === undefined) return undefined;
    const up = k.delta_pct >= 0;
    return `${up ? "▲" : "▼"} ${Math.abs(k.delta_pct)}% vs prev 30d`;
  };

  const isEmpty = !t && daily.length === 0 && pages.length === 0 && searches.length === 0 && channels.length === 0;

  return (
    <AdminPageShell
      eyebrow="09 // TRAFFIC"
      code="TRF"
      title="Traffic"
      italic="& Engagement."
      description="Who's visiting, how long they stay, what they look at and search — from your own event stream, automated & bot traffic filtered out. No third party."
      stats={[
        { label: "Visitors", value: (t?.visitors ?? 0).toLocaleString(), tone: "blue", sub: delta("Visitors") },
        { label: "Sessions", value: (t?.sessions ?? 0).toLocaleString(), tone: "emerald", sub: delta("Sessions") },
        { label: "Pageviews", value: (t?.pageviews ?? 0).toLocaleString(), tone: "neutral", sub: delta("Pageviews") },
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
        <State kind="empty" title="No human traffic captured yet" hint="Visitors, sessions and pageviews appear here as your event stream fills. Automated/QA traffic is filtered out, so this stays clean." />
      ) : (
        <div className="space-y-14">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/70">
            <ShieldCheck className="h-3.5 w-3.5" /> Humans only · bots &amp; admin filtered
          </div>

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
            <FloatSection title="New vs returning" meta="daily visitors">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newRet} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
                    <Bar dataKey="new_visitors" stackId="a" fill={ACCENT_HSL} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="returning_visitors" stackId="a" fill={CYAN} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: ACCENT_HSL }} /> New</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: CYAN }} /> Returning</span>
              </div>
            </FloatSection>
            <FloatSection title="Acquisition funnel" meta="visit → sign-up">
              <Funnel steps={funnel} />
            </FloatSection>
          </div>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="Channels" meta="how visitors arrive"><SegBars rows={channels.map((c) => ({ key: c.channel, sessions: c.sessions, visitors: c.visitors }))} /></FloatSection>
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
          </div>

          <FloatSection title="When they visit" meta="hour × day · local time">
            <Heatmap cells={heat} />
          </FloatSection>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
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
            <FloatSection title="Regions" meta="timezone"><SegBars rows={region} unit="sess" /></FloatSection>
          </div>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-2">
            <FloatSection title="Devices"><SegBars rows={device} /></FloatSection>
            <FloatSection title="Browsers"><SegBars rows={browser} /></FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
