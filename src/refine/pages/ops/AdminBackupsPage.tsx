/** Backups log — read-only history of automated db backups. */
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";

interface BackupRow extends AdminRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  status: string;
  notes: string | null;
}

const formatBytes = (b: number | null): string => {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(1)} ${u[i]}`;
};

const formatDuration = (start: string, end: string | null): string => {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
};

export default function AdminBackupsPage() {
  return (
    <AdminPageShell
      eyebrow="01 // OBSERVABILITY"
      code="BKP"
      title="Backups"
      italic="Log."
      description="Automated database backup history — size, duration, status, storage location."
    >
      <AdminConsoleV2<BackupRow>
        intro="Every backup attempt with its outcome. Reconcile against your recovery RPO/RTO targets."
        query={{ table: "db_backups_log", orderBy: { column: "started_at", ascending: false }, limit: 50 }}
        filters={[
          { key: "status", label: "Status", type: "select", options: [
            { value: "success", label: "Success" }, { value: "failed", label: "Failed" },
            { value: "in_progress", label: "In progress" }, { value: "retained", label: "Retained" },
            { value: "expired", label: "Expired" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Successful", value: (r) => r.filter((x) => (x as BackupRow).status === "success").length, tone: "emerald" },
          { label: "Failed", value: (r) => r.filter((x) => (x as BackupRow).status === "failed").length, tone: "rose" },
          { label: "Total size",
            value: (r) => formatBytes(r.reduce((s, x) => s + ((x as BackupRow).size_bytes ?? 0), 0)), tone: "neutral" },
        ]}
        columns={[
          { key: "started_at", label: "Started", width: "180px" },
          { key: "completed_at", label: "Duration", width: "100px",
            render: (_, row) => formatDuration(row.started_at, row.completed_at) },
          { key: "size_bytes", label: "Size", width: "100px", align: "right",
            render: (v) => formatBytes(v as number | null) },
          { key: "status", label: "Status", width: "120px" },
          { key: "storage_path", label: "Storage path", hideOnMobile: true,
            render: (v) => v ? <code className="font-mono text-[11px] text-white/55">{String(v)}</code> : "—" },
          { key: "notes", label: "Notes", hideOnMobile: true },
        ]}
        emptyTitle="No backups recorded"
        emptyDescription="Configure your daily backup job to write to db_backups_log — entries will appear here."
      />
    </AdminPageShell>
  );
}
