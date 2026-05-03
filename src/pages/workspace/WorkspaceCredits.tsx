import { Coins, TrendingDown, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, MetricCard, CmdButton, Pill } from '@/components/workspace/command-ui';

export default function WorkspaceCredits() {
  const { currentOrg } = useWorkspace();
  const balance = currentOrg?.credits_balance ?? 0;
  const low = balance < 500;
  return (
    <WorkspacePage
      icon={Coins}
      eyebrow="Optimize · Spend"
      title="Credits"
      description="Pooled credit balance shared by every workspace member. Refills monthly with your plan."
      actions={
        <Link to="/workspace/billing">
          <CmdButton variant="primary"><Coins className="w-3 h-3" /> Top up</CmdButton>
        </Link>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Pool balance" value={balance} sub="credits available" icon={Coins} accent />
        <MetricCard label="Refill cadence" value="Monthly" sub="On plan renewal" icon={RefreshCcw} />
        <MetricCard label="Low-balance alert" value={low ? 'ACTIVE' : 'OK'} sub="Threshold: 10%" icon={AlertTriangle} warn={low} />
      </div>

      <Surface>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(35,12%,90%)]">
              Auto-recharge
            </div>
            <p className="text-[12px] text-[hsl(35,8%,55%)] mt-2 max-w-xl font-light">
              When the pool drops below the threshold, automatically purchase a top-up so productions never stall mid-pipeline.
            </p>
          </div>
          <Pill tone="neutral">DISABLED</Pill>
        </div>
        <div className="mt-5 flex gap-2">
          <CmdButton variant="ghost" disabled>Configure auto-recharge</CmdButton>
          <Link to="/workspace/analytics"><CmdButton variant="ghost"><TrendingDown className="w-3 h-3" /> View burn report</CmdButton></Link>
        </div>
      </Surface>
    </WorkspacePage>
  );
}