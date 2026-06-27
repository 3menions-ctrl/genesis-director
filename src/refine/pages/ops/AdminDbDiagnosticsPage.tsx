/**
 * AdminDbDiagnosticsPage — live database diagnostics: total size, connections,
 * active queries, and per-table rows / size / dead-tuples / scan stats.
 * From admin_db_diagnostics() (reads pg_stat_user_tables, pg_stat_activity).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL } from "@/admin/ui/primitives";

interface Tbl { table: string; rows: number; dead_rows: number; bytes: number; seq_scans: number; idx_scans: number }
interface Diag { db_size_bytes: number; connections: number; active_queries: number; tables: Tbl[] }
function fmtBytes(n: number) { if (!n) return "0 B"; const u = ["B", "KB", "MB", "GB", "TB"]; const i = Math.floor(Math.log(n) / Math.log(1024)); return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`; }

export default function AdminDbDiagnosticsPage() {
  const [d, setD] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { (async () => { const { data, error } = await supabase.rpc("admin_db_diagnostics" as never, {} as never); if (error) setErr(error.message); else setD((data as Diag) ?? null); setLoading(false); })(); }, []);

  return (
    <AdminPageShell
      eyebrow="System // database"
      code="DBX"
      title="Database"
      italic="diagnostics."
      description="Live storage, connections and per-table health — straight from Postgres internals."
      stats={[
        { label: "DB size", value: fmtBytes(d?.db_size_bytes ?? 0), tone: "blue" },
        { label: "Connections", value: d?.connections ?? 0, tone: "neutral" },
        { label: "Active queries", value: d?.active_queries ?? 0, tone: "amber" },
        { label: "Tables", value: d?.tables?.length ?? 0, tone: "emerald" },
      ]}
    >
      <FloatSection title="Tables" meta="by size">
        {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
          : err ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-rose-300/80">Diagnostics unavailable — {err}<div className="mt-2 normal-case tracking-normal text-white/40">Stats below could not be loaded; this is a backend error, not an empty database.</div></div>
          : <FloatTable
              columns={[
                { key: "table", label: "Table" },
                { key: "rows", label: "Rows", align: "right" },
                { key: "bytes", label: "Size", align: "right" },
                { key: "dead", label: "Dead", align: "right" },
                { key: "seq", label: "Seq scans", align: "right" },
                { key: "idx", label: "Idx scans", align: "right" },
              ]}
              rows={(d?.tables ?? []).map((t) => ({
                _key: t.table,
                table: <span className="font-mono text-[12.5px] text-white/85">{t.table}</span>,
                rows: <span style={{ color: ACCENT_HSL }}>{Number(t.rows).toLocaleString()}</span>,
                bytes: <span className="text-white/70">{fmtBytes(Number(t.bytes))}</span>,
                dead: <span className="text-white/45">{Number(t.dead_rows).toLocaleString()}</span>,
                seq: <span className="text-white/45">{Number(t.seq_scans).toLocaleString()}</span>,
                idx: <span className="text-white/45">{Number(t.idx_scans).toLocaleString()}</span>,
              }))}
              empty="No table stats."
            />}
      </FloatSection>
    </AdminPageShell>
  );
}
