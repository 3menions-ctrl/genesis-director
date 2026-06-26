/**
 * AdminDashboardPage — Mission Control (Horizon kit).
 *
 * Borderless floating figures over the shared aurora: a StatOrb KPI rail, live
 * FloatSection visualizations, an attention queue and hub nav. Built entirely on
 * the canonical admin primitives (src/admin/ui) + AdminPageShell hero.
 *
 * Data path is preserved: one `admin_dashboard_pulse` RPC with a parallel-count
 * fallback, plus a real 14-day signups series for the trend chart.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Coins, FolderKanban, MessageSquare, RefreshCw,
  Sparkles, TrendingUp, Users, Wallet, Zap, ChevronRight, Gauge, Server,
  Timer, DollarSign, HeartPulse, CircleDot, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminPageShell } from "../components/AdminPageShell";
import {
  StatOrb, FloatSection, FloatRow, DeckButton, AttentionCard, ORB_AURAS,
  ACCENT_HSL, accent, CYAN, VIOLET, ROSE, AMBER,
} from "@/admin/ui/primitives";
import {
  TrendArea, MultiTrend, CategoryBars, Donut, bucketByDay, sumBy, topN, pct,
} from "@/admin/ui/charts";

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

// Real rows pulled for the new analytics + health panels (all admin-gated reads).
interface ApiLog { created_at: string; service: string; status: string; real_cost_cents: number | null }
interface CreditTxn { created_at: string; amount: number; transaction_type: string }
interface ProjRow { created_at: string; status: string | null }
// Live operational health, computed from real 24h windows.
interface Health {
  renderSuccess: number | null;   // % from render_success_snapshot (authoritative)
  renderFailures: number;         // failed renders, 24h
  apiSuccess: number | null;      // % completed of (completed+failed), 24h, exact head counts
  apiCalls24h: number;            // total api_cost_logs rows, 24h (exact)
  apiSpend24h: number;            // $ from sampled 24h logs
  queueActive: number;            // clips pending/generating (exact)
  queueStuck: number;             // clips stuck >10m (exact)
}
const emptyHealth: Health = { renderSuccess: null, renderFailures: 0, apiSuccess: null, apiCalls24h: 0, apiSpend24h: 0, queueActive: 0, queueStuck: 0 };

// Tone for a 0-100 health percentage (higher = better).
const rateTone = (v: number | null): "emerald" | "amber" | "rose" | "neutral" =>
  v == null ? "neutral" : v >= 95 ? "emerald" : v >= 80 ? "amber" : "rose";
const toneColor = { emerald: CYAN, amber: AMBER, rose: ROSE, neutral: "rgba(255,255,255,0.5)" } as const;

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
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [credits, setCredits] = useState<CreditTxn[]>([]);
  const [projects, setProjects] = useState<ProjRow[]>([]);
  const [health, setHealth] = useState<Health>(emptyHealth);
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

      // ── Analytics + health windows — all real, admin-gated reads in parallel ──
      const since14 = since.toISOString();                                   // 14d ago (00:00)
      const since24h = new Date(Date.now() - 86400_000).toISOString();        // rolling 24h
      const stuckCut = new Date(Date.now() - 10 * 60_000).toISOString();      // 10m staleness
      const [
        creditsRes, projRes, apiRes, renderSnap,
        apiTotal, apiFailed, qActive, qStuck,
      ] = await Promise.all([
        supabase.from("credit_transactions").select("created_at, amount, transaction_type").gte("created_at", since14).limit(8000),
        supabase.from("movie_projects").select("created_at, status").gte("created_at", since14).limit(8000),
        supabase.from("api_cost_logs").select("created_at, service, status, real_cost_cents").gte("created_at", since24h).order("created_at", { ascending: false }).limit(5000),
        supabase.rpc("render_success_snapshot" as never, { window_hours: 24 } as never),
        supabase.from("api_cost_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("api_cost_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("status", "failed"),
        supabase.from("video_clips").select("id", { count: "exact", head: true }).in("status", ["pending", "generating"]),
        supabase.from("video_clips").select("id", { count: "exact", head: true }).in("status", ["pending", "generating"]).lt("updated_at", stuckCut),
      ]);

      const apiRows = (apiRes.data as ApiLog[]) ?? [];
      setApiLogs(apiRows);
      setCredits((creditsRes.data as CreditTxn[]) ?? []);
      setProjects((projRes.data as ProjRow[]) ?? []);

      const snap = ((renderSnap.data as { failures: number; success_rate_pct: number }[]) ?? [])[0];
      const apiTot = apiTotal.count ?? 0;
      const apiFail = apiFailed.count ?? 0;
      const apiOk = Math.max(0, apiTot - apiFail);
      setHealth({
        renderSuccess: snap?.success_rate_pct != null ? Number(snap.success_rate_pct) : null,
        renderFailures: snap?.failures != null ? Number(snap.failures) : 0,
        apiSuccess: apiTot > 0 ? pct(apiOk, apiTot) : null,
        apiCalls24h: apiTot,
        apiSpend24h: apiRows.reduce((s, r) => s + (r.real_cost_cents || 0), 0) / 100,
        queueActive: qActive.count ?? 0,
        queueStuck: qStuck.count ?? 0,
      });

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
    if (health.queueStuck > 0) items.push({ priority: "high", icon: Timer, title: `${health.queueStuck} render job${health.queueStuck === 1 ? "" : "s"} stuck >10m`, body: "Clips still pending/generating with no update for over 10 minutes — likely wedged. Requeue or cancel.", ctaLabel: "Open queue", ctaTo: "/admin/queue" });
    if (health.renderSuccess != null && health.renderSuccess < 80) items.push({ priority: "high", icon: HeartPulse, title: `Render success at ${health.renderSuccess}% (24h)`, body: `${health.renderFailures} failed render${health.renderFailures === 1 ? "" : "s"} in the last day. Check the failure classifications.`, ctaLabel: "Open telemetry", ctaTo: "/admin/observability" });
    if (health.apiSuccess != null && health.apiSuccess < 90 && health.apiCalls24h > 0) items.push({ priority: "medium", icon: Server, title: `Provider success at ${health.apiSuccess}% (24h)`, body: "Upstream API calls are failing above the normal rate. Inspect per-provider reliability.", ctaLabel: "Open providers", ctaTo: "/admin/providers" });
    if (pulse.support.open_tickets > 0) items.push({ priority: "high", icon: MessageSquare, title: `${pulse.support.open_tickets} open support ticket${pulse.support.open_tickets === 1 ? "" : "s"}`, body: "Waiting on first response or follow-up from a teammate.", ctaLabel: "Open inbox", ctaTo: "/admin/messages" });
    if (pulse.projects.failed > 0) items.push({ priority: pulse.projects.failed > 5 ? "high" : "medium", icon: AlertTriangle, title: `${pulse.projects.failed} project${pulse.projects.failed === 1 ? "" : "s"} in failed state`, body: "These never reached completion and likely need a retry or refund.", ctaLabel: "Review failures", ctaTo: "/admin/projects?status=failed" });
    if (pulse.projects.in_flight > 0) items.push({ priority: "low", icon: Activity, title: `${pulse.projects.in_flight} render${pulse.projects.in_flight === 1 ? "" : "s"} in flight`, body: "Live jobs across the pipeline — watch the queue if any stall past ETA.", ctaLabel: "Open queue", ctaTo: "/admin/queue" });
    if (pulse.users.signups_24h > 0) items.push({ priority: "low", icon: Users, title: `${pulse.users.signups_24h} new sign-up${pulse.users.signups_24h === 1 ? "" : "s"} in the last 24h`, body: pulse.users.signups_7d > 0 ? `${pulse.users.signups_7d} this week. Growth is live.` : "Welcome traffic from your latest channels.", ctaLabel: "View people", ctaTo: "/admin/users" });
    if (Math.abs(pulse.credits.spend_24h_signed) > 0) { const spend = Math.abs(pulse.credits.spend_24h_signed); items.push({ priority: "low", icon: Coins, title: `${spend.toLocaleString()} credits burned in the last 24h`, body: "Track engine spend — if this rises sharply, free-tier renders should throttle.", ctaLabel: "Open ledger", ctaTo: "/admin/credits" }); }
    if (items.length === 0) items.push({ priority: "low", icon: Sparkles, title: "All clear.", body: "No open tickets, no failed renders, no urgent action required. Take a breath.", ctaLabel: "Open analytics", ctaTo: "/admin/analytics" });
    items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    return items;
  }, [pulse, health]);

  const statusData = useMemo(() => ([
    { key: "completed", name: "Completed", value: pulse.projects.completed, from: ACCENT_HSL, to: CYAN },
    { key: "inflight", name: "In flight", value: pulse.projects.in_flight, from: VIOLET, to: ACCENT_HSL },
    { key: "failed", name: "Failed", value: pulse.projects.failed, from: ROSE, to: AMBER },
  ].filter((d) => d.value > 0)), [pulse]);

  const spark = useMemo(() => series.map((s) => s.signups), [series]);

  // 14-day projects-created trend.
  const projectsSeries = useMemo(
    () => bucketByDay(projects, (r) => r.created_at, { days: 14 }),
    [projects],
  );
  // 14-day credit flow — inflow (grants/purchases) vs consumption magnitude.
  const creditFlow = useMemo(() => {
    const inS = bucketByDay(credits.filter((t) => t.amount > 0), (t) => t.created_at, { days: 14, value: (t) => t.amount });
    const outS = bucketByDay(credits.filter((t) => t.amount < 0), (t) => t.created_at, { days: 14, value: (t) => Math.abs(t.amount) });
    return inS.map((p, i) => ({ label: p.label, inflow: p.value, spend: outS[i]?.value ?? 0 }));
  }, [credits]);
  // API spend by provider/service, last 24h (proportional from sampled logs).
  const costByService = useMemo(
    () => topN(sumBy(apiLogs, (r) => r.service, (r) => (r.real_cost_cents || 0) / 100), 7),
    [apiLogs],
  );
  // Provider call outcomes, last 24h.
  const apiOutcomes = useMemo(() => {
    let ok = 0, fail = 0, other = 0;
    for (const r of apiLogs) {
      if (r.status === "completed" || r.status === "success") ok++;
      else if (r.status === "failed") fail++;
      else other++;
    }
    return [
      { key: "Completed", value: ok, color: CYAN },
      { key: "Failed", value: fail, color: ROSE },
      { key: "Pending / other", value: other, color: "rgba(255,255,255,0.28)" },
    ].filter((d) => d.value > 0);
  }, [apiLogs]);
  // Hourly API invocation cadence over the last 24h.
  const apiHourly = useMemo(() => {
    const now = Date.now(), start = now - 24 * 3600_000;
    const arr = new Array(24).fill(0);
    for (const r of apiLogs) {
      const t = new Date(r.created_at).getTime();
      if (isNaN(t) || t < start) continue;
      const idx = Math.min(23, Math.floor((t - start) / 3600_000));
      arr[idx]++;
    }
    return arr.map((value, i) => ({ label: `${String(new Date(start + i * 3600_000).getHours()).padStart(2, "0")}h`, value }));
  }, [apiLogs]);

  // Overall operational status rolled up from the health signals.
  const overall = useMemo(() => {
    const bad = health.queueStuck > 0 || rateTone(health.renderSuccess) === "rose" || rateTone(health.apiSuccess) === "rose";
    const watch = rateTone(health.renderSuccess) === "amber" || rateTone(health.apiSuccess) === "amber" || pulse.projects.failed > 5;
    if (bad) return { label: "Degraded", tone: "rose" as const };
    if (watch) return { label: "Watch", tone: "amber" as const };
    return { label: "Operational", tone: "emerald" as const };
  }, [health, pulse.projects.failed]);

  return (
    <AdminPageShell
      eyebrow="01 // PULSE"
      code="HQ"
      title="Mission"
      italic="control."
      description="What needs you right now — and the signals behind it. Drill into any card to act."
      actions={
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em]"
            style={{ color: toneColor[overall.tone], background: `${toneColor[overall.tone]}1f` }}
            title="Overall operational status, rolled up from render, provider and queue health"
          >
            <CircleDot className="h-3 w-3" style={{ filter: `drop-shadow(0 0 5px ${toneColor[overall.tone]})` }} />
            {overall.label}
          </span>
          <DeckButton onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}
          </DeckButton>
        </div>
      }
    >
      <div className="space-y-14">
        {/* KPI rail — floating figures */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
          <StatOrb index={0} aura={ORB_AURAS[0]} label="Total users" value={pulse.users.total_users} icon={Users} delta={pulse.users.signups_24h} deltaLabel="today" sparkData={spark} />
          <StatOrb index={1} aura={ORB_AURAS[1]} label="New · 7d" value={pulse.users.signups_7d} icon={TrendingUp} accentNumber sparkData={spark} />
          <StatOrb index={2} aura={ORB_AURAS[2]} label="Projects" value={pulse.projects.total} icon={FolderKanban} delta={pulse.projects.created_24h} deltaLabel="new" />
          <StatOrb index={3} aura={ORB_AURAS[3]} label="In flight" value={pulse.projects.in_flight} icon={Activity} sub="rendering now" />
          <StatOrb index={4} aura={ORB_AURAS[4]} label="Failed" value={pulse.projects.failed} icon={AlertTriangle} sub={pulse.projects.failed > 0 ? "need attention" : "all clear"} />
          <StatOrb index={5} aura={ORB_AURAS[5]} label="Open tickets" value={pulse.support.open_tickets} icon={MessageSquare} sub="support" />
        </div>

        {/* App health — live operational signals across render, providers and the
            queue. Render success is authoritative (render_success_snapshot RPC);
            provider success + call volume are exact 24h head-counts; spend is the
            sum of the sampled 24h api_cost_logs. */}
        <FloatSection title="App health" meta="last 24 hours" actions={
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: toneColor[overall.tone] }}>
            <CircleDot className="h-3 w-3" /> {overall.label}
          </span>
        }>
          <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
            <StatOrb index={0} aura={toneColor[rateTone(health.renderSuccess)]} icon={HeartPulse} label="Render success"
              value={health.renderSuccess == null ? "—" : `${health.renderSuccess}%`} sub={`${health.renderFailures.toLocaleString()} failed`} />
            <StatOrb index={1} aura={toneColor[rateTone(health.apiSuccess)]} icon={Server} label="Provider success"
              value={health.apiSuccess == null ? "—" : `${health.apiSuccess}%`} sub={`${health.apiCalls24h.toLocaleString()} calls`} />
            <StatOrb index={2} aura={ACCENT_HSL} icon={Activity} label="Queue active" value={health.queueActive} sub="rendering / queued" />
            <StatOrb index={3} aura={health.queueStuck > 0 ? ROSE : CYAN} icon={Timer} label="Stuck >10m" value={health.queueStuck}
              sub={health.queueStuck > 0 ? "needs attention" : "healthy"} />
            <StatOrb index={4} aura={AMBER} icon={DollarSign} label="API spend" value={`$${health.apiSpend24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} sub="sampled 24h" />
            <StatOrb index={5} aura={VIOLET} icon={Gauge} label="API calls" value={health.apiCalls24h} sub="last 24h" />
          </div>
        </FloatSection>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.6fr_1fr]">
          <FloatSection title="Sign-ups" meta="last 14 days">
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
          </FloatSection>

          <FloatSection title="Projects by status" meta={`${pulse.projects.total.toLocaleString()} total`}>
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
          </FloatSection>
        </div>

        {/* Growth & revenue trends — projects created and credit flow over 14d. */}
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
          <FloatSection title="Projects created" meta="last 14 days" actions={<DeckButton accent><Link to="/admin/projects">Open projects →</Link></DeckButton>}>
            <TrendArea data={projectsSeries} valueLabel="projects" height={220} color={VIOLET} color2={ACCENT_HSL} interval={1} />
          </FloatSection>
          <FloatSection title="Credit flow" meta="grants vs consumption · 14d" actions={<DeckButton accent><Link to="/admin/credits">Open ledger →</Link></DeckButton>}>
            <MultiTrend
              data={creditFlow}
              series={[{ key: "inflow", label: "Granted / purchased", color: CYAN }, { key: "spend", label: "Consumed", color: ROSE }]}
              height={220}
              interval={1}
              emptyLabel="No credit movement in this window."
            />
          </FloatSection>
        </div>

        {/* Cost & provider health — where the money and the calls go (24h). */}
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1fr_1fr_1.2fr]">
          <FloatSection title="Spend by provider" meta="last 24h · USD" actions={<DeckButton accent><Link to="/admin/providers">Providers →</Link></DeckButton>}>
            <CategoryBars data={costByService} formatValue={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} emptyLabel="No provider spend in this window." />
          </FloatSection>
          <FloatSection title="Call outcomes" meta="last 24h">
            <Donut data={apiOutcomes} height={200} centerLabel="calls" emptyLabel="No provider calls in this window." />
          </FloatSection>
          <FloatSection title="Call cadence" meta="invocations / hour · 24h" actions={<DeckButton accent><Link to="/admin/edge-logs">Edge logs →</Link></DeckButton>}>
            <TrendArea data={apiHourly} valueLabel="calls" height={200} color={AMBER} color2={ROSE} interval={3} emptyLabel="No provider calls in this window." />
          </FloatSection>
        </div>

        {/* Attention queue + hubs */}
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.5fr_1fr]">
          <FloatSection title="Action queue">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-20 text-white/50">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Reading pulse…</span>
              </div>
            ) : (
              <div className="space-y-4">
                {cards.map((c, i) => <AttentionCard key={i} index={i} {...c} />)}
              </div>
            )}
          </FloatSection>

          <FloatSection title="Hubs">
            <div>
              {HUBS.map((h, i) => (
                <Link key={h.to} to={h.to} className="group block">
                  <FloatRow
                    last={i === HUBS.length - 1}
                    left={
                      <span className="flex items-center gap-3.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: accent(0.12), color: ACCENT_HSL }}>
                          <h.icon className="h-4 w-4" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-[15px] font-semibold text-white">{h.title}</span>
                          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{h.sub}</span>
                        </span>
                      </span>
                    }
                    right={<ChevronRight className="h-4 w-4 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />}
                  />
                </Link>
              ))}
            </div>
          </FloatSection>
        </div>
      </div>
    </AdminPageShell>
  );
}
