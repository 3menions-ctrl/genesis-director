/** Edge — aggregated invocation/cost telemetry from api_cost_logs. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = { id: string; created_at: string; service: string; operation: string; status: string; credits_charged: number; real_cost_cents: number; duration_seconds: number | null; user_id: string | null };

export default function AdminEdgeLogsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("api_cost_logs")
        .select("id,created_at,service,operation,status,credits_charged,real_cost_cents,duration_seconds,user_id")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!on) return;
      if (error) toast.error(error.message);
      else setRows((data as Row[]) || []);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [reload]);

  const failed = useMemo(() => rows.filter(r => r.status !== "success" && r.status !== "completed").length, [rows]);
  const totalCost = useMemo(() => rows.reduce((s, r) => s + (r.real_cost_cents || 0), 0) / 100, [rows]);
  const avgDuration = useMemo(() => {
    const d = rows.filter(r => r.duration_seconds != null);
    return d.length ? Math.round(d.reduce((s, r) => s + (r.duration_seconds || 0), 0) / d.length) : 0;
  }, [rows]);
  const pg = usePagination(rows, 25);

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="EDG"
      title="Edge"
      italic="Telemetry."
      description="Last 24 hours of edge-function and provider invocations with cost and latency."
      stats={[
        { label: "Invocations (24h)", value: rows.length, tone: "blue" },
        { label: "Failures", value: failed, tone: failed > 0 ? "rose" : "neutral" },
        { label: "Spend", value: `$${totalCost.toFixed(2)}`, tone: "amber" },
        { label: "Avg Duration", value: `${avgDuration}s`, tone: "emerald" },
      ]}
      actions={<Button variant="outline" size="sm" onClick={() => setReload(k => k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</Button>}
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Operation</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Duration</th>
                <th className="text-right px-4 py-3">Credits</th>
                <th className="text-right px-4 py-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">No edge invocations in last 24h.</td></tr>}
              {pg.slice.map(r => {
                const ok = r.status === "success" || r.status === "completed";
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/60 font-mono text-[11px] whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded border border-[#0A84FF]/30 bg-[#0A84FF]/5 text-[#6FB6FF] font-mono text-[11px]">{r.service}</span></td>
                    <td className="px-4 py-3 text-white/70 font-mono text-[11px]">{r.operation}</td>
                    <td className="px-4 py-3"><Badge variant={ok ? "secondary" : "destructive"} className="font-mono text-[10px]">{r.status}</Badge></td>
                    <td className="px-4 py-3 text-right text-white/60 font-mono text-[11px] tabular-nums">{r.duration_seconds ?? "—"}{r.duration_seconds != null ? "s" : ""}</td>
                    <td className="px-4 py-3 text-right text-white/60 font-mono text-[11px] tabular-nums">{r.credits_charged}</td>
                    <td className="px-4 py-3 text-right text-amber-300/80 font-mono text-[11px] tabular-nums">${(r.real_cost_cents/100).toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="p-4 border-t border-white/[0.06]" />
      </AdminSurface>
    </AdminPageShell>
  );
}