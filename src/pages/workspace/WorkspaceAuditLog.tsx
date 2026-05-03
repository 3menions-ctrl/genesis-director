import { useEffect, useState } from 'react';
import { ScrollText, Filter } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, Pill } from '@/components/workspace/command-ui';

interface CreditEvent {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default function WorkspaceAuditLog() {
  const { currentOrg } = useWorkspace();
  const [events, setEvents] = useState<CreditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('credit_transactions')
        .select('id,amount,type,description,created_at')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!cancelled) {
        setEvents((data ?? []) as CreditEvent[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentOrg?.id]);

  return (
    <WorkspacePage
      icon={ScrollText}
      eyebrow="Govern · Trail"
      title="Audit log"
      description="Immutable record of every workspace action — credit movement, member changes and content events."
      actions={
        <button className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,55%)] hover:text-[hsl(35,12%,90%)]">
          <Filter className="w-3 h-3" /> Filter
        </button>
      }
    >
      <Surface padded={false}>
        {loading ? (
          <div className="px-5 py-12 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(35,8%,45%)]">Reading ledger…</div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No events yet"
            body="Audit events will appear here as members create projects, spend credits and manage the team."
          />
        ) : (
          <ul className="divide-y divide-[hsl(35,12%,12%)]">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3 flex items-center gap-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,50%)] w-32 shrink-0">
                  {new Date(e.created_at).toLocaleString()}
                </div>
                <Pill tone={e.amount < 0 ? 'amber' : 'good'}>{e.type}</Pill>
                <div className="flex-1 text-[12px] text-[hsl(35,12%,90%)] truncate">
                  {e.description || '—'}
                </div>
                <div className="font-mono text-[12px] tabular-nums text-[hsl(35,12%,96%)]">
                  {e.amount > 0 ? '+' : ''}{e.amount}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </WorkspacePage>
  );
}