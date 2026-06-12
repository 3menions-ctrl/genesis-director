import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Clock, Film } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, Pill, CmdButton, DataTextarea } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

interface ApprovalRow {
  id: string;
  project_id: string;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  reviewer_note: string | null;
  submitted_by: string;
  reviewed_at: string | null;
  created_at: string;
  project_title?: string;
  project_thumb?: string | null;
}

export default function WorkspaceApprovals() {
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canReview = hasPermission('reviewer');
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('approval_requests')
      .select('id, project_id, status, note, reviewer_note, submitted_by, reviewed_at, created_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map(r => r.project_id);
    const projMap: Record<string, { title: string; thumb: string | null }> = {};
    if (ids.length > 0) {
      const { data: projs } = await supabase
        .from('movie_projects')
        .select('id, title, thumbnail_url')
        .in('id', ids);
      for (const p of projs ?? []) projMap[p.id] = { title: p.title, thumb: p.thumbnail_url };
    }
    setRows((data ?? []).map(r => ({
      ...(r as any),
      project_title: projMap[r.project_id]?.title ?? 'Untitled production',
      project_thumb: projMap[r.project_id]?.thumb ?? null,
    })));
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row: ApprovalRow, status: 'approved' | 'rejected') => {
    if (!user || !canReview) return;
    setBusyId(row.id);
    const { error } = await supabase
      .from('approval_requests')
      .update({
        status,
        reviewer_id: user.id,
        reviewer_note: noteDraft[row.id] ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === 'approved' ? 'Approved' : 'Rejected');
    // Best-effort audit trail
    if (currentOrg) {
      await supabase.from('workspace_audit_events').insert({
        organization_id: currentOrg.id,
        actor_id: user.id,
        category: 'approvals',
        action: status === 'approved' ? 'approval.approved' : 'approval.rejected',
        target_kind: 'project',
        target_id: row.project_id,
        metadata: { request_id: row.id },
      });
    }
    load();
  };

  const pending = rows.filter(r => r.status === 'pending');
  const closed = rows.filter(r => r.status !== 'pending');

  return (
    <WorkspacePage
      icon={CheckCircle2}
      eyebrow="Govern · Review"
      title="Approvals"
      description="Productions awaiting reviewer sign-off before publish or export."
      actions={<Pill tone={pending.length > 0 ? 'amber' : 'neutral'}>QUEUE · {pending.length}</Pill>}
    >
      {loading ? (
        <Surface><div className="px-2 py-10 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">Loading queue…</div></Surface>
      ) : pending.length === 0 && closed.length === 0 ? (
        <Surface>
          <EmptyState icon={CheckCircle2} title="Nothing pending review"
            body="When a Producer submits a production for sign-off, reviewers will see it here with approve/reject controls." />
        </Surface>
      ) : (
        <>
          {pending.length > 0 && (
            <Surface padded={false}>
              <ul className="divide-y divide-white/[0.05]">
                {pending.map(row => (
                  <li key={row.id} className="p-5 flex flex-col md:flex-row gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-xl border border-white/[0.06] bg-glass flex items-center justify-center overflow-hidden shrink-0">
                        {row.project_thumb
                          ? <img src={row.project_thumb} alt="" className="w-full h-full object-cover" />
                          : <Film className="w-4 h-4 text-white/65" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] text-white/95 font-light truncate">{row.project_title}</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/75 mt-1">
                          Submitted {new Date(row.created_at).toLocaleString()}
                        </div>
                        {row.note && <div className="text-[12px] text-white/55 mt-2 italic">"{row.note}"</div>}
                        {canReview && (
                          <DataTextarea
                            placeholder="Reviewer note (optional)…"
                            rows={2}
                            value={noteDraft[row.id] ?? ''}
                            onChange={(e) => setNoteDraft(s => ({ ...s, [row.id]: e.target.value }))}
                            className="mt-3 max-w-xl"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2 md:w-auto shrink-0 items-end">
                      <CmdButton variant="primary" disabled={!canReview || busyId === row.id} onClick={() => decide(row, 'approved')}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </CmdButton>
                      <CmdButton variant="danger" disabled={!canReview || busyId === row.id} onClick={() => decide(row, 'rejected')}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </CmdButton>
                    </div>
                  </li>
                ))}
              </ul>
            </Surface>
          )}

          {closed.length > 0 && (
            <Surface padded={false} className="mt-6">
              <div className="px-5 py-3 border-b border-white/[0.05] font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">
                Recent decisions
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {closed.slice(0, 50).map(row => (
                  <li key={row.id} className="px-5 py-3 flex items-center gap-4">
                    <Clock className="w-3.5 h-3.5 text-white/65 shrink-0" />
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 w-44 shrink-0">
                      {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : '—'}
                    </div>
                    <Pill tone={row.status === 'approved' ? 'good' : 'bad'}>{row.status}</Pill>
                    <div className="flex-1 truncate text-[12px] text-white/80">{row.project_title}</div>
                    {row.reviewer_note && <div className="hidden md:block text-[12px] text-white/45 italic truncate max-w-xs">"{row.reviewer_note}"</div>}
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </>
      )}
    </WorkspacePage>
  );
}