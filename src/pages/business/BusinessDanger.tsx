/**
 * BusinessDanger — /business/danger
 *
 * Destructive workspace actions (transfer ownership · export · soft-delete),
 * reusing the exact data logic from WorkspaceDanger, re-skinned into the
 * borderless cover-hero BusinessPage language with a rose danger accent.
 */
import { useState } from "react";
import { ArrowRightLeft, Download, Trash2, Loader2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, StaggerList, StaggerItem } from "@/components/business/BusinessPage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

const inputCls = "h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-rose-400/30 text-[14px] text-white placeholder:text-white/35 outline-none transition w-full";

export function DangerContent() {
  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const canDelete = hasPermission("owner");
  const navigate = useNavigate();

  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const [xferOpen, setXferOpen] = useState(false);
  const [members, setMembers] = useState<Array<{ user_id: string; label: string }>>([]);
  const [chosen, setChosen] = useState<string>("");

  const openTransfer = async () => {
    if (!currentOrg) return;
    const { data: rows } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", currentOrg.id)
      .neq("role", "owner");
    const ids = (rows ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      toast.error("Invite another admin first.");
      return;
    }
    const { data: profs } = await supabase.from("profiles").select("id, display_name, full_name, email").in("id", ids);
    setMembers((profs ?? []).map((p) => ({
      user_id: p.id, label: p.display_name || p.full_name || p.email || p.id.slice(0, 8),
    })));
    setChosen("");
    setXferOpen(true);
  };

  const transfer = async () => {
    if (!currentOrg || !chosen) return;
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
        "fn_transfer_ownership", { _org_id: currentOrg.id, _new_owner: chosen },
      );
      if (error) throw error;
      toast.success("Ownership transferred");
      setXferOpen(false);
      await refresh();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Transfer failed");
    } finally { setBusy(false); }
  };

  const exportData = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const [memberRows, projects, assets, invites, audit] = await Promise.all([
        supabase.from("organization_members").select("*").eq("organization_id", currentOrg.id),
        supabase.from("movie_projects").select("id,title,status,created_at,updated_at").eq("organization_id", currentOrg.id),
        supabase.from("organization_brand_assets").select("id,kind,name,public_url,created_at").eq("organization_id", currentOrg.id),
        supabase.from("organization_invites").select("email,role,status,created_at").eq("organization_id", currentOrg.id),
        (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)("workspace_audit_events").select("*").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }).limit(1000),
      ]);
      const blob = new Blob([JSON.stringify({
        org: { id: currentOrg.id, name: currentOrg.name, slug: currentOrg.slug, plan: currentOrg.plan, exportedAt: new Date().toISOString() },
        members: memberRows.data ?? [],
        projects: projects.data ?? [],
        assets: assets.data ?? [],
        invites: invites.data ?? [],
        audit: audit.data ?? [],
      }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${currentOrg.slug || "workspace"}-export-${Date.now()}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally { setBusy(false); }
  };

  const destroy = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
        "fn_soft_delete_org", { _org_id: currentOrg.id, _confirm_name: confirm },
      );
      if (error) throw error;
      toast.success("Workspace deleted");
      try { localStorage.removeItem("smallbridges.currentOrgId"); } catch { /* ignore */ }
      navigate("/projects");
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Delete failed");
    } finally { setBusy(false); setDelOpen(false); }
  };

  const rows: Array<{ icon: typeof ArrowRightLeft; label: string; sublabel: string; cta: string; onClick: () => void; disabled: boolean; danger?: boolean; loading?: boolean }> = [
    {
      icon: ArrowRightLeft, label: "Transfer ownership",
      sublabel: "Hand the owner role to another member. You become an admin.",
      cta: "Transfer", onClick: () => void openTransfer(), disabled: !canDelete,
    },
    {
      icon: Download, label: "Export workspace data",
      sublabel: "Download every project, asset reference, member, invite and audit event as JSON.",
      cta: busy ? "Exporting…" : "Download JSON", onClick: () => void exportData(), disabled: busy, loading: busy,
    },
    {
      icon: Trash2, label: "Delete workspace",
      sublabel: "Soft-deletes the workspace immediately and queues full purge of projects + assets within 24h. Cannot be undone.",
      cta: "Delete workspace", onClick: () => setDelOpen(true), disabled: !canDelete, danger: true,
    },
  ];

  return (
    <>
      <SectionHead label="Irreversible" />
      <StaggerList className="space-y-3">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <StaggerItem key={r.label} className={cn(
              "rounded-2xl p-5 ring-1 flex flex-col sm:flex-row sm:items-center gap-4",
              r.danger ? "ring-rose-400/30 bg-rose-500/10" : "ring-white/[0.07] bg-white/[0.015]",
            )}>
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1",
                r.danger ? "text-rose-300 ring-rose-400/30 bg-rose-500/10" : "text-white/70 ring-white/10 bg-white/[0.03]",
              )}>
                <Icon className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-white/90">{r.label}</div>
                <div className="mt-1 text-[12.5px] text-white/55 font-light leading-snug">{r.sublabel}</div>
              </div>
              <button
                type="button"
                onClick={r.onClick}
                disabled={r.disabled}
                className={cn(
                  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ring-1",
                  r.danger
                    ? "text-rose-300 ring-rose-400/30 bg-rose-500/10 hover:bg-rose-500/15"
                    : "text-white/85 ring-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                {r.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />} {r.cta}
              </button>
            </StaggerItem>
          );
        })}
      </StaggerList>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="bg-[hsl(220,16%,5%)] border border-white/[0.08] text-white">
          <DialogTitle className="font-display italic text-[18px]">Delete {currentOrg?.name}?</DialogTitle>
          <DialogDescription className="text-white/55 text-[13px]">
            Type the workspace name <span className="font-mono text-white/85">{currentOrg?.name}</span> to confirm.
          </DialogDescription>
          <div className="mt-3">
            <div className={cn(TYPE_META, "text-white/45 mb-1.5")}>Confirm name</div>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setDelOpen(false)}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-[13px] text-white/85 ring-1 ring-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancel</button>
            <button type="button" onClick={() => void destroy()} disabled={busy || confirm !== currentOrg?.name}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-[13px] font-medium text-rose-300 ring-1 ring-rose-400/30 bg-rose-500/10 hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Delete forever</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={xferOpen} onOpenChange={setXferOpen}>
        <DialogContent className="bg-[hsl(220,16%,5%)] border border-white/[0.08] text-white">
          <DialogTitle className="font-display italic text-[18px]">Transfer ownership</DialogTitle>
          <DialogDescription className="text-white/55 text-[13px]">
            You'll be downgraded to admin. The new owner gains full control including billing.
          </DialogDescription>
          <div className="space-y-2 mt-3 max-h-[300px] overflow-y-auto">
            {members.map((m) => (
              <button key={m.user_id} onClick={() => setChosen(m.user_id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl ring-1 transition",
                  chosen === m.user_id ? "ring-rose-400/30 bg-rose-500/10" : "ring-white/[0.08] hover:bg-white/[0.04]",
                )}>
                <div className="text-[13px] text-white/90">{m.label}</div>
                <div className="font-mono text-[10px] text-white/75">{m.user_id.slice(0, 12)}…</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setXferOpen(false)}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-[13px] text-white/85 ring-1 ring-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancel</button>
            <button type="button" onClick={() => void transfer()} disabled={busy || !chosen}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-[13px] font-medium text-rose-300 ring-1 ring-rose-400/30 bg-rose-500/10 hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Confirm transfer</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function BusinessDanger() {
  usePageMeta({ title: "Danger zone — Business" });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Settings</span><span className="text-white/20">·</span><span>Destructive actions</span></>}
      title="Danger zone."
      subtitle="Irreversible workspace operations. All require owner role and explicit confirmation."
    >
      <DangerContent />
    </BusinessPage>
  );
}
