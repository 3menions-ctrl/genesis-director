/** Provider — aggregated cost & reliability per upstream provider. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = { service: string; operation: string; status: string; credits_charged: number; real_cost_cents: number; duration_seconds: number | null };

export default function AdminProvidersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      // paginate all to avoid 1k cap
      const all: Row[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("api_cost_logs")
          .select("service,operation,status,credits_charged,real_cost_cents,duration_seconds")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .range(offset, offset + 999);
        if (error) { toast.error(error.message); break; }
        if (!data?.length) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (!on) return;
      setRows(all);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [reload]);

  const groups = useMemo(() => {
    const m = new Map<string, { service: string; invocations: number; failures: number; cost_cents: number; credits: number; durations: number[] }>();
    for (const r of rows) {
      const k = r.service || "unknown";
      const g = m.get(k) ?? { service: k, invocations: 0, failures: 0, cost_cents: 0, credits: 0, durations: [] };
      g.invocations++;
      if (r.status !== "success" && r.status !== "completed") g.failures++;
      g.cost_cents += r.real_cost_cents || 0;
      g.credits += r.credits_charged || 0;
      if (r.duration_seconds != null) g.durations.push(r.duration_seconds);
      m.set(k, g);
    }
    return Array.from(m.values()).map(g => ({
      ...g,
      avg_duration: g.durations.length ? Math.round(g.durations.reduce((a,b)=>a+b,0)/g.durations.length) : 0,
      success_rate: g.invocations ? Math.round(((g.invocations - g.failures) / g.invocations) * 100) : 100,
    })).sort((a,b) => b.cost_cents - a.cost_cents);
  }, [rows]);

  const totalCost = groups.reduce((s,g)=>s+g.cost_cents,0) / 100;

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="PRV"
      title="Providers"
      italic="Roster."
      description="7-day aggregated spend and reliability per upstream provider."
      stats={[
        { label: "Providers", value: groups.length, tone: "blue" },
        { label: "7d Spend", value: `$${totalCost.toFixed(2)}`, tone: "amber" },
        { label: "Invocations", value: rows.length, tone: "emerald" },
        { label: "Failures", value: groups.reduce((s,g)=>s+g.failures,0), tone: "rose" },
      ]}
      actions={<Button variant="outline" size="sm" onClick={() => setReload(k=>k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</Button>}
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-right px-4 py-3">Invocations</th>
                <th className="text-right px-4 py-3">Success</th>
                <th className="text-right px-4 py-3">Avg Duration</th>
                <th className="text-right px-4 py-3">Credits</th>
                <th className="text-right px-4 py-3">Cost (7d)</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
              {!loading && groups.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No provider activity in last 7 days.</td></tr>}
              {groups.map(g => (
                <tr key={g.service} className="border-b border-white/[0.04] hover:bg-glass">
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary/80 font-mono text-[11px]">{g.service}</span></td>
                  <td className="px-4 py-3 text-right text-white/70 font-mono text-[11px] tabular-nums">{g.invocations}</td>
                  <td className={`px-4 py-3 text-right font-mono text-[11px] tabular-nums ${g.success_rate >= 95 ? "text-emerald-300" : g.success_rate >= 80 ? "text-amber-300" : "text-rose-300"}`}>{g.success_rate}%</td>
                  <td className="px-4 py-3 text-right text-white/60 font-mono text-[11px] tabular-nums">{g.avg_duration}s</td>
                  <td className="px-4 py-3 text-right text-white/60 font-mono text-[11px] tabular-nums">{g.credits}</td>
                  <td className="px-4 py-3 text-right text-amber-300/80 font-mono text-[11px] tabular-nums">${(g.cost_cents/100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSurface>
    </AdminPageShell>
  );
}