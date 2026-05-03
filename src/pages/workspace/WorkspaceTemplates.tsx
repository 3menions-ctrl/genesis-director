import { LayoutTemplate, Plus } from 'lucide-react';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, CmdButton } from '@/components/workspace/command-ui';

export default function WorkspaceTemplates() {
  return (
    <WorkspacePage
      icon={LayoutTemplate}
      eyebrow="Operate · Reuse"
      title="Templates"
      description="Reusable scene scripts, style presets and brand-locked layouts the team can launch from."
      actions={<CmdButton variant="primary" disabled><Plus className="w-3 h-3" /> New template</CmdButton>}
    >
      <Surface>
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          body="Save a finished production as a template to let the team launch new variations in seconds."
        />
      </Surface>
    </WorkspacePage>
  );
}