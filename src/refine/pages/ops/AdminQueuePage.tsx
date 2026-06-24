/** Queue — pending / generating video clips with optional re-poll. */
import { useEffect, useMemo, useState } from "react";
import { Clock, Lock, RefreshCw } from "lucide-react";
import { AdminPageShell, AdminSurface } from "../../components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Clip = {
  id: string;
  project_id: string;
  user_id: string;
  shot_index: number;
  status: string;
  prompt: string;
  retry_count: number | null;
  created_at: string;
  updated_at: string;
  engine: string | null;
  replicate_prediction_id: string | null;
};

export default function AdminQueuePage() {
  const [rows, setRows] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("video_clips")
        .select("id,project_id,user_id,shot_index,status,prompt,retry_count,created_at,updated_at,engine,replicate_prediction_id")
        .in("status", ["pending", "generating"])
        .order("created_at", { ascending: false })
        .limit(500);
      if (!on) return;
      if (error) toast.error(error.message);
      else setRows((data as Clip[]) || []);
      setLoading(false);
    })();
    return () => { on = false; };
  }, [reloadKey]);

  const stuck = useMemo(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    return rows.filter(r => new Date(r.updated_at).getTime() < cutoff).length;
  }, [rows]);
  const pending = useMemo(() => rows.filter(r => r.status === "pending").length, [rows]);
  const generating = useMemo(() => rows.filter(r => r.status === "generating").length, [rows]);
  const pg = usePagination(rows, 25);

  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="QUE"
      title="Queue"
      italic="Depth."
      description="Pending and generating clips across the entire pipeline."
      stats={[
        { label: "Pending", value: pending, tone: "amber" },
        { label: "Generating", value: generating, tone: "blue" },
        { label: "Stuck > 10m", value: stuck, tone: stuck > 0 ? "rose" : "neutral" },
        { label: "Total Active", value: rows.length, tone: "emerald" },
      ]}
      actions={
        <Button variant="outline" size="sm" onClick={() => setReloadKey(k => k + 1)} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      <AdminSurface className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7ebf3] text-[10px] uppercase tracking-[0.18em] text-[#9aa4b8] font-mono">
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Engine</th>
                <th className="text-left px-4 py-3">Shot</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Retries</th>
                <th className="text-left px-4 py-3">Replicate ID</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#9aa4b8]">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#9aa4b8]">Queue is empty.</td></tr>}
              {pg.slice.map((r) => {
                const ageMin = (Date.now() - new Date(r.updated_at).getTime()) / 60000;
                const isStuck = ageMin > 10;
                return (
                  <tr key={r.id} className="border-b border-[#e7ebf3] hover:bg-glass">
                    <td className="px-4 py-3 text-[#5d6a82] font-mono text-[11px] whitespace-nowrap"><Clock className="w-3 h-3 inline mr-1 opacity-50" />{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isStuck ? "destructive" : r.status === "generating" ? "default" : "secondary"} className="font-mono text-[10px]">
                        {r.status}{isStuck ? " · stuck" : ""}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#5d6a82] font-mono text-[11px]">{r.engine ?? "—"}</td>
                    <td className="px-4 py-3 text-[#5d6a82] font-mono text-[11px]">#{r.shot_index}</td>
                    <td className="px-4 py-3 text-[#9aa4b8] font-mono text-[11px]">{r.project_id.slice(0,8)}…</td>
                    <td className="px-4 py-3 text-[#5d6a82] font-mono text-[11px]">{r.retry_count ?? 0}</td>
                    <td className="px-4 py-3 text-[#9aa4b8] font-mono text-[11px]">{r.replicate_prediction_id ? <><Lock className="w-3 h-3 inline mr-1 opacity-50" />{r.replicate_prediction_id.slice(0,12)}…</> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="p-4 border-t border-[#e7ebf3]" />
      </AdminSurface>
    </AdminPageShell>
  );
}