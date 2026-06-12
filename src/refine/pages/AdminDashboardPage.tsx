/**
 * AdminDashboardPage — Command Bridge (action-card edition).
 *
 * The dashboard isn't a stats wall anymore. It's a decision surface — a
 * vertical of "what needs your attention right now" cards, each linking
 * deep into the relevant hub view with filters pre-applied. The supporting
 * KPI rail still lives at the top for at-a-glance health.
 *
 * Data path: a single `admin_dashboard_pulse` RPC roundtrip; falls back to
 * direct counts so the page is robust if the new migration isn't pushed.
 *
 * Visual: Editorial Noir surfaces (glass + brand rail), tactical mono
 * eyebrows, no animation noise. Every card has a clear primary CTA.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight, Coins, FolderKanban, MessageSquare,
  RefreshCw, Sparkles, TrendingUp, Users, Wallet, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../components/AdminPageShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

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

export default function AdminDashboardPage() {
  const [pulse, setPulse] = useState<Pulse>(empty);
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
        // Fallback: parallel counts so dashboard still renders.
        const [u, p24, projTotal, projFailed, projDone, projFlight, p24Proj, sup] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true })
            .gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("status", "failed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("status", "completed"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true }).not("status", "in", "(failed,completed,draft)"),
          supabase.from("movie_projects").select("id", { count: "exact", head: true })
            .gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
          supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        ]);
        setPulse({
          users:    { total_users: u.count ?? 0, signups_24h: p24.count ?? 0, signups_7d: 0 },
          projects: {
            total: projTotal.count ?? 0,
            completed: projDone.count ?? 0,
            failed: projFailed.count ?? 0,
            in_flight: projFlight.count ?? 0,
            created_24h: p24Proj.count ?? 0,
          },
          credits:  { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: 0 },
          support:  { open_tickets: sup.count ?? 0 },
        });
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error("[AdminDashboard] load error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Compose the action cards from the pulse.
  const cards = useMemo<ActionCard[]>(() => {
    const items: ActionCard[] = [];

    if (pulse.support.open_tickets > 0) {
      items.push({
        priority: "high",
        icon: MessageSquare,
        title: `${pulse.support.open_tickets} open support ticket${pulse.support.open_tickets === 1 ? "" : "s"}`,
        body: "Waiting on first response or follow-up from a teammate.",
        ctaLabel: "Open Inbox",
        ctaTo: "/admin/messages",
      });
    }

    if (pulse.projects.failed > 0) {
      items.push({
        priority: pulse.projects.failed > 5 ? "high" : "medium",
        icon: AlertTriangle,
        title: `${pulse.projects.failed} project${pulse.projects.failed === 1 ? "" : "s"} in failed state`,
        body: "These never reached completion and likely need a retry or refund.",
        ctaLabel: "Review failures",
        ctaTo: "/admin/projects?status=failed",
      });
    }

    if (pulse.projects.in_flight > 0) {
      items.push({
        priority: "low",
        icon: Activity,
        title: `${pulse.projects.in_flight} render${pulse.projects.in_flight === 1 ? "" : "s"} in flight`,
        body: "Live jobs across the membrane — watch the queue if any stall past ETA.",
        ctaLabel: "Open queue",
        ctaTo: "/admin/queue",
      });
    }

    if (pulse.users.signups_24h > 0) {
      items.push({
        priority: "low",
        icon: Users,
        title: `${pulse.users.signups_24h} new sign-up${pulse.users.signups_24h === 1 ? "" : "s"} in the last 24h`,
        body: pulse.users.signups_7d > 0
          ? `${pulse.users.signups_7d} this week. Growth is live.`
          : "Welcome traffic from your latest channels.",
        ctaLabel: "View people",
        ctaTo: "/admin/users",
      });
    }

    if (Math.abs(pulse.credits.spend_24h_signed) > 0) {
      const spend = Math.abs(pulse.credits.spend_24h_signed);
      items.push({
        priority: "low",
        icon: Coins,
        title: `${spend.toLocaleString()} credits burned in the last 24h`,
        body: "Watch the LTX-Video cap — if this rises, free-tier renders should throttle.",
        ctaLabel: "Open ledger",
        ctaTo: "/admin/credits",
      });
    }

    if (items.length === 0) {
      items.push({
        priority: "low",
        icon: Sparkles,
        title: "All clear.",
        body: "No open tickets, no failed renders, no urgent action required. Take a breath.",
        ctaLabel: "Open analytics",
        ctaTo: "/admin/analytics",
      });
    }

    items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    return items;
  }, [pulse]);

  return (
    <AdminPageShell
      eyebrow="01 // PULSE"
      code="HUB"
      title="Command Bridge"
      italic="Today."
      description="What needs you right now — and nothing else. Drill into any card to take action."
      stats={[
        { label: "Users",          value: pulse.users.total_users.toLocaleString(), tone: "blue",
          sub: `${pulse.users.signups_24h} today` },
        { label: "Projects",       value: pulse.projects.total.toLocaleString(), tone: "neutral",
          sub: `${pulse.projects.created_24h} new · ${pulse.projects.in_flight} live` },
        { label: "Failed",         value: pulse.projects.failed.toLocaleString(), tone: pulse.projects.failed > 0 ? "rose" : "neutral",
          sub: "need a retry or refund" },
        { label: "Open tickets",   value: pulse.support.open_tickets.toLocaleString(), tone: pulse.support.open_tickets > 0 ? "amber" : "emerald",
          sub: "support inbox" },
      ]}
      actions={
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/55 hover:text-white px-3.5 py-1.5 rounded-full border border-white/[0.08] hover:border-white/20 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Left — action cards */}
        <div className="space-y-4">
          <AdminSectionLabel
            label="Action queue"
            meta={lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : undefined}
          />
          {loading ? (
            <div className="flex items-center justify-center py-24 gap-3 text-white/55">
              <Spinner size="md" tone="muted" />
              <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Reading pulse…</span>
            </div>
          ) : (
            cards.map((c, i) => <ActionCardRow key={i} card={c} />)
          )}
        </div>

        {/* Right — destinations */}
        <div className="space-y-4">
          <AdminSectionLabel label="Hubs" />
          <HubCard
            icon={Users}
            title="People"
            sub="Users · sessions · roles · GDPR · abuse"
            to="/admin/people"
          />
          <HubCard
            icon={FolderKanban}
            title="Production"
            sub="Projects · queue · providers · edge logs"
            to="/admin/production-hub"
          />
          <HubCard
            icon={Wallet}
            title="Money"
            sub="Subscriptions · refunds · coupons · ledger"
            to="/admin/money"
          />
          <HubCard
            icon={TrendingUp}
            title="Growth"
            sub="Analytics · experiments · flags · cohorts"
            to="/admin/growth"
          />
          <HubCard
            icon={Zap}
            title="System"
            sub="API keys · webhooks · secrets · backups"
            to="/admin/system"
          />

          <AdminSurface className="!p-4 mt-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35 mb-2">
              Shortcut
            </div>
            <div className="text-[12px] text-white/70 leading-relaxed">
              Hit <kbd className="px-1.5 py-0.5 rounded border border-white/[0.08] font-mono text-white">⌘K</kbd> anywhere in admin to search users, projects, or orgs.
            </div>
          </AdminSurface>
        </div>
      </div>
    </AdminPageShell>
  );
}

type Priority = "high" | "medium" | "low";
interface ActionCard {
  priority: Priority;
  icon: React.ElementType;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
}
const priorityRank = (p: Priority) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

function ActionCardRow({ card }: { card: ActionCard }) {
  const toneClass =
    card.priority === "high"   ? "border-rose-400/30 bg-rose-400/[0.04]"
  : card.priority === "medium" ? "border-amber-400/25 bg-amber-400/[0.04]"
  :                              "border-white/[0.06] bg-white/[0.02]";
  const eyebrow =
    card.priority === "high"   ? "text-rose-200"
  : card.priority === "medium" ? "text-amber-200"
  :                              "text-[#6FB6FF]";
  const Icon = card.icon;
  return (
    <div className={cn("relative rounded-2xl border backdrop-blur-md p-5 overflow-hidden", toneClass)}>
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-3 bottom-3 w-px",
          card.priority === "high"   ? "bg-rose-300/60"
        : card.priority === "medium" ? "bg-amber-300/60"
        :                              "bg-[#0A84FF]/40",
        )}
      />
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
          card.priority === "high"   ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
        : card.priority === "medium" ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
        :                              "border-[#0A84FF]/30 bg-[#0A84FF]/10 text-[#6FB6FF]",
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-[9px] font-mono uppercase tracking-[0.32em] mb-1.5", eyebrow)}>
            {card.priority}
          </div>
          <div className="text-[15px] text-white font-light">{card.title}</div>
          <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed">{card.body}</p>
          <Link
            to={card.ctaTo}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-white/75 hover:text-white"
          >
            {card.ctaLabel} <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function HubCard({ icon: Icon, title, sub, to }: { icon: React.ElementType; title: string; sub: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-[#0A84FF]/30 hover:bg-[#0A84FF]/[0.04] px-4 py-3.5 backdrop-blur-md transition-colors"
    >
      <div className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/55 group-hover:text-[#0A84FF] group-hover:border-[#0A84FF]/40 transition-colors shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-white">{title}</div>
        <div className="text-[10px] text-white/40 truncate font-mono uppercase tracking-[0.22em]">{sub}</div>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-white/35 group-hover:text-[#0A84FF]" />
    </Link>
  );
}
