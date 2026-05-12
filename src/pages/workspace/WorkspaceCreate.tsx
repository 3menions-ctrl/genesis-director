/**
 * WorkspaceCreate — mounts the full Create studio inside the
 * /workspace shell so business users can launch productions
 * without leaving the workspace.
 */
import Create from '@/pages/Create';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

export default function WorkspaceCreate() {
  return (
    <WorkspaceLayout fullBleed>
      <Create />
    </WorkspaceLayout>
  );
}