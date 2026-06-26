/** Admin webhooks — every workspace webhook endpoint across the platform. */
import { Webhook, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { FloatSection, CYAN, AMBER } from "@/admin/ui/primitives";
import { Donut, MiniHistogram } from "@/admin/ui/charts";
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
        charts={(rows) => {
          const active = rows.filter((x) => (x as WebhookRow).active).length;
          const paused = rows.length - active;
          // Failure-count distribution bucketed into discrete bands.
          const bands = [
            { label: "0", lo: 0, hi: 0 },
            { label: "1–2", lo: 1, hi: 2 },
            { label: "3–5", lo: 3, hi: 5 },
            { label: "6–10", lo: 6, hi: 10 },
            { label: "10+", lo: 11, hi: Infinity },
          ];
          const failureHist = bands.map((b) => ({
            label: b.label,
            value: rows.filter((x) => {
              const f = (x as WebhookRow).failure_count ?? 0;
              return f >= b.lo && f <= b.hi;
            }).length,
          }));
          return (
            <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
              <FloatSection title="Status" meta={`${rows.length} endpoints`}>
                <Donut data={[{ key: "Active", value: active, color: CYAN }, { key: "Paused", value: paused, color: AMBER }]} centerLabel="endpoints" />
              </FloatSection>
              <FloatSection title="Failure count" meta="endpoints per band">
                <MiniHistogram data={failureHist} valueLabel="endpoints" />
              </FloatSection>
            </div>
          );
        }}
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
