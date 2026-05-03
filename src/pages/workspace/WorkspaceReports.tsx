import { FileSpreadsheet, Download } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, CmdButton, Pill } from '@/components/workspace/command-ui';

const REPORTS = [
  { label: 'Monthly usage summary', sub: 'Members · projects · credit burn', format: 'CSV' },
  { label: 'Per-member burn',       sub: 'Credits consumed by each member', format: 'CSV' },
  { label: 'Invoice export',        sub: 'All invoices for the period',     format: 'PDF' },
  { label: 'Project ledger',        sub: 'Every project + status + cost',   format: 'CSV' },
];

export default function WorkspaceReports() {
  return (
    <WorkspacePage
      icon={FileSpreadsheet}
      eyebrow="Optimize · Export"
      title="Reports"
      description="Exportable summaries for finance, operations and leadership review."
    >
      <Surface padded={false}>
        <ul className="divide-y divide-[hsl(35,12%,12%)]">
          {REPORTS.map((r) => (
            <li key={r.label} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[hsl(35,12%,92%)]">{r.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,50%)] mt-1">{r.sub}</div>
              </div>
              <Pill tone="neutral">{r.format}</Pill>
              <CmdButton variant="ghost" disabled><Download className="w-3 h-3" /> Export</CmdButton>
            </li>
          ))}
        </ul>
      </Surface>
    </WorkspacePage>
  );
}