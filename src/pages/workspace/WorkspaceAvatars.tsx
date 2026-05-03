import { UserSquare2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { CmdButton, Surface } from '@/components/workspace/command-ui';

export default function WorkspaceAvatars() {
  return (
    <WorkspacePage
      icon={UserSquare2}
      eyebrow="Operate · Cast"
      title="Avatars"
      description="Brand-locked spokespeople and recurring characters shared across the team."
      actions={
        <Link to="/avatars">
          <CmdButton variant="primary"><Plus className="w-3 h-3" /> Open Studio</CmdButton>
        </Link>
      }
    >
      <Surface>
        <EmptyState
          icon={UserSquare2}
          title="Shared cast"
          body="Org-wide avatar identity locks are managed inside the Studio. Avatars created by any workspace member will surface here."
          action={<Link to="/avatars"><CmdButton variant="ghost">Manage in Studio</CmdButton></Link>}
        />
      </Surface>
    </WorkspacePage>
  );
}