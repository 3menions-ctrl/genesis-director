import { useState } from 'react';
import { AlertOctagon, ArrowRightLeft, Download, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, CmdButton, DataInput, Field } from '@/components/workspace/command-ui';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function WorkspaceDanger() {
  const { currentOrg, hasPermission, organizations, refresh } = useWorkspace();
  const canDelete = hasPermission('owner');
  const navigate = useNavigate();

  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const [xferOpen, setXferOpen] = useState(false);
  const [members, setMembers] = useState<Array<{ user_id: string; label: string }>>([]);
  const [chosen, setChosen] = useState<string>('');

  const openTransfer = async () => {
    if (!currentOrg) return;
    const { data: rows } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', currentOrg.id)
      .neq('role', 'owner');
    const ids = (rows ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      toast.error('Invite another admin first.');
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id, display_name, full_name, email').in('id', ids);
    setMembers((profs ?? []).map((p: any) => ({
      user_id: p.id, label: p.display_name || p.full_name || p.email || p.id.slice(0, 8),
    })));
    setChosen('');
    setXferOpen(true);
  };

  const transfer = async () => {
    if (!currentOrg || !chosen) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('fn_transfer_ownership', { _org_id: currentOrg.id, _new_owner: chosen } as any);
      if (error) throw error;
      toast.success('Ownership transferred');
      setXferOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Transfer failed');
    } finally { setBusy(false); }
  };

  const exportData = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const [members, projects, assets, invites, audit] = await Promise.all([
        supabase.from('organization_members').select('*').eq('organization_id', currentOrg.id),
        supabase.from('movie_projects').select('id,title,status,created_at,updated_at').eq('organization_id', currentOrg.id),
        supabase.from('organization_brand_assets').select('id,kind,name,public_url,created_at').eq('organization_id', currentOrg.id),
        supabase.from('organization_invites').select('email,role,status,created_at').eq('organization_id', currentOrg.id),
        supabase.from('workspace_audit_events' as any).select('*').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }).limit(1000),
      ]);
      const blob = new Blob([JSON.stringify({
        org: { id: currentOrg.id, name: currentOrg.name, slug: currentOrg.slug, plan: currentOrg.plan, exportedAt: new Date().toISOString() },
        members: members.data ?? [],
        projects: projects.data ?? [],
        assets: assets.data ?? [],
        invites: invites.data ?? [],
        audit: audit.data ?? [],
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${currentOrg.slug || 'workspace'}-export-${Date.now()}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e: any) {
      toast.error('Export failed');
    } finally { setBusy(false); }
  };

  const destroy = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('fn_soft_delete_org', { _org_id: currentOrg.id, _confirm_name: confirm } as any);
      if (error) throw error;
      toast.success('Workspace deleted');
      try { localStorage.removeItem('apex.currentOrgId'); } catch {}
      navigate('/projects');
    } catch (e: any) {
      toast.error(e?.message ?? 'Delete failed');
    } finally { setBusy(false); setDelOpen(false); }
  };

  return (
    <WorkspacePage icon={AlertOctagon} eyebrow="Settings · Irreversible" title="Danger zone"
      description="Destructive workspace actions. All require owner role and explicit confirmation.">
      <div className="space-y-4">
        <Section icon={ArrowRightLeft} label="Transfer ownership" sublabel="Hand the owner role to another member. You become an admin."
          action={<CmdButton variant="ghost" onClick={openTransfer} disabled={!canDelete}>Transfer</CmdButton>}><div /></Section>
        <Section icon={Download} label="Export workspace data" sublabel="Download every project, asset reference, member, invite and audit event as JSON."
          action={<CmdButton variant="ghost" onClick={exportData} disabled={busy}><Download className="w-3 h-3" /> {busy ? 'Exporting…' : 'Download JSON'}</CmdButton>}><div /></Section>
        <Section icon={Trash2} label="Delete workspace" sublabel="Soft-deletes the workspace immediately and queues full purge of projects + assets within 24h. Cannot be undone."
          action={<CmdButton variant="danger" onClick={() => setDelOpen(true)} disabled={!canDelete}><Trash2 className="w-3 h-3" /> Delete workspace</CmdButton>}><div /></Section>
      </div>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="bg-[hsl(220,16%,5%)] border border-white/[0.08] text-white">
          <DialogTitle className="font-display text-[18px]">Delete {currentOrg?.name}?</DialogTitle>
          <DialogDescription className="text-white/55 text-[13px]">
            Type the workspace name <span className="font-mono text-white/85">{currentOrg?.name}</span> to confirm.
          </DialogDescription>
          <Field label="Confirm name">
            <DataInput value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 mt-4">
            <CmdButton variant="ghost" onClick={() => setDelOpen(false)}>Cancel</CmdButton>
            <CmdButton variant="danger" onClick={destroy} disabled={busy || confirm !== currentOrg?.name}>Delete forever</CmdButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={xferOpen} onOpenChange={setXferOpen}>
        <DialogContent className="bg-[hsl(220,16%,5%)] border border-white/[0.08] text-white">
          <DialogTitle className="font-display text-[18px]">Transfer ownership</DialogTitle>
          <DialogDescription className="text-white/55 text-[13px]">
            You'll be downgraded to admin. The new owner gains full control including billing.
          </DialogDescription>
          <div className="space-y-2 mt-3 max-h-[300px] overflow-y-auto">
            {members.map((m) => (
              <button key={m.user_id} onClick={() => setChosen(m.user_id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                  chosen === m.user_id ? 'border-[hsl(215,100%,55%)] bg-[hsl(215,100%,55%)]/10' : 'border-white/[0.08] hover:bg-white/[0.04]'
                }`}>
                <div className="text-[13px] text-white/90">{m.label}</div>
                <div className="font-mono text-[10px] text-white/75">{m.user_id.slice(0, 12)}…</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <CmdButton variant="ghost" onClick={() => setXferOpen(false)}>Cancel</CmdButton>
            <CmdButton variant="danger" onClick={transfer} disabled={busy || !chosen}>Confirm transfer</CmdButton>
          </div>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  );
}
