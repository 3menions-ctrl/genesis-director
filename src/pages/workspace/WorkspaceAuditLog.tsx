import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, Pill } from '@/components/workspace/command-ui';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';

import { usePageMeta } from '@/hooks/usePageMeta';
type LedgerKind = 'credit' | 'workspace';
interface LedgerRow {
  id: string;
  kind: LedgerKind;
  ts: string;
  label: string;
  detail: string;
  amount: number | null;
  category: string | null;
}

export default function WorkspaceAuditLog() {
  usePageMeta({ title: "Workspace Audit Log — Small Bridges" });

  const { currentOrg } = useWorkspace();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | LedgerKind>('all');

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 1) Workspace events (members, settings, approvals, api keys, …)
      const wsPromise = supabase
        .from('workspace_audit_events')
        .select('id, action, category, target_kind, target_id, actor_name, metadata, created_at')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(150);

      // 2) Credit ledger – joined via project ids that belong to the org
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, title')
        .eq('organization_id', currentOrg.id);
      const projIds = (projects ?? []).map(p => p.id);
      const titleMap = new Map<string, string>((projects ?? []).map(p => [p.id, p.title]));

      const creditPromise = projIds.length
        ? supabase
            .from('credit_transactions')
            .select('id, amount, transaction_type, description, project_id, created_at')
            .in('project_id', projIds)
            .order('created_at', { ascending: false })
            .limit(150)
        : Promise.resolve({ data: [] as any[] });

      const [{ data: wsEvents }, { data: credits }] = await Promise.all([wsPromise, creditPromise as any]);
      if (cancelled) return;

      const merged: LedgerRow[] = [
        ...(wsEvents ?? []).map((e: any) => ({
          id: `ws-${e.id}`,
          kind: 'workspace' as const,
          ts: e.created_at,
          label: e.action,
          detail: e.target_kind ? `${e.target_kind}${e.target_id ? ` · ${String(e.target_id).slice(0, 8)}` : ''}` : (e.actor_name ?? ''),
          amount: null,
          category: e.category,
        })),
        ...(credits ?? []).map((c: any) => ({
          id: `cr-${c.id}`,
          kind: 'credit' as const,
          ts: c.created_at,
          label: c.transaction_type,
          detail: c.description ?? titleMap.get(c.project_id) ?? '',
          amount: c.amount,
          category: 'credits',
        })),
      ].sort((a, b) => b.ts.localeCompare(a.ts));

      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentOrg?.id]);

  const visible = filter === 'all' ? rows : rows.filter(r => r.kind === filter);
  const { slice, page, setPage, totalPages, total, pageSize } = usePagination(visible, 25);

  return (
    <WorkspacePage
      icon={ScrollText}
      eyebrow="Govern · Trail"
      title="Audit log"
      description="Immutable record of every workspace action — credit movement, member changes and content events."
      actions={
        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-glass p-0.5">
          {(['all','workspace','credit'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 h-7 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] transition ${filter === f ? 'bg-[hsl(215,100%,45%)]/25 text-[hsl(215,100%,82%)]' : 'text-white/45 hover:text-white/80'}`}>
              {f}
            </button>
          ))}
        </div>
      }
    >
      <Surface padded={false}>
        {loading ? (
          <div className="px-5 py-12 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">Reading ledger…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No events yet"
            body="Audit events will appear here as members create projects, spend credits and manage the team."
          />
        ) : (
          <>
          <ul className="divide-y divide-white/[0.05]">
            {slice.map(e => (
              <li key={e.id} className="px-5 py-3 flex items-center gap-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 w-40 shrink-0">
                  {new Date(e.ts).toLocaleString()}
                </div>
                <Pill tone={e.kind === 'credit' ? (e.amount && e.amount < 0 ? 'amber' : 'good') : 'neutral'}>
                  {e.label}
                </Pill>
                <div className="flex-1 text-[12px] text-white/85 truncate">
                  {e.detail || '—'}
                </div>
                {e.amount !== null && (
                  <div className="font-mono text-[12px] tabular-nums text-white/95">
                    {e.amount > 0 ? '+' : ''}{e.amount}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5">
            <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="events" />
          </div>
          </>
        )}
      </Surface>
    </WorkspacePage>
  );
}