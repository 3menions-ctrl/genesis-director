/** Admin Analytics — live, cinematic, instrumented. */
import { useEffect, useMemo, useState } from "react";
import { Activity, Users, TrendingUp, DollarSign, Clock, Sparkles, Globe, Layers, Zap, RefreshCw, AlertCircle } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
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
  };
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

export default function AdminAnalyticsPage() {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        { label: `Signups ${windowDays}D`, value: data ? fmtN(windowDays === 7 ? data.kpis.signups7d : windowDays === 30 ? data.kpis.signups30d : data.kpis.signups30d) : "—", tone: "emerald", sub: data ? `${fmtN(data.kpis.totalUsers)} total` : undefined },
        { label: "Completion", value: data ? `${data.kpis.completionRate}%` : "—", tone: "amber", sub: data ? `${fmtN(data.kpis.completedClips)} clips` : undefined },
        { label: `Revenue ${windowDays}D`, value: data ? fmtUsd(data.kpis.grossRevenue) : "—", tone: "neutral", sub: data ? `${fmtN(data.kpis.creditsPurchased)} cr sold` : undefined },
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
        <KpiTile icon={Sparkles} label={`Projects ${windowDays}D`} value={data ? fmtN(data.kpis.projects) : null} loading={loading} accent="emerald" />
        <KpiTile icon={Zap} label={`Credits Spent ${windowDays}D`} value={data ? fmtN(data.kpis.creditsSpent) : null} loading={loading} accent="amber" />
      </div>

      {/* Activity chart */}
      <AdminSectionLabel label="Activity" meta={`${windowDays}-day window`} />
      <AdminSurface className="mb-10">
        {loading ? (
          <Skeleton className="h-[320px] w-full bg-white/[0.04]" />
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={merged} margin={{ top: 16, right: 12, left: -10, bottom: 0 }}>
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
                <Area type="monotone" dataKey="creditsSpent" name="Credits spent" stroke="#FBBF24" strokeWidth={1.4} fill="url(#gCredits)" />
                <Area type="monotone" dataKey="projects" name="Projects" stroke="#34D399" strokeWidth={1.4} fill="url(#gProjects)" />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#0A84FF" strokeWidth={1.8} fill="url(#gSignups)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <ChartLegend items={[
          { color: "#0A84FF", label: "Signups" },
          { color: "#34D399", label: "Projects" },
          { color: "#FBBF24", label: "Credits spent" },
        ]} />
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

      {data && (
        <p className="mt-10 text-[10px] text-white/25 font-mono uppercase tracking-[0.28em] text-right">
          Last refreshed {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </AdminPageShell>
  );
}

function KpiTile({ icon: Icon, label, value, loading, accent }: {
  icon: React.ElementType; label: string; value: string | null; loading: boolean;
  accent: "blue" | "emerald" | "amber";
}) {
  const tone = { blue: "text-[#6FB6FF]", emerald: "text-emerald-300", amber: "text-amber-300" }[accent];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 relative overflow-hidden group">
      <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "radial-gradient(circle, rgba(10,132,255,0.18), transparent 65%)", filter: "blur(20px)" }} />
      <div className="flex items-center gap-2 text-[9px] text-white/40 font-mono uppercase tracking-[0.32em] mb-3">
        <Icon className={cn("h-3 w-3", tone)} /> {label}
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

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-5 mt-4 pt-4 border-t border-white/[0.04]">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-[10px] text-white/50 font-mono uppercase tracking-[0.22em]">
          <span className="h-1.5 w-3 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </div>
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
