import WorkspaceSettings from '@/pages/WorkspaceSettings';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

/**
 * Wraps the existing member/invite manager inside the new workspace layout.
 * The underlying page already has its own header — we strip its outer
 * spacing by rendering it inside the layout's content area.
 */
export default function WorkspaceTeam() {
  return (
    <WorkspaceLayout>
      <div className="-mt-10">
        {/* WorkspaceSettings already centers itself; the negative margin
            collapses its top padding so it sits flush under the layout header. */}
        <WorkspaceSettings />
      </div>
    </WorkspaceLayout>
  );
}