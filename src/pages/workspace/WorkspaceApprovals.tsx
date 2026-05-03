import { CheckCircle2 } from 'lucide-react';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, Pill } from '@/components/workspace/command-ui';

export default function WorkspaceApprovals() {
  return (
    <WorkspacePage
      icon={CheckCircle2}
      eyebrow="Govern · Review"
      title="Approvals"
      description="Productions awaiting reviewer sign-off before publish or export."
      actions={<Pill tone="amber">QUEUE · 0</Pill>}
    >
      <Surface>
        <EmptyState
          icon={CheckCircle2}
          title="Nothing pending review"
          body="When a Producer submits a production for sign-off, Reviewers will see it here with full preview and approve/reject controls."
        />
      </Surface>
    </WorkspacePage>
  );
}