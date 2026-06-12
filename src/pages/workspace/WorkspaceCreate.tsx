/**
 * WorkspaceCreate — mounts the canonical Studio inside the /workspace
 * shell. WorkspaceLayout is applied at the route level in App.tsx
 * (with fullBleed), so the page only renders its child.
 */
import Studio from '@/pages/Studio';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function WorkspaceCreate() {
  usePageMeta({ title: "Workspace Studio — Small Bridges" });
  return <Studio />;
}
