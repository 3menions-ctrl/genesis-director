/**
 * BusinessOverview — /business
 *
 * The operational command center for a business workspace. Real, org-scoped
 * analytics: KPIs with 30-day trend + period delta, production-output and
 * credit-burn time series, project-status breakdown, and a top-members usage
 * table — plus recent productions and quick actions. All data is real
 * (movie_projects, organization_members, credit_transactions); empty states
 * are graceful.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Film, Users, ArrowRight, CreditCard, Palette, BarChart3, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  BusinessPage, SectionHead, SkeletonCards, StaggerList, StaggerItem, Badge, EmptyState,
} from "@/components/business/BusinessPage";
import {
  ChartCard, AreaTrend, DonutChart, ChartLegend, TrendStat, DataTable, bucketByDay, periodDelta,
  CHART_BLUE, CHART_CYAN, CHART_EMERALD, CHART_AMBER, CHART_ROSE, type Column,
} from "@/components/business/BusinessCharts";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

const WINDOW_DAYS = 30;

interface ProjectRow {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  thumbnail_url: string | null;
  genre: string | null;
  quality_tier: string | null;
  user_id: string | null;
}
interface MemberUsage {
  user_id: string;
  name: string;
  avatar_url: string | null;
  credits: number;
  projects: number;
}

const STATUS_COLOR: Record<string, string> = {
  completed: CHART_EMERALD,
  processing: CHART_BLUE,
  rendering: CHART_BLUE,
  generating: CHART_BLUE,
  draft: CHART_AMBER,
  failed: CHART_ROSE,
};
const statusColor = (s: string) => STATUS_COLOR[s.toLowerCase()] ?? CHART_CYAN;

const QUICK_ACTIONS = [
  { to: "/business/create", label: "New production", sub: "Generate", Icon: Sparkles, role: "producer" },
  { to: "/business/projects", label: "Projects", sub: "All work", Icon: Film, role: "viewer" },
  { to: "/business/team", label: "Team", sub: "Roster & access", Icon: Users, role: "viewer" },
  { to: "/business/brand", label: "Brand", sub: "Identity & voice", Icon: Palette, role: "producer" },
  { to: "/business/analytics", label: "Telemetry", sub: "Usage", Icon: BarChart3, role: "admin" },
  { to: "/business/billing", label: "Billing", sub: "Plan & invoices", Icon: CreditCard, role: "admin" },
] as const;

export default function BusinessOverview() {
  const { currentOrg, hasPermission } = useWorkspace();
  usePageMeta({ title: "Overview — Business", description: "Your business workspace at a glance." });

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string; avatar_url: string | null }[]>([]);
  const [spends, setSpends] = useState<{ user_id: string; amount: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = currentOrg?.id ?? null;
  const credits = (currentOrg as { credits_balance?: number } | null)?.credits_balance ?? 0;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
      const [projRes, memberRes] = await Promise.all([
        supabase
          .from("movie_projects")
          .select("id, title, status, created_at, thumbnail_url, genre, quality_tier, user_id")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("organization_members").select("user_id").eq("organization_id", orgId),
      ]);
      const proj = (projRes.data ?? []) as unknown as ProjectRow[];
      setProjects(proj);

      const userIds = (memberRes.data ?? []).map((m) => m.user_id);
      if (userIds.length > 0) {
        const [profRes, txnRes] = await Promise.all([
          // Org-scoped member directory (SECURITY DEFINER) — email is no longer
          // readable from the base profiles table.
          (supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: Array<{ id: string; display_name: string | null; full_name: string | null; avatar_url: string | null; email: string | null }> | null }>
          )("org_member_directory", { p_org_id: orgId }),
          supabase
            .from("credit_transactions")
            .select("user_id, amount, created_at")
            .in("user_id", userIds)
            .lt("amount", 0)
            .gte("created_at", since),
        ]);
        const pmap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
        setMembers(userIds.map((id) => {
          const p = pmap.get(id);
          return { user_id: id, name: p?.display_name || p?.full_name || p?.email || "Member", avatar_url: p?.avatar_url ?? null };
        }));
        setSpends((txnRes.data ?? []) as { user_id: string; amount: number; created_at: string }[]);
      } else {
        setMembers([]);
        setSpends([]);
      }
    } catch (e) {
      console.error("[BusinessOverview] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  const firstName = useMemo(() => (currentOrg?.name ?? "Workspace").split(/\s+/)[0], [currentOrg]);

  // ── Derived analytics ──────────────────────────────────────────────────────
  const a = useMemo(() => {
    const since = Date.now() - WINDOW_DAYS * 86400_000;
    const recent30 = projects.filter((p) => p.created_at && new Date(p.created_at).getTime() >= since);

    const prodSeries = bucketByDay(recent30, (p) => p.created_at, () => 1, WINDOW_DAYS);
    const burnSeries = bucketByDay(spends, (s) => s.created_at, (s) => Math.abs(s.amount), WINDOW_DAYS);

    const burned30 = burnSeries.reduce((t, d) => t + d.value, 0);

    // Status breakdown
    const statusCounts = new Map<string, number>();
    for (const p of projects) {
      const s = (p.status || "draft").toLowerCase();
      statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    }
    const statusData = [...statusCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value, color: statusColor(name) }));

    // Per-member usage
    const creditsByUser = new Map<string, number>();
    for (const s of spends) creditsByUser.set(s.user_id, (creditsByUser.get(s.user_id) ?? 0) + Math.abs(s.amount));
    const projectsByUser = new Map<string, number>();
    for (const p of recent30) if (p.user_id) projectsByUser.set(p.user_id, (projectsByUser.get(p.user_id) ?? 0) + 1);
    const topMembers: MemberUsage[] = members
      .map((m) => ({ ...m, credits: creditsByUser.get(m.user_id) ?? 0, projects: projectsByUser.get(m.user_id) ?? 0 }))
      .sort((x, y) => y.credits - x.credits)
      .slice(0, 6);

    const activeMembers = members.filter(
      (m) => (creditsByUser.get(m.user_id) ?? 0) > 0 || (projectsByUser.get(m.user_id) ?? 0) > 0,
    ).length;

    const completed = statusCounts.get("completed") ?? 0;
    const completionRate = projects.length ? Math.round((completed / projects.length) * 100) : 0;

    return {
      prodSeries, burnSeries, burned30, statusData, topMembers, activeMembers, completionRate,
      prodDelta: periodDelta(prodSeries.map((d) => d.value)),
      burnDelta: periodDelta(burnSeries.map((d) => d.value)),
      prodSpark: prodSeries.map((d) => d.value),
      burnSpark: burnSeries.map((d) => d.value),
      productions30: recent30.length,
    };
  }, [projects, members, spends]);

  const recent = projects.slice(0, 6);
  const memberCols: Column<MemberUsage>[] = [
    {
      key: "name", header: "Member",
      render: (m, i) => (
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-white/30 tabular-nums w-4">{String(i + 1).padStart(2, "0")}</span>
          <span className="w-7 h-7 rounded-full bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-mono text-[11px] text-[hsl(215,100%,72%)]">{m.name[0]?.toUpperCase()}</span>}
          </span>
          <span className="truncate text-white/85">{m.name}</span>
        </div>
      ),
    },
    { key: "projects", header: "Projects", align: "right", render: (m) => <span className="tabular-nums text-white/70">{m.projects}</span> },
    { key: "credits", header: "Credits · 30d", align: "right", render: (m) => <span className="tabular-nums text-white">{m.credits.toLocaleString()}</span> },
  ];

  return (
    <BusinessPage
      eyebrow={<>
        <span className="text-[hsl(215,100%,72%)]">{currentOrg?.name ?? "Business"}</span>
        <span className="text-white/20">·</span>
        <span>{currentOrg?.plan?.replace(/_/g, " ") ?? "—"} · {currentOrg?.role}</span>
      </>}
      title={`${firstName} — at a glance.`}
      subtitle="Your workspace command center — productions, credit burn, and team output over the last 30 days, then straight into the work."
      actions={hasPermission("producer") && (
        <Link to="/business/create" className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
          <Sparkles className="w-4 h-4" strokeWidth={1.8} /> New production
        </Link>
      )}
    >
      {/* KPI row — value · period delta · sparkline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrendStat label="Productions · 30d" value={a.productions30} deltaPct={a.prodDelta} spark={a.prodSpark} accent loading={loading} hint={`${projects.length} all-time`} />
        <TrendStat label="Credits burned · 30d" value={a.burned30.toLocaleString()} deltaPct={a.burnDelta} spark={a.burnSpark} loading={loading} hint="Across the workspace" />
        <TrendStat label="Active members" value={loading ? "—" : `${a.activeMembers} / ${members.length}`} loading={loading} hint="Created or spent in 30d" />
        <TrendStat label="Credit pool" value={credits.toLocaleString()} loading={loading} hint="Shared balance" />
      </div>

      {/* Trends */}
      <SectionHead label="Workspace analytics" action={<span className={cn(TYPE_META, "text-white/35")}>Window · 30d</span>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Production output" subtitle="Projects created per day">
          {loading ? <ChartSkeleton /> : (
            a.prodSpark.some((v) => v > 0)
              ? <AreaTrend data={a.prodSeries} xKey="label" series={[{ key: "value", label: "Productions", color: CHART_BLUE }]} height={210} />
              : <ChartEmpty label="No productions in this window yet." />
          )}
        </ChartCard>
        <ChartCard title="Credit burn" subtitle="Credits spent per day">
          {loading ? <ChartSkeleton /> : (
            a.burnSpark.some((v) => v > 0)
              ? <AreaTrend data={a.burnSeries} xKey="label" series={[{ key: "value", label: "Credits", color: CHART_CYAN }]} height={210} />
              : <ChartEmpty label="No credit spend in this window yet." />
          )}
        </ChartCard>
      </div>

      {/* Status mix + top members */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Project status" subtitle="All productions in the workspace">
          {loading ? <ChartSkeleton /> : a.statusData.length === 0 ? (
            <ChartEmpty label="No productions yet." />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2"><DonutChart data={a.statusData} height={190} centerValue={projects.length} centerLabel="Total" /></div>
              <ChartLegend className="sm:w-1/2 sm:flex-col sm:gap-2.5" items={a.statusData.map((d) => ({ label: d.name, color: d.color!, value: d.value }))} />
            </div>
          )}
        </ChartCard>
        <ChartCard title="Top members" subtitle="By credits used · 30d" action={
          <Link to="/business/analytics" className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/45 hover:text-white inline-flex items-center gap-1">Telemetry <ArrowRight className="w-3 h-3" /></Link>
        }>
          {loading ? <ChartSkeleton /> : a.topMembers.length === 0 || a.topMembers.every((m) => m.credits === 0) ? (
            <ChartEmpty label="No member usage in this window yet." />
          ) : (
            <DataTable columns={memberCols} rows={a.topMembers} getRowKey={(m) => m.user_id} />
          )}
        </ChartCard>
      </div>

      {/* Recent productions */}
      <SectionHead label="Recent productions" count={loading ? undefined : projects.length} action={
        <Link to="/business/projects" className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/45 hover:text-white inline-flex items-center gap-1">
          All <ArrowRight className="w-3 h-3" />
        </Link>
      } />
      {loading ? (
        <SkeletonCards count={6} grid="grid-cols-2 md:grid-cols-3" />
      ) : recent.length === 0 ? (
        <EmptyProductions canCreate={hasPermission("producer")} />
      ) : (
        <StaggerList className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {recent.map((p) => (
            <StaggerItem key={p.id}>
              <Link to={`/production/${p.id}`} className="group block rounded-2xl overflow-hidden ring-1 ring-white/[0.07] hover:ring-white/20 transition-all">
                <div className="relative aspect-video bg-gradient-to-br from-[hsl(215_40%_12%)] to-[#0a0a0f]">
                  {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {p.status && (
                    <span className="absolute top-2.5 left-2.5">
                      <Badge tone={p.status === "completed" ? "good" : p.status === "failed" ? "bad" : "warn"}>{p.status}</Badge>
                    </span>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <div className="text-[14px] text-white font-light truncate">{p.title || "Untitled"}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
                      <Clock className="w-3 h-3" />{p.genre || p.quality_tier || "production"}
                    </div>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {/* Quick actions */}
      <SectionHead label="Jump to" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {QUICK_ACTIONS.filter((act) => hasPermission(act.role)).map(({ to, label, sub, Icon }) => (
          <Link key={to} to={to} className="group flex items-center gap-3 rounded-2xl p-4 ring-1 ring-white/[0.07] hover:ring-[hsl(215_90%_60%/0.3)] bg-white/[0.015] hover:bg-[hsl(215_90%_55%/0.05)] transition-colors">
            <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10 group-hover:ring-[hsl(215_90%_60%/0.3)]">
              <Icon className="w-4.5 h-4.5 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] text-white/90 group-hover:text-white truncate">{label}</div>
              <div className={cn(TYPE_META, "text-white/40")}>{sub}</div>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto text-white/25 group-hover:text-white/60 transition-colors" strokeWidth={1.5} />
          </Link>
        ))}
      </div>
    </BusinessPage>
  );
}

function ChartSkeleton() {
  return <div className="h-[210px] rounded-xl bg-white/[0.02] animate-pulse" />;
}
function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="h-[190px] flex items-center justify-center text-center">
      <p className="text-[13px] text-white/40 font-light max-w-xs">{label}</p>
    </div>
  );
}

function EmptyProductions({ canCreate }: { canCreate: boolean }) {
  return (
    <EmptyState
      icon={Film}
      title="No productions yet."
      description="Spin up your first branded production and it'll show up here for the whole team."
      action={canCreate && (
        <Link to="/business/create" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
          <Sparkles className="w-4 h-4" /> New production
        </Link>
      )}
    />
  );
}
