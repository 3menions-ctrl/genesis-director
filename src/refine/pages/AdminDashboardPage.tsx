/**
 * AdminDashboardPage — Mission Control (Horizon kit).
 *
 * Borderless floating figures over the shared aurora: a real-time live-ops strip,
 * a StatOrb KPI rail, SLA/health chips, trend visualizations, a live activity
 * feed, trending content, an attention queue and hub nav. Built on the canonical
 * admin primitives (src/admin/ui) + AdminPageShell hero.
 *
 * Data: admin_dashboard_pulse (+ parallel-count fallback) and a 14-day signups
 * series, plus Phase-1 command-center RPCs — admin_live_ops, admin_sla,
 * admin_activity_feed, admin_trending. The live strip + feed auto-refresh.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Coins, FolderKanban, MessageSquare, RefreshCw,
  Sparkles, TrendingUp, Users, Wallet, Zap, ChevronRight, Eye, Radio,
  Clapperboard, UserPlus, Film, Flame, Clock, Play, type LucideIcon,
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

interface LiveOps { active_visitors_5m: number; live_rooms: number; renders_in_flight: number; signups_1h: number; published_1h: number }
interface Sla { oldest_ticket_min: number | null; oldest_render_min: number | null; failed_rate_24h: number | null; stuck_renders: number }
interface Activity_ { kind: string; label: string; ref_id: string; occurred_at: string }
interface Trend { reel_id: string; title: string; creator: string; plays: number; likes: number; tips: number }
interface Economy { issued: number; purchased: number; spent: number; welcome: number; txns: number }

type ActionCard = { priority: "high" | "medium" | "low"; icon: LucideIcon; title: string; body: string; ctaLabel: string; ctaTo: string };
const priorityRank = (p: ActionCard["priority"]) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

const HUBS = [
  { icon: Users, title: "People", sub: "Users · sessions · roles · GDPR · abuse", to: "/admin/people" },
  { icon: FolderKanban, title: "Production", sub: "Projects · queue · providers · edge logs", to: "/admin/production-hub" },
  { icon: Wallet, title: "Money", sub: "Subscriptions · refunds · coupons · ledger", to: "/admin/money" },
  { icon: TrendingUp, title: "Growth", sub: "Analytics · experiments · flags · cohorts", to: "/admin/growth" },
  { icon: Zap, title: "System", sub: "API keys · webhooks · secrets · DB health", to: "/admin/system" },
];

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const ago = (iso: string) => { const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
const mins = (m: number | null) => { if (m == null) return "—"; if (m < 60) return `${Math.round(m)}m`; const h = Math.floor(m / 60); return `${h}h ${Math.round(m % 60)}m`; };

const ACT: Record<string, { icon: LucideIcon; color: string }> = {
  signup: { icon: UserPlus, color: "hsl(150 70% 60%)" },
  publish: { icon: Film, color: ACCENT_HSL },
  render_failed: { icon: AlertTriangle, color: "hsl(350 90% 70%)" },
  live: { icon: Radio, color: "hsl(330 90% 68%)" },
};

function LiveStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-white/45" strokeWidth={1.8} />
      <span className="font-display text-[20px] font-semibold tabular-nums text-white" style={{ textShadow: `0 0 18px ${accent(0.4)}` }}>{compact(value)}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">{label}</span>
    </span>
  );
}

function SlaChip({ label, value, bad }: { label: string; value: string | number; bad: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: bad ? "hsl(350 90% 60% / 0.14)" : "rgba(255,255,255,0.05)" }}>
      <Clock className="h-3 w-3" style={{ color: bad ? "hsl(350 90% 72%)" : "rgba(255,255,255,0.35)" }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</span>
      <span className={cn("font-display text-[13px] font-semibold tabular-nums", bad ? "text-rose-300" : "text-white/80")}>{value}</span>
    </span>
  );
}

export default function AdminDashboardPage() {
  const [pulse, setPulse] = useState<Pulse>(empty);
  const [series, setSeries] = useState<{ day: string; signups: number }[]>([]);
  const [liveOps, setLiveOps] = useState<LiveOps | null>(null);
  const [sla, setSla] = useState<Sla | null>(null);
  const [activity, setActivity] = useState<Activity_[]>([]);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Lightweight live refresh — the "right now" strip, SLA, and feed.
  const pollLive = useCallback(async () => {
    const [lo, sl, af] = await Promise.all([
      supabase.rpc("admin_live_ops" as never),
      supabase.rpc("admin_sla" as never),
      supabase.rpc("admin_activity_feed" as never, { _limit: 18 } as never),
    ]) as Array<{ data: unknown; error: unknown }>;
    if (!lo.error && lo.data) setLiveOps(((lo.data as LiveOps[]) ?? [])[0] ?? null);
    if (!sl.error && sl.data) setSla(((sl.data as Sla[]) ?? [])[0] ?? null);
    if (!af.error && af.data) setActivity((af.data as Activity_[]) ?? []);
  }, []);

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

      // Phase-1 command-center widgets.
      const tr = await supabase.rpc("admin_trending" as never, { _limit: 6 } as never) as { data: unknown; error: unknown };
      if (!tr.error && tr.data) setTrending((tr.data as Trend[]) ?? []);
      const ec = await supabase.rpc("admin_credit_economy" as never) as { data: unknown; error: unknown };
      if (!ec.error && ec.data) setEconomy(((ec.data as Economy[]) ?? [])[0] ?? null);
      await pollLive();

      setLastUpdated(new Date());
    } catch (e) {
      console.error("[AdminDashboard] load error", e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [pollLive]);

  useEffect(() => { void load(); }, [load]);
  // Auto-refresh the live strip + feed every 20s.
  useEffect(() => { const id = window.setInterval(() => { void pollLive(); }, 20000); return () => window.clearInterval(id); }, [pollLive]);

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

  // Smart daily briefing — synthesizes the whole pulse into an exec summary.
  const briefing = useMemo(() => {
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const s: string[] = [];
    s.push(`${pulse.users.total_users.toLocaleString()} members on the platform${pulse.users.signups_7d > 0 ? `, ${pulse.users.signups_7d} new this week` : pulse.users.signups_24h > 0 ? `, ${pulse.users.signups_24h} new today` : ""}.`);
    const inflight = pulse.projects.in_flight, failed = pulse.projects.failed;
    s.push(`${inflight} render${inflight === 1 ? "" : "s"} in flight and ${failed} failed — ${failed === 0 ? "the pipeline is healthy" : (sla?.stuck_renders ?? 0) > 0 ? `${sla?.stuck_renders} stuck past ETA, worth a look` : "nothing stuck"}.`);
    s.push(pulse.support.open_tickets > 0 ? `${pulse.support.open_tickets} support ticket${pulse.support.open_tickets === 1 ? "" : "s"} waiting on a reply.` : "Support inbox is clear.");
    if ((liveOps?.active_visitors_5m ?? 0) > 0) s.push(`${liveOps?.active_visitors_5m} visitor${liveOps?.active_visitors_5m === 1 ? "" : "s"} on the site right now.`);
    if (trending[0]) s.push(`Top reel is “${trending[0].title}” at ${compact(trending[0].plays)} plays.`);
    if (economy && economy.purchased > 0) s.push(`${economy.purchased.toLocaleString()} credits purchased to date.`);
    return { greet, text: s.join(" ") };
  }, [pulse, sla, liveOps, trending, economy]);

  return (
    <AdminPageShell
      eyebrow="01 // PULSE"
      code="HQ"
      title="Mission"
      italic="control."
      description="What needs you right now — and the signals behind it. Drill into any card to act."
      actions={
        <DeckButton onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}
        </DeckButton>
      }
    >
      <div className="space-y-14">
        {/* Smart daily briefing — synthesized exec summary */}
        <div className="relative overflow-hidden rounded-[20px] px-6 py-5" style={{ background: `linear-gradient(120deg, ${accent(0.14)}, rgba(255,255,255,0.02) 60%)` }}>
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: accent(0.18) }} />
          <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#9ab4ff]">
            <Sparkles className="h-3.5 w-3.5" /> Daily briefing · {new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <p className="relative mt-2.5 max-w-3xl text-[15.5px] font-light leading-relaxed text-white/85">
            <span className="font-display font-semibold text-white">{briefing.greet}.</span> {briefing.text}
          </p>
        </div>

        {/* Live-ops strip — the "right now", auto-refreshing every 20s */}
        <div className="flex flex-wrap items-center gap-x-9 gap-y-4">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300/80">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            Live now
          </span>
          <LiveStat icon={Eye} label="visitors · 5m" value={liveOps?.active_visitors_5m ?? 0} />
          <LiveStat icon={Radio} label="live rooms" value={liveOps?.live_rooms ?? 0} />
          <LiveStat icon={Clapperboard} label="rendering" value={liveOps?.renders_in_flight ?? 0} />
          <LiveStat icon={UserPlus} label="sign-ups · 1h" value={liveOps?.signups_1h ?? 0} />
          <LiveStat icon={Film} label="published · 1h" value={liveOps?.published_1h ?? 0} />
        </div>

        {/* SLA / health chips */}
        {sla && (
          <div className="flex flex-wrap gap-3">
            <SlaChip label="Failed · 24h" value={`${sla.failed_rate_24h ?? 0}%`} bad={(sla.failed_rate_24h ?? 0) > 10} />
            <SlaChip label="Stuck renders" value={sla.stuck_renders} bad={sla.stuck_renders > 0} />
            <SlaChip label="Oldest ticket" value={mins(sla.oldest_ticket_min)} bad={(sla.oldest_ticket_min ?? 0) > 1440} />
            <SlaChip label="Oldest render" value={mins(sla.oldest_render_min)} bad={(sla.oldest_render_min ?? 0) > 60} />
          </div>
        )}

        {/* Credit economy strip */}
        {economy && (
          <div className="flex flex-wrap items-center gap-x-9 gap-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-300/70">Economy</span>
            <LiveStat icon={Coins} label="credits issued" value={economy.issued} />
            <LiveStat icon={Wallet} label="purchased" value={economy.purchased} />
            <LiveStat icon={Flame} label="spent" value={economy.spent} />
            <LiveStat icon={Activity} label="ledger txns" value={economy.txns} />
          </div>
        )}

        {/* KPI rail — floating figures */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-3 xl:grid-cols-6">
          <StatOrb index={0} aura={ORB_AURAS[0]} label="Total users" value={pulse.users.total_users} icon={Users} delta={pulse.users.signups_24h} deltaLabel="today" sparkData={spark} />
          <StatOrb index={1} aura={ORB_AURAS[1]} label="New · 7d" value={pulse.users.signups_7d} icon={TrendingUp} accentNumber sparkData={spark} />
          <StatOrb index={2} aura={ORB_AURAS[2]} label="Projects" value={pulse.projects.total} icon={FolderKanban} delta={pulse.projects.created_24h} deltaLabel="new" />
          <StatOrb index={3} aura={ORB_AURAS[3]} label="In flight" value={pulse.projects.in_flight} icon={Activity} sub="rendering now" />
          <StatOrb index={4} aura={ORB_AURAS[4]} label="Failed" value={pulse.projects.failed} icon={AlertTriangle} sub={pulse.projects.failed > 0 ? "need attention" : "all clear"} />
          <StatOrb index={5} aura={ORB_AURAS[5]} label="Open tickets" value={pulse.support.open_tickets} icon={MessageSquare} sub="support" />
        </div>

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

        {/* Live activity feed + Trending content */}
        <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1fr_1fr]">
          <FloatSection title="Live activity" meta="latest events">
            {activity.length === 0 ? (
              <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No activity yet.</div>
            ) : (
              <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
                {activity.map((a, i) => {
                  const cfg = ACT[a.kind] ?? { icon: Activity, color: "rgba(255,255,255,0.5)" };
                  const Icon = cfg.icon;
                  return (
                    <div key={a.kind + a.ref_id + i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${cfg.color}1f`, color: cfg.color }}><Icon className="h-4 w-4" strokeWidth={1.9} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-white/85">{a.label}</span>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">{a.kind.replace("_", " ")}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">{ago(a.occurred_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </FloatSection>

          <FloatSection title={<span className="inline-flex items-center gap-2"><Flame className="h-3.5 w-3.5 text-amber-300" /> Trending</span>} meta="top reels by plays">
            {trending.length === 0 ? (
              <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No reels yet.</div>
            ) : (
              <div>
                {trending.map((r, i) => (
                  <FloatRow
                    key={r.reel_id}
                    last={i === trending.length - 1}
                    left={
                      <span className="flex items-center gap-3.5">
                        <span className="w-5 text-center font-display text-[15px] font-semibold" style={{ color: i === 0 ? "hsl(45 100% 65%)" : "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-[14px] font-semibold text-white">{r.title}</span>
                          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">{r.creator}</span>
                        </span>
                      </span>
                    }
                    right={
                      <span className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-white/55">
                        <span className="inline-flex items-center gap-1"><Play className="h-3 w-3" />{compact(r.plays)}</span>
                        {r.tips > 0 && <span className="inline-flex items-center gap-1 text-amber-300/80"><Coins className="h-3 w-3" />{compact(r.tips)}</span>}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
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
