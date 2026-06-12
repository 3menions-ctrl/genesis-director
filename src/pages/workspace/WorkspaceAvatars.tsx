/**
 * WorkspaceAvatars — mounts the full Avatars studio inside the
 * /workspace shell so business users never leave their workspace
 * context (org, role, brand kit) to manage avatars.
 */
import Avatars from '@/pages/Avatars';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function WorkspaceAvatars() {
  usePageMeta({ title: "Workspace Avatars — Small Bridges" });

  return (
    <WorkspaceLayout fullBleed>
      <Avatars />
    </WorkspaceLayout>
  );
}