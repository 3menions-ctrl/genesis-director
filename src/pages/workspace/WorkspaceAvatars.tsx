/**
 * WorkspaceAvatars — mounts the full Avatars studio inside the
 * /workspace shell. WorkspaceLayout is applied at the route level in
 * App.tsx (with fullBleed), so the page only renders its child.
 */
import Avatars from '@/pages/Avatars';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function WorkspaceAvatars() {
  usePageMeta({ title: "Workspace Avatars — Small Bridges" });
  return <Avatars />;
}
