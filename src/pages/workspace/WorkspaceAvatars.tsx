/**
 * WorkspaceAvatars — mounts the full Avatars studio inside the
 * /workspace shell so business users never leave their workspace
 * context (org, role, brand kit) to manage avatars.
 */
import Avatars from '@/pages/Avatars';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

export default function WorkspaceAvatars() {
  return (
    <WorkspaceLayout fullBleed>
      <Avatars />
    </WorkspaceLayout>
  );
}