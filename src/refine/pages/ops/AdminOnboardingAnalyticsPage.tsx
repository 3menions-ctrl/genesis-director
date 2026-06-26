/** Onboarding Analytics — funnel rollup from onboarding_intents + profiles. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, DeckButton } from "@/admin/ui/primitives";
import { TrendArea, Donut, CategoryBars, bucketByDay, countBy, topN } from "@/admin/ui/charts";
import { supabase } from "@/integrations/supabase/client";

type Intent = {
  id: string;
  account_type: string | null;
  selected_plan_id: string | null;
  selected_plan_kind: string | null;
  primary_use_case: string | null;
  monthly_volume: string | null;
  consumed_by_user_id: string | null;
  consumed_at: string | null;
  created_at: string;
};

/** Inline loading / error / empty state used inside the shell body. */
function State({ kind, title, hint }: { kind: "loading" | "error" | "empty"; title: string; hint?: string }) {
  const Icon = kind === "loading" ? Loader2 : kind === "error" ? AlertTriangle : Inbox;
  const color = kind === "error" ? "hsl(350 90% 70%)" : "rgba(255,255,255,0.25)";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Icon className={`h-7 w-7 ${kind === "loading" ? "animate-spin" : ""}`} style={{ color }} />
      <p className="text-[15px] text-white/70">{title}</p>
      {hint && <p className="max-w-md text-[12px] text-white/40 font-mono">{hint}</p>}
    </div>
  );
}

export default function AdminOnboardingAnalyticsPage() {
  const [rows, setRows] = useState<Intent[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [signups7d, setSignups7d] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const [r1, r2, r3] = await Promise.all([
      supabase.rpc("admin_list_onboarding_intents", { p_limit: 1000 }),
      supabase.from("profiles").select("id", { head: true, count: "exact" }).eq("onboarding_completed", true),
      supabase.from("profiles").select("id", { head: true, count: "exact" }).gte("created_at", new Date(Date.now() - 7*24*60*60*1000).toISOString()),
    ]);
    if (r1.error) {
      setError(r1.error.message);
      setRows([]);
    } else {
      setRows((r1.data as Intent[]) || []);
    }
    setCompletedCount(r2.count ?? 0);
    setSignups7d(r3.count ?? 0);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const accountTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.account_type || "—"))).sort(),
    [rows],
  );

  // The intent-derived view (funnel stages 1–3 + breakdowns) is scoped by the
  // account-type filter. The "Onboarding completed" stage and the 7d signup
  // count come from a separate profiles count that can't be sliced by intent
  // account_type, so the completed stage is only shown for the unfiltered view.
  const filtered = useMemo(
    () => (accountFilter ? rows.filter((r) => (r.account_type || "—") === accountFilter) : rows),
    [rows, accountFilter],
  );

  const started = filtered.length;
  const planSelected = useMemo(() => filtered.filter(r => r.selected_plan_id || r.selected_plan_kind).length, [filtered]);
  const consumed = useMemo(() => filtered.filter(r => r.consumed_by_user_id).length, [filtered]);

  const startToPlan = started > 0 ? (planSelected / started * 100) : 0;
  const planToConsume = planSelected > 0 ? (consumed / planSelected * 100) : 0;

  // Chart series derived from the already-fetched intents (scoped by the active
  // account-type filter). Intents/day over the last 30 days, plus the account
  // and use-case breakdowns shaped for the chart kit.
  const intentsPerDay = useMemo(() => bucketByDay(filtered, (r) => r.created_at, { days: 30 }), [filtered]);
  const byUseCase = useMemo(() => topN(countBy(filtered, (r) => r.primary_use_case), 8), [filtered]);
  const byAccountType = useMemo(() => countBy(filtered, (r) => r.account_type), [filtered]);

  const funnelStages = [
    { label: "Created intent", n: started, base: started },
    { label: "Selected a plan", n: planSelected, base: started },
    { label: "Consumed (account linked)", n: consumed, base: started },
    ...(accountFilter
      ? []
      : [{ label: "Onboarding completed", n: completedCount, base: Math.max(started, completedCount) }]),
  ];

  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="OBA"
      title="Onboarding"
      italic="Funnel."
      description="Intent → plan-selected → consumed → completed across the entire onboarding flow."
      stats={[
        { label: "Signups 7d", value: signups7d, tone: "blue" },
        { label: "Intents → Plan", value: `${startToPlan.toFixed(1)}%`, tone: "emerald" },
        { label: "Plan → Consumed", value: `${planToConsume.toFixed(1)}%`, tone: "amber" },
        { label: "Onboarded Total", value: completedCount, tone: "neutral" },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {!loading && !error && rows.length > 0 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-[12px] text-white/70 transition-colors focus:bg-white/[0.1] focus:outline-none"
            >
              <option value="">Account type: all</option>
              {accountTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <DeckButton onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </DeckButton>
        </div>
      }
    >
      {error ? (
        <State kind="error" title="Couldn't load onboarding intents" hint={error} />
      ) : loading ? (
        <State kind="loading" title="Loading onboarding intents…" />
      ) : rows.length === 0 ? (
        <State kind="empty" title="No onboarding intents yet" hint="Intents appear here as users move through onboarding." />
      ) : (
        <div className="space-y-14">
          <FloatSection
            title="Funnel"
            meta={`${started} intent${started === 1 ? "" : "s"}${accountFilter ? ` · ${accountFilter}` : " tracked"}`}
          >
            <div className="space-y-4">
              {funnelStages.map((stage, i) => {
                const pct = stage.base > 0 ? stage.n / stage.base * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-[12px] mb-1.5">
                      <span className="text-white/70 font-mono">{stage.label}</span>
                      <span className="text-white/50 font-mono tabular-nums">{stage.n.toLocaleString()} · {pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-glass-hover overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0A84FF] to-[#6FB6FF]" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </FloatSection>

          <FloatSection title="Intents over time" meta="last 30 days">
            <TrendArea data={intentsPerDay} valueLabel="intents" height={240} />
          </FloatSection>

          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="By account type" meta={`${started} intents`}>
              <Donut data={byAccountType} centerLabel="intents" />
            </FloatSection>
            <FloatSection title="Top use cases" meta="top 8">
              <CategoryBars data={byUseCase} valueSuffix="intents" />
            </FloatSection>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
