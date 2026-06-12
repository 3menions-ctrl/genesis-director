/** Reconcile — Stripe ↔ Supabase reconciliation job history. */
import { useState } from "react";
import { GitCompare, Play, Loader2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReconcileRow extends AdminRow {
  id: string;
  job_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  scanned: number;
  matched: number;
  discrepancies: number;
  report: unknown;
}

const STATUS_TONE = { in_progress: "text-[#6FB6FF]", success: "text-emerald-300", partial: "text-amber-300", failed: "text-rose-300" } as const;

export default function AdminReconcilePage() {
  const [starting, setStarting] = useState(false);

  const startJob = async () => {
    const jobType = prompt(
      "Job type to run:",
      "stripe_subscriptions",
    );
    if (!jobType) return;
    setStarting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reconcile_jobs").insert({
      job_type: jobType, triggered_by: user?.id,
    });
    setStarting(false);
    if (error) toast.error(error.message);
    else toast.success("Reconcile job queued");
  };

  return (
    <AdminPageShell
      eyebrow="09 // MONEY"
      code="REC"
      title="Reconcile"
      italic="& Audit."
      description="Stripe ↔ Supabase reconciliation jobs — scanned, matched, discrepancies."
    >
      <AdminConsoleV2<ReconcileRow>
        intro="Reconcile the subscription/payment ledger between Stripe and your DB. Discrepancies > 0 means manual review needed."
        query={{ table: "reconcile_jobs", orderBy: { column: "started_at", ascending: false }, limit: 50 }}
        filters={[
          { key: "status", label: "Status", type: "select", options: [
            { value: "in_progress", label: "In progress" }, { value: "success", label: "Success" },
            { value: "partial", label: "Partial" }, { value: "failed", label: "Failed" }] },
        ]}
        signals={[
          { label: "Total jobs", value: (r) => r.length, tone: "blue" },
          { label: "Discrepancies",
            value: (r) => r.reduce((s, x) => s + ((x as ReconcileRow).discrepancies ?? 0), 0).toLocaleString(),
            tone: "rose" },
          { label: "Records scanned",
            value: (r) => r.reduce((s, x) => s + ((x as ReconcileRow).scanned ?? 0), 0).toLocaleString(),
            tone: "neutral" },
          { label: "Last run",
            value: (r) => r[0] ? new Date((r[0] as ReconcileRow).started_at).toLocaleString() : "—",
            tone: "emerald" },
        ]}
        columns={[
          { key: "job_type", label: "Job", width: "200px",
            render: (v) => <code className="font-mono text-[12px] text-[#6FB6FF]">{String(v)}</code> },
          { key: "started_at", label: "Started", width: "180px" },
          { key: "scanned", label: "Scanned", width: "100px", align: "right" },
          { key: "matched", label: "Matched", width: "100px", align: "right" },
          { key: "discrepancies", label: "Discrepancies", width: "120px", align: "right",
            render: (v) => v as number > 0
              ? <span className="text-rose-300">{(v as number).toLocaleString()}</span>
              : <span className="text-white/55">0</span> },
          { key: "status", label: "Status", width: "120px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${STATUS_TONE[v as keyof typeof STATUS_TONE]}`}>{String(v).replace("_", " ")}</span> },
        ]}
        primaryCta={{ label: starting ? "Queueing…" : "Run reconcile", onClick: startJob }}
        emptyTitle="No reconcile jobs yet"
        emptyDescription="Queue a job to audit your Stripe ↔ Supabase ledger. Periodic runs catch drift before customers do."
      />
    </AdminPageShell>
  );
}
