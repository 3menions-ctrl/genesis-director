/** Queue — pending / generating video clips with optional re-poll. */
import { useEffect, useMemo, useState } from "react";
import { Clock, Lock, RefreshCw } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, DeckButton, StatusPill, AMBER, CYAN } from "@/admin/ui/primitives";
import { ListPagination, usePagination } from "@/components/ui/list-pagination";
import { Donut, MiniHistogram, CategoryBars, countBy } from "@/admin/ui/charts";
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

  const statusSplit = useMemo(
    () => [{ key: "pending", value: pending, color: AMBER }, { key: "generating", value: generating, color: CYAN }],
    [pending, generating],
  );
  const retryDist = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // 0,1,2,3,4+
    for (const r of rows) {
      const n = r.retry_count ?? 0;
      buckets[Math.min(n, 4)]++;
    }
    return buckets.map((value, i) => ({ label: i === 4 ? "4+" : String(i), value }));
  }, [rows]);
  const byEngine = useMemo(() => countBy(rows, r => r.engine), [rows]);

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
        <DeckButton onClick={() => setReloadKey(k => k + 1)} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </DeckButton>
      }
    >
      {!loading && rows.length > 0 && (
        <div className="mb-14 grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
          <FloatSection title="Queue by status" meta={`${rows.length} active`}>
            <Donut data={statusSplit} centerLabel="clips" />
          </FloatSection>
          <FloatSection title="Retry distribution" meta="attempts per clip">
            <MiniHistogram data={retryDist} valueLabel="clips" />
          </FloatSection>
          <FloatSection title="By engine" meta="active clips" className="lg:col-span-2">
            <CategoryBars data={byEngine} valueSuffix="clips" />
          </FloatSection>
        </div>
      )}

      <FloatSection title="Active clips" meta="pending + generating">
        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">Loading…</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <FloatTable
                columns={[
                  { key: "created", label: "Created" },
                  { key: "status", label: "Status" },
                  { key: "engine", label: "Engine" },
                  { key: "shot", label: "Shot" },
                  { key: "project", label: "Project" },
                  { key: "retries", label: "Retries" },
                  { key: "replicate", label: "Replicate ID" },
                ]}
                rows={pg.slice.map((r) => {
                  const ageMin = (Date.now() - new Date(r.updated_at).getTime()) / 60000;
                  const isStuck = ageMin > 10;
                  return {
                    _key: r.id,
                    created: <span className="text-white/60 font-mono text-[11px] whitespace-nowrap"><Clock className="w-3 h-3 inline mr-1 opacity-50" />{new Date(r.created_at).toLocaleString()}</span>,
                    status: (
                      <StatusPill tone={isStuck ? "danger" : r.status === "generating" ? "accent" : "neutral"}>
                        {r.status}{isStuck ? " · stuck" : ""}
                      </StatusPill>
                    ),
                    engine: <span className="text-white/60 font-mono text-[11px]">{r.engine ?? "—"}</span>,
                    shot: <span className="text-white/60 font-mono text-[11px]">#{r.shot_index}</span>,
                    project: <span className="text-white/40 font-mono text-[11px]">{r.project_id.slice(0,8)}…</span>,
                    retries: <span className="text-white/60 font-mono text-[11px]">{r.retry_count ?? 0}</span>,
                    replicate: <span className="text-white/40 font-mono text-[11px]">{r.replicate_prediction_id ? <><Lock className="w-3 h-3 inline mr-1 opacity-50" />{r.replicate_prediction_id.slice(0,12)}…</> : "—"}</span>,
                  };
                })}
                empty="Queue is empty."
              />
            </div>
            <ListPagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} className="pt-4" />
          </>
        )}
      </FloatSection>
    </AdminPageShell>
  );
}