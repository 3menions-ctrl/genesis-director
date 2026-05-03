import { Plug, Slack, Webhook, Database, Zap, Cloud } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, CmdButton, Pill } from '@/components/workspace/command-ui';

interface Integration { name: string; sub: string; icon: LucideIcon; status: 'available' | 'coming' }

const INTEGRATIONS: Integration[] = [
  { name: 'Slack',        sub: 'Post finished productions to channels',  icon: Slack,    status: 'coming' },
  { name: 'Notion',       sub: 'Sync brand kit + asset library',         icon: Database, status: 'coming' },
  { name: 'Google Drive', sub: 'Auto-upload exports to a shared drive',  icon: Cloud,    status: 'coming' },
  { name: 'Zapier',       sub: 'Trigger 6,000+ automations',              icon: Zap,      status: 'coming' },
  { name: 'Webhooks',     sub: 'POST events to your endpoints',           icon: Webhook,  status: 'available' },
];

export default function WorkspaceIntegrations() {
  return (
    <WorkspacePage
      icon={Plug}
      eyebrow="Extend · Connect"
      title="Integrations"
      description="Push productions, brand updates and credit alerts into the tools your team already uses."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map((i) => (
          <Surface key={i.name}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,7%)] flex items-center justify-center shrink-0">
                <i.icon className="w-4 h-4 text-[hsl(215,100%,62%)]" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] text-[hsl(220,14%,96%)] font-display">{i.name}</div>
                  {i.status === 'coming' && <Pill tone="neutral">SOON</Pill>}
                </div>
                <p className="text-[12px] text-[hsl(220,8%,55%)] mt-1 font-light">{i.sub}</p>
                <div className="mt-3">
                  <CmdButton variant="ghost" disabled={i.status === 'coming'}>
                    {i.status === 'coming' ? 'Notify me' : 'Connect'}
                  </CmdButton>
                </div>
              </div>
            </div>
          </Surface>
        ))}
      </div>
    </WorkspacePage>
  );
}