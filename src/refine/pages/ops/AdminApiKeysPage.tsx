/** Org API keys — global admin view across workspaces. Revoke only; creation lives in WorkspaceApi. */
import { Ban, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";

interface KeyRow extends AdminRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  organization_id: string;
  organizations?: { name: string } | null;
}

export default function AdminApiKeysPage() {
  return (
    <AdminPageShell
      eyebrow="13 // SYSTEM"
      code="API"
      title="API"
      italic="Keys."
      description="Workspace API keys across every org. Revoke compromised keys instantly."
    >
      <AdminConsoleV2<KeyRow>
        intro="Every workspace-scoped API key, masked. Revoke a key and the next call from any client using it fails immediately."
        query={{
          table: "org_api_keys",
          select: "id, name, prefix, scopes, last_used_at, revoked_at, created_at, organization_id, organizations(name)",
          orderBy: { column: "created_at", ascending: false },
        }}
        searchKey="name"
        searchPlaceholder="Search by key name…"
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Active", value: (r) => r.filter((x) => !(x as KeyRow).revoked_at).length, tone: "emerald" },
          { label: "Revoked", value: (r) => r.filter((x) => (x as KeyRow).revoked_at).length, tone: "rose" },
          { label: "Never used", value: (r) => r.filter((x) => !(x as KeyRow).last_used_at).length, tone: "amber" },
        ]}
        columns={[
          { key: "name", label: "Name", width: "220px" },
          { key: "organizations", label: "Workspace", width: "180px",
            render: (_, row) => row.organizations?.name ?? "—" },
          { key: "prefix", label: "Prefix", width: "160px",
            render: (v) => <code className="font-mono text-[11px] text-[#5d6a82]">{String(v)}…</code> },
          { key: "last_used_at", label: "Last used", width: "170px", hideOnMobile: true },
          { key: "revoked_at", label: "Status", width: "120px",
            render: (v) => v
              ? <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-300">Revoked</span>
              : <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">Active</span> },
        ]}
        actions={[
          { label: "Revoke", icon: Ban, variant: "destructive", confirm: "Revoke this API key? Any service using it will fail.",
            show: (r) => !r.revoked_at,
            onRun: async (r) => {
              const { error } = await supabase
                .from("org_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", r.id);
              if (error) throw error;
            }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Permanently delete this revoked key record?",
            show: (r) => !!r.revoked_at,
            onRun: async (r) => {
              const { error } = await supabase.from("org_api_keys").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        emptyTitle="No API keys issued"
        emptyDescription="Workspace operators generate keys from /workspace/api — they appear here for global oversight."
      />
    </AdminPageShell>
  );
}
