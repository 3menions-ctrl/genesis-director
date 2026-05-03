import { KeyRound, Webhook, Plus } from 'lucide-react';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Section, CmdButton, Pill } from '@/components/workspace/command-ui';

export default function WorkspaceApi() {
  return (
    <WorkspacePage
      icon={KeyRound}
      eyebrow="Extend · Programmatic"
      title="API & Webhooks"
      description="Org-scoped API keys and webhook endpoints for programmatic access to workspace productions."
      actions={<Pill tone="amber">PROGRAMMATIC ACCESS</Pill>}
    >
      <Section icon={KeyRound} label="API Keys" sublabel="Server-to-server access scoped to this workspace."
        action={<CmdButton variant="primary" disabled><Plus className="w-3 h-3" /> Generate key</CmdButton>}>
        <EmptyState
          icon={KeyRound}
          title="No keys yet"
          body="Generate a workspace-scoped API key to call generation endpoints from your backend. Keys inherit org credit pool."
        />
      </Section>

      <Section icon={Webhook} label="Webhooks" sublabel="Receive POST events when projects start, complete or fail."
        action={<CmdButton variant="primary" disabled><Plus className="w-3 h-3" /> Add endpoint</CmdButton>}>
        <EmptyState
          icon={Webhook}
          title="No endpoints registered"
          body="Subscribe a URL to receive workspace events: project.created · project.completed · credits.low · member.joined."
        />
      </Section>
    </WorkspacePage>
  );
}