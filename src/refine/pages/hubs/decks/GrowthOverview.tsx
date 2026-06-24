/**
 * GrowthOverview — the "Command Deck" landing for /admin growth & analytics.
 *
 * Direction A, completely borderless: figures float on the page, lists are
 * separated only by a thin hairline, generous spacing. Wired to LIVE data —
 * `analytics_visitors_daily` + `analytics_top_pages` RPCs for the traffic
 * trend and top pages, `feature_flags` for flag rollout, and
 * `admin_dashboard_pulse` for the sign-up figure. Renders embedded inside the
 * Growth hub shell (no own hero). Defensive throughout — tolerates null/empty
 * and never throws on malformed analytics rows.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Users, MousePointerClick, UserPlus, ToggleRight, FlaskConical } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  StatOrb, ORB_AURAS, FloatSection, FloatTable, FloatRow, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, accent,
} from "@/admin/ui/primitives";

type Row = Record<string, unknown>;
const str = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v != null && v !== "") return String(v); } return ""; };
const num = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (typeof v === "number") return v; if (v != null && !isNaN(Number(v))) return Number(v); } return 0; };
const bool = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v != null) return v === true || v === "true" || v === 1 || v === "1"; } return false; };
const dur = (s: number) => {
  const sec = Math.max(0, Math.round(s));
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

interface ChartPoint { day: string; pageviews: number }
interface Pulse { users: { signups_7d: number } }

export default function GrowthOverview() {
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [totals, setTotals] = useState({ pageviews: 0, visitors: 0, sessions: 0 });
  const [signups7d, setSignups7d] = useState(0);
  const [topPages, setTopPages] = useState<Row[]>([]);
  const [flags, setFlags] = useState<Row[]>([]);
  const [flagOn, setFlagOn] = useState(0);
  const [flagTotal, setFlagTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
        const [dailyRes, pagesRes, flagsRes, pulseRes] = await Promise.all([
          supabase.rpc("analytics_visitors_daily" as never, { _since: since } as never),
          supabase.rpc("analytics_top_pages" as never, { _since: since, _limit: 8 } as never),
          supabase.from("feature_flags").select("*"),
          supabase.rpc("admin_dashboard_pulse" as never),
        ]);

        const daily = ((dailyRes.data as Row[]) ?? [])
          .map((d) => ({ ...d, _day: String(d.day).slice(0, 10) }))
          .filter((d) => !!d._day && d._day !== "null");
        let pv = 0, vis = 0, sess = 0;
        for (const d of daily) {
          pv += num(d, "pageviews");
          vis += num(d, "visitors");
          sess += num(d, "sessions");
        }
        setTotals({ pageviews: pv, visitors: vis, sessions: sess });
        setChart(daily.map((d) => ({ day: String(d._day).slice(5), pageviews: num(d, "pageviews") })));

        setTopPages((pagesRes.data as Row[]) ?? []);

        const allFlags = (flagsRes.data as Row[]) ?? [];
        setFlags(allFlags);
        setFlagTotal(allFlags.length);
        setFlagOn(allFlags.filter((f) => bool(f, "enabled", "is_enabled", "active")).length);

        const pulse = pulseRes.data as unknown as Pulse | null;
        setSignups7d(pulse?.users?.signups_7d ?? 0);
      } catch (e) {
        console.error("[GrowthOverview] load", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: "Pageviews · 30d", value: totals.pageviews, icon: Eye },
    { label: "Visitors · 30d", value: totals.visitors, icon: Users },
    { label: "Sessions · 30d", value: totals.sessions, icon: MousePointerClick, accentNumber: true },
    { label: "New · 7d", value: signups7d, icon: UserPlus },
    { label: "Flags on", value: `${flagOn} / ${flagTotal}`, icon: ToggleRight },
    { label: "Feature flags", value: flagTotal, icon: FlaskConical },
  ]), [totals, signups7d, flagOn, flagTotal]);

  return (
    <div className="space-y-14">
      {/* KPI rail — floating aura orbs */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <StatOrb key={k.label} index={i} aura={ORB_AURAS[i % ORB_AURAS.length]} {...k} />)}
      </div>

      {/* Dominant traffic trend */}
      <FloatSection title="Pageviews" meta="last 30 days" actions={<DeckButton accent><Link to="/admin/analytics">Open analytics →</Link></DeckButton>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.55} />
                  <stop offset="50%" stopColor={CYAN} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="growthStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
              <Area type="monotone" dataKey="pageviews" stroke="url(#growthStroke)" strokeWidth={2.5} fill="url(#growthFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </FloatSection>

      {/* Top pages + feature flags */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.55fr_1fr]">
        <FloatSection title="Top pages" meta={loading ? "loading…" : `${topPages.length} shown`}>
          <FloatTable
            columns={[
              { key: "path", label: "Path" },
              { key: "views", label: "Views", align: "right" },
              { key: "visitors", label: "Visitors", align: "right" },
              { key: "avg", label: "Avg time", align: "right" },
            ]}
            rows={topPages.map((p, i) => ({
              _key: str(p, "path") || i,
              path: <span className="block max-w-[18rem] truncate font-mono text-[11.5px] text-white/70">{str(p, "path") || "—"}</span>,
              views: <span className="text-white">{num(p, "views").toLocaleString()}</span>,
              visitors: <span className="text-white/80">{num(p, "visitors").toLocaleString()}</span>,
              avg: <span className="text-white/50">{dur(num(p, "avg_seconds"))}</span>,
            }))}
          />
        </FloatSection>

        <FloatSection title="Feature flags" meta={`${flagOn} on`} actions={<DeckButton accent><Link to="/admin/feature-flags">All flags →</Link></DeckButton>}>
          <div>
            {flags.length === 0 && <div className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No feature flags yet.</div>}
            {flags.slice(0, 6).map((f, i, arr) => {
              const name = str(f, "key", "name", "flag") || "flag";
              const on = bool(f, "enabled", "is_enabled", "active");
              return (
                <FloatRow key={str(f, "id") || name || i} last={i === arr.length - 1}
                  left={<span className="truncate font-mono text-[12.5px] text-white/80">{name}</span>}
                  right={<StatusPill tone={on ? "positive" : "neutral"}>{on ? "on" : "off"}</StatusPill>}
                />
              );
            })}
          </div>
        </FloatSection>
      </div>
    </div>
  );
}
