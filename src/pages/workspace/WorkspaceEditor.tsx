/**
 * WorkspaceEditor — mounts the full Video Editor inside the
 * /workspace shell. Desktop-only (matches the editor constraint).
 */
import VideoEditor from '@/pages/VideoEditor';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

export default function WorkspaceEditor() {
  return (
    <WorkspaceLayout fullBleed>
      <VideoEditor />
    </WorkspaceLayout>
  );
}