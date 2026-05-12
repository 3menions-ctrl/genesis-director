import { useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, CmdButton, Pill, Field, DataInput } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

type ReportKey = 'usage_summary' | 'member_burn' | 'project_ledger' | 'spend_events';

const REPORTS: { key: ReportKey; label: string; sub: string }[] = [
  { key: 'usage_summary', label: 'Monthly usage summary', sub: 'Members · projects · credit burn' },
  { key: 'member_burn',   label: 'Per-member burn',       sub: 'Credits consumed by each member' },
  { key: 'spend_events',  label: 'Spend ledger',          sub: 'Every credit deduction with reason' },
  { key: 'project_ledger',label: 'Project ledger',        sub: 'Every project + status + cost' },
];

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function WorkspaceReports() {
  const { currentOrg } = useWorkspace();
  const [range, setRange] = useState(defaultRange());
  const [busy, setBusy] = useState<string | null>(null);

  const exportReport = async (key: ReportKey, label: string) => {
    if (!currentOrg) return;
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke('export-workspace-report', {
        body: { organization_id: currentOrg.id, report: key, start: range.start, end: range.end },
      });
      if (error) throw error;
      const csv = (data as any)?.csv;
      if (!csv) throw new Error('No data');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentOrg.slug}-${key}-${range.start}_to_${range.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} exported`);
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <WorkspacePage
      icon={FileSpreadsheet}
      eyebrow="Optimize · Export"
      title="Reports"
      description="Exportable summaries for finance, operations and leadership review."
    >
    <Surface>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <Field label="From">
          <DataInput type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </Field>
        <Field label="To">
          <DataInput type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </Field>
      </div>
    </Surface>
      <Surface padded={false}>
        <ul className="divide-y divide-[hsl(220,14%,12%)]">
          {REPORTS.map((r) => (
          <li key={r.key} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[hsl(220,14%,92%)]">{r.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,50%)] mt-1">{r.sub}</div>
              </div>
            <Pill tone="neutral">CSV</Pill>
            <CmdButton variant="ghost" disabled={busy === r.key} onClick={() => exportReport(r.key, r.label)}>
              <Download className="w-3 h-3" /> {busy === r.key ? 'Exporting…' : 'Export'}
            </CmdButton>
            </li>
          ))}
        </ul>
      </Surface>
    </WorkspacePage>
  );
}