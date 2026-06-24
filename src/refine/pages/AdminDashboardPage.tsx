/**
 * AdminDashboardPage — Overview, "Floating Analysis" LIGHT.
 *
 * The bar-setter for the admin rebuild: borderless data that floats directly on
 * the aurora — no card frames, just generous whitespace, hairline rules, soft
 * depth shadows, and color-coded numerals. Gradient hero figure, tier bars,
 * real recharts growth curve, a live action queue, and hub nav.
 *
 * Data path is preserved: one `admin_dashboard_pulse` RPC with a parallel-count
 * fallback, plus a real 14-day signups series for the trend chart.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Coins, FolderKanban, MessageSquare, RefreshCw,
  Sparkles, TrendingUp, Users, Wallet, Cpu, ChevronRight, ArrowUpRight, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  CountUp, Sparkline, AttentionCard,
  ACCENT_HSL, CYAN, VIOLET, ROSE, AMBER, EMERALD, MAGENTA, INK, MUT, MUT2,
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

type ActionCard = { priority: "high" | "medium" | "low"; icon: LucideIcon; title: string; body: string; ctaLabel: string; ctaTo: string };
const priorityRank = (p: ActionCard["priority"]) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

const HUBS = [
  { icon: Users, title: "People", sub: "Users · sessions · roles · GDPR", to: "/admin/people", tint: ACCENT_HSL },
  { icon: FolderKanban, title: "Studio", sub: "Projects · queue · providers · logs", to: "/admin/production-hub", tint: CYAN },
  { icon: Wallet, title: "Money", sub: "Subscriptions · refunds · ledger", to: "/admin/money", tint: VIOLET },
  { icon: TrendingUp, title: "Growth", sub: "Analytics · experiments · flags", to: "/admin/growth", tint: EMERALD },
  { icon: Cpu, title: "System", sub: "Keys · webhooks · secrets · health", to: "/admin/system", tint: AMBER },
];

/** Numeral that floats on the aura with a soft depth shadow (no card). */
function Floor({ children, className, big, style }: { children: React.ReactNode; className?: string; big?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={cn("block font-display font-semibold tabular-nums leading-none tracking-[-0.03em]", className)}
      style={{ filter: big ? "drop-shadow(0 14px 24px rgba(47,107,255,.16))" : "drop-shadow(0 10px 18px rgba(16,24,40,.1))", ...style }}
    >
      {children}
    </span>
  );
}

const GL = "font-mono text-[9.5px] font-semibold uppercase tracking-[0.22em]";
const Sep = () => <div className="my-7 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(16,24,40,.1),transparent)" }} />;

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

  const spark = useMemo(() => series.map((s) => s.signups), [series]);
  const completionPct = pulse.projects.total > 0 ? Math.round((pulse.projects.completed / pulse.projects.total) * 100) : 0;

  // Project status tier bars (proportions of total).
  const tiers = useMemo(() => {
    const t = Math.max(pulse.projects.total, 1);
    return [
      { label: "Completed", value: pulse.projects.completed, pct: (pulse.projects.completed / t) * 100, grad: "linear-gradient(90deg,#0fa968,#34d399)" },
      { label: "In flight", value: pulse.projects.in_flight, pct: (pulse.projects.in_flight / t) * 100, grad: "linear-gradient(90deg,#2f6bff,#60a5fa)" },
      { label: "Failed", value: pulse.projects.failed, pct: (pulse.projects.failed / t) * 100, grad: "linear-gradient(90deg,#f43f5e,#fb7185)" },
    ];
  }, [pulse]);

  return (
    <div className="relative mx-auto w-full max-w-[1340px] px-8 py-7">
      {/* ── Top bar ── */}
      <div className="mb-7 flex items-center gap-4">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>Overview</h1>
        <div className="ml-auto flex items-center gap-5">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold" style={{ color: MUT }}>
            <span className="h-2 w-2 rounded-full" style={{ background: EMERALD, boxShadow: `0 0 8px ${EMERALD}` }} /> Nominal
          </span>
          <span className={GL} style={{ color: MUT2 }}>Render queue · {pulse.projects.in_flight}</span>
          <button onClick={() => void load(true)} disabled={refreshing}
            className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5", GL)}
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)", color: MUT, boxShadow: "0 6px 18px -10px rgba(16,24,40,0.2)" }}>
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Sync" : lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Hero deck ── */}
      <div className="grid items-start gap-11 lg:grid-cols-[1.5fr_1fr_1fr]">
        {/* Hero — total users */}
        <div>
          <div className="flex items-center justify-between">
            <span className={GL} style={{ color: ACCENT_HSL }}>◆ Total operators</span>
            {pulse.users.signups_24h > 0 && <span className="text-[12px] font-bold" style={{ color: EMERALD }}>▲ {pulse.users.signups_24h} today</span>}
          </div>
          <Floor big className="mt-3.5 text-[80px]" style={undefined}>
            <CountUp value={pulse.users.total_users} className="bg-gradient-to-br from-[#2f6bff] to-[#7c3aed] bg-clip-text text-transparent" />
          </Floor>
          <div className="mt-2.5 text-[13px]" style={{ color: MUT }}>
            {pulse.users.signups_7d > 0 ? `${pulse.users.signups_7d.toLocaleString()} new this week · ` : ""}{pulse.users.signups_24h.toLocaleString()} today
          </div>
          <div className="mt-4 w-full">
            <Sparkline data={spark.length > 1 ? spark : [0, 0]} id="hero" w={520} h={84} />
          </div>
        </div>

        {/* Projects + tier bars */}
        <div>
          <span className={GL} style={{ color: VIOLET }}>Projects total</span>
          <Floor className="mt-3 text-[50px]" style={{ color: VIOLET }}><CountUp value={pulse.projects.total} /></Floor>
          <div className="mt-2.5 text-[13px]" style={{ color: MUT }}>+{pulse.projects.created_24h.toLocaleString()} in 24h</div>
          <div className="mt-5 space-y-1">
            {tiers.map((t) => (
              <div key={t.label} className="flex items-center gap-3.5 py-1 text-[13.5px] font-semibold" style={{ color: INK }}>
                <span className="w-[68px] shrink-0">{t.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(16,24,40,.06)" }}>
                  <i className="block h-full rounded-full" style={{ width: `${Math.max(t.pct, t.value > 0 ? 4 : 0)}%`, background: t.grad }} />
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums" style={{ color: MUT }}>{t.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rendered today */}
        <div>
          <span className={GL} style={{ color: CYAN }}>Created · today</span>
          <Floor className="mt-3 text-[50px]" style={{ color: CYAN }}><CountUp value={pulse.projects.created_24h} /></Floor>
          <div className="mt-2.5 text-[13px]" style={{ color: MUT }}>
            {completionPct}% completion · {pulse.projects.failed > 0 ? <span style={{ color: ROSE }}>{pulse.projects.failed} failed</span> : "0 failed"} · {pulse.projects.in_flight} in flight
          </div>
          <div className="mt-4">
            <Sparkline data={spark.length > 1 ? spark : [0, 0]} id="today" w={240} h={74} />
          </div>
        </div>
      </div>

      <Sep />

      {/* ── Mini metric row ── */}
      <div className="grid grid-cols-2 gap-11 md:grid-cols-4">
        {[
          { gl: "New · 24h", color: EMERALD, value: pulse.users.signups_24h, foot: "sign-ups" },
          { gl: "New · 7d", color: ACCENT_HSL, value: pulse.users.signups_7d, foot: "this week" },
          { gl: "In flight", color: MAGENTA, value: pulse.projects.in_flight, foot: "rendering now" },
          { gl: "Open tickets", color: AMBER, value: pulse.support.open_tickets, foot: pulse.support.open_tickets > 0 ? "needs response" : "all clear" },
        ].map((m) => (
          <div key={m.gl}>
            <span className={GL} style={{ color: m.color }}>{m.gl}</span>
            <Floor className="mt-2.5 text-[42px]" style={{ color: m.color }}><CountUp value={m.value} /></Floor>
            <div className="mt-1.5 text-[12px]" style={{ color: MUT2 }}>{m.foot}</div>
          </div>
        ))}
      </div>

      <Sep />

      {/* ── Growth curve + action queue ── */}
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <span className={GL} style={{ color: MUT }}>Growth · sign-ups, last 14 days</span>
          <div className="mt-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT_HSL} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="areaStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={EMERALD} /><stop offset="50%" stopColor={CYAN} /><stop offset="100%" stopColor={ACCENT_HSL} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,24,40,0.06)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: MUT2, fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fill: MUT2, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={{ background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 20px 50px -20px rgba(16,24,40,0.3)", fontSize: 12 }} labelStyle={{ color: MUT }} itemStyle={{ color: INK }} cursor={{ stroke: "rgba(47,107,255,0.3)" }} />
                <Area type="monotone" dataKey="signups" stroke="url(#areaStroke)" strokeWidth={3} fill="url(#areaFill)" dot={false} activeDot={{ r: 5, fill: "#fff", stroke: ACCENT_HSL, strokeWidth: 2.5 }} isAnimationActive animationDuration={1200} style={{ filter: "drop-shadow(0 12px 20px rgba(16,24,40,.12))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <span className={GL} style={{ color: MUT }}>◆ Action queue</span>
          {loading ? (
            <div className="mt-3 flex items-center justify-center gap-3 py-16" style={{ color: MUT }}>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Reading pulse…</span>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {cards.slice(0, 4).map((c, i) => <AttentionCard key={i} index={i} {...c} />)}
            </div>
          )}
        </div>
      </div>

      <Sep />

      {/* ── Hub nav ── */}
      <div>
        <span className={GL} style={{ color: MUT }}>Hubs</span>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HUBS.map((h) => (
            <Link key={h.to} to={h.to} className="group block">
              <div className="rounded-2xl border border-[#e7ebf3] bg-white p-4 shadow-[0_2px_4px_rgba(16,24,40,.04),0_12px_28px_-14px_rgba(16,24,40,.14)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(16,24,40,.06),0_24px_48px_-16px_rgba(16,24,40,.22)]">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${h.tint}1a`, color: h.tint }}>
                    <h.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <ArrowUpRight className="h-4 w-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: MUT2 }} />
                </div>
                <div className="mt-3 font-display text-[16px] font-semibold" style={{ color: INK }}>{h.title}</div>
                <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em]" style={{ color: MUT2 }}>{h.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
