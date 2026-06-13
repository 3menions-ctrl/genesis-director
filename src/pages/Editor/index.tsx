/**
 * Editor — the new v1 editor mount point.
 *
 * Routes:
 *   - /editor               — ProjectChooser (FoundationShell with LeftRail)
 *   - /editor/:id           — full editor surface (FoundationShell bare)
 *   - /workspace/editor     — re-exported via WorkspaceEditor (same surface)
 *   - /admin/editor         — same surface, admin-scoped via route
 *
 * Two distinct mount paths so the chooser doesn't fight the editor's
 * full-bleed atmosphere. The editor itself sits inside FoundationShell
 * with `bare` so the LeftRail and the (deleted) top bar stay out of
 * the editor's own chrome.
 */
import { useParams } from "react-router-dom";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useProject } from "@/hooks/editor/useProject";
import { usePersistence } from "@/hooks/editor/usePersistence";
import { EditorShell } from "./EditorShell";
import { ProjectChooser } from "./components/ProjectChooser";

export default function Editor() {
  const { id } = useParams<{ id?: string }>();

  usePageMeta({
    title: id
      ? `Editor — ${id.slice(0, 8)} — Small Bridges`
      : "Editor — Small Bridges",
    description:
      "The Small Bridges Editor — Stage, Timeline, Script, Storyboard. AI as a first-class collaborator. Versions, not undo.",
  });

  if (!id) {
    return (
      <FoundationShell>
        <ProjectChooser />
      </FoundationShell>
    );
  }
  return <EditorWithProject id={id} />;
}

/**
 * EditorWithProject — separate component so the project hooks
 * (useProject + usePersistence) only run when there's actually a
 * project id to load. Avoids the "no id" code path firing the
 * supabase queries with undefined.
 */
function EditorWithProject({ id }: { id: string }) {
  useProject(id);
  usePersistence(id);
  return (
    <FoundationShell bare>
      <EditorShell />
    </FoundationShell>
  );
}
