/**
 * BusinessAudit — /business/audit
 *
 * The workspace activity intelligence surface. Merges workspace_audit_events
 * with the org's credit_transactions into one immutable trail, then layers
 * analytics on top: activity-over-time, events-by-category, an actor
 * leaderboard, a searchable/filterable trail with a detail drawer, and CSV
 * export. Admin-gated. Real data only.
 */
import { useEffect, useMemo, useState } from "react";
import { csvRow } from "@/lib/csvSafe";
import { Lock, History, Download, Search, X } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, EmptyState, SkeletonRows, Badge } from "@/components/business/BusinessPage";
import { GlassButton } from "@/components/foundation/Floating";
import {
  ChartCard, AreaTrend, DonutChart, ChartLegend, TrendStat, DataTable,
  bucketByDay, periodDelta, CHART_BLUE, CHART_SERIES, type Column,
} from "@/components/business/BusinessCharts";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

type LedgerKind = "credit" | "workspace";
interface LedgerRow {
  id: string;
  kind: LedgerKind;
  ts: string;
  label: string;
  detail: string;
  amount: number | null;
  category: string | null;
  actor: string | null;
  metadata: unknown;
}
interface ActorStat { actor: string; events: number }

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function BusinessAudit() {
  usePageMeta({ title: "Audit log — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canView = hasPermission("admin");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | LedgerKind>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LedgerRow | null>(null);

  useEffect(() => {
    if (!currentOrg || !canView) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const wsPromise = supabase
        .from("workspace_audit_events")
        .select("id, action, category, target_kind, target_id, actor_name, metadata, created_at")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(250);

      const { data: projects } = await supabase
        .from("movie_projects").select("id, title").eq("organization_id", currentOrg.id);
      const projIds = (projects ?? []).map((p) => p.id);
      const titleMap = new Map<string, string>((projects ?? []).map((p) => [p.id, p.title]));

      // AUDIT FIX B-2/H-6: org-scoped ledger via the SECURITY DEFINER
      // org_credit_transactions() RPC (transactions tagged by the project's
      // org, membership-gated). The previous direct credit_transactions read
      // was silently narrowed to the viewer's own rows by RLS, so an admin
      // never saw transactions made by other org members.
      const creditPromise = projIds.length
        ? (supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: CreditTx[] | null }>
          )("org_credit_transactions", { p_org_id: currentOrg.id })
        : Promise.resolve({ data: [] as CreditTx[] });

      const [{ data: wsEvents }, { data: credits }] = await Promise.all([
        wsPromise as Promise<{ data: WsEvent[] | null }>,
        creditPromise as Promise<{ data: CreditTx[] | null }>,
      ]);
      if (cancelled) return;

      const merged: LedgerRow[] = [
        ...(wsEvents ?? []).map((e) => ({
          id: `ws-${e.id}`, kind: "workspace" as const, ts: e.created_at, label: e.action,
          detail: e.target_kind ? `${e.target_kind}${e.target_id ? ` · ${String(e.target_id).slice(0, 8)}` : ""}` : (e.actor_name ?? ""),
          amount: null, category: e.category, actor: e.actor_name, metadata: e.metadata,
        })),
        ...(credits ?? []).map((c) => ({
          id: `cr-${c.id}`, kind: "credit" as const, ts: c.created_at, label: c.transaction_type,
          detail: c.description ?? titleMap.get(c.project_id) ?? "", amount: c.amount, category: "credits",
          actor: null, metadata: { project_id: c.project_id, amount: c.amount, type: c.transaction_type },
        })),
      ].sort((a, b) => b.ts.localeCompare(a.ts));

      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentOrg, canView]);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const a = useMemo(() => {
    const activitySeries = bucketByDay(rows, (r) => r.ts, () => 1, 30);
    const last7 = rows.filter((r) => Date.now() - new Date(r.ts).getTime() < 7 * 86400_000).length;

    const catCounts = new Map<string, number>();
    for (const r of rows) {
      const c = (r.category || "other").toLowerCase();
      catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
    }
    const categoryData = [...catCounts.entries()].sort((x, y) => y[1] - x[1])
      .map(([name, value], i) => ({ name: name[0].toUpperCase() + name.slice(1), value, color: CHART_SERIES[i % CHART_SERIES.length] }));

    const actorCounts = new Map<string, number>();
    for (const r of rows) if (r.actor) actorCounts.set(r.actor, (actorCounts.get(r.actor) ?? 0) + 1);
    const actors: ActorStat[] = [...actorCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([actor, events]) => ({ actor, events }));

    return {
      activitySeries, activitySpark: activitySeries.map((d) => d.value),
      activityDelta: periodDelta(activitySeries.map((d) => d.value)),
      last7, categoryData, actors,
      wsCount: rows.filter((r) => r.kind === "workspace").length,
      creditCount: rows.filter((r) => r.kind === "credit").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      (filter === "all" || r.kind === filter) &&
      (!q || r.label.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q) || (r.actor ?? "").toLowerCase().includes(q) || (r.category ?? "").toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

  const { slice, page, setPage, totalPages, total, pageSize } = usePagination(visible, 25);

  const exportCsv = () => {
    const header = "Timestamp,Kind,Category,Action,Actor,Detail,Amount\n";
    const body = visible.map((r) => csvRow([new Date(r.ts).toISOString(), r.kind, r.category ?? "", r.label, r.actor ?? "", r.detail || "", r.amount ?? ""])).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${currentOrg?.slug || "workspace"}-audit.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const actorCols: Column<ActorStat>[] = [
    { key: "actor", header: "Actor", render: (m, i) => <div className="flex items-center gap-2.5"><span className="font-mono text-[10px] text-white/30 tabular-nums w-4">{String(i + 1).padStart(2, "0")}</span><span className="truncate text-white/85">{m.actor}</span></div> },
    { key: "events", header: "Events", align: "right", render: (m) => <span className="tabular-nums text-white">{m.events}</span> },
  ];

  if (!canView) {
    return (
      <BusinessPage eyebrow={<><span className="text-[hsl(215,100%,72%)]">Govern</span><span className="text-white/20">·</span><span>Activity trail</span></>} title="Audit log." subtitle="An immutable record of every workspace action.">
        <EmptyState icon={Lock} title="Access denied." description="The audit trail is restricted to admins and owners." />
      </BusinessPage>
    );
  }

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Govern</span><span className="text-white/20">·</span><span>Activity trail</span></>}
      title="Audit log."
      subtitle="An immutable record of every workspace action — credit movement, member changes and content events."
      actions={
        <GlassButton tone="neutral" onClick={exportCsv} disabled={loading || visible.length === 0}>
          <Download className="w-4 h-4" strokeWidth={1.8} /> Export CSV
        </GlassButton>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrendStat label="Total events" value={rows.length} deltaPct={a.activityDelta} spark={a.activitySpark} accent loading={loading} hint="Across the workspace" />
        <TrendStat label="Last 7 days" value={a.last7} loading={loading} hint="Recent activity" />
        <TrendStat label="Workspace" value={a.wsCount} loading={loading} hint="Members · settings · content" />
        <TrendStat label="Credit movement" value={a.creditCount} loading={loading} hint="Spend & grants" />
      </div>

      {/* Charts */}
      <SectionHead label="Activity" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <ChartCard title="Activity over time" subtitle="Events per day · 30d">
          {loading ? <div className="h-[200px] rounded-xl bg-white/[0.02] animate-pulse" /> : a.activitySpark.some((v) => v > 0)
            ? <AreaTrend data={a.activitySeries} xKey="label" series={[{ key: "value", label: "Events", color: CHART_BLUE }]} height={200} />
            : <div className="h-[180px] flex items-center justify-center"><p className="text-[13px] text-white/40">No recent activity.</p></div>}
        </ChartCard>
        <ChartCard title="By category" subtitle="All recorded events">
          {loading ? <div className="h-[200px] rounded-xl bg-white/[0.02] animate-pulse" /> : a.categoryData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center"><p className="text-[13px] text-white/40">No events yet.</p></div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2"><DonutChart data={a.categoryData} height={180} centerValue={rows.length} centerLabel="Events" /></div>
              <ChartLegend className="sm:w-1/2 sm:flex-col sm:gap-2" items={a.categoryData.slice(0, 6).map((d) => ({ label: d.name, color: d.color, value: d.value }))} />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Actor leaderboard */}
      {!loading && a.actors.length > 0 && (
        <>
          <SectionHead label="Most active" count={a.actors.length} />
          <DataTable columns={actorCols} rows={a.actors} getRowKey={(m) => m.actor} />
        </>
      )}

      {/* Trail */}
      <SectionHead label="Activity trail" count={loading ? undefined : visible.length} action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
              className="h-8 w-36 sm:w-44 pl-8 pr-3 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[12px] text-white placeholder:text-white/35 outline-none transition" />
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-0.5">
            {(["all", "workspace", "credit"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("px-3 h-7 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] transition", filter === f ? "bg-[hsl(215,100%,45%)]/25 text-[hsl(215,100%,82%)]" : "text-white/45 hover:text-white/80")}>
                {f}
              </button>
            ))}
          </div>
        </div>
      } />

      {loading ? (
        <SkeletonRows rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState icon={History} title={rows.length === 0 ? "No events yet." : "No matches."} description={rows.length === 0 ? "Audit events appear here as members create projects, spend credits and manage the team." : "Try a different search or filter."} />
      ) : (
        <div className="rounded-2xl overflow-hidden">
          <ul className="divide-y divide-white/[0.05]">
            {slice.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setSelected(e)} className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-white/[0.025] transition-colors">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 w-32 shrink-0" title={new Date(e.ts).toLocaleString()}>{relativeTime(e.ts)}</div>
                  <Badge tone={e.kind === "credit" ? (e.amount != null && e.amount < 0 ? "warn" : "good") : "neutral"} className="shrink-0">{e.label}</Badge>
                  <div className="flex-1 text-[12px] text-white/85 truncate">{e.detail || (e.actor ? `by ${e.actor}` : "—")}</div>
                  {e.amount !== null && <div className="font-mono text-[12px] tabular-nums text-white/95 shrink-0">{e.amount > 0 ? "+" : ""}{e.amount}</div>}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4"><ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="events" /></div>
        </div>
      )}

      {/* Detail drawer */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-[hsl(220,16%,5%)] border border-white/[0.08] text-white max-w-lg">
          <DialogTitle className="sr-only">Event detail</DialogTitle>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Badge tone={selected.kind === "credit" ? (selected.amount != null && selected.amount < 0 ? "warn" : "good") : "neutral"}>{selected.label}</Badge>
                <span className={cn(TYPE_META, "text-white/40")}>{selected.category}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-y-2.5 text-[13px]">
                <span className="text-white/40">When</span><span className="text-white/85">{new Date(selected.ts).toLocaleString()}</span>
                <span className="text-white/40">Kind</span><span className="text-white/85 capitalize">{selected.kind}</span>
                {selected.actor && <><span className="text-white/40">Actor</span><span className="text-white/85">{selected.actor}</span></>}
                {selected.detail && <><span className="text-white/40">Detail</span><span className="text-white/85 break-words">{selected.detail}</span></>}
                {selected.amount !== null && <><span className="text-white/40">Amount</span><span className="font-mono text-white/85">{selected.amount > 0 ? "+" : ""}{selected.amount}</span></>}
              </div>
              {!!selected.metadata && (
                <div>
                  <div className={cn(TYPE_META, "text-white/40 mb-1.5")}>Metadata</div>
                  <pre className="text-[11px] font-mono text-white/70 bg-black/40 rounded-xl p-3 overflow-x-auto max-h-48">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </div>
              )}
              <div className="flex justify-end">
                <GlassButton tone="neutral" size="sm" onClick={() => setSelected(null)}>
                  <X className="w-3.5 h-3.5" /> Close
                </GlassButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BusinessPage>
  );
}

interface WsEvent {
  id: string; action: string; category: string | null; target_kind: string | null;
  target_id: string | null; actor_name: string | null; metadata: unknown; created_at: string;
}
interface CreditTx {
  id: string; amount: number; transaction_type: string; description: string | null; project_id: string; created_at: string;
}
