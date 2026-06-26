/**
 * AdminDbDiagnosticsPage — live database diagnostics: total size, connections,
 * active queries, and per-table rows / size / dead-tuples / scan stats.
 * From admin_db_diagnostics() (reads pg_stat_user_tables, pg_stat_activity).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageShell } from "../../components/AdminPageShell";
import { FloatSection, FloatTable, ACCENT_HSL } from "@/admin/ui/primitives";
import { CategoryBars, topN } from "@/admin/ui/charts";

interface Tbl { table: string; rows: number; dead_rows: number; bytes: number; seq_scans: number; idx_scans: number }
interface Diag { db_size_bytes: number; connections: number; active_queries: number; tables: Tbl[] }
function fmtBytes(n: number) { if (!n) return "0 B"; const u = ["B", "KB", "MB", "GB", "TB"]; const i = Math.floor(Math.log(n) / Math.log(1024)); return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`; }

export default function AdminDbDiagnosticsPage() {
  const [d, setD] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.rpc("admin_db_diagnostics" as never, {} as never); setD((data as Diag) ?? null); setLoading(false); })(); }, []);

  const tables = d?.tables ?? [];
  const sizeByTable = useMemo(() => topN([...tables].map(t => ({ key: t.table, value: Number(t.bytes || 0) })).sort((a, b) => b.value - a.value), 12), [tables]);
  const rowsByTable = useMemo(() => topN([...tables].map(t => ({ key: t.table, value: Number(t.rows || 0) })).sort((a, b) => b.value - a.value), 12), [tables]);

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
      {!loading && tables.length > 0 && (
        <div className="mb-14">
          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="Top tables by size" meta="on-disk bytes">
              <CategoryBars data={sizeByTable} formatValue={fmtBytes} />
            </FloatSection>
            <FloatSection title="Top tables by rows" meta="live tuples">
              <CategoryBars data={rowsByTable} valueSuffix="rows" />
            </FloatSection>
          </div>
          <p className="mt-3 text-[11px] text-white/35 italic">point-in-time snapshot — current Postgres internals, not a historical trend.</p>
        </div>
      )}

      <FloatSection title="Tables" meta="by size">
        {loading ? <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">Loading…</div>
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
