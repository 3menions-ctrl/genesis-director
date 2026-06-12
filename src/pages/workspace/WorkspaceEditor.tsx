/**
 * WorkspaceEditor — mounts the full Video Editor inside the /workspace
 * shell. Desktop-only (matches the editor constraint). WorkspaceLayout
 * is applied at the route level in App.tsx (with fullBleed), so the
 * page only renders its child.
 */
import VideoEditor from '@/pages/VideoEditor';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function WorkspaceEditor() {
  usePageMeta({ title: "Workspace Editor — Small Bridges" });
  return <VideoEditor />;
}
