/** Admin webhooks — every workspace webhook endpoint across the platform. */
import { Webhook, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";

interface WebhookRow extends AdminRow {
  id: string;
  organization_id: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  last_delivered_at: string | null;
  failure_count: number;
  created_at: string;
  organizations?: { name: string } | null;
}

export default function AdminWebhooksPage() {
  return (
    <AdminPageShell
      eyebrow="13 // SYSTEM"
      code="WHK"
      title="Webhooks"
      italic="Registry."
      description="Every workspace webhook endpoint, with delivery health and admin pause/delete."
    >
      <AdminConsoleV2<WebhookRow>
        intro="Workspace operators configure their own endpoints; this is the global view for platform-wide oversight."
        query={{
          table: "webhook_endpoints",
          select: "id, organization_id, url, description, events, active, last_delivered_at, failure_count, created_at, organizations(name)",
          orderBy: { column: "created_at", ascending: false },
        }}
        searchKey="url"
        filters={[
          { key: "active", label: "Active", type: "select", options: [
            { value: "true", label: "Active" }, { value: "false", label: "Paused" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Active", value: (r) => r.filter((x) => (x as WebhookRow).active).length, tone: "emerald" },
          { label: "Failing", value: (r) => r.filter((x) => (x as WebhookRow).failure_count > 0).length, tone: "rose" },
          { label: "Never delivered", value: (r) => r.filter((x) => !(x as WebhookRow).last_delivered_at).length, tone: "amber" },
        ]}
        columns={[
          { key: "url", label: "Endpoint",
            render: (v) => <code className="font-mono text-[11px] text-white/80">{String(v)}</code> },
          { key: "organizations", label: "Workspace", width: "180px",
            render: (_, row) => row.organizations?.name ?? "—" },
          { key: "events", label: "Events", width: "200px",
            render: (v) => Array.isArray(v) && v.length
              ? <span className="text-[11px] text-white/55">{v.slice(0, 2).join(", ")}{v.length > 2 ? ` +${v.length - 2}` : ""}</span>
              : "—" },
          { key: "failure_count", label: "Failures", width: "100px", align: "right",
            render: (v) => v as number > 0
              ? <span className="text-rose-300">{v as number}</span>
              : <span className="text-white/55">0</span> },
          { key: "last_delivered_at", label: "Last sent", width: "180px", hideOnMobile: true },
          { key: "active", label: "Status", width: "100px" },
        ]}
        actions={[
          { label: "Toggle", icon: Power,
            onRun: async (r) => {
              const { error } = await supabase.from("webhook_endpoints").update({ active: !r.active }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this endpoint? Future events won't be delivered.",
            onRun: async (r) => {
              const { error } = await supabase.from("webhook_endpoints").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        emptyTitle="No webhook endpoints registered"
        emptyDescription="Workspaces configure endpoints at /workspace/api — they appear here for platform oversight."
      />
    </AdminPageShell>
  );
}
