/** GDPR requests — handle data export, deletion, rectification. */
import { Shield, Check, X, Clock } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";

interface GdprRow extends AdminRow {
  id: string;
  user_id: string | null;
  email: string;
  kind: string;
  status: string;
  payload_url: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_TONE = { pending: "text-amber-300", in_progress: "text-[#6FB6FF]", completed: "text-emerald-300", rejected: "text-rose-300" } as const;

export default function AdminGdprPage() {
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="GDP"
      title="GDPR"
      italic="Requests."
      description="Data export, deletion, rectification, and restriction requests from users."
    >
      <AdminConsoleV2<GdprRow>
        intro="Statutory data requests. The clock starts at created_at — most jurisdictions require a 30-day response window."
        query={{ table: "gdpr_requests", orderBy: { column: "created_at", ascending: false } }}
        searchKey="email"
        filters={[
          { key: "status", label: "Status", type: "select", options: [
            { value: "pending", label: "Pending" }, { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" }, { value: "rejected", label: "Rejected" }] },
          { key: "kind", label: "Kind", type: "select", options: [
            { value: "export", label: "Export" }, { value: "delete", label: "Delete" },
            { value: "rectification", label: "Rectification" }, { value: "restriction", label: "Restriction" }] },
        ]}
        signals={[
          { label: "Pending", value: (r) => r.filter((x) => (x as GdprRow).status === "pending").length, tone: "amber" },
          { label: "In progress", value: (r) => r.filter((x) => (x as GdprRow).status === "in_progress").length, tone: "blue" },
          { label: "Overdue (>30d)",
            value: (r) => r.filter((x) => {
              const g = x as GdprRow;
              if (g.status === "completed" || g.status === "rejected") return false;
              return Date.now() - new Date(g.created_at).getTime() > 30 * 86400_000;
            }).length, tone: "rose" },
          { label: "Completed", value: (r) => r.filter((x) => (x as GdprRow).status === "completed").length, tone: "emerald" },
        ]}
        columns={[
          { key: "email", label: "Email", width: "240px" },
          { key: "kind", label: "Kind", width: "120px",
            render: (v) => <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#6FB6FF]">{String(v)}</span> },
          { key: "status", label: "Status", width: "130px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${STATUS_TONE[v as keyof typeof STATUS_TONE]}`}>{String(v).replace("_", " ")}</span> },
          { key: "created_at", label: "Received", width: "170px" },
          { key: "completed_at", label: "Closed", width: "170px", hideOnMobile: true },
          { key: "notes", label: "Notes", hideOnMobile: true },
        ]}
        actions={[
          { label: "Start", icon: Clock, show: (r) => r.status === "pending",
            onRun: async (r) => {
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase.from("gdpr_requests")
                .update({ status: "in_progress", handled_by: user?.id }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Complete", icon: Check, show: (r) => r.status === "pending" || r.status === "in_progress",
            onRun: async (r) => {
              const note = prompt("Optional completion note (e.g. export URL, deletion summary):", r.notes ?? "");
              const { error } = await supabase.from("gdpr_requests")
                .update({ status: "completed", completed_at: new Date().toISOString(), notes: note }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Reject", icon: X, variant: "destructive", show: (r) => r.status === "pending" || r.status === "in_progress",
            onRun: async (r) => {
              const reason = prompt("Reason for rejecting? (will be logged in notes)");
              if (!reason) return;
              const { error } = await supabase.from("gdpr_requests")
                .update({ status: "rejected", completed_at: new Date().toISOString(), notes: reason }).eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        emptyTitle="No GDPR requests pending"
        emptyDescription="When users submit data requests, they appear here for processing."
      />
    </AdminPageShell>
  );
}
