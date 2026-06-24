/**
 * BusinessCredits — /business/credits
 *
 * Premium, data-rich pooled-credit surface for a business workspace. A balance
 * hero with a 30-day burn-down and projected runway, KPI trend stats, a full
 * credit ledger (filterable + paginated) and top-spending productions — all on
 * REAL org-scoped data (organizations, organization_members, credit_transactions,
 * movie_projects). Preserves the existing auto-recharge (set_org_auto_recharge)
 * and spend-alerts (set_org_spend_alerts) configuration exactly.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, TrendingDown, Check, Loader2, Gauge, Film } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, StatCard, SectionHead, Badge, EmptyState } from "@/components/business/BusinessPage";
import {
  ChartCard, AreaTrend, TrendStat, DataTable, bucketByDay, periodDelta,
  CHART_CYAN, type Column,
} from "@/components/business/BusinessCharts";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const WINDOW_DAYS = 30;
const RUNWAY_WINDOW_DAYS = 14;
const TXN_LIMIT = 200;
const LEDGER_CAP = 50;
const LEDGER_PAGE_SIZE = 10;

const inputCls = "h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition";

type Txn = {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
  transaction_type: string;
  description: string | null;
  balance_after: number | null;
  project_id: string | null;
};

type LedgerFilter = "all" | "grants" | "spends";

type TopProject = {
  project_id: string;
  title: string;
  spend: number;
};

const humanizeType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function BusinessCredits() {
  usePageMeta({ title: "Credits — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission("admin");
  const balance = currentOrg?.credits_balance ?? 0;
  const low = balance < 500;

  const orgId = currentOrg?.id ?? null;

  // ── Auto-recharge / spend-alert config (preserved exactly) ─────────────────
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number>(500);
  const [amount, setAmount] = useState<number>(2000);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [alertDaily, setAlertDaily] = useState<string>("");
  const [alertWeekly, setAlertWeekly] = useState<string>("");
  const [savingAlerts, setSavingAlerts] = useState(false);

  // ── Ledger / analytics data ────────────────────────────────────────────────
  const [txns, setTxns] = useState<Txn[]>([]);
  const [projectTitles, setProjectTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LedgerFilter>("all");

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      const { data } = await supabase.from("organizations")
        .select("auto_recharge_enabled, auto_recharge_threshold, auto_recharge_amount")
        .eq("id", currentOrg.id).maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        setEnabled(!!d.auto_recharge_enabled);
        if (d.auto_recharge_threshold) setThreshold(d.auto_recharge_threshold as number);
        if (d.auto_recharge_amount) setAmount(d.auto_recharge_amount as number);
      }
      const { data: alerts } = await supabase.from("organizations")
        .select("spend_alert_daily, spend_alert_weekly")
        .eq("id", currentOrg.id).maybeSingle();
      if (alerts) {
        const a = alerts as Record<string, unknown>;
        setAlertDaily((a.spend_alert_daily as number | null)?.toString() ?? "");
        setAlertWeekly((a.spend_alert_weekly as number | null)?.toString() ?? "");
      }
    })();
  }, [currentOrg?.id]);

  const loadLedger = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const memberRes = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId);
      const userIds = (memberRes.data ?? []).map((m) => m.user_id);
      if (userIds.length === 0) {
        setTxns([]);
        setProjectTitles(new Map());
        return;
      }

      const [txnRes, projRes] = await Promise.all([
        supabase
          .from("credit_transactions")
          .select("id, user_id, amount, created_at, transaction_type, description, balance_after, project_id")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(TXN_LIMIT),
        supabase
          .from("movie_projects")
          .select("id, title")
          .eq("organization_id", orgId)
          .limit(1000),
      ]);

      setTxns((txnRes.data ?? []) as unknown as Txn[]);
      setProjectTitles(new Map(((projRes.data ?? []) as { id: string; title: string | null }[])
        .map((p) => [p.id, p.title || "Untitled"])));
    } catch (e) {
      console.error("[BusinessCredits] ledger load failed", e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void loadLedger(); }, [loadLedger]);

  // ── Config save handlers (preserved exactly) ───────────────────────────────
  const saveAlerts = async () => {
    if (!currentOrg) return;
    const d = alertDaily.trim() === "" ? null : Math.max(0, parseInt(alertDaily, 10));
    const w = alertWeekly.trim() === "" ? null : Math.max(0, parseInt(alertWeekly, 10));
    setSavingAlerts(true);
    const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
      "set_org_spend_alerts", { p_org: currentOrg.id, p_daily: d, p_weekly: w },
    );
    setSavingAlerts(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Spend alerts saved");
  };

  const save = async (turnOn: boolean) => {
    if (!currentOrg) return;
    setSaving(true);
    const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
      "set_org_auto_recharge", { p_org: currentOrg.id, p_enabled: turnOn, p_threshold: threshold, p_amount: amount },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEnabled(turnOn);
    setOpen(false);
    toast.success(turnOn ? "Auto-recharge preference saved" : "Auto-recharge disabled");
  };

  const alertsArmed = !!(alertDaily || alertWeekly);

  // ── Derived analytics ──────────────────────────────────────────────────────
  const a = useMemo(() => {
    const spends = txns.filter((t) => t.amount < 0);
    const grants = txns.filter((t) => t.amount > 0);

    const burnSeries = bucketByDay(spends, (s) => s.created_at, (s) => Math.abs(s.amount), WINDOW_DAYS);
    const grantSeries = bucketByDay(grants, (g) => g.created_at, (g) => g.amount, WINDOW_DAYS);

    const burned30 = burnSeries.reduce((t, d) => t + d.value, 0);
    const granted30 = grantSeries.reduce((t, d) => t + d.value, 0);

    // Projected runway — balance / avg daily burn over the last 14 days
    const recentBurn = burnSeries.slice(-RUNWAY_WINDOW_DAYS).reduce((t, d) => t + d.value, 0);
    const avgDailyBurn = recentBurn / RUNWAY_WINDOW_DAYS;
    const runwayDays = avgDailyBurn > 0 ? Math.round(balance / avgDailyBurn) : null;

    // Top spending projects — group spends by project, sum abs(amount)
    const spendByProject = new Map<string, number>();
    for (const s of spends) {
      if (!s.project_id) continue;
      spendByProject.set(s.project_id, (spendByProject.get(s.project_id) ?? 0) + Math.abs(s.amount));
    }
    const topProjects: TopProject[] = [...spendByProject.entries()]
      .map(([project_id, spend]) => ({ project_id, spend, title: projectTitles.get(project_id) ?? "Untitled" }))
      .sort((x, y) => y.spend - x.spend)
      .slice(0, 5);

    return {
      burnSeries, grantSeries, burned30, granted30, runwayDays, avgDailyBurn, topProjects,
      burnDelta: periodDelta(burnSeries.map((d) => d.value)),
      grantDelta: periodDelta(grantSeries.map((d) => d.value)),
      burnSpark: burnSeries.map((d) => d.value),
      grantSpark: grantSeries.map((d) => d.value),
      hasBurn: burnSeries.some((d) => d.value > 0),
    };
  }, [txns, projectTitles, balance]);

  // ── Ledger (filter → cap → paginate) ───────────────────────────────────────
  const ledgerRows = useMemo(() => {
    const filtered = txns.filter((t) =>
      filter === "all" ? true : filter === "grants" ? t.amount > 0 : t.amount < 0,
    );
    return filtered.slice(0, LEDGER_CAP);
  }, [txns, filter]);

  const { page, setPage, totalPages, total, pageSize, slice } = usePagination(ledgerRows, LEDGER_PAGE_SIZE);

  const ledgerCols: Column<Txn>[] = [
    {
      key: "created_at", header: "Date",
      render: (t) => (
        <span className="tabular-nums text-white/60 whitespace-nowrap">
          {new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
        </span>
      ),
    },
    {
      key: "transaction_type", header: "Type",
      render: (t) => <Badge tone={t.amount > 0 ? "good" : "neutral"}>{humanizeType(t.transaction_type)}</Badge>,
    },
    {
      key: "description", header: "Detail",
      render: (t) => <span className="text-white/70 truncate block max-w-[280px]">{t.description || (t.project_id ? projectTitles.get(t.project_id) ?? "—" : "—")}</span>,
    },
    {
      key: "amount", header: "Amount", align: "right",
      render: (t) => (
        <span className={cn("tabular-nums font-mono", t.amount > 0 ? "text-emerald-300/90" : "text-rose-300/90")}>
          {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}
        </span>
      ),
    },
    {
      key: "balance_after", header: "Balance", align: "right",
      render: (t) => <span className="tabular-nums text-white/55">{t.balance_after != null ? t.balance_after.toLocaleString() : "—"}</span>,
    },
  ];

  const topProjectCols: Column<TopProject>[] = [
    {
      key: "title", header: "Production",
      render: (p, i) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[10px] text-white/30 tabular-nums w-4">{String(i + 1).padStart(2, "0")}</span>
          <Link to={`/production/${p.project_id}`} className="truncate text-white/85 hover:text-white transition-colors">{p.title}</Link>
        </div>
      ),
    },
    { key: "spend", header: "Credits spent", align: "right", render: (p) => <span className="tabular-nums text-white">{p.spend.toLocaleString()}</span> },
  ];

  const FILTERS: { key: LedgerFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "grants", label: "Grants" },
    { key: "spends", label: "Spends" },
  ];

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Optimize</span><span className="text-white/20">·</span><span>Pool &amp; top-ups</span></>}
      title="Credits."
      subtitle="Pooled credit balance shared by every workspace member. Track burn, watch the runway, and set spend thresholds. Top up through billing when the pool runs low."
      actions={
        <Link to="/workspace/billing" className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
          <Coins className="w-4 h-4" strokeWidth={1.8} /> Top up
        </Link>
      }
    >
      {/* ── Balance hero — pool + runway · 30-day burn-down ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl p-5 ring-1 ring-[hsl(215_90%_60%/0.25)] bg-[hsl(215_90%_55%/0.06)] flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/45">Pool balance</div>
            <div className="mt-3 font-display font-light text-[48px] leading-none tracking-[-0.02em] text-white tabular-nums">
              {balance.toLocaleString()}
            </div>
            <div className="mt-2 text-[12px] text-white/40">credits available · shared</div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center gap-2.5">
            <Gauge className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.6} />
            <div>
              <div className="text-[13px] text-white/85 tabular-nums">
                {loading ? "—" : a.runwayDays != null ? `~${a.runwayDays.toLocaleString()} days` : "—"}
              </div>
              <div className="text-[11px] text-white/40">Projected runway at current burn</div>
            </div>
          </div>
        </div>
        <ChartCard className="lg:col-span-2" title="Credit burn-down" subtitle="Credits spent per day · 30d"
          action={<Badge tone={low ? "warn" : "neutral"}>{low ? "Low balance" : "Healthy"}</Badge>}>
          {loading ? <ChartSkeleton /> : a.hasBurn ? (
            <AreaTrend data={a.burnSeries} xKey="label" series={[{ key: "value", label: "Credits", color: CHART_CYAN }]} height={210} />
          ) : (
            <ChartEmpty label="No credit spend in the last 30 days yet." />
          )}
        </ChartCard>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrendStat label="Pool balance" value={balance.toLocaleString()} accent loading={loading} hint="Shared credits" />
        <TrendStat label="Burned · 30d" value={a.burned30.toLocaleString()} deltaPct={a.burnDelta} spark={a.burnSpark} loading={loading} hint="Across the workspace" />
        <TrendStat label="Granted · 30d" value={a.granted30.toLocaleString()} deltaPct={a.grantDelta} spark={a.grantSpark} loading={loading} hint="Refills & top-ups" />
        <TrendStat label="Runway" value={loading ? "—" : a.runwayDays != null ? `${a.runwayDays.toLocaleString()}d` : "—"} loading={loading} hint="At current burn" />
      </div>

      {/* ── Credit ledger ────────────────────────────────────────────────────── */}
      <SectionHead
        label="Credit ledger"
        count={loading ? undefined : total}
        action={
          <div className="inline-flex items-center gap-1 rounded-full ring-1 ring-white/[0.08] bg-white/[0.02] p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={cn(
                  "px-3 h-7 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] transition-colors",
                  filter === f.key ? "bg-white/[0.10] text-white" : "text-white/45 hover:text-white/80",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />
      {loading ? (
        <div className="h-[280px] rounded-2xl bg-white/[0.02] animate-pulse" />
      ) : ledgerRows.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No transactions yet."
          description="Credit grants and production spend across the workspace will appear here as they happen."
        />
      ) : (
        <>
          <DataTable columns={ledgerCols} rows={slice} getRowKey={(t) => t.id} />
          <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="transactions" />
        </>
      )}

      {/* ── Top spending productions ─────────────────────────────────────────── */}
      <SectionHead label="Top spending productions" action={
        <Link to="/business/projects" className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/45 hover:text-white inline-flex items-center gap-1">
          Projects
        </Link>
      } />
      {loading ? (
        <div className="h-[200px] rounded-2xl bg-white/[0.02] animate-pulse" />
      ) : a.topProjects.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No project spend yet."
          description="When credits are spent on productions, the biggest consumers will rank here."
        />
      ) : (
        <DataTable columns={topProjectCols} rows={a.topProjects} getRowKey={(p) => p.project_id} />
      )}

      {/* ── Pool status cards ────────────────────────────────────────────────── */}
      <SectionHead label="Pool status" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Refill cadence" value="Monthly" hint="On plan renewal" />
        <StatCard label="Low-balance alert" value={low ? "Active" : "OK"} hint="Threshold: 500 credits" accent={low} />
        <StatCard label="Avg daily burn · 14d" value={loading ? "—" : Math.round(a.avgDailyBurn).toLocaleString()} hint="credits / day" />
      </div>

      {/* ── Auto-recharge (preserved) ────────────────────────────────────────── */}
      <SectionHead
        label="Auto-recharge"
        action={<Badge tone={enabled ? "good" : "neutral"}>{enabled ? "Armed" : "Disabled"}</Badge>}
      />
      <div className="rounded-2xl p-5">
        <p className="text-[12.5px] text-white/55 max-w-xl font-light leading-relaxed">
          Set a balance threshold and top-up size. Automatic purchasing isn&apos;t live yet —
          saving your preference here readies it for when billing automation is enabled.
        </p>
        {enabled && (
          <p className="text-[12.5px] text-white/70 mt-2 font-mono">
            Buys <span className="text-[hsl(215,100%,72%)]">{amount.toLocaleString()}</span> credits when balance drops below <span className="text-[hsl(215,100%,72%)]">{threshold.toLocaleString()}</span>.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button type="button" disabled={!canEdit} onClick={() => setOpen(true)}
            className={cn(
              "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50",
              enabled ? "ring-1 ring-white/[0.08] bg-white/[0.04] text-white hover:ring-white/20" : "bg-[hsl(215,90%,55%)] text-white hover:bg-[hsl(215,90%,60%)]",
            )}>
            {enabled ? "Edit auto-recharge" : "Configure auto-recharge"}
          </button>
          {enabled && (
            <button type="button" disabled={!canEdit || saving} onClick={() => void save(false)}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl ring-1 ring-white/[0.08] bg-white/[0.04] text-white text-[13px] font-medium hover:ring-white/20 disabled:opacity-50 transition-colors">
              Disable
            </button>
          )}
          <Link to="/workspace/analytics"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl ring-1 ring-white/[0.08] bg-white/[0.04] text-white/75 text-[13px] font-medium hover:text-white hover:ring-white/20 transition-colors">
            <TrendingDown className="w-4 h-4" strokeWidth={1.8} /> View burn report
          </Link>
        </div>
      </div>

      {/* ── Spend alerts (preserved) ─────────────────────────────────────────── */}
      <SectionHead
        label="Spend alerts"
        action={<Badge tone={alertsArmed ? "good" : "neutral"}>{alertsArmed ? "Armed" : "Off"}</Badge>}
      />
      <div className="rounded-2xl p-5">
        <p className="text-[12.5px] text-white/55 max-w-xl font-light leading-relaxed">
          Set daily or weekly spend thresholds for the workspace. Alert delivery isn&apos;t live yet —
          your thresholds are saved and will be used once it is. Leave a field blank to disable that alert.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 max-w-xl">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Daily ceiling (credits)</label>
            <input type="number" value={alertDaily} placeholder="e.g. 500" disabled={!canEdit}
              onChange={(e) => setAlertDaily(e.target.value)} className={cn(inputCls, "w-full mt-2")} />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Weekly ceiling (credits)</label>
            <input type="number" value={alertWeekly} placeholder="e.g. 2500" disabled={!canEdit}
              onChange={(e) => setAlertWeekly(e.target.value)} className={cn(inputCls, "w-full mt-2")} />
          </div>
        </div>
        <div className="mt-4">
          <button type="button" disabled={!canEdit || savingAlerts} onClick={() => void saveAlerts()}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl ring-1 ring-white/[0.08] bg-white/[0.04] text-white text-[13px] font-medium hover:ring-white/20 disabled:opacity-50 transition-colors">
            {savingAlerts ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save alerts"}
          </button>
        </div>
      </div>

      {/* ── Configure dialog (preserved) ─────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(220,14%,4%)] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="font-display italic font-light text-[20px]">Configure auto-recharge</DialogTitle>
            <DialogDescription className="text-white/50 text-[12.5px]">
              Saves your threshold and top-up size. Once automatic billing is enabled, the workspace&apos;s
              billing source will be charged for the credit pack when the pool drops below the threshold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Threshold (credits)</label>
              <input type="number" value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))} className={cn(inputCls, "w-full mt-2")} />
              <div className="mt-1.5 text-[11px] text-white/40">Trigger when pool balance falls below this number.</div>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Top-up amount (credits)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} className={cn(inputCls, "w-full mt-2")} />
              <div className="mt-1.5 text-[11px] text-white/40">Credits added per recharge. Billed at $0.10 / credit.</div>
            </div>
            <div className="text-[12px] text-white/55 font-mono">
              Estimated charge per recharge: <span className="text-[hsl(215,100%,72%)]">${(amount * 0.1).toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl ring-1 ring-white/[0.08] bg-white/[0.04] text-white text-[13px] font-medium hover:ring-white/20 transition-colors">
              Cancel
            </button>
            <button type="button" disabled={saving || threshold <= 0 || amount <= 0} onClick={() => void save(true)}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-50 transition-colors">
              <Check className="w-4 h-4" /> {saving ? "Saving…" : "Arm auto-recharge"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BusinessPage>
  );
}

function ChartSkeleton() {
  return <div className="h-[210px] rounded-xl bg-white/[0.02] animate-pulse" />;
}
function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="h-[210px] flex items-center justify-center text-center">
      <p className="text-[13px] text-white/40 font-light max-w-xs">{label}</p>
    </div>
  );
}
