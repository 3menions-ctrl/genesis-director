/** Audit — real wiring against admin_audit_log via admin_get_audit_logs RPC. */
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Filter, RefreshCw, Search } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, DeckButton } from "@/admin/ui/primitives";
import { TrendArea, CategoryBars, Donut, countBy, bucketByDay, topN } from "@/admin/ui/charts";
import { Input } from "@/components/ui/input";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
};

export default function AdminAuditLogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_get_audit_logs", { p_limit: 1000, p_offset: 0 });
    if (error) toast.error(error.message);
    else setRows((data as Row[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r =>
      r.action?.toLowerCase().includes(needle) ||
      r.target_type?.toLowerCase().includes(needle) ||
      r.target_id?.toLowerCase().includes(needle) ||
      JSON.stringify(r.details || {}).toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    return rows.filter(r => new Date(r.created_at) >= start).length;
  }, [rows]);
  const operators = useMemo(() => new Set(rows.map(r => r.admin_id)).size, [rows]);

  // Charts derive from the same 1000 audit rows already fetched via RPC.
  const perDay = useMemo(() => bucketByDay(rows, r => r.created_at, { days: 14 }), [rows]);
  const byAction = useMemo(() => topN(countBy(rows, r => r.action), 10), [rows]);
  const byTarget = useMemo(() => countBy(rows, r => r.target_type), [rows]);

  const pg = usePagination(filtered, 25);

  function exportCsv() {
    const header = "created_at,admin_id,action,target_type,target_id,details\n";
    const body = filtered.map(r => [r.created_at, r.admin_id, r.action, r.target_type ?? "", r.target_id ?? "", JSON.stringify(r.details ?? {}).replace(/"/g, '""')].map(v => `"${String(v)}"`).join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="AUD"
      title="Audit"
      italic="Log."
      description="Append-only trail of every privileged action — who, what, when, and what changed."
      stats={[
        { label: "Events Today", value: today, tone: "blue" },
        { label: "Operators", value: operators, tone: "neutral" },
        { label: "Total Events", value: rows.length, tone: "amber" },
        { label: "Showing", value: filtered.length, tone: "emerald" },
      ]}
      actions={
        <>
          <DeckButton onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </DeckButton>
          <DeckButton onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export CSV
          </DeckButton>
        </>
      }
    >
      {rows.length > 0 && (
        <div className="mb-14 grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
          <FloatSection title="Activity" meta="last 14 days">
            <TrendArea data={perDay} valueLabel="events" />
          </FloatSection>
          <FloatSection title="By action" meta="top 10">
            <CategoryBars data={byAction} valueSuffix="events" />
          </FloatSection>
          {byTarget.length > 0 && (
            <FloatSection title="By target type" meta={`${rows.length} events`}>
              <Donut data={byTarget} centerLabel="events" />
            </FloatSection>
          )}
        </div>
      )}

      <FloatSection
        title="Events"
        meta={`${filtered.length} shown`}
        actions={
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-white/40" />
            <Input
              placeholder="Filter by action, target, or details…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-transparent border-white/10 text-white placeholder:text-white/30 h-8 w-56"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-[9.5px] uppercase tracking-[0.2em] text-white/38 font-mono">
                <th className="text-left pb-3 pr-4">When</th>
                <th className="text-left pb-3 pr-4">Action</th>
                <th className="text-left pb-3 pr-4">Target</th>
                <th className="text-left pb-3 pr-4">Admin</th>
                <th className="text-left pb-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">Loading…</td></tr>
              )}
              {!loading && pg.slice.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">No audit events.</td></tr>
              )}
              {pg.slice.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.015]">
                  <td className="py-3.5 pr-4 text-white/70 font-mono text-[12px] whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-3.5 pr-4"><span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary/80 font-mono text-[11px]">{r.action}</span></td>
                  <td className="py-3.5 pr-4 text-white/60 font-mono text-[11px]">{r.target_type ?? "—"}{r.target_id ? ` / ${r.target_id.slice(0,8)}…` : ""}</td>
                  <td className="py-3.5 pr-4 text-white/40 font-mono text-[11px]">{r.admin_id.slice(0,8)}…</td>
                  <td className="py-3.5 text-white/50 font-mono text-[11px] max-w-[420px] truncate">{JSON.stringify(r.details ?? {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="pt-4" />
      </FloatSection>
    </AdminPageShell>
  );
}
