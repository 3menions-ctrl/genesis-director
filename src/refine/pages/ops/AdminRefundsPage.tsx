/** Refund requests — approve, deny, mark as processed. */
import { Receipt, Check, X, CreditCard } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";

interface RefundRow extends AdminRow {
  id: string;
  user_id: string | null;
  charge_id: string | null;
  amount_cents: number;
  currency: string;
  reason: string | null;
  status: string;
  stripe_refund_id: string | null;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

const STATUS_TONE = { pending: "text-amber-300", approved: "text-primary/80", denied: "text-rose-300", processed: "text-emerald-300" } as const;

const formatCurrency = (cents: number, ccy: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy.toUpperCase() }).format(cents / 100);

export default function AdminRefundsPage() {
  return (
    <AdminPageShell
      eyebrow="09 // MONEY"
      code="REF"
      title="Refunds"
      italic="Queue."
      description="Customer refund requests — approve, deny, or mark as processed against Stripe."
    >
      <AdminConsoleV2<RefundRow>
        intro="Refund queue. Approving here marks intent — actually issuing the Stripe refund is the next step (use the Stripe dashboard or your refund handler)."
        query={{ table: "refund_requests", orderBy: { column: "created_at", ascending: false } }}
        searchKey="charge_id"
        searchPlaceholder="Search by charge id…"
        filters={[
          { key: "status", label: "Status", type: "select", options: [
            { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" },
            { value: "denied", label: "Denied" }, { value: "processed", label: "Processed" }] },
        ]}
        signals={[
          { label: "Pending", value: (r) => r.filter((x) => (x as RefundRow).status === "pending").length, tone: "amber" },
          { label: "Total owed",
            value: (r) => {
              const cents = r
                .filter((x) => (x as RefundRow).status === "approved")
                .reduce((s, x) => s + (x as RefundRow).amount_cents, 0);
              return formatCurrency(cents, "usd");
            }, tone: "rose" },
          { label: "Processed this month",
            value: (r) => r.filter((x) => {
              const ref = x as RefundRow;
              return ref.status === "processed" && ref.processed_at &&
                new Date(ref.processed_at).getMonth() === new Date().getMonth();
            }).length, tone: "emerald" },
          { label: "Denied", value: (r) => r.filter((x) => (x as RefundRow).status === "denied").length, tone: "neutral" },
        ]}
        columns={[
          { key: "charge_id", label: "Charge", width: "200px",
            render: (v) => v
              ? <code className="font-mono text-[11px] text-[#0c1426]">{String(v)}</code>
              : <span className="text-[#9aa4b8]">—</span> },
          { key: "amount_cents", label: "Amount", width: "120px", align: "right",
            render: (_, row) => formatCurrency(row.amount_cents, row.currency) },
          { key: "reason", label: "Reason" },
          { key: "status", label: "Status", width: "120px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${STATUS_TONE[v as keyof typeof STATUS_TONE]}`}>{String(v)}</span> },
          { key: "created_at", label: "Requested", width: "170px", hideOnMobile: true },
        ]}
        actions={[
          { label: "Approve", icon: Check, show: (r) => r.status === "pending",
            onRun: async (r) => {
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase.from("refund_requests")
                .update({ status: "approved", handled_by: user?.id }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Deny", icon: X, variant: "destructive", show: (r) => r.status === "pending",
            onRun: async (r) => {
              const reason = prompt("Reason for denying? (saved to notes)");
              if (!reason) return;
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase.from("refund_requests")
                .update({ status: "denied", notes: reason, handled_by: user?.id }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Mark processed", icon: CreditCard, show: (r) => r.status === "approved",
            onRun: async (r) => {
              const stripeId = prompt("Stripe refund ID (re_...):");
              if (!stripeId) return;
              const { error } = await supabase.from("refund_requests")
                .update({ status: "processed", processed_at: new Date().toISOString(), stripe_refund_id: stripeId })
                .eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        emptyTitle="No refund requests"
        emptyDescription="When customers submit refund requests, they appear here for review."
      />
    </AdminPageShell>
  );
}
