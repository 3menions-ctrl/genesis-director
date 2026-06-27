/** Admin team — every user holding admin role, with promote/demote flow. */
import { useState } from "react";
import { UserCog, UserPlus, UserMinus } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface RoleRow extends AdminRow {
  id: string;
  user_id: string;
  role: string;
  granted_at: string | null;
  profiles?: { email: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export default function AdminTeamPage() {
  const [promoting, setPromoting] = useState(false);
  const { user } = useAuth();
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="TEM"
      title="Admin"
      italic="Team."
      description="Operators with admin role — promote new admins, demote when responsibilities shift."
    >
      <AdminConsoleV2<RoleRow>
        intro="Every account holding a role in user_roles. Note: console access is currently gated by the is_admin check (super-admin), NOT by these rows — promoting here records the role but does not by itself grant console access until per-role gating ships. Promotion writes a row to user_roles; demotion deletes it."
        query={{
          table: "user_roles",
          select: "id, user_id, role, granted_at, profiles(email, display_name, avatar_url)",
          orderBy: { column: "granted_at", ascending: false },
        }}
        filters={[
          { key: "role", label: "Role", type: "select", options: [
            { value: "admin", label: "Admin" }, { value: "moderator", label: "Moderator" }, { value: "support", label: "Support" }] },
        ]}
        signals={[
          { label: "Admins", value: (r) => r.filter((x) => (x as RoleRow).role === "admin").length, tone: "rose" },
          { label: "Moderators", value: (r) => r.filter((x) => (x as RoleRow).role === "moderator").length, tone: "amber" },
          { label: "Support", value: (r) => r.filter((x) => (x as RoleRow).role === "support").length, tone: "blue" },
          { label: "Total operators", value: (r) => new Set(r.map((x) => (x as RoleRow).user_id)).size, tone: "emerald" },
        ]}
        columns={[
          { key: "profiles", label: "Operator", width: "320px",
            render: (_, row) => (
              <div className="flex items-center gap-3">
                {row.profiles?.avatar_url
                  ? <img src={row.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full border border-white/[0.06]" />
                  : <div className="w-8 h-8 rounded-full bg-glass-hover border border-white/[0.06]" />}
                <div>
                  <div className="text-white/90 text-[13px]">{row.profiles?.display_name || row.profiles?.email || row.user_id.slice(0,8)}</div>
                  {row.profiles?.email && <div className="text-white/45 text-[11px]">{row.profiles.email}</div>}
                </div>
              </div>
            )},
          { key: "role", label: "Role", width: "140px",
            render: (v) => <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary/80">{String(v)}</span> },
          { key: "granted_at", label: "Granted", width: "180px" },
        ]}
        actions={[
          { label: "Demote", icon: UserMinus, variant: "destructive",
            confirm: "Remove this role assignment? They keep their account, but lose this role.",
            onRun: async (r) => {
              // Guard self-demotion: deleting your own role row risks locking
              // yourself out (recoverable only via direct DB access).
              if (user && r.user_id === user.id) {
                throw new Error("You cannot demote your own account — ask another operator or use the database.");
              }
              const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Promote user", onClick: () => setPromoting(true) }}
        emptyTitle="No role assignments yet"
        emptyDescription="Promote a user to admin to populate this list."
      >
        {promoting && <PromoteDialog onClose={() => setPromoting(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function PromoteDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) { toast.error("Email required"); return; }
    setBusy(true);
    // Resolve id by email via is_admin-gated RPC (profiles.email is no longer
    // client-selectable — cross-tenant containment).
    const { data: foundId, error: pErr } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message: string } | null }>
    )("admin_find_user_by_email", { p_email: email.trim().toLowerCase() });
    if (pErr || !foundId) {
      setBusy(false);
      toast.error("No user with that email");
      return;
    }
    const { error } = await supabase.from("user_roles").insert({
      user_id: foundId, role,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${email} recorded as ${role} — note: console access is gated by is_admin, not this role yet.`);
    window.dispatchEvent(new Event("admin-console-refresh"));
    onClose();
  };

  return (
    <AdminDialog title="Promote user" icon={UserPlus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Promote">
      <AdminField label="User email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="ops@example.com" /></AdminField>
      <AdminField label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          <option value="admin">Admin</option><option value="moderator">Moderator</option><option value="support">Support</option>
        </select>
      </AdminField>
    </AdminDialog>
  );
}
