/**
 * WorkspaceCreate — mounts the full Create studio inside the
 * /workspace shell so business users can launch productions
 * without leaving the workspace.
 */
import Create from '@/pages/Create';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function WorkspaceCreate() {
  usePageMeta({ title: "Workspace Create — Small Bridges" });

  return (
    <WorkspaceLayout fullBleed>
      <Create />
    </WorkspaceLayout>
  );
}