/**
 * Editor — the new v1 editor mount point.
 *
 * Routes:
 *   - /editor               — open with no project (renders a chooser
 *                             through the empty-state path)
 *   - /editor/:id           — open a specific project by movie_projects.id
 *   - /workspace/editor     — re-exported via WorkspaceEditor (same shell)
 *   - /admin/editor         — same shell, admin-scoped via route
 *
 * Renders inside FoundationShell with `bare` so the LeftRail and the
 * (deleted) top bar don't compete with the editor's own chrome. The
 * SpineBackdrop still paints, but the EditorShell's ProjectBackdrop
 * sits above it and dominates the atmosphere.
 *
 * The project loader (useProject) is fire-and-forget — it writes to
 * the editor store and EditorShell reads via useEditor().
 */
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useProject } from "@/hooks/editor/useProject";
import { usePersistence } from "@/hooks/editor/usePersistence";
import { resetEditor, setError } from "@/lib/editor/store";
import { EditorShell } from "./EditorShell";

export default function Editor() {
  const { id } = useParams<{ id?: string }>();

  usePageMeta({
    title: id
      ? `Editor — ${id.slice(0, 8)} — Small Bridges`
      : "Editor — Small Bridges",
    description:
      "The Small Bridges Editor — Stage, Timeline, Script, Storyboard. AI as a first-class collaborator. Versions, not undo.",
  });

  useProject(id);
  usePersistence(id);

  // Surface a clean "pick a project" message when the URL has no id
  useEffect(() => {
    if (!id) {
      resetEditor();
      setError(
        "Open a project from /library to start editing — the editor needs a project id (/editor/:id).",
      );
    }
  }, [id]);

  return (
    <FoundationShell bare>
      <EditorShell />
    </FoundationShell>
  );
}
