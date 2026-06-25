/**
 * BusinessCharts — the analytics primitive kit for the /business module.
 *
 * Recharts-backed, themed to the cover-hero glass language (business blue,
 * hairline grids, dark glass tooltips). Pages compose these with BusinessPage
 * primitives to build premium, data-rich surfaces. All charts are driven by
 * REAL data passed in by the page — never fabricate.
 */
import type { ReactNode } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

// ── Palette ──────────────────────────────────────────────────────────────────
export const CHART_BLUE = "hsl(215, 92%, 60%)";
export const CHART_CYAN = "hsl(195, 90%, 60%)";
export const CHART_VIOLET = "hsl(265, 85%, 68%)";
export const CHART_EMERALD = "hsl(152, 70%, 52%)";
export const CHART_AMBER = "hsl(38, 92%, 58%)";
export const CHART_ROSE = "hsl(352, 85%, 64%)";
export const CHART_SERIES = [CHART_BLUE, CHART_CYAN, CHART_VIOLET, CHART_EMERALD, CHART_AMBER, CHART_ROSE];

const AXIS = { fontSize: 10, fontFamily: "ui-monospace, monospace", fill: "rgba(255,255,255,0.35)" } as const;
const GRID_STROKE = "rgba(255,255,255,0.05)";

// Horizon: borderless dark tooltip.
const tooltipStyle = {
  background: "#0a0d14",
  border: "none",
  borderRadius: 12,
  backdropFilter: "blur(12px)",
  fontSize: 12,
  color: "rgba(255,255,255,0.9)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
} as const;

// ── ChartCard — Horizon borderless section (accent-tick heading, no surface) ──
export function ChartCard({ title, subtitle, action, children, className, bodyClassName }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode;
  children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span aria-hidden className="h-4 w-1 shrink-0 rounded-full" style={{ background: "linear-gradient(hsl(215 90% 60%), hsl(188 92% 58%))" }} />
            <div className="min-w-0">
              {title && <h2 className="font-display text-[17px] font-semibold tracking-tight text-white truncate">{title}</h2>}
              {subtitle && <div className={cn(TYPE_META, "tracking-[0.18em] text-white/40 mt-0.5")}>{subtitle}</div>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export interface ChartSeries { key: string; label?: string; color?: string }

// ── AreaTrend — smooth gradient area chart for time series ───────────────────
export function AreaTrend({ data, xKey, series, height = 220, yWidth = 34, hideAxes }: {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: ChartSeries[];
  height?: number;
  yWidth?: number;
  hideAxes?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
        <defs>
          {series.map((s, i) => {
            const c = s.color ?? CHART_SERIES[i % CHART_SERIES.length];
            return (
              <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                <stop offset="100%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        {!hideAxes && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />}
        {!hideAxes && <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />}
        {!hideAxes && <YAxis tick={AXIS} axisLine={false} tickLine={false} width={yWidth} allowDecimals={false} />}
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
        {series.map((s, i) => {
          const c = s.color ?? CHART_SERIES[i % CHART_SERIES.length];
          return (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key}
              stroke={c} strokeWidth={2} fill={`url(#area-${s.key})`} dot={false} activeDot={{ r: 3 }} />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── BarTrend — rounded bar chart ─────────────────────────────────────────────
export function BarTrend({ data, xKey, series, height = 220, yWidth = 34, stacked }: {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: ChartSeries[];
  height?: number;
  yWidth?: number;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={yWidth} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        {series.map((s, i) => {
          const c = s.color ?? CHART_SERIES[i % CHART_SERIES.length];
          return (
            <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} stackId={stacked ? "a" : undefined}
              fill={c} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={42} />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── DonutChart — proportion breakdown with center label ──────────────────────
export interface DonutDatum { name: string; value: number; color?: string }
export function DonutChart({ data, height = 220, centerLabel, centerValue }: {
  data: DonutDatum[]; height?: number; centerLabel?: ReactNode; centerValue?: ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%"
            paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={d.name} fill={d.color ?? CHART_SERIES[i % CHART_SERIES.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue !== undefined || centerLabel !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-display font-light text-[28px] text-white tabular-nums leading-none">
            {centerValue ?? total.toLocaleString()}
          </div>
          {centerLabel && <div className={cn(TYPE_META, "tracking-[0.22em] text-white/40 mt-1.5")}>{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

// ── Legend — keyed swatches for any of the above ─────────────────────────────
export function ChartLegend({ items, className }: {
  items: { label: ReactNode; color: string; value?: ReactNode }[]; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
          <span className="text-[12px] text-white/65">{it.label}</span>
          {it.value !== undefined && <span className="text-[12px] text-white/45 tabular-nums">· {it.value}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Sparkline — tiny inline area trend ───────────────────────────────────────
export function Sparkline({ data, color = CHART_BLUE, height = 34 }: {
  data: number[]; color?: string; height?: number;
}) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── TrendStat — KPI with value, period delta, and a sparkline ────────────────
export function TrendStat({ label, value, deltaPct, spark, accent, hint, loading }: {
  label: ReactNode; value: ReactNode; deltaPct?: number | null; spark?: number[];
  accent?: boolean; hint?: ReactNode; loading?: boolean;
}) {
  const up = (deltaPct ?? 0) > 0;
  const flat = !deltaPct;
  const DeltaIcon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const deltaTone = flat ? "text-white/40" : up ? "text-emerald-300/90" : "text-rose-300/90";
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className={cn(TYPE_META, "tracking-[0.22em] text-white/45")}>{label}</div>
        {deltaPct !== undefined && deltaPct !== null && !loading && (
          <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums", deltaTone)}>
            <DeltaIcon className="w-3 h-3" strokeWidth={2} />{Math.abs(deltaPct).toFixed(0)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-[30px] w-16 rounded-md bg-white/[0.06] animate-pulse" />
      ) : (
        <div
          className="mt-2.5 font-display font-semibold text-[34px] leading-[0.95] tracking-tight tabular-nums"
          style={accent ? { color: "hsl(215 100% 72%)", textShadow: "0 0 30px hsl(215 90% 60% / 0.5)" } : { color: "#fff" }}
        >{value}</div>
      )}
      {spark && spark.length > 1 && !loading && (
        <div className="mt-3 -mb-1"><Sparkline data={spark} color={accent ? CHART_BLUE : "rgba(255,255,255,0.5)"} height={32} /></div>
      )}
      {hint && !loading && <div className="mt-2 text-[12px] text-white/40">{hint}</div>}
    </div>
  );
}

// ── DataTable — premium hairline table ───────────────────────────────────────
export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  render?: (row: T, index: number) => ReactNode;
}
export function DataTable<T extends Record<string, unknown>>({ columns, rows, getRowKey, empty, className, onRowClick }: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
}) {
  const alignCls = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cn("overflow-x-auto", className)}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {columns.map((c) => (
                <th key={c.key} className={cn(TYPE_META, "tracking-[0.2em] pb-3 pr-4 text-white/40 whitespace-nowrap", alignCls(c.align))}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-white/[0.025]")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 text-[13px] text-white/80", alignCls(c.align), c.className)}>
                    {c.render ? c.render(row, i) : (row[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

// ── bucketByDay — helper to fold timestamped rows into a daily series ────────
export function bucketByDay<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined,
  getValue: (row: T) => number,
  days: number,
): Array<{ day: string; label: string; value: number }> {
  const out: Array<{ day: string; label: string; value: number }> = [];
  const idx = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = days - 1; d >= 0; d--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - d);
    const key = dt.toISOString().slice(0, 10);
    idx.set(key, out.length);
    out.push({ day: key, label: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: 0 });
  }
  for (const r of rows) {
    const ds = getDate(r);
    if (!ds) continue;
    const key = ds.slice(0, 10);
    const at = idx.get(key);
    if (at !== undefined) out[at].value += getValue(r);
  }
  return out;
}

/** Period-over-period delta % between the two halves of a numeric series. */
export function periodDelta(series: number[]): number | null {
  if (series.length < 2) return null;
  const mid = Math.floor(series.length / 2);
  const prev = series.slice(0, mid).reduce((a, b) => a + b, 0);
  const curr = series.slice(mid).reduce((a, b) => a + b, 0);
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}
