/** Onboarding Analytics — funnel rollup from onboarding_intents + profiles. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function AdminOnboardingAnalyticsPage() {
  const [rows, setRows] = useState<Intent[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [signups7d, setSignups7d] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.rpc("admin_list_onboarding_intents", { p_limit: 1000 }),
      supabase.from("profiles").select("id", { head: true, count: "exact" }).eq("onboarding_completed", true),
      supabase.from("profiles").select("id", { head: true, count: "exact" }).gte("created_at", new Date(Date.now() - 7*24*60*60*1000).toISOString()),
    ]);
    if (r1.error) toast.error(r1.error.message);
    else setRows((r1.data as Intent[]) || []);
    setCompletedCount(r2.count ?? 0);
    setSignups7d(r3.count ?? 0);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const started = rows.length;
  const planSelected = useMemo(() => rows.filter(r => r.selected_plan_id || r.selected_plan_kind).length, [rows]);
  const consumed = useMemo(() => rows.filter(r => r.consumed_by_user_id).length, [rows]);

  const startToPlan = started > 0 ? (planSelected / started * 100) : 0;
  const planToConsume = planSelected > 0 ? (consumed / planSelected * 100) : 0;

  const byUseCase = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.primary_use_case || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a,b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const byAccountType = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.account_type || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a,b) => b[1] - a[1]);
  }, [rows]);

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
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      <div className="space-y-8">
        <AdminSurface>
          <AdminSectionLabel label="Funnel" meta={`${started} intents tracked`} />
          <div className="space-y-4">
            {[
              { label: "Created intent", n: started, base: started },
              { label: "Selected a plan", n: planSelected, base: started },
              { label: "Consumed (account linked)", n: consumed, base: started },
              { label: "Onboarding completed", n: completedCount, base: Math.max(started, completedCount) },
            ].map((stage, i) => {
              const pct = stage.base > 0 ? stage.n / stage.base * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-[#0c1426] font-mono">{stage.label}</span>
                    <span className="text-[#5d6a82] font-mono tabular-nums">{stage.n.toLocaleString()} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-glass-hover overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#0A84FF] to-[#6FB6FF]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminSurface>

        <div className="grid md:grid-cols-2 gap-6">
          <AdminSurface>
            <AdminSectionLabel label="By Account Type" />
            <table className="w-full text-sm">
              <tbody>
                {byAccountType.length === 0 && <tr><td className="text-[#9aa4b8] py-4">No data.</td></tr>}
                {byAccountType.map(([k, v]) => (
                  <tr key={k} className="border-b border-[#e7ebf3]">
                    <td className="py-2 text-[#0c1426] font-mono text-[12px]">{k}</td>
                    <td className="py-2 text-right text-primary/80 font-mono tabular-nums text-[12px]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminSurface>
          <AdminSurface>
            <AdminSectionLabel label="Top Use Cases" />
            <table className="w-full text-sm">
              <tbody>
                {byUseCase.length === 0 && <tr><td className="text-[#9aa4b8] py-4">No data.</td></tr>}
                {byUseCase.map(([k, v]) => (
                  <tr key={k} className="border-b border-[#e7ebf3]">
                    <td className="py-2 text-[#0c1426] font-mono text-[12px]">{k}</td>
                    <td className="py-2 text-right text-primary/80 font-mono tabular-nums text-[12px]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminSurface>
        </div>
      </div>
    </AdminPageShell>
  );
}
