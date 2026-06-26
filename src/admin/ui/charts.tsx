/**
 * Admin chart kit — cohesive, borderless recharts wrappers + pure data helpers.
 *
 * Every admin analytics surface composes these so charts stay visually identical
 * to the existing hand-rolled charts (MoneyOverview, AdminTrafficPage, …): cool
 * accent→cyan gradients, hairline grid, no axis lines, dark glass tooltip, soft
 * accent drop-shadow. All inputs are REAL data the caller already fetched — these
 * components never invent values; they only shape and draw what they're given.
 *
 * Components: TrendArea · MultiTrend · CategoryBars · Donut · MiniHistogram ·
 *             ChartState (loading/empty/error). Helpers: bucketByDay · countBy ·
 *             topN · sumBy · pct.
 */
import { type ReactNode, useId } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Loader2, AlertTriangle, BarChart3 } from "lucide-react";
import { ACCENT_HSL, CYAN, VIOLET, ROSE, AMBER, accent } from "@/admin/ui/primitives";

// Re-export the brand palette so a page can pull both charts and their colours
// from a single import (`import { TrendArea, CYAN } from "@/admin/ui/charts"`).
export { ACCENT_HSL, CYAN, VIOLET, ROSE, AMBER, accent };

// Ordered categorical palette — reused for breakdown slices/bars so colours are
// stable and on-brand across every page.
export const SERIES_COLORS = [ACCENT_HSL, CYAN, VIOLET, AMBER, ROSE, "hsl(158 86% 52%)", "hsl(280 80% 70%)", "hsl(20 90% 64%)"];

const GRID = "rgba(255,255,255,0.05)";
const AXIS_TICK = { fill: "rgba(255,255,255,0.35)", fontSize: 10 } as const;
const TOOLTIP_STYLE = { background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12, boxShadow: "0 18px 50px -20px rgba(0,0,0,0.9)" } as const;

// ── State (loading / empty / error) ──────────────────────────────────────────
/** Inline loading / empty / error placeholder sized to sit inside a chart slot. */
export function ChartState({ kind, title, hint, height = 224 }: {
  kind: "loading" | "empty" | "error"; title: string; hint?: string; height?: number;
}) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : BarChart3;
  const color = kind === "error" ? ROSE : "rgba(255,255,255,0.22)";
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 text-center" style={{ minHeight: height }}>
      <Icon className={`h-6 w-6 ${kind === "loading" ? "animate-spin" : ""}`} style={{ color }} />
      <p className="text-[13.5px] text-white/65">{title}</p>
      {hint && <p className="max-w-sm text-[11.5px] text-white/35">{hint}</p>}
    </div>
  );
}

// ── Single-series area trend ─────────────────────────────────────────────────
export interface TrendPoint { label: string; value: number }
/** Gradient area trend — the canonical admin time-series chart. */
export function TrendArea({ data, height = 224, color = ACCENT_HSL, color2 = CYAN, valueLabel = "value", interval, emptyLabel = "No data in this window." }: {
  data: TrendPoint[]; height?: number; color?: string; color2?: string; valueLabel?: string;
  interval?: number | "preserveStartEnd"; emptyLabel?: string;
}) {
  const uid = useId().replace(/:/g, "");
  if (!data || data.length === 0) return <ChartState kind="empty" title={emptyLabel} height={height} />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`ta-f-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="55%" stopColor={color2} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color2} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`ta-s-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} /><stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={interval ?? "preserveStartEnd"} minTickGap={16} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} cursor={{ stroke: accent(0.4) }}
            formatter={(v: number) => [Number(v).toLocaleString(), valueLabel]} />
          <Area type="monotone" dataKey="value" stroke={`url(#ta-s-${uid})`} strokeWidth={2.5} fill={`url(#ta-f-${uid})`} dot={false}
            activeDot={{ r: 4, fill: color2, stroke: color, strokeWidth: 2 }} isAnimationActive animationDuration={900}
            style={{ filter: `drop-shadow(0 6px 16px ${accent(0.35)})` }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Multi-series area / line trend ───────────────────────────────────────────
export interface SeriesDef { key: string; label: string; color?: string }
/** Stacked or overlaid multi-series area trend (e.g. inflow vs outflow). */
export function MultiTrend({ data, series, height = 224, stacked = false, interval, emptyLabel = "No data in this window." }: {
  data: Array<Record<string, number | string>>; series: SeriesDef[]; height?: number;
  stacked?: boolean; interval?: number | "preserveStartEnd"; emptyLabel?: string;
}) {
  const uid = useId().replace(/:/g, "");
  if (!data || data.length === 0) return <ChartState kind="empty" title={emptyLabel} height={height} />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const c = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
              return (
                <linearGradient key={s.key} id={`mt-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={interval ?? "preserveStartEnd"} minTickGap={16} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} cursor={{ stroke: accent(0.4) }} />
          {series.map((s, i) => {
            const c = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId={stacked ? "1" : undefined}
                stroke={c} strokeWidth={2} fill={`url(#mt-${uid}-${s.key})`} dot={false} activeDot={{ r: 3.5, fill: c }}
                isAnimationActive animationDuration={900} />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Categorical horizontal bars ──────────────────────────────────────────────
export interface CategoryDatum { key: string; value: number; color?: string }
/** Borderless horizontal-bar breakdown — counts/totals per category. Pure CSS
 *  bars (not recharts) so it stays crisp at any row count and matches the
 *  existing SegBars look. */
export function CategoryBars({ data, valueSuffix, max, emptyLabel = "No data yet.", formatValue }: {
  data: CategoryDatum[]; valueSuffix?: string; max?: number; emptyLabel?: string;
  formatValue?: (v: number) => string;
}) {
  if (!data || data.length === 0)
    return <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">{emptyLabel}</div>;
  const peak = max ?? Math.max(...data.map((d) => d.value), 1);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const c = d.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <div key={d.key} className="relative overflow-hidden rounded-lg px-3 py-2">
            <div aria-hidden className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
              style={{ width: `${peak > 0 ? (d.value / peak) * 100 : 0}%`, background: `linear-gradient(90deg, ${c}33, ${c}14)` }} />
            <div className="relative flex items-center justify-between text-[12.5px]">
              <span className="truncate text-white/75">{d.key}</span>
              <span className="ml-3 shrink-0 tabular-nums text-white/55">{fmt(d.value)}{valueSuffix ? <span className="text-white/30"> {valueSuffix}</span> : null}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut / breakdown ────────────────────────────────────────────────────────
/** Donut with a centred total + legend. For status / type distributions. */
export function Donut({ data, height = 224, centerLabel, formatValue, emptyLabel = "No data yet." }: {
  data: CategoryDatum[]; height?: number; centerLabel?: string;
  formatValue?: (v: number) => string; emptyLabel?: string;
}) {
  if (!data || data.length === 0 || data.every((d) => d.value === 0))
    return <ChartState kind="empty" title={emptyLabel} height={height} />;
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%"
              paddingAngle={2} stroke="none" isAnimationActive animationDuration={800}>
              {data.map((d, i) => <Cell key={d.key} fill={d.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} formatter={(v: number, n: string) => [fmt(Number(v)), n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[26px] font-semibold tabular-nums text-white">{fmt(total)}</span>
          {centerLabel && <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{centerLabel}</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <div key={d.key} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <span className="truncate text-white/70">{d.key}</span>
            </span>
            <span className="shrink-0 tabular-nums text-white/50">
              {fmt(d.value)} <span className="text-white/25">· {total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Histogram (vertical bars over discrete buckets) ──────────────────────────
/** Vertical-bar histogram for distributions (retry counts, latency buckets). */
export function MiniHistogram({ data, height = 200, color = ACCENT_HSL, valueLabel = "count", emptyLabel = "No data yet." }: {
  data: TrendPoint[]; height?: number; color?: string; valueLabel?: string; emptyLabel?: string;
}) {
  const uid = useId().replace(/:/g, "");
  if (!data || data.length === 0 || data.every((d) => d.value === 0))
    return <ChartState kind="empty" title={emptyLabel} height={height} />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`hg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.85} />
              <stop offset="100%" stopColor={color} stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} minTickGap={2} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#fff" }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} cursor={{ fill: accent(0.08) }}
            formatter={(v: number) => [Number(v).toLocaleString(), valueLabel]} />
          <Bar dataKey="value" fill={`url(#hg-${uid})`} radius={[5, 5, 0, 0]} isAnimationActive animationDuration={800} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Pure data helpers (no fabrication — only shape what's passed in) ──────────

/** UTC YYYY-MM-DD for an ISO/date string. UTC keeps bucketing deterministic
 *  across machine/CI timezones and matches the existing MoneyOverview series. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Bucket rows into a contiguous daily series ending today, going back `days`
 * days. `value` defaults to a count of 1 per row; pass a selector to sum a
 * numeric field (use Math.abs in the selector for magnitudes). Labels are MM-DD.
 * Buckets are UTC days. `now` is injectable for tests; defaults to the present.
 */
export function bucketByDay<T>(rows: T[], getDate: (r: T) => string | null | undefined, opts?: {
  days?: number; value?: (r: T) => number; now?: Date;
}): TrendPoint[] {
  const days = opts?.days ?? 14;
  const value = opts?.value;
  const end = opts?.now ? new Date(opts.now) : new Date();
  const buckets = new Map<string, number>();
  const order: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end); d.setUTCDate(end.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    buckets.set(k, 0); order.push(k);
  }
  for (const r of rows) {
    const iso = getDate(r);
    if (!iso) continue;
    const k = dayKey(iso);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + (value ? value(r) : 1));
  }
  return order.map((k) => ({ label: k.slice(5), value: buckets.get(k) ?? 0 }));
}

/** Count rows by a categorical key, sorted desc. Null/empty → `other`. */
export function countBy<T>(rows: T[], getKey: (r: T) => string | null | undefined, otherLabel = "—"): CategoryDatum[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const raw = getKey(r);
    const k = raw == null || raw === "" ? otherLabel : String(raw);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}

/** Sum a numeric field grouped by a categorical key, sorted desc. */
export function sumBy<T>(rows: T[], getKey: (r: T) => string | null | undefined, getValue: (r: T) => number, otherLabel = "—"): CategoryDatum[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const raw = getKey(r);
    const k = raw == null || raw === "" ? otherLabel : String(raw);
    m.set(k, (m.get(k) ?? 0) + (getValue(r) || 0));
  }
  return [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}

/** Keep the top N categories; fold the rest into a single "+N more" bucket. */
export function topN(data: CategoryDatum[], n: number, restLabel = "Other"): CategoryDatum[] {
  if (data.length <= n) return data;
  const head = data.slice(0, n);
  const rest = data.slice(n).reduce((s, d) => s + d.value, 0);
  return rest > 0 ? [...head, { key: restLabel, value: rest, color: "rgba(255,255,255,0.22)" }] : head;
}

/** Percent helper guarding divide-by-zero. */
export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}
