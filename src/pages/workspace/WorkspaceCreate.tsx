/**
 * WorkspaceCreate — mounts the canonical Studio workshop inside the
 * /workspace shell so business users can launch productions without
 * leaving the workspace. Same Foundation-shelled experience as the
 * personal /studio surface; the WorkspaceLayout is the only extra layer.
 */
import Studio from '@/pages/Studio';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function WorkspaceCreate() {
  usePageMeta({ title: "Workspace Studio — Small Bridges" });

  return (
    <WorkspaceLayout fullBleed>
      <Studio />
    </WorkspaceLayout>
  );
}