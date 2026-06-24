/** Edge — aggregated invocation/cost telemetry from api_cost_logs. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton, StatusPill } from "@/admin/ui/primitives";
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
      actions={<DeckButton onClick={() => setReload(k => k+1)} disabled={loading}><RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading?"animate-spin":""}`} /> Refresh</DeckButton>}
    >
      <FloatSection title="Invocations" meta="last 24h">
        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">Loading…</div>
        ) : (
          <>
            <FloatTable
              columns={[
                { key: "when", label: "When" },
                { key: "service", label: "Service" },
                { key: "operation", label: "Operation" },
                { key: "status", label: "Status" },
                { key: "duration", label: "Duration", align: "right" },
                { key: "credits", label: "Credits", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
              ]}
              rows={pg.slice.map(r => {
                const ok = r.status === "success" || r.status === "completed";
                return {
                  _key: r.id,
                  when: <span className="text-white/60 font-mono text-[11px] whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</span>,
                  service: <span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary/80 font-mono text-[11px]">{r.service}</span>,
                  operation: <span className="text-white/70 font-mono text-[11px]">{r.operation}</span>,
                  status: <StatusPill tone={ok ? "neutral" : "danger"}>{r.status}</StatusPill>,
                  duration: <span className="text-white/60 font-mono text-[11px] tabular-nums">{r.duration_seconds ?? "—"}{r.duration_seconds != null ? "s" : ""}</span>,
                  credits: <span className="text-white/60 font-mono text-[11px] tabular-nums">{r.credits_charged}</span>,
                  cost: <span className="text-amber-300/80 font-mono text-[11px] tabular-nums">${(r.real_cost_cents/100).toFixed(3)}</span>,
                };
              })}
              empty="No edge invocations in last 24h."
            />
            <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="pt-4" />
          </>
        )}
      </FloatSection>
    </AdminPageShell>
  );
}