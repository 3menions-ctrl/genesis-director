/**
 * AdminDashboardPage — Mission Control (premium rebuild).
 *
 * The bar-setter for the admin rebuild: borderless glass, single blue accent,
 * Fraunces, real charts. KPI tiles + live visualizations + an attention queue
 * + hub nav, all on the shared admin UI primitives (src/admin/ui).
 *
 * Data path is preserved: one `admin_dashboard_pulse` RPC with a parallel-count
 * fallback, plus a real 14-day signups series for the trend chart.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Coins, FolderKanban, MessageSquare, RefreshCw,
  Sparkles, TrendingUp, Users, Wallet, Zap, ChevronRight, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AdminPageHeader, AdminCard, KpiTile, ChartCard, AttentionCard,
  ACCENT_HSL, accent, CYAN, VIOLET, ROSE, AMBER,
} from "@/admin/ui/primitives";

const AURORA_CSS = `
.admin-aurora{position:absolute;border-radius:9999px;filter:blur(90px);opacity:.55;will-change:transform}
.admin-aurora-1{top:-180px;left:6%;width:540px;height:540px;background:radial-gradient(closest-side, hsl(214 90% 62% / .28), transparent 70%);animation:admAur1 24s ease-in-out infinite}
.admin-aurora-2{top:-90px;right:4%;width:480px;height:480px;background:radial-gradient(closest-side, hsl(188 92% 58% / .20), transparent 70%);animation:admAur2 30s ease-in-out infinite}
.admin-aurora-3{top:220px;left:42%;width:520px;height:520px;background:radial-gradient(closest-side, hsl(256 88% 72% / .16), transparent 70%);animation:admAur3 34s ease-in-out infinite}
@keyframes admAur1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(46px,34px) scale(1.08)}}
@keyframes admAur2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-54px,22px) scale(.94)}}
@keyframes admAur3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,-34px) scale(1.06)}}
@media (prefers-reduced-motion: reduce){.admin-aurora{animation:none!important}}
`;

interface Pulse {
  users:    { total_users: number; signups_24h: number; signups_7d: number };
  projects: { total: number; completed: number; failed: number; in_flight: number; created_24h: number };
  credits:  { lifetime_grants: number; lifetime_spend: number; spend_24h_signed: number };
  support:  { open_tickets: number };
}
const empty: Pulse = {
  users:    { total_users: 0, signups_24h: 0, signups_7d: 0 },
  projects: { total: 0, completed: 0, failed: 0, in_flight: 0, created_24h: 0 },
  credits:  { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: 0 },
  support:  { open_tickets: 0 },
};

type ActionCard = { priority: "high" | "medium" | "low"; icon: LucideIcon; title: string; body: string; ctaLabel: string; ctaTo: string };
const priorityRank = (p: ActionCard["priority"]) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

const HUBS = [
  { icon: Users, title: "People", sub: "Users · sessions · roles · GDPR · abuse", to: "/admin/people" },
  { icon: FolderKanban, title: "Production", sub: "Projects · queue · providers · edge logs", to: "/admin/production-hub" },
  { icon: Wallet, title: "Money", sub: "Subscriptions · refunds · coupons · ledger", to: "/admin/money" },
  { icon: TrendingUp, title: "Growth", sub: "Analytics · experiments · flags · cohorts", to: "/admin/growth" },
  { icon: Zap, title: "System", sub: "API keys · webhooks · secrets · DB health", to: "/admin/system" },
];

export default function AdminDashboardPage() {
  const [pulse, setPulse] = useState<Pulse>(empty);
  const [series, setSeries] = useState<{ day: string; signups: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_dashboard_pulse" as never);
      if (!error && data) {
        setPulse(data as unknown as Pulse);
      } else {
        const [u, p24, projTotal, projFailed, projDone, projFlight, p24Proj, sup] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("status", "failed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).not("status", "in", "(failed,completed,draft)"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
          supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        ]);
        setPulse({
          users:    { total_users: u.count ?? 0, signups_24h: p24.count ?? 0, signups_7d: 0 },
          projects: { total: projTotal.count ?? 0, completed: projDone.count ?? 0, failed: projFailed.count ?? 0, in_flight: projFlight.count ?? 0, created_24h: p24Proj.count ?? 0 },
          credits:  { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: 0 },
          support:  { open_tickets: sup.count ?? 0 },
        });
      }

      // Real 14-day signups trend (bucketed client-side).
      const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 13);
      const { data: rows } = await supabase.from("profiles").select("created_at").gte("created_at", since.toISOString());
      const buckets = new Map<string, number>();
      for (let i = 0; i < 14; i++) { const d = new Date(since); d.setDate(since.getDate() + i); buckets.set(d.toISOString().slice(0, 10), 0); }
      for (const r of (rows ?? []) as { created_at: string }[]) {
        const k = new Date(r.created_at).toISOString().slice(0, 10);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      }
      setSeries(Array.from(buckets.entries()).map(([k, v]) => ({ day: k.slice(5), signups: v })));

      setLastUpdated(new Date());
    } catch (e) {
      console.error("[AdminDashboard] load error", e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = useMemo<ActionCard[]>(() => {
    const items: ActionCard[] = [];
    if (pulse.support.open_tickets > 0) items.push({ priority: "high", icon: MessageSquare, title: `${pulse.support.open_tickets} open support ticket${pulse.support.open_tickets === 1 ? "" : "s"}`, body: "Waiting on first response or follow-up from a teammate.", ctaLabel: "Open inbox", ctaTo: "/admin/messages" });
    if (pulse.projects.failed > 0) items.push({ priority: pulse.projects.failed > 5 ? "high" : "medium", icon: AlertTriangle, title: `${pulse.projects.failed} project${pulse.projects.failed === 1 ? "" : "s"} in failed state`, body: "These never reached completion and likely need a retry or refund.", ctaLabel: "Review failures", ctaTo: "/admin/projects?status=failed" });
    if (pulse.projects.in_flight > 0) items.push({ priority: "low", icon: Activity, title: `${pulse.projects.in_flight} render${pulse.projects.in_flight === 1 ? "" : "s"} in flight`, body: "Live jobs across the pipeline — watch the queue if any stall past ETA.", ctaLabel: "Open queue", ctaTo: "/admin/queue" });
    if (pulse.users.signups_24h > 0) items.push({ priority: "low", icon: Users, title: `${pulse.users.signups_24h} new sign-up${pulse.users.signups_24h === 1 ? "" : "s"} in the last 24h`, body: pulse.users.signups_7d > 0 ? `${pulse.users.signups_7d} this week. Growth is live.` : "Welcome traffic from your latest channels.", ctaLabel: "View people", ctaTo: "/admin/users" });
    if (Math.abs(pulse.credits.spend_24h_signed) > 0) { const spend = Math.abs(pulse.credits.spend_24h_signed); items.push({ priority: "low", icon: Coins, title: `${spend.toLocaleString()} credits burned in the last 24h`, body: "Track engine spend — if this rises sharply, free-tier renders should throttle.", ctaLabel: "Open ledger", ctaTo: "/admin/credits" }); }
    if (items.length === 0) items.push({ priority: "low", icon: Sparkles, title: "All clear.", body: "No open tickets, no failed renders, no urgent action required. Take a breath.", ctaLabel: "Open analytics", ctaTo: "/admin/analytics" });
    items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    return items;
  }, [pulse]);

  const statusData = useMemo(() => ([
    { key: "completed", name: "Completed", value: pulse.projects.completed, from: ACCENT_HSL, to: CYAN },
    { key: "inflight", name: "In flight", value: pulse.projects.in_flight, from: VIOLET, to: ACCENT_HSL },
    { key: "failed", name: "Failed", value: pulse.projects.failed, from: ROSE, to: AMBER },
  ].filter((d) => d.value > 0)), [pulse]);

  const spark = useMemo(() => series.map((s) => s.signups), [series]);

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <style>{AURORA_CSS}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="admin-aurora admin-aurora-1" />
        <div className="admin-aurora admin-aurora-2" />
        <div className="admin-aurora admin-aurora-3" />
      </div>
      <AdminPageHeader
        eyebrow="01 · Pulse"
        title={<>Mission <span className="italic">control</span>.</>}
        sub="What needs you right now — and the signals behind it. Drill into any card to act."
        actions={
          <button onClick={() => void load(true)} disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white disabled:opacity-40">
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}
          </button>
        }
      />

      {/* KPI rail */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile index={0} label="Total users" value={pulse.users.total_users} icon={Users} delta={pulse.users.signups_24h} deltaLabel="today" sparkData={spark} />
        <KpiTile index={1} label="New · 7d" value={pulse.users.signups_7d} icon={TrendingUp} accentNumber sparkData={spark} />
        <KpiTile index={2} label="Projects" value={pulse.projects.total} icon={FolderKanban} delta={pulse.projects.created_24h} deltaLabel="new" />
        <KpiTile index={3} label="In flight" value={pulse.projects.in_flight} icon={Activity} deltaLabel="rendering now" />
        <KpiTile index={4} label="Failed" value={pulse.projects.failed} icon={AlertTriangle} deltaLabel={pulse.projects.failed > 0 ? "need attention" : "all clear"} />
        <KpiTile index={5} label="Open tickets" value={pulse.support.open_tickets} icon={MessageSquare} deltaLabel="support" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <ChartCard title="Sign-ups" meta="last 14 days">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.6} />
                    <stop offset="45%" stopColor={CYAN} stopOpacity={0.24} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="areaStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={ACCENT_HSL} />
                    <stop offset="100%" stopColor={CYAN} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, boxShadow: "0 20px 60px -20px rgba(0,0,0,0.9)", fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#fff" }} cursor={{ stroke: accent(0.4) }} />
                <Area type="monotone" dataKey="signups" stroke="url(#areaStroke)" strokeWidth={2.5} fill="url(#areaFill)" dot={false} activeDot={{ r: 5, fill: CYAN, stroke: ACCENT_HSL, strokeWidth: 2 }} isAnimationActive animationDuration={1200} style={{ filter: `drop-shadow(0 6px 16px ${accent(0.4)})` }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Projects by status" meta={`${pulse.projects.total.toLocaleString()} total`}>
          <div className="flex h-60 items-center">
            <div className="relative h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {statusData.map((d) => (
                      <linearGradient key={d.key} id={`seg-${d.key}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={d.from} /><stop offset="100%" stopColor={d.to} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={4} cornerRadius={6} stroke="none" isAnimationActive animationDuration={1100} style={{ filter: `drop-shadow(0 4px 16px ${accent(0.35)})` }}>
                    {statusData.map((d) => <Cell key={d.key} fill={`url(#seg-${d.key})`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0a0d14", border: "none", borderRadius: 12, fontSize: 12 }} itemStyle={{ color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[26px] font-semibold leading-none text-white" style={{ textShadow: `0 0 22px ${accent(0.5)}` }}>{pulse.projects.total.toLocaleString()}</span>
                <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">projects</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 pl-3">
              {statusData.length === 0 && <div className="text-[13px] font-light text-white/40">No projects yet.</div>}
              {statusData.map((d) => (
                <div key={d.key} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2.5 text-[13px] text-white/70">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${d.from}, ${d.to})`, boxShadow: `0 0 8px ${d.from}` }} />{d.name}
                  </span>
                  <span className="font-display text-[15px] font-semibold tabular-nums text-white">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Attention queue + hubs */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Action queue</div>
          {loading ? (
            <AdminCard className="flex items-center justify-center gap-3 py-20 text-white/50">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Reading pulse…</span>
            </AdminCard>
          ) : (
            <div className="space-y-4">
              {cards.map((c, i) => <AttentionCard key={i} index={i} {...c} />)}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Hubs</div>
          <div className="space-y-3">
            {HUBS.map((h) => (
              <Link key={h.to} to={h.to} className="group block">
                <AdminCard interactive className="flex items-center gap-3.5 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: accent(0.12), color: ACCENT_HSL }}>
                    <h.icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-semibold text-white">{h.title}</div>
                    <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{h.sub}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />
                </AdminCard>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
