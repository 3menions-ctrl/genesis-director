/**
 * WorkspaceEditor — mounts the full Video Editor inside the
 * /workspace shell. Desktop-only (matches the editor constraint).
 */
import VideoEditor from '@/pages/VideoEditor';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function WorkspaceEditor() {
  usePageMeta({ title: "Workspace Editor — Small Bridges" });

  return (
    <WorkspaceLayout fullBleed>
      <VideoEditor />
    </WorkspaceLayout>
  );
}