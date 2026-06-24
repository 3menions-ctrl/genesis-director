/** Roles — every user_role assignment with revoke action. */
import { ShieldCheck, UserMinus } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";

interface RoleRow extends AdminRow {
  id: string;
  user_id: string;
  role: string;
  granted_at: string | null;
  profiles?: { email: string | null; display_name: string | null } | null;
}

const ROLE_TONE: Record<string, string> = {
  admin: "text-rose-300", moderator: "text-amber-300", support: "text-primary/80", user: "text-[#0c1426]",
};

export default function AdminRolesPage() {
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="RLS"
      title="Roles"
      italic="& RBAC."
      description="Every user → role assignment. Revoke instantly; promotion happens through the admin promote flow."
    >
      <AdminConsoleV2<RoleRow>
        intro="Roles drive policy. Revoking a role takes effect on the next request — sessions don't carry it."
        query={{
          table: "user_roles",
          select: "id, user_id, role, granted_at, profiles(email, display_name)",
          orderBy: { column: "granted_at", ascending: false },
        }}
        signals={[
          { label: "Total assignments", value: (r) => r.length, tone: "blue" },
          { label: "Admins", value: (r) => r.filter((x) => (x as RoleRow).role === "admin").length, tone: "rose" },
          { label: "Moderators", value: (r) => r.filter((x) => (x as RoleRow).role === "moderator").length, tone: "amber" },
          { label: "Other roles", value: (r) => r.filter((x) => !["admin","moderator"].includes((x as RoleRow).role)).length, tone: "neutral" },
        ]}
        columns={[
          { key: "profiles", label: "User", width: "300px",
            render: (_, row) => row.profiles?.email
              ? <span><span className="text-[#0c1426]">{row.profiles.email}</span>{row.profiles.display_name ? <span className="text-[#5d6a82] ml-2">· {row.profiles.display_name}</span> : null}</span>
              : <code className="font-mono text-[11px] text-[#5d6a82]">{row.user_id}</code> },
          { key: "role", label: "Role", width: "140px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${ROLE_TONE[String(v)] ?? "text-[#5d6a82]"}`}>{String(v)}</span> },
          { key: "granted_at", label: "Granted", width: "180px" },
        ]}
        actions={[
          { label: "Revoke", icon: UserMinus, variant: "destructive",
            confirm: "Revoke this role? The user loses any access that depends on it.",
            onRun: async (r) => {
              const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        emptyTitle="No role assignments"
        emptyDescription="Promote users to admin/moderator/support via the team page — assignments will appear here."
      />
    </AdminPageShell>
  );
}
