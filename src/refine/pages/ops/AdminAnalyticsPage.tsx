/** Admin Analytics — live, cinematic, instrumented. */
import { useEffect, useMemo, useState } from "react";
import { Activity, Users, TrendingUp, DollarSign, Clock, Sparkles, Globe, Layers, Zap, RefreshCw, AlertCircle, X, ArrowUpRight, Loader2, ArrowDown, ArrowUp, Filter, Crown, AlertOctagon, Calendar, Download } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Series = { date: string; value: number }[];
interface AnalyticsPayload {
  generatedAt: string;
  windowDays: number;
  kpis: {
    totalUsers: number;
    signups1d: number; signups7d: number; signups30d: number;
    active1d: number; active7d: number; active30d: number; stickiness: number;
    projects: number; clipsTotal: number; completedClips: number; failedClips: number; completionRate: number;
    creditsPurchased: number; creditsSpent: number; grossRevenue: number;
    ttvMedianMinutes: number | null; activationRate: number;
    onboardedTotal?: number;
  };
  deltas?: { signups: number; projects: number; completionRate: number; creditsSpent: number; creditsPurchased: number; revenue: number };
  funnel?: { step: string; users: number }[];
  cohorts?: { cohort: string; size: number; weeks: number[] }[];
  failureBreakdown?: { category: string; count: number }[];
  topUsers?: { id: string; spend: number; projects: number; profile: { email: string; display_name: string | null; account_tier: string | null; country: string | null } | null }[];
  heatmap?: { matrix: number[][]; max: number };
  series: { signups: Series; projects: Series; creditsSpent: Series; creditsPurchased: Series };
  tierBreakdown: { tier: string; count: number }[];
  topCountries: { key: string; count: number }[];
  topSources: { key: string; count: number }[];
  topReferrers: { key: string; count: number }[];
}

const WINDOWS = [7, 30, 90] as const;
const TIER_COLORS = ["#0A84FF", "#6FB6FF", "#34D399", "#FBBF24", "#F472B6"];

const fmtN = (n: number) => n.toLocaleString();
const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtMins = (m: number | null) => {
  if (m == null) return "—";
  if (m < 60) return `${m.toFixed(0)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
};
const fmtDay = (s: string) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Dataset = "signups" | "projects" | "clips" | "creditsSpent" | "creditsPurchased";
const DATASET_TONE: Record<Dataset, string> = {
  signups: "#0A84FF",
  projects: "#34D399",
  clips: "#A78BFA", // tier-only fallback (not on chart) — kept for tier list clicks
  creditsSpent: "#FBBF24",
  creditsPurchased: "#6FB6FF",
};
interface DetailPayload {
  dataset: Dataset; date: string; title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

export default function AdminAnalyticsPage() {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ dataset: Dataset; date: string } | null>(null);
  const [drillData, setDrillData] = useState<DetailPayload | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  const openDrill = (dataset: Dataset, date: string) => setDrill({ dataset, date });
  const closeDrill = () => { setDrill(null); setDrillData(null); setDrillError(null); };

  const load = async (days: number) => {
    setLoading(true); setError(null);
    const { data: res, error: err } = await supabase.functions.invoke<AnalyticsPayload>(
      `admin-analytics?windowDays=${days}`,
      { method: "GET" },
    );
    if (err) { setError(err.message); setLoading(false); return; }
    setData(res); setLoading(false);
  };

  useEffect(() => { load(windowDays); /* eslint-disable-next-line */ }, [windowDays]);

  // Fetch drill rows whenever drill target changes.
  useEffect(() => {
    if (!drill) return;
    let cancelled = false;
    (async () => {
      setDrillLoading(true); setDrillError(null); setDrillData(null);
      const params = new URLSearchParams({
        mode: "detail",
        dataset: drill.dataset,
        date: drill.date,
        limit: "200",
      });
      const { data: res, error: err } = await supabase.functions.invoke<DetailPayload>(
        `admin-analytics?${params.toString()}`, { method: "GET" },
      );
      if (cancelled) return;
      if (err) setDrillError(err.message);
      else setDrillData(res);
      setDrillLoading(false);
    })();
    return () => { cancelled = true; };
  }, [drill]);

  const merged = useMemo(() => {
    if (!data) return [];
    const { signups, projects, creditsSpent } = data.series;
    return signups.map((s, i) => ({
      date: s.date,
      signups: s.value,
      projects: projects[i]?.value ?? 0,
      creditsSpent: creditsSpent[i]?.value ?? 0,
    }));
  }, [data]);

  const tierTotal = useMemo(
    () => (data?.tierBreakdown ?? []).reduce((s, t) => s + t.count, 0) || 1,
    [data],
  );

  // Recharts click handlers operate on payload row objects.
  const handleAreaClick = (dataset: Dataset) => (evt: { payload?: { date?: string } } | undefined) => {
    const date = evt?.payload?.date;
    if (date) openDrill(dataset, date);
  };
  const handleChartClick = (state: { activeLabel?: string } | null) => {
    // Click anywhere on the chart canvas → drill into signups for that day.
    if (state?.activeLabel) openDrill("signups", state.activeLabel);
  };

  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="ANL"
      title="Analytics"
      italic="Deep-Dive."
      description="Real-time growth, retention, monetization and activation across the entire platform."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-white/10 bg-white/[0.02] p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindowDays(w)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] rounded-full transition-colors",
                  windowDays === w
                    ? "bg-[#0A84FF]/15 text-[#6FB6FF]"
                    : "text-white/40 hover:text-white/70",
                )}
              >
                {w}d
              </button>
            ))}
          </div>
          <button
            onClick={() => load(windowDays)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-white/50 hover:text-[#6FB6FF] hover:border-[#0A84FF]/40 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      }
      stats={[
        { label: "Active 24H", value: data ? fmtN(data.kpis.active1d) : "—", tone: "blue", sub: data ? `Stick ${data.kpis.stickiness}%` : undefined },
        { label: `Signups ${windowDays}D`, value: data ? fmtN(windowDays === 7 ? data.kpis.signups7d : data.kpis.signups30d) : "—", tone: "emerald", sub: data?.deltas ? deltaSub(data.deltas.signups, "vs prev") : undefined },
        { label: "Completion", value: data ? `${data.kpis.completionRate}%` : "—", tone: "amber", sub: data?.deltas ? deltaSub(data.deltas.completionRate, "pp Δ", true) : undefined },
        { label: `Revenue ${windowDays}D`, value: data ? fmtUsd(data.kpis.grossRevenue) : "—", tone: "neutral", sub: data?.deltas ? deltaSub(data.deltas.revenue, "vs prev") : undefined },
      ]}
    >
      {error && (
        <AdminSurface className="border-rose-500/30 bg-rose-500/[0.04] mb-8">
          <div className="flex items-center gap-3 text-rose-300">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load analytics: {error}</span>
          </div>
        </AdminSurface>
      )}

      {/* Secondary KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KpiTile icon={Users} label="Active 7D" value={data ? fmtN(data.kpis.active7d) : null} loading={loading} accent="blue" />
        <KpiTile icon={Activity} label="Active 30D" value={data ? fmtN(data.kpis.active30d) : null} loading={loading} accent="blue" />
        <KpiTile
          icon={Sparkles}
          label={`Projects ${windowDays}D`}
          value={data ? fmtN(data.kpis.projects) : null}
          loading={loading}
          accent="emerald"
          onClick={data ? () => openDrill("projects", todayKey()) : undefined}
        />
        <KpiTile
          icon={Zap}
          label={`Credits Spent ${windowDays}D`}
          value={data ? fmtN(data.kpis.creditsSpent) : null}
          loading={loading}
          accent="amber"
          onClick={data ? () => openDrill("creditsSpent", todayKey()) : undefined}
        />
      </div>

      {/* Activity chart */}
      <AdminSectionLabel label="Activity" meta={`${windowDays}-day window · click any day to inspect`} />
      <AdminSurface className="mb-10">
        {loading ? (
          <Skeleton className="h-[320px] w-full bg-white/[0.04]" />
        ) : (
          <div className="h-[320px] cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={merged} margin={{ top: 16, right: 12, left: -10, bottom: 0 }} onClick={handleChartClick as any}>
                <defs>
                  <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#0A84FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gProjects" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34D399" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCredits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#FBBF24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "hsl(220, 14%, 4%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(l) => fmtDay(l as string)}
                  cursor={{ stroke: "rgba(10,132,255,0.35)", strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="creditsSpent" name="Credits spent" stroke="#FBBF24" strokeWidth={1.4} fill="url(#gCredits)"
                  activeDot={{ r: 4, onClick: handleAreaClick("creditsSpent") as any, style: { cursor: "pointer" } }} />
                <Area type="monotone" dataKey="projects" name="Projects" stroke="#34D399" strokeWidth={1.4} fill="url(#gProjects)"
                  activeDot={{ r: 4, onClick: handleAreaClick("projects") as any, style: { cursor: "pointer" } }} />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#0A84FF" strokeWidth={1.8} fill="url(#gSignups)"
                  activeDot={{ r: 5, onClick: handleAreaClick("signups") as any, style: { cursor: "pointer" } }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <ChartLegend
          items={[
            { color: "#0A84FF", label: "Signups", dataset: "signups" as const },
            { color: "#34D399", label: "Projects", dataset: "projects" as const },
            { color: "#FBBF24", label: "Credits spent", dataset: "creditsSpent" as const },
          ]}
          onSelect={(ds) => openDrill(ds, todayKey())}
        />
      </AdminSurface>

      {/* Two-column row: tier mix + activation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <AdminSurface className="lg:col-span-1">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-4">
            <Layers className="h-3 w-3" /> Tier mix
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full bg-white/[0.04]" />
          ) : (
            <>
              <div className="h-44 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data?.tierBreakdown ?? []} dataKey="count" nameKey="tier" innerRadius={50} outerRadius={75} stroke="hsl(220, 14%, 2%)" strokeWidth={2} paddingAngle={2}>
                      {(data?.tierBreakdown ?? []).map((_, i) => (
                        <Cell key={i} fill={TIER_COLORS[i % TIER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(220, 14%, 4%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl text-white font-light tabular-nums" style={{ fontFamily: "'Fraunces', serif" }}>
                    {fmtN(tierTotal)}
                  </div>
                  <div className="text-[9px] text-white/40 font-mono uppercase tracking-[0.3em]">accounts</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {(data?.tierBreakdown ?? []).map((t, i) => (
                  <div key={t.tier} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[i % TIER_COLORS.length] }} />
                      <span className="text-white/70 capitalize">{t.tier}</span>
                    </div>
                    <span className="text-white/40 font-mono tabular-nums">
                      {fmtN(t.count)} <span className="text-white/25">· {Math.round((t.count / tierTotal) * 100)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </AdminSurface>

        <AdminSurface className="lg:col-span-2">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-5">
            <Clock className="h-3 w-3" /> Activation funnel
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <BigStat
              label="Time to value"
              value={data ? fmtMins(data.kpis.ttvMedianMinutes) : "—"}
              sub="median signup → first project"
              tone="blue"
              loading={loading}
            />
            <BigStat
              label="Activation"
              value={data ? `${data.kpis.activationRate}%` : "—"}
              sub="signups → ≥1 project"
              tone="emerald"
              loading={loading}
            />
            <BigStat
              label="Failure rate"
              value={data ? `${(100 - data.kpis.completionRate).toFixed(1)}%` : "—"}
              sub={data ? `${fmtN(data.kpis.failedClips)} failed clips` : ""}
              tone="rose"
              loading={loading}
            />
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-3">
              <DollarSign className="h-3 w-3" /> Monetization
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MiniStat label="Credits sold" value={data ? fmtN(data.kpis.creditsPurchased) : "—"} />
              <MiniStat label="Credits spent" value={data ? fmtN(data.kpis.creditsSpent) : "—"} />
              <MiniStat label="Gross revenue" value={data ? fmtUsd(data.kpis.grossRevenue) : "—"} accent />
            </div>
          </div>
        </AdminSurface>
      </div>

      {/* Geo + sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RankedList
          icon={Globe}
          title="Top countries"
          subtitle={`Signups · ${windowDays}d`}
          rows={data?.topCountries ?? []}
          loading={loading}
        />
        <RankedList
          icon={TrendingUp}
          title="Top sources"
          subtitle={`utm_source · ${windowDays}d`}
          rows={data?.topSources ?? []}
          loading={loading}
        />
      </div>

      {/* ── Funnel + cohort retention ─────────────────────────────────── */}
      <AdminSectionLabel label="Funnel & retention" meta={`${windowDays}-day cohort`} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        <AdminSurface className="lg:col-span-2">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-5">
            <Filter className="h-3 w-3" /> Activation funnel
          </div>
          <FunnelView steps={data?.funnel ?? []} loading={loading} />
        </AdminSurface>
        <AdminSurface className="lg:col-span-3">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-5">
            <Calendar className="h-3 w-3" /> Weekly cohort retention
          </div>
          <CohortMatrix cohorts={data?.cohorts ?? []} loading={loading} />
        </AdminSurface>
      </div>

      {/* ── Heatmap + Failures ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        <AdminSurface className="lg:col-span-3">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-5">
            <Activity className="h-3 w-3" /> Generation heatmap
            <span className="ml-auto text-white/25 normal-case tracking-normal">UTC · clips by hour</span>
          </div>
          <Heatmap data={data?.heatmap} loading={loading} />
        </AdminSurface>
        <AdminSurface className="lg:col-span-2">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em] mb-5">
            <AlertOctagon className="h-3 w-3" /> Failure categories
          </div>
          <FailureBars rows={data?.failureBreakdown ?? []} loading={loading} />
        </AdminSurface>
      </div>

      {/* ── Top users leaderboard ─────────────────────────────────────── */}
      <AdminSectionLabel label="Power users" meta={`Top 10 · ${windowDays}-day spend`} />
      <AdminSurface className="mt-6">
        <Leaderboard rows={data?.topUsers ?? []} loading={loading} />
      </AdminSurface>

      {data && (
        <p className="mt-10 text-[10px] text-white/25 font-mono uppercase tracking-[0.28em] text-right">
          Last refreshed {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}

      <DrillSheet
        open={!!drill}
        onClose={closeDrill}
        target={drill}
        loading={drillLoading}
        error={drillError}
        payload={drillData}
      />
    </AdminPageShell>
  );
}

/** Render "+12.4% vs prev" or "-3.1% vs prev" — colored implicitly via tone passed by caller. */
function deltaSub(delta: number, label: string, asPP = false): string {
  const sign = delta > 0 ? "+" : "";
  const unit = asPP ? "" : "%";
  return `${sign}${delta}${unit} ${label}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function KpiTile({ icon: Icon, label, value, loading, accent, onClick }: {
  icon: React.ElementType; label: string; value: string | null; loading: boolean;
  accent: "blue" | "emerald" | "amber";
  onClick?: () => void;
}) {
  const tone = { blue: "text-[#6FB6FF]", emerald: "text-emerald-300", amber: "text-amber-300" }[accent];
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 relative overflow-hidden group",
        onClick && "cursor-pointer transition-colors hover:border-[#0A84FF]/30",
      )}
    >
      <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "radial-gradient(circle, rgba(10,132,255,0.18), transparent 65%)", filter: "blur(20px)" }} />
      <div className="flex items-center gap-2 text-[9px] text-white/40 font-mono uppercase tracking-[0.32em] mb-3">
        <Icon className={cn("h-3 w-3", tone)} /> {label}
        {onClick && <ArrowUpRight className="h-3 w-3 ml-auto text-white/20 group-hover:text-[#6FB6FF] transition-colors" />}
      </div>
      {loading || value == null ? (
        <Skeleton className="h-8 w-20 bg-white/[0.04]" />
      ) : (
        <div className="text-3xl font-light text-white tabular-nums" style={{ fontFamily: "'Fraunces', serif" }}>
          {value}
        </div>
      )}
    </div>
  );
}

function BigStat({ label, value, sub, tone, loading }: {
  label: string; value: string; sub?: string; tone: "blue" | "emerald" | "rose"; loading: boolean;
}) {
  const c = { blue: "text-[#6FB6FF]", emerald: "text-emerald-300", rose: "text-rose-300" }[tone];
  return (
    <div>
      <div className="text-[9px] text-white/40 font-mono uppercase tracking-[0.32em] mb-2">{label}</div>
      {loading ? (
        <Skeleton className="h-9 w-24 bg-white/[0.04]" />
      ) : (
        <div className={cn("text-4xl font-light tabular-nums", c)} style={{ fontFamily: "'Fraunces', serif" }}>
          {value}
        </div>
      )}
      {sub && <div className="text-[10px] text-white/30 mt-1.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] text-white/40 font-mono uppercase tracking-[0.3em] mb-1">{label}</div>
      <div className={cn("text-xl font-light tabular-nums", accent ? "text-[#6FB6FF]" : "text-white")}
        style={{ fontFamily: "'Fraunces', serif" }}>
        {value}
      </div>
    </div>
  );
}

function ChartLegend({ items, onSelect }: {
  items: { color: string; label: string; dataset?: Dataset }[];
  onSelect?: (ds: Dataset) => void;
}) {
  return (
    <div className="flex items-center gap-5 mt-4 pt-4 border-t border-white/[0.04]">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          disabled={!onSelect || !i.dataset}
          onClick={() => i.dataset && onSelect?.(i.dataset)}
          className={cn(
            "flex items-center gap-2 text-[10px] text-white/50 font-mono uppercase tracking-[0.22em]",
            onSelect && i.dataset && "hover:text-white transition-colors cursor-pointer",
          )}
        >
          <span className="h-1.5 w-3 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {onSelect && i.dataset && <ArrowUpRight className="h-2.5 w-2.5 opacity-50" />}
        </button>
      ))}
    </div>
  );
}

function RankedList({ icon: Icon, title, subtitle, rows, loading }: {
  icon: React.ElementType; title: string; subtitle: string;
  rows: { key: string; count: number }[]; loading: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <AdminSurface>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono uppercase tracking-[0.32em]">
          <Icon className="h-3 w-3" /> {title}
        </div>
        <div className="text-[9px] text-white/25 font-mono uppercase tracking-[0.28em]">{subtitle}</div>
      </div>
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full bg-white/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[12px] text-white/30 italic py-6 text-center">No data in this window</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="relative">
              <div className="flex items-center justify-between text-[12px] py-1.5 relative z-10 px-3">
                <span className="text-white/75 truncate max-w-[60%]" title={r.key}>{r.key}</span>
                <span className="text-white/45 font-mono tabular-nums">{r.count.toLocaleString()}</span>
              </div>
              <div aria-hidden className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-[#0A84FF]/20 to-[#0A84FF]/0"
                style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

// ── Drill-down sheet ───────────────────────────────────────────────────
function DrillSheet({ open, onClose, target, loading, error, payload }: {
  open: boolean;
  onClose: () => void;
  target: { dataset: Dataset; date: string } | null;
  loading: boolean;
  error: string | null;
  payload: DetailPayload | null;
}) {
  const accent = target ? DATASET_TONE[target.dataset] : "#0A84FF";
  const heading = payload?.title ?? (target ? `${target.dataset} · ${target.date}` : "");
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-4xl bg-[hsl(220,14%,3%)] border-l border-white/[0.06] text-white p-0 flex flex-col"
      >
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent}33, transparent 65%)`, filter: "blur(60px)" }} />
        <SheetHeader className="px-8 pt-8 pb-5 border-b border-white/[0.05] relative">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold uppercase tracking-[0.28em]"
              style={{ borderColor: `${accent}66`, color: accent, background: `${accent}10` }}>
              {target?.dataset}
            </span>
            <span className="h-px w-8 bg-white/15" />
            <span className="text-[10px] text-white/35 font-mono uppercase tracking-[0.28em]">
              {target?.date}
            </span>
            <button onClick={onClose} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <SheetTitle className="text-2xl font-light tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
            {heading}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-white/40 mt-1">
            {loading ? "Fetching rows…"
              : payload ? `${payload.rows.length} ${payload.rows.length === 1 ? "row" : "rows"}${payload.truncated ? " (truncated to 200)" : ""}`
              : error ? "Error loading details"
              : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-[#6FB6FF]" />
            </div>
          ) : error ? (
            <div className="m-6 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-4 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !payload || payload.rows.length === 0 ? (
            <div className="py-20 text-center text-[13px] text-white/30 italic">
              No rows for this day.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.05] hover:bg-transparent">
                  {payload.columns.map((c) => (
                    <TableHead key={c.key} className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em]">
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((row, i) => (
                  <TableRow key={i} className="border-white/[0.04] hover:bg-white/[0.02]">
                    {payload.columns.map((c) => (
                      <TableCell key={c.key} className="text-[12px] text-white/75 font-mono tabular-nums max-w-[260px] truncate" title={String(row[c.key] ?? "")}>
                        {formatCell(c.key, row[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatCell(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key.endsWith("_at") || key === "completed_at") {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  if (key === "user_id" || key === "project_id") {
    const s = String(value);
    return s.length > 8 ? `${s.slice(0, 8)}…` : s;
  }
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

// ── Funnel ─────────────────────────────────────────────────────────────
function FunnelView({ steps, loading }: { steps: { step: string; users: number }[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-48 w-full bg-white/[0.04]" />;
  if (!steps.length) return <div className="py-10 text-center text-[12px] text-white/30 italic">No funnel data</div>;
  const top = steps[0]?.users || 1;
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = (s.users / top) * 100;
        const dropFromPrev = i > 0 && steps[i - 1].users > 0
          ? +(((steps[i - 1].users - s.users) / steps[i - 1].users) * 100).toFixed(1)
          : 0;
        return (
          <div key={s.step} className="relative">
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-white/30 font-mono text-[10px] w-4">{i + 1}</span>
                <span className="text-white/75">{s.step}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-white tabular-nums font-mono">{s.users.toLocaleString()}</span>
                {i > 0 && (
                  <span className={cn("font-mono tabular-nums", dropFromPrev > 30 ? "text-rose-300" : "text-white/30")}>
                    {dropFromPrev > 0 ? `−${dropFromPrev}%` : "—"}
                  </span>
                )}
              </div>
            </div>
            <div className="h-7 rounded-md bg-white/[0.03] overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, rgba(10,132,255,${0.55 - i * 0.1}), rgba(10,132,255,${0.15 - i * 0.03}))`,
                }} />
              <div className="absolute inset-y-0 left-3 flex items-center text-[10px] text-white/60 font-mono">
                {pct.toFixed(0)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cohort retention matrix ────────────────────────────────────────────
function CohortMatrix({ cohorts, loading }: { cohorts: { cohort: string; size: number; weeks: number[] }[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-56 w-full bg-white/[0.04]" />;
  if (!cohorts.length) return <div className="py-10 text-center text-[12px] text-white/30 italic">No cohorts in window</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-white/30">
            <th className="text-left pb-2 pr-3 font-normal uppercase tracking-[0.22em]">Cohort</th>
            <th className="text-right pb-2 pr-3 font-normal uppercase tracking-[0.22em]">Size</th>
            {Array.from({ length: 8 }).map((_, w) => (
              <th key={w} className="text-center pb-2 px-1 font-normal uppercase tracking-[0.22em]">W{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort} className="border-t border-white/[0.04]">
              <td className="py-1.5 pr-3 text-white/75 whitespace-nowrap">{c.cohort.slice(5)}</td>
              <td className="py-1.5 pr-3 text-right text-white/45 tabular-nums">{c.size}</td>
              {c.weeks.map((v, i) => (
                <td key={i} className="py-1 px-0.5">
                  {v < 0 ? (
                    <div className="h-7 rounded-sm bg-white/[0.02]" />
                  ) : (
                    <div
                      className="h-7 rounded-sm flex items-center justify-center text-[10px] tabular-nums"
                      style={{
                        background: `rgba(10,132,255,${Math.min(0.85, 0.05 + v / 120)})`,
                        color: v > 40 ? "white" : "rgba(255,255,255,0.6)",
                      }}
                      title={`${v}% week ${i}`}
                    >
                      {v}%
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Hour-of-day × DOW heatmap ──────────────────────────────────────────
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function Heatmap({ data, loading }: { data?: { matrix: number[][]; max: number }; loading: boolean }) {
  if (loading) return <Skeleton className="h-56 w-full bg-white/[0.04]" />;
  if (!data || data.max === 0) return <div className="py-10 text-center text-[12px] text-white/30 italic">No clip activity in window</div>;
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-1 min-w-[520px]">
        <div className="flex items-center gap-1 pl-10 text-[8px] font-mono text-white/25 uppercase tracking-[0.2em]">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="flex-1 text-center">{h % 6 === 0 ? h : ""}</div>
          ))}
        </div>
        {data.matrix.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <div className="w-10 text-[9px] font-mono text-white/35 uppercase tracking-[0.2em]">{DOW[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                className="flex-1 aspect-square rounded-sm"
                title={`${DOW[d]} ${h}:00 — ${v} clips`}
                style={{
                  background: v === 0
                    ? "rgba(255,255,255,0.02)"
                    : `rgba(10,132,255,${0.1 + (v / data.max) * 0.85})`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Failure breakdown ──────────────────────────────────────────────────
function FailureBars({ rows, loading }: { rows: { category: string; count: number }[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full bg-white/[0.04]" />;
  if (!rows.length) return <div className="py-10 text-center text-[12px] text-emerald-300/60 italic">No failures in window</div>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.category} className="relative">
          <div className="flex items-center justify-between text-[12px] py-1.5 relative z-10 px-3">
            <span className="text-white/75 truncate max-w-[60%]" title={r.category}>{r.category}</span>
            <span className="text-rose-300 font-mono tabular-nums">{r.count}</span>
          </div>
          <div aria-hidden className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-rose-500/15 to-rose-500/0"
            style={{ width: `${(r.count / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

// ── Top users leaderboard ──────────────────────────────────────────────
function Leaderboard({ rows, loading }: { rows: NonNullable<AnalyticsPayload["topUsers"]>; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-white/[0.04]" />)}
      </div>
    );
  }
  if (!rows?.length) return <div className="py-10 text-center text-[12px] text-white/30 italic">No power users in window</div>;
  const maxSpend = Math.max(...rows.map((r) => r.spend), 1);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/[0.05] hover:bg-transparent">
          <TableHead className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em] w-10">#</TableHead>
          <TableHead className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em]">User</TableHead>
          <TableHead className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em]">Tier</TableHead>
          <TableHead className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em] text-right">Projects</TableHead>
          <TableHead className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em] text-right">Credits spent</TableHead>
          <TableHead className="text-[9px] text-white/40 font-mono uppercase tracking-[0.28em]">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((u, i) => (
          <TableRow key={u.id} className="border-white/[0.04] hover:bg-white/[0.02]">
            <TableCell className="text-[12px] text-white/40 font-mono tabular-nums">
              {i === 0 ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : i + 1}
            </TableCell>
            <TableCell className="text-[12px]">
              <div className="text-white/85 truncate max-w-[260px]">{u.profile?.display_name || u.profile?.email || u.id.slice(0, 8) + "…"}</div>
              <div className="text-[10px] text-white/30 font-mono">{u.profile?.email || u.id.slice(0, 8) + "…"}</div>
            </TableCell>
            <TableCell className="text-[11px] text-white/55 capitalize">{u.profile?.account_tier ?? "free"}</TableCell>
            <TableCell className="text-[12px] text-white/75 font-mono tabular-nums text-right">{u.projects.toLocaleString()}</TableCell>
            <TableCell className="text-[12px] text-amber-300 font-mono tabular-nums text-right">{u.spend.toLocaleString()}</TableCell>
            <TableCell className="w-[160px]">
              <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#0A84FF] to-[#6FB6FF]" style={{ width: `${(u.spend / maxSpend) * 100}%` }} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
