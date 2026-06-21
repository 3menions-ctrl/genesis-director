/**
 * AdminDbDiagnosticsPage — live database diagnostics: total size, connections,
 * active queries, and per-table rows / size / dead-tuples / scan stats.
 * From admin_db_diagnostics() (reads pg_stat_user_tables, pg_stat_activity).
 */
import { useEffect, useMemo, useState } from "react";
import { Database, Plug, Activity, Table as TableIcon } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, KpiTile, ACCENT_HSL } from "@/admin/ui/primitives";
import { DataTable } from "@/admin/ui/DataTable";

interface Tbl { table: string; rows: number; dead_rows: number; bytes: number; seq_scans: number; idx_scans: number }
interface Diag { db_size_bytes: number; connections: number; active_queries: number; tables: Tbl[] }
function fmtBytes(n: number) { if (!n) return "0 B"; const u = ["B", "KB", "MB", "GB", "TB"]; const i = Math.floor(Math.log(n) / Math.log(1024)); return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`; }
const col = createColumnHelper<Tbl>();

export default function AdminDbDiagnosticsPage() {
  const [d, setD] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.rpc("admin_db_diagnostics" as never, {} as never); setD((data as Diag) ?? null); setLoading(false); })(); }, []);

  const cols = useMemo(() => [
    col.accessor("table", { header: "Table", cell: (c) => <span className="font-mono text-[12.5px] text-white/85">{c.getValue()}</span> }),
    col.accessor("rows", { header: "Rows", cell: (c) => <span className="tabular-nums" style={{ color: ACCENT_HSL }}>{Number(c.getValue()).toLocaleString()}</span> }),
    col.accessor("bytes", { header: "Size", cell: (c) => <span className="tabular-nums text-white/70">{fmtBytes(Number(c.getValue()))}</span> }),
    col.accessor("dead_rows", { header: "Dead", cell: (c) => <span className="tabular-nums text-white/45">{Number(c.getValue()).toLocaleString()}</span> }),
    col.accessor("seq_scans", { header: "Seq scans", cell: (c) => <span className="tabular-nums text-white/45">{Number(c.getValue()).toLocaleString()}</span> }),
    col.accessor("idx_scans", { header: "Idx scans", cell: (c) => <span className="tabular-nums text-white/45">{Number(c.getValue()).toLocaleString()}</span> }),
  ], []);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <AdminPageHeader eyebrow="System" title={<>Database <span className="italic">diagnostics</span>.</>} sub="Live storage, connections and per-table health — straight from Postgres internals." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile index={0} label="DB size" value={fmtBytes(d?.db_size_bytes ?? 0)} icon={Database} accentNumber />
        <KpiTile index={1} label="Connections" value={d?.connections ?? 0} icon={Plug} />
        <KpiTile index={2} label="Active queries" value={d?.active_queries ?? 0} icon={Activity} />
        <KpiTile index={3} label="Tables" value={d?.tables?.length ?? 0} icon={TableIcon} />
      </div>

      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">Tables · by size</div>
      {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
        : <DataTable columns={cols as never} data={d?.tables ?? []} dense empty="No table stats." />}
    </div>
  );
}
