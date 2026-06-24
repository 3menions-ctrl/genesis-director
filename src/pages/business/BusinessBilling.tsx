/**
 * BusinessBilling — /business/billing
 *
 * The billing & spend surface for a business workspace. Real, org-scoped
 * data: a 30-day credit-burn KPI row, a 6-month monthly-spend bar chart,
 * a spend-by-type donut, and a statement-style table with estimated cost
 * at $0.10/credit. Spend is sourced from credit_transactions scoped to the
 * workspace's member user_ids; project/member counts are head-counts. The
 * pricing-inquiry form (writes to support_messages) is preserved intact.
 * Plans are now live — everything runs on hand-allocated credits.
 */
import { useEffect, useMemo, useState } from "react";
import { Send, Loader2, BadgeCheck, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, EmptyState } from "@/components/business/BusinessPage";
import {
  ChartCard, BarTrend, DonutChart, ChartLegend, TrendStat, DataTable,
  bucketByDay, periodDelta,
  CHART_BLUE, CHART_CYAN, CHART_EMERALD, CHART_AMBER, CHART_ROSE, CHART_VIOLET,
  type Column,
} from "@/components/business/BusinessCharts";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";

const WINDOW_DAYS = 30;
const MONTHS = 6;
const COST_PER_CREDIT = 0.1; // $0.10 / credit — the page's costing convention

const TYPE_COLORS = [CHART_BLUE, CHART_CYAN, CHART_VIOLET, CHART_EMERALD, CHART_AMBER, CHART_ROSE];

interface SpendRow {
  amount: number;
  created_at: string;
  transaction_type: string | null;
}
interface MonthBucket {
  key: string;        // YYYY-MM
  month: string;      // "Mar"
  period: string;     // "Mar 2026"
  value: number;      // credits used (abs)
}

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const titleizeType = (t: string) =>
  t.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Fold timestamped spends into the last `months` calendar-month buckets. */
function monthlyBuckets(spends: SpendRow[], months: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  const idx = new Map<string, number>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    idx.set(key, out.length);
    out.push({
      key,
      month: dt.toLocaleString(undefined, { month: "short" }),
      period: dt.toLocaleString(undefined, { month: "short", year: "numeric" }),
      value: 0,
    });
  }
  for (const s of spends) {
    if (!s.created_at) continue;
    const at = idx.get(s.created_at.slice(0, 7));
    if (at !== undefined) out[at].value += Math.abs(s.amount);
  }
  return out;
}

export default function BusinessBilling() {
  usePageMeta({ title: "Billing — Business" });

  const { user } = useAuth();
  const { currentOrg, hasPermission } = useWorkspace();
  const canManage = hasPermission("admin");

  const orgId = currentOrg?.id ?? null;
  const creditPool = currentOrg?.credits_balance ?? 0;

  const [memberCount, setMemberCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [spends, setSpends] = useState<SpendRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [inquiryReason, setInquiryReason] = useState("");
  const [seats, setSeats] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Spend window spans whole calendar months (for the 6-month chart).
        const now = new Date();
        const since = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1).toISOString();

        const [memberRes, projRes] = await Promise.all([
          supabase.from("organization_members").select("user_id").eq("organization_id", orgId),
          supabase
            .from("movie_projects")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId),
        ]);

        const userIds = (memberRes.data ?? []).map((m) => m.user_id);
        if (cancelled) return;
        setMemberCount(userIds.length);
        setProjectCount(projRes.count ?? 0);

        if (userIds.length > 0) {
          const txnRes = await supabase
            .from("credit_transactions")
            .select("amount, created_at, transaction_type")
            .in("user_id", userIds)
            .lt("amount", 0)
            .gte("created_at", since);
          if (cancelled) return;
          setSpends((txnRes.data ?? []) as SpendRow[]);
        } else {
          setSpends([]);
        }
      } catch (e) {
        console.error("[BusinessBilling] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // ── Derived analytics ──────────────────────────────────────────────────────
  const a = useMemo(() => {
    const burnSeries = bucketByDay(spends, (s) => s.created_at, (s) => Math.abs(s.amount), WINDOW_DAYS);
    const burnSpark = burnSeries.map((d) => d.value);
    const used30d = burnSpark.reduce((t, v) => t + v, 0);

    const months = monthlyBuckets(spends, MONTHS);

    // Spend by transaction type (whole window).
    const byType = new Map<string, number>();
    for (const s of spends) {
      const t = (s.transaction_type || "other").toLowerCase();
      byType.set(t, (byType.get(t) ?? 0) + Math.abs(s.amount));
    }
    const typeData = [...byType.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([name, value], i) => ({
        name: titleizeType(name),
        value,
        color: TYPE_COLORS[i % TYPE_COLORS.length],
      }));

    return {
      burnSeries, burnSpark, used30d,
      burnDelta: periodDelta(burnSpark),
      months,
      monthsHasData: months.some((m) => m.value > 0),
      statement: [...months].reverse(),
      typeData,
      totalWindow: spends.reduce((t, s) => t + Math.abs(s.amount), 0),
    };
  }, [spends]);

  // Preserved figures for the pricing inquiry message.
  const stats = { members: memberCount, projects: projectCount, creditsUsed30d: a.used30d };

  const submitInquiry = async () => {
    if (!user || !currentOrg) return;
    setBusy(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: user.id,
      name: user.email?.split("@")[0] ?? "Small Bridges user",
      email: user.email ?? "",
      source: "workspace_pricing",
      subject: `Workspace pricing inquiry — ${currentOrg.name}`,
      message:
        `Workspace pricing inquiry from ${currentOrg.name}.\n` +
        `Seats anticipated: ${seats || "not specified"}\n` +
        `Members today: ${stats.members}\n` +
        `Projects: ${stats.projects}\n` +
        `Credits used last 30d: ${stats.creditsUsed30d}\n\n` +
        `Notes:\n${inquiryReason || "(none provided)"}`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Could not send");
      return;
    }
    setSent(true);
    toast.success("We'll reply within one business day");
  };

  // ── Statement table ─────────────────────────────────────────────────────────
  const statementCols: Column<MonthBucket>[] = [
    {
      key: "period", header: "Period",
      render: (m) => <span className="text-white/85">{m.period}</span>,
    },
    {
      key: "value", header: "Credits used", align: "right",
      render: (m) => <span className="tabular-nums text-white">{m.value.toLocaleString()}</span>,
    },
    {
      key: "cost", header: "Est. cost", align: "right",
      render: (m) => (
        <span className="tabular-nums text-white/70">{usd(m.value * COST_PER_CREDIT)}</span>
      ),
    },
  ];

  return (
    <BusinessPage
      eyebrow={
        <>
          <span className="text-[hsl(215,100%,72%)]">Optimize</span>
          <span className="text-white/20">·</span>
          <span>Plan &amp; invoices</span>
        </>
      }
      title="Billing."
      subtitle="Workspace plans launch later. For now, your team runs on shared, hand-allocated credits — here's your spend, broken down so you can shape the plan that fits."
      actions={
        <span className="inline-flex items-center px-3 h-8 rounded-full text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-300/90 ring-1 ring-emerald-400/30 bg-emerald-400/10">
          Free to start
        </span>
      }
    >
      {/* KPI row */}
      <SectionHead label="Usage at a glance" action={<span className={cn(TYPE_META, "text-white/35")}>Burn · 30d</span>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrendStat label="Members" value={stats.members.toLocaleString()} loading={loading} hint="On the roster" />
        <TrendStat label="Projects" value={stats.projects.toLocaleString()} loading={loading} hint="All-time" />
        <TrendStat
          label="Credits used · 30d"
          value={a.used30d.toLocaleString()}
          deltaPct={a.burnDelta}
          spark={a.burnSpark}
          accent
          loading={loading}
          hint={`≈ ${usd(a.used30d * COST_PER_CREDIT)} at $0.10/credit`}
        />
        <TrendStat label="Credit pool" value={creditPool.toLocaleString()} loading={loading} hint="Shared balance" />
      </div>

      {/* Spend breakdowns */}
      <SectionHead label="Spend analytics" action={<span className={cn(TYPE_META, "text-white/35")}>Window · {MONTHS}mo</span>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Monthly spend" subtitle={`Credits used per month · last ${MONTHS} months`}>
          {loading ? <ChartSkeleton /> : a.monthsHasData ? (
            <BarTrend
              data={a.months}
              xKey="month"
              series={[{ key: "value", label: "Credits", color: CHART_BLUE }]}
              height={210}
            />
          ) : (
            <ChartEmpty label="No credit spend in the last six months yet." />
          )}
        </ChartCard>

        <ChartCard title="Spend by type" subtitle="Where the credits went">
          {loading ? <ChartSkeleton /> : a.typeData.length === 0 ? (
            <ChartEmpty label="No credit spend to break down yet." />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-1/2">
                <DonutChart
                  data={a.typeData}
                  height={190}
                  centerValue={a.totalWindow.toLocaleString()}
                  centerLabel="Credits"
                />
              </div>
              <ChartLegend
                className="sm:w-1/2 sm:flex-col sm:gap-2.5"
                items={a.typeData.map((d) => ({ label: d.name, color: d.color, value: d.value.toLocaleString() }))}
              />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Statement */}
      <SectionHead label="Statement" action={<span className={cn(TYPE_META, "text-white/35")}>$0.10 / credit</span>} />
      {loading ? (
        <ChartSkeleton />
      ) : a.monthsHasData ? (
        <DataTable columns={statementCols} rows={a.statement} getRowKey={(m) => m.key} />
      ) : (
        <EmptyState
          icon={Receipt}
          title="No statement activity yet."
          description="As your team spends credits, a month-by-month statement with estimated cost will appear here."
        />
      )}

      {/* Pricing inquiry (preserved) */}
      <SectionHead label="Talk to us about pricing" />
      {sent ? (
        <div className="rounded-2xl ring-1 ring-emerald-400/30 bg-emerald-500/[0.04] p-6 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
          <BadgeCheck className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" strokeWidth={1.6} />
          <div>
            <div className="text-white text-[15px] font-light mb-1">Got it.</div>
            <p className="text-white/60 text-[13px] leading-relaxed">
              We&rsquo;ll reach out within one business day with a proposal.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6">
          <p className="text-[13px] text-white/55 leading-relaxed mb-5">
            Tell us what your team needs — we&rsquo;ll size a plan that fits.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
            <label className="block">
              <span className={cn(TYPE_META, "text-white/45")}>Seats anticipated</span>
              <input
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="e.g. 12"
                disabled={!canManage}
                className="mt-2 w-full h-11 px-4 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className={cn(TYPE_META, "text-white/45")}>Notes (optional)</span>
              <textarea
                rows={4}
                value={inquiryReason}
                onChange={(e) => setInquiryReason(e.target.value)}
                placeholder="What kind of output volume are you targeting? Any compliance asks?"
                disabled={!canManage}
                className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition resize-none disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-5">
            <button
              type="button"
              disabled={!canManage || busy}
              onClick={submitInquiry}
              className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors disabled:opacity-50 disabled:hover:bg-[hsl(215,90%,55%)]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={1.8} />}
              Send to billing
            </button>
          </div>
        </div>
      )}

      {/* Plan-launch copy (preserved) */}
      <SectionHead label="What happens when paid plans launch?" />
      <ul className="space-y-3 text-[14px] text-white/65 leading-relaxed">
        <li className="flex gap-3">
          <span className="mt-[9px] w-1 h-1 rounded-full bg-[hsl(215,100%,72%)] shrink-0" />
          Your work and your account are always yours to keep.
        </li>
        <li className="flex gap-3">
          <span className="mt-[9px] w-1 h-1 rounded-full bg-[hsl(215,100%,72%)] shrink-0" />
          We&rsquo;ll email at least 30 days before any paid plan turns on, and we&rsquo;ll tell you what stays free.
        </li>
        <li className="flex gap-3">
          <span className="mt-[9px] w-1 h-1 rounded-full bg-[hsl(215,100%,72%)] shrink-0" />
          Workspace-tier features (audit log export, SSO, custom roles) ship together when paid plans launch.
        </li>
      </ul>
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
