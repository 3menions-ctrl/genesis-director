/**
 * AdminProjectionsPage — page-view trends across day / week / month windows,
 * with a transparent forward projection.
 *
 * Built entirely on the existing first-party `analytics_visitors_daily` RPC
 * (daily pageviews / visitors / sessions). No new tables, no third party — the
 * granularity rollups and the trend-line forecast are computed client-side in
 * src/lib/analytics/projection.ts (unit-tested).
 */
import { useEffect, useMemo, useState } from "react";
import { Eye, Users, MousePointerClick, TrendingUp, CalendarRange, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, KpiTile, ChartCard, ACCENT_HSL, CYAN, accent } from "@/admin/ui/primitives";
import {
  buildProjectedSeries, bucketByWeek, bucketByMonth, trendPct,
  type DailyPoint,
} from "@/lib/analytics/projection";

interface Daily { day: string; visitors: number; sessions: number; pageviews: number }

type Metric = "pageviews" | "visitors" | "sessions";
type Grain = "day" | "week" | "month";

const METRICS: { id: Metric; label: string; icon: typeof Eye }[] = [
  { id: "pageviews", label: "Pageviews", icon: Eye },
  { id: "visitors", label: "Visitors", icon: Users },
  { id: "sessions", label: "Sessions", icon: MousePointerClick },
];

const GRAINS: { id: Grain; label: string; window: number; horizon: number; horizonLabel: string }[] = [
  { id: "day", label: "Daily", window: 30, horizon: 14, horizonLabel: "next 14 days" },
  { id: "week", label: "Weekly", window: 13, horizon: 4, horizonLabel: "next 4 weeks" },
  { id: "month", label: "Monthly", window: 12, horizon: 3, horizonLabel: "next 3 months" },
];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ISO = (d: Date) => d.toISOString().slice(0, 10);

export default function AdminProjectionsPage() {
  const [daily, setDaily] = useState<Daily[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>("pageviews");
  const [grain, setGrain] = useState<Grain>("day");

  useEffect(() => {
    (async () => {
      // One generous fetch (≈13 months of daily rows) powers every grain.
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 400);
      const { data } = await supabase.rpc(
        "analytics_visitors_daily" as never,
        { _since: since.toISOString() } as never,
      );
      const rows = ((data as Daily[]) ?? [])
        .map((d) => ({ ...d, day: String(d.day).slice(0, 10) }))
        .sort((a, b) => a.day.localeCompare(b.day));
      setDaily(rows);
      setLoading(false);
    })();
  }, []);

  const grainCfg = GRAINS.find((g) => g.id === grain)!;

  const model = useMemo(() => {
    // Daily points for the chosen metric.
    const points: DailyPoint[] = daily.map((d) => ({ day: d.day, value: Number(d[metric]) || 0 }));

    // Roll up to the chosen grain, then keep the trailing `window` buckets.
    let bucketed: DailyPoint[] =
      grain === "week" ? bucketByWeek(points)
      : grain === "month" ? bucketByMonth(points)
      : points;
    bucketed = bucketed.slice(-grainCfg.window);

    // Label projected steps forward from the last real bucket.
    const lastDay = bucketed.length ? bucketed[bucketed.length - 1].day : ISO(new Date());
    const labelFor = (step: number): string => {
      if (grain === "month") {
        const [y, m] = lastDay.split("-").map(Number);
        const d = new Date(Date.UTC(y, (m - 1) + step, 1));
        return d.toISOString().slice(0, 7);
      }
      const base = new Date(`${lastDay}T00:00:00Z`);
      base.setUTCDate(base.getUTCDate() + step * (grain === "week" ? 7 : 1));
      return ISO(base);
    };

    const { series, fit, projectedTotal } = buildProjectedSeries(
      bucketed.map((b) => ({ day: b.day, value: b.value })),
      grainCfg.horizon,
      labelFor,
    );

    const values = bucketed.map((b) => b.value);
    return {
      series,
      fit,
      projectedTotal,
      total: sum(values),
      avg: values.length ? Math.round(sum(values) / values.length) : 0,
      peak: values.length ? Math.max(...values) : 0,
      trend: trendPct(values),
    };
  }, [daily, metric, grain, grainCfg]);

  const metricLabel = METRICS.find((m) => m.id === metric)!.label;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader
        eyebrow="First-party analytics · forecast"
        title={<>Growth &amp; projections.</>}
        sub="Page-view trends by day, week and month — with a transparent trend-line forecast. All from your own event stream."
      />

      {/* Controls — metric + granularity */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented>
          {METRICS.map((m) => (
            <SegBtn key={m.id} active={metric === m.id} onClick={() => setMetric(m.id)}>
              <m.icon className="h-3.5 w-3.5" /> {m.label}
            </SegBtn>
          ))}
        </Segmented>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <Segmented>
          {GRAINS.map((g) => (
            <SegBtn key={g.id} active={grain === g.id} onClick={() => setGrain(g.id)}>
              <CalendarRange className="h-3.5 w-3.5" /> {g.label}
            </SegBtn>
          ))}
        </Segmented>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile index={0} label={`${metricLabel} · window`} value={model.total} icon={Eye} />
        <KpiTile index={1} label={`Avg / ${grain}`} value={model.avg} icon={TrendingUp} accentNumber />
        <KpiTile index={2} label="Peak" value={model.peak} icon={TrendingUp} />
        <KpiTile index={3} label="Trend" value={`${model.trend > 0 ? "+" : ""}${model.trend}%`} icon={TrendingUp} deltaLabel="first vs second half" />
        <KpiTile index={4} label={`Projected · ${grainCfg.horizonLabel}`} value={model.projectedTotal} icon={Sparkles} accentNumber />
      </div>

      <ChartCard
        title={`${metricLabel} — ${grainCfg.label.toLowerCase()}`}
        meta={loading ? "loading…" : `fit r² ${model.fit.r2.toFixed(2)} · forecast ${grainCfg.horizonLabel}`}
        className="mb-6"
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={model.series} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="pjFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.5} />
                  <stop offset="60%" stopColor={CYAN} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pjStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
              <Area
                name={metricLabel} type="monotone" dataKey="value" stroke="url(#pjStroke)" strokeWidth={2.5}
                fill="url(#pjFill)" dot={false} activeDot={{ r: 4, fill: CYAN }} connectNulls={false}
                isAnimationActive animationDuration={900} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.35)})` }}
              />
              <Line
                name="Projected" type="monotone" dataKey="projected" stroke={accent(0.9)} strokeWidth={2}
                strokeDasharray="5 5" dot={false} connectNulls isAnimationActive animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-white/40">
          The dashed line extends the least-squares trend of the visible buckets {grainCfg.horizonLabel}.
          It's a straight-line estimate — useful for direction and rough planning, not a guarantee.
          Fit quality (r²) shows how closely recent {grainCfg.label.toLowerCase()} {metricLabel.toLowerCase()} follow that line.
        </p>
      </ChartCard>
    </div>
  );
}

// ── tiny segmented-control primitives ───────────────────────────────────────
function Segmented({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06]">
      {children}
    </div>
  );
}
function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-white/[0.10] text-white" : "text-white/55 hover:text-white/85",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
