/**
 * BusinessAnalytics — /business/analytics (Telemetry)
 *
 * The workspace analytics surface. Real, org-scoped usage intelligence over a
 * selectable 7/30/90-day window: credit-burn & output time series, quality-tier
 * and engine mix, and a per-member leaderboard with sparklines and share bars.
 * Data: organization_members → profiles, credit_transactions (negative = spend),
 * movie_projects. Admin-gated. CSV export of the leaderboard.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { Lock, Users, Download } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, EmptyState } from "@/components/business/BusinessPage";
import {
  ChartCard, AreaTrend, DonutChart, ChartLegend, TrendStat, DataTable, Sparkline,
  bucketByDay, periodDelta,
  CHART_BLUE, CHART_CYAN, CHART_VIOLET, CHART_EMERALD, CHART_AMBER, CHART_ROSE, CHART_SERIES,
  type Column,
} from "@/components/business/BusinessCharts";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

type Range = 7 | 30 | 90;
const RANGES: Range[] = [7, 30, 90];

interface Txn { user_id: string; amount: number; created_at: string }
interface Proj { user_id: string | null; id: string; created_at: string | null; quality_tier: string | null; engine: string | null }
interface Member { user_id: string; name: string; email: string; avatar_url: string | null }

interface MemberStat extends Member {
  credits: number;
  projects: number;
  spark: number[];
}

export default function BusinessAnalytics() {
  usePageMeta({ title: "Telemetry — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canView = hasPermission("admin");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);

  const [members, setMembers] = useState<Member[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg || !canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: memberRows } = await supabase
        .from("organization_members").select("user_id").eq("organization_id", currentOrg.id);
      const userIds = (memberRows ?? []).map((m) => m.user_id);
      if (userIds.length === 0) { setMembers([]); setTxns([]); setProjects([]); return; }

      const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();
      const [profRes, txnRes, projRes] = await Promise.all([
        // Org-scoped member directory (SECURITY DEFINER) — email is no longer
        // readable from the base profiles table.
        (supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: Array<{ id: string; display_name: string | null; full_name: string | null; avatar_url: string | null; email: string | null }> | null }>
        )("org_member_directory", { p_org_id: currentOrg.id }),
        supabase.from("credit_transactions").select("user_id, amount, created_at")
          .in("user_id", userIds).lt("amount", 0).gte("created_at", since90),
        supabase.from("movie_projects").select("user_id, id, created_at, quality_tier, engine")
          .in("user_id", userIds).gte("created_at", since90),
      ]);
      const pmap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
      setMembers(userIds.map((id) => {
        const p = pmap.get(id);
        return { user_id: id, name: p?.display_name || p?.full_name || "Member", email: p?.email ?? "", avatar_url: p?.avatar_url ?? null };
      }));
      setTxns((txnRes.data ?? []) as Txn[]);
      setProjects((projRes.data ?? []) as Proj[]);
    } catch (e) {
      console.error("[telemetry] load", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, canView]);

  useEffect(() => { void load(); }, [load]);

  // ── Derived (recomputes on range change, no refetch) ───────────────────────
  const a = useMemo(() => {
    const since = Date.now() - range * 86400_000;
    const spends = txns.filter((t) => new Date(t.created_at).getTime() >= since);
    const projs = projects.filter((p) => p.created_at && new Date(p.created_at).getTime() >= since);

    const burnSeries = bucketByDay(spends, (s) => s.created_at, (s) => Math.abs(s.amount), range);
    const outputSeries = bucketByDay(projs, (p) => p.created_at, () => 1, range);

    const burned = burnSeries.reduce((t, d) => t + d.value, 0);

    // per-member
    const stats: MemberStat[] = members.map((m) => {
      const mySpends = spends.filter((s) => s.user_id === m.user_id);
      const myProjs = projs.filter((p) => p.user_id === m.user_id);
      return {
        ...m,
        credits: mySpends.reduce((t, s) => t + Math.abs(s.amount), 0),
        projects: myProjs.length,
        spark: bucketByDay(mySpends, (s) => s.created_at, (s) => Math.abs(s.amount), range).map((d) => d.value),
      };
    }).sort((x, y) => y.credits - x.credits);

    const active = stats.filter((s) => s.credits > 0 || s.projects > 0).length;
    const maxCredits = Math.max(1, ...stats.map((s) => s.credits));

    const mix = (key: "quality_tier" | "engine") => {
      const m = new Map<string, number>();
      for (const p of projs) {
        const v = (p[key] || "unspecified").toString().toLowerCase();
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()].sort((x, y) => y[1] - x[1]).map(([name, value], i) => ({
        name: name === "unspecified" ? "Unspecified" : name[0].toUpperCase() + name.slice(1),
        value, color: CHART_SERIES[i % CHART_SERIES.length],
      }));
    };

    return {
      burnSeries, outputSeries, burned,
      burnSpark: burnSeries.map((d) => d.value),
      outputSpark: outputSeries.map((d) => d.value),
      burnDelta: periodDelta(burnSeries.map((d) => d.value)),
      outputDelta: periodDelta(outputSeries.map((d) => d.value)),
      projectsTotal: projs.length,
      stats, active, maxCredits,
      avgPerActive: active ? Math.round(burned / active) : 0,
      qualityMix: mix("quality_tier"),
      engineMix: mix("engine"),
    };
  }, [txns, projects, members, range]);

  const exportCsv = () => {
    const header = "Member,Email,Credits,Projects\n";
    const body = a.stats.map((m) => `"${m.name}","${m.email}",${m.credits},${m.projects}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentOrg?.slug || "workspace"}-telemetry-${range}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const memberCols: Column<MemberStat>[] = [
    {
      key: "name", header: "Member",
      render: (m, i) => (
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-white/30 tabular-nums w-4">{String(i + 1).padStart(2, "0")}</span>
          <span className="w-7 h-7 rounded-full bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-mono text-[11px] text-[hsl(215,100%,72%)]">{m.name[0]?.toUpperCase()}</span>}
          </span>
          <div className="min-w-0">
            <div className="truncate text-white/85">{m.name}</div>
            <div className="font-mono text-[10px] text-white/35 truncate">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "trend", header: "Burn trend", className: "w-32",
      render: (m) => m.spark.some((v) => v > 0) ? <div className="w-28"><Sparkline data={m.spark} height={28} /></div> : <span className="text-white/25">—</span>,
    },
    { key: "projects", header: "Projects", align: "right", render: (m) => <span className="tabular-nums text-white/70">{m.projects}</span> },
    {
      key: "credits", header: "Credits", align: "right",
      render: (m) => (
        <div className="flex items-center justify-end gap-2.5">
          <span className="hidden sm:block w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <span className="block h-full rounded-full bg-[hsl(215,90%,55%)]" style={{ width: `${(m.credits / a.maxCredits) * 100}%` }} />
          </span>
          <span className="tabular-nums text-white w-16 text-right">{m.credits.toLocaleString()}</span>
        </div>
      ),
    },
  ];

  if (!canView) {
    return (
      <BusinessPage
        eyebrow={<><span className="text-[hsl(215,100%,72%)]">Optimize</span><span className="text-white/20">·</span><span>Telemetry</span></>}
        title="Telemetry."
        subtitle="Credit burn and output across the workspace, by member."
      >
        <EmptyState icon={Lock} title="Access denied." description="Telemetry is restricted to admins and owners." />
      </BusinessPage>
    );
  }

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Optimize</span><span className="text-white/20">·</span><span>Telemetry</span></>}
      title="Telemetry."
      subtitle="Credit burn, output, and per-member usage across the workspace. Switch the window to compare trends."
      actions={
        <button type="button" onClick={exportCsv} disabled={loading || a.stats.length === 0}
          className="inline-flex items-center gap-2 rounded-full px-4 h-11 ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 text-[13px] transition-colors disabled:opacity-40">
          <Download className="w-4 h-4" strokeWidth={1.8} /> Export CSV
        </button>
      }
    >
      {/* Range control */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className={cn(TYPE_META, "text-white/45")}>Window</div>
        <div className="flex items-center gap-1 p-1 rounded-xl ring-1 ring-white/[0.07] bg-white/[0.015]">
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)}
              className={cn(
                "px-3.5 h-8 rounded-lg text-[12px] font-light transition-colors tabular-nums",
                range === r ? "bg-[hsl(215,90%,55%)] text-white" : "text-white/55 hover:text-white/85",
              )}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrendStat label={`Credits burned · ${range}d`} value={a.burned.toLocaleString()} deltaPct={a.burnDelta} spark={a.burnSpark} accent loading={loading} />
        <TrendStat label={`Projects · ${range}d`} value={a.projectsTotal} deltaPct={a.outputDelta} spark={a.outputSpark} loading={loading} />
        <TrendStat label="Active members" value={loading ? "—" : `${a.active} / ${members.length}`} loading={loading} hint="Created or spent in window" />
        <TrendStat label="Avg / active member" value={a.avgPerActive.toLocaleString()} loading={loading} hint="Credits per active member" />
      </div>

      {/* Time series */}
      <SectionHead label="Trends" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Credit burn" subtitle="Credits spent per day">
          {loading ? <ChartSkeleton /> : a.burnSpark.some((v) => v > 0)
            ? <AreaTrend data={a.burnSeries} xKey="label" series={[{ key: "value", label: "Credits", color: CHART_BLUE }]} height={210} />
            : <ChartEmpty label="No credit spend in this window yet." />}
        </ChartCard>
        <ChartCard title="Project output" subtitle="Projects created per day">
          {loading ? <ChartSkeleton /> : a.outputSpark.some((v) => v > 0)
            ? <AreaTrend data={a.outputSeries} xKey="label" series={[{ key: "value", label: "Projects", color: CHART_CYAN }]} height={210} />
            : <ChartEmpty label="No productions in this window yet." />}
        </ChartCard>
      </div>

      {/* Mix donuts */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Quality tier" subtitle="Productions by tier">
          {loading ? <ChartSkeleton /> : a.qualityMix.length === 0 ? <ChartEmpty label="No productions in window." /> : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2"><DonutChart data={a.qualityMix} height={180} centerValue={a.projectsTotal} centerLabel="Projects" /></div>
              <ChartLegend className="sm:w-1/2 sm:flex-col sm:gap-2.5" items={a.qualityMix.map((d) => ({ label: d.name, color: d.color, value: d.value }))} />
            </div>
          )}
        </ChartCard>
        <ChartCard title="Engine mix" subtitle="Productions by engine">
          {loading ? <ChartSkeleton /> : a.engineMix.length === 0 ? <ChartEmpty label="No productions in window." /> : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2"><DonutChart data={a.engineMix} height={180} centerValue={a.projectsTotal} centerLabel="Projects" /></div>
              <ChartLegend className="sm:w-1/2 sm:flex-col sm:gap-2.5" items={a.engineMix.map((d) => ({ label: d.name, color: d.color, value: d.value }))} />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Member leaderboard */}
      <SectionHead label="Member leaderboard" count={loading ? undefined : members.length} action={<span className={cn(TYPE_META, "text-white/35")}>By credits · {range}d</span>} />
      {loading ? (
        <SkeletonTable />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No members on roster." description="Invite teammates to start tracking credit burn and output volume." />
      ) : (
        <DataTable columns={memberCols} rows={a.stats} getRowKey={(m) => m.user_id} />
      )}
    </BusinessPage>
  );
}

function ChartSkeleton() {
  return <div className="h-[210px] rounded-xl bg-white/[0.02] animate-pulse" />;
}
function ChartEmpty({ label }: { label: string }) {
  return <div className="h-[180px] flex items-center justify-center text-center"><p className="text-[13px] text-white/40 font-light max-w-xs">{label}</p></div>;
}
function SkeletonTable() {
  return <div className="h-64 rounded-2xl bg-white/[0.02] animate-pulse" />;
}
