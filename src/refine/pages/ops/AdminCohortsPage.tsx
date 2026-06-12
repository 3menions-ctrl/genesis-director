/** Cohorts — aggregate signup_analytics by day for retention insight. */
import { useEffect, useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";

interface SignupDay {
  signup_date: string;
  signups: number;
  activations: number;
  paid_conversions: number;
}

export default function AdminCohortsPage() {
  const [rows, setRows] = useState<SignupDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const { data } = await supabase
        .from("signup_analytics")
        .select("created_at, activated_at, converted_at")
        .gte("created_at", since)
        .limit(5000);
      const byDay = new Map<string, SignupDay>();
      for (const r of (data as Array<{ created_at: string; activated_at?: string; converted_at?: string }>) ?? []) {
        const d = r.created_at.slice(0, 10);
        const row = byDay.get(d) ?? { signup_date: d, signups: 0, activations: 0, paid_conversions: 0 };
        row.signups++;
        if (r.activated_at) row.activations++;
        if (r.converted_at) row.paid_conversions++;
        byDay.set(d, row);
      }
      setRows([...byDay.values()].sort((a, b) => b.signup_date.localeCompare(a.signup_date)));
      setLoading(false);
    })();
  }, []);

  const totalSignups = rows.reduce((s, r) => s + r.signups, 0);
  const totalActivations = rows.reduce((s, r) => s + r.activations, 0);
  const totalConversions = rows.reduce((s, r) => s + r.paid_conversions, 0);

  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="COH"
      title="Cohorts"
      italic="& Retention."
      description="Daily signup cohort with activation and paid-conversion outcomes (last 90 days)."
      stats={[
        { label: "Signups (90d)", value: totalSignups, tone: "blue" },
        { label: "Activated", value: totalActivations, tone: "emerald" },
        { label: "Paid", value: totalConversions, tone: "amber" },
        { label: "Activation rate",
          value: totalSignups ? `${Math.round((totalActivations / totalSignups) * 100)}%` : "—",
          tone: "neutral" },
      ]}
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <AdminSectionLabel label="Daily cohort" meta={`${rows.length} days`} />
        </div>
        {loading ? (
          <div className="p-16 flex items-center justify-center gap-3 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-7 h-7 mx-auto mb-3 text-white/20" />
            <p className="text-[15px] text-white/70 mb-2">No signup data yet</p>
            <p className="text-[12px] text-white/40 max-w-md mx-auto">When users sign up, their cohort metrics appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Day</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Signups</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Activated</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Paid</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Activation %</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Paid %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.signup_date} className="border-b border-white/[0.03] hover:bg-glass">
                    <td className="px-5 py-3 text-white/75 font-mono text-[12px]">{r.signup_date}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-white/85">{r.signups.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-300">{r.activations}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-amber-300">{r.paid_conversions}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-white/55">{r.signups ? `${Math.round((r.activations / r.signups) * 100)}%` : "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-white/55">{r.signups ? `${Math.round((r.paid_conversions / r.signups) * 100)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSurface>
    </AdminPageShell>
  );
}
