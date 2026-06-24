/**
 * GrowthOverview — comprehensive launchpad for the Growth hub.
 *
 * Summarises every Growth cluster at a glance and acts as the hub's navigation:
 *  - a cross-domain KPI rail (floating figures)
 *  - the dominant traffic trend
 *  - four "domain cards" — Analytics / Experiments / Content / Comms — each
 *    pulling LIVE headline figures and deep-linking into its cluster tab
 *    (/admin/growth#analytics etc.).
 *
 * Every figure is real (analytics_* RPCs, feature_flags, experiments,
 * signup_analytics, gallery_showcase, project_templates, avatar_catalog_entries,
 * content_safety_rules, project_comments, announcements, changelog_entries) and
 * defensive — tolerates missing tables/empty data and never throws.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Eye, MousePointerClick, UserPlus, ToggleRight, FlaskConical, Image } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  StatOrb, ORB_AURAS, FloatSection, FloatRow, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, accent,
} from "@/admin/ui/primitives";

type Row = Record<string, unknown>;
const str = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v != null && v !== "") return String(v); } return ""; };
const num = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (typeof v === "number") return v; if (v != null && !isNaN(Number(v))) return Number(v); } return 0; };
const bool = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v != null) return v === true || v === "true" || v === 1 || v === "1"; } return false; };

const count = async (table: string, build?: (q: any) => any) => {
  try {
    let q: any = supabase.from(table as never).select("id", { count: "exact", head: true });
    if (build) q = build(q);
    const { count: c } = await q;
    return c ?? 0;
  } catch { return 0; }
};

interface ChartPoint { day: string; pageviews: number }
interface Pulse { users: { signups_7d: number } }

export default function GrowthOverview() {
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [totals, setTotals] = useState({ pageviews: 0, visitors: 0, sessions: 0 });
  const [signups7d, setSignups7d] = useState(0);
  const [topPages, setTopPages] = useState<Row[]>([]);
  const [flagOn, setFlagOn] = useState(0);
  const [flagTotal, setFlagTotal] = useState(0);
  const [exp, setExp] = useState({ total: 0, running: 0 });
  const [content, setContent] = useState({ gallery: 0, templates: 0, avatars: 0, safety: 0, comments: 0 });
  const [comms, setComms] = useState<{ news?: Row; log?: Row }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
        const [dailyRes, pagesRes, flagsRes, pulseRes, expRes, newsRes, logRes,
          gallery, templates, avatars, safety, comments] = await Promise.all([
          supabase.rpc("analytics_visitors_daily" as never, { _since: since } as never),
          supabase.rpc("analytics_top_pages" as never, { _since: since, _limit: 6 } as never),
          supabase.from("feature_flags").select("enabled, is_enabled, active"),
          supabase.rpc("admin_dashboard_pulse" as never),
          supabase.from("experiments").select("status"),
          supabase.from("announcements").select("title, body, created_at").order("created_at", { ascending: false }).limit(1),
          supabase.from("changelog_entries").select("title, version, created_at").order("created_at", { ascending: false }).limit(1),
          count("gallery_showcase"),
          count("project_templates"),
          count("avatar_catalog_entries"),
          count("content_safety_rules"),
          count("project_comments"),
        ]);

        const daily = ((dailyRes.data as Row[]) ?? [])
          .map((d) => ({ ...d, _day: String(d.day).slice(0, 10) }))
          .filter((d) => !!d._day && d._day !== "null");
        let pv = 0, vis = 0, sess = 0;
        for (const d of daily) { pv += num(d, "pageviews"); vis += num(d, "visitors"); sess += num(d, "sessions"); }
        setTotals({ pageviews: pv, visitors: vis, sessions: sess });
        setChart(daily.map((d) => ({ day: String(d._day).slice(5), pageviews: num(d, "pageviews") })));
        setTopPages((pagesRes.data as Row[]) ?? []);

        const allFlags = (flagsRes.data as Row[]) ?? [];
        setFlagTotal(allFlags.length);
        setFlagOn(allFlags.filter((f) => bool(f, "enabled", "is_enabled", "active")).length);

        setSignups7d((pulseRes.data as unknown as Pulse | null)?.users?.signups_7d ?? 0);

        const exps = (expRes.data as Row[]) ?? [];
        const running = exps.filter((e) => ["running", "active", "live"].includes(str(e, "status").toLowerCase())).length;
        setExp({ total: exps.length, running });

        setContent({ gallery, templates, avatars, safety, comments });
        setComms({ news: (newsRes.data as Row[])?.[0], log: (logRes.data as Row[])?.[0] });
      } catch (e) {
        console.error("[GrowthOverview] load", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: "Visitors · 30d", value: totals.visitors, icon: Eye },
    { label: "Sessions · 30d", value: totals.sessions, icon: MousePointerClick, accentNumber: true },
    { label: "Signups · 7d", value: signups7d, icon: UserPlus },
    { label: "A/B running", value: exp.running, icon: FlaskConical },
    { label: "Flags on", value: `${flagOn} / ${flagTotal}`, icon: ToggleRight },
    { label: "Content items", value: content.gallery + content.templates + content.avatars, icon: Image },
  ]), [totals, signups7d, exp, flagOn, flagTotal, content]);

  return (
    <div className="space-y-14">
      {/* Cross-domain KPI rail — floating figures */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <StatOrb key={k.label} index={i} aura={ORB_AURAS[i % ORB_AURAS.length]} {...k} />)}
      </div>

      {/* Dominant traffic trend */}
      <FloatSection title="Traffic" meta="pageviews · last 30 days" actions={<DeckButton accent><Link to="/admin/growth#analytics">Open analytics →</Link></DeckButton>}>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.5} />
                  <stop offset="55%" stopColor={CYAN} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="growthStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={ACCENT_HSL} /><stop offset="100%" stopColor={CYAN} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
              <Area type="monotone" dataKey="pageviews" stroke="url(#growthStroke)" strokeWidth={2.5} fill="url(#growthFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1100} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </FloatSection>

      {/* Domain launchpad — one summary card per cluster, each a door into it */}
      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
        <DomainCard title="Analytics" to="/admin/growth#analytics" cta="Open analytics"
          rows={[
            { k: "Pageviews · 30d", v: totals.pageviews.toLocaleString() },
            { k: "Top page", v: <span className="font-mono text-[12px] text-white/70">{str(topPages[0] ?? {}, "path") || "—"}</span> },
            { k: "Top page views", v: num(topPages[0] ?? {}, "views").toLocaleString() },
          ]} />

        <DomainCard title="Experiments" to="/admin/growth#experiments" cta="Open experiments"
          rows={[
            { k: "A/B tests running", v: <span className="inline-flex items-center gap-2">{exp.running}{exp.running > 0 && <StatusPill tone="positive">live</StatusPill>}</span> },
            { k: "Total experiments", v: exp.total.toLocaleString() },
            { k: "Feature flags on", v: `${flagOn} / ${flagTotal}` },
          ]} />

        <DomainCard title="Content" to="/admin/growth#content" cta="Open content"
          rows={[
            { k: "Gallery · templates · avatars", v: `${content.gallery} · ${content.templates} · ${content.avatars}` },
            { k: "Safety rules", v: content.safety.toLocaleString() },
            { k: "Comments", v: content.comments.toLocaleString() },
          ]} />

        <DomainCard title="Comms" to="/admin/growth#comms" cta="Open comms"
          rows={[
            { k: "Latest announcement", v: <span className="block max-w-[14rem] truncate text-[13px] text-white/75">{str(comms.news ?? {}, "title") || (loading ? "…" : "None yet")}</span> },
            { k: "Latest changelog", v: <span className="block max-w-[14rem] truncate text-[13px] text-white/75">{str(comms.log ?? {}, "title", "version") || (loading ? "…" : "None yet")}</span> },
          ]} />
      </div>
    </div>
  );
}

/** A floating domain summary block that deep-links into its cluster tab. */
function DomainCard({ title, to, cta, rows }: { title: string; to: string; cta: string; rows: { k: string; v: ReactNode }[] }) {
  return (
    <FloatSection title={title} actions={<DeckButton accent><Link to={to}>{cta} →</Link></DeckButton>}>
      <div>
        {rows.map((r, i) => (
          <FloatRow key={r.k} last={i === rows.length - 1}
            left={<span className="text-[12.5px] text-white/55">{r.k}</span>}
            right={<span className="font-display text-[16px] tabular-nums text-white">{r.v}</span>}
          />
        ))}
      </div>
    </FloatSection>
  );
}
