/**
 * Editor — the mount point.
 *
 * The editor surface is ALWAYS visible. /editor (no id) mounts the
 * shell immediately and runs a background auto-pick that loads the
 * user's most recent project into the store — no redirect, no
 * intermediate page. /editor/{id} mounts the shell on that project.
 * Either way, the user sees the four-region NLE layout from the
 * first paint.
 *
 * Routes:
 *   - /editor              — empty editor; auto-loads most recent project in background.
 *   - /editor/:id          — editor with that project.
 *   - /workspace/editor    — same surface (via WorkspaceEditor re-export).
 *   - /admin/editor        — same surface.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useProject } from "@/hooks/editor/useProject";
import { usePersistence } from "@/hooks/editor/usePersistence";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EditorShell } from "./EditorShell";

export default function Editor() {
  const { id: urlId } = useParams<{ id?: string }>();
  const autoId = useAutoPickProjectId(urlId);
  const effectiveId = urlId ?? autoId;

  usePageMeta({
    title: effectiveId
      ? `Editor — ${effectiveId.slice(0, 8)} — Small Bridges`
      : "Editor — Small Bridges",
    description:
      "The Small Bridges Editor — Stage, Timeline, Script, Storyboard. AI as a first-class collaborator. Versions, not undo.",
  });

  useProject(effectiveId);
  usePersistence(effectiveId);

  return (
    <FoundationShell bare>
      <EditorShell />
    </FoundationShell>
  );
}

/**
 * useAutoPickProjectId — runs once on mount when there's no URL id.
 * Queries movie_projects (RLS-scoped, no application-layer
 * user_id filter), returns the most recent row's id. Does NOT
 * trigger a URL change — the editor loads the project inline.
 *
 * URL id always wins. If urlId is set, autoId stays undefined.
 */
function useAutoPickProjectId(urlId: string | undefined): string | undefined {
  const [autoId, setAutoId] = useState<string | undefined>();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (urlId) return; // URL takes precedence — no auto-pick
    if (authLoading) return;
    if (!user) return; // Empty editor when signed out

    let cancelled = false;
    void (async () => {
      try {
        // Step 1 — personal projects first.
        const { data: own, error: ownErr } = await supabase
          .from("movie_projects")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (ownErr) {
          // eslint-disable-next-line no-console
          console.error("[Editor auto-pick] personal query failed", ownErr);
        }
        if (own && own.length > 0) {
          setAutoId(own[0].id);
          return;
        }

        // Step 2 — anything the user can see (RLS-scoped workspace
        // / org projects). Picks the most recent.
        const { data: anyRow, error: anyErr } = await supabase
          .from("movie_projects")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (anyErr) {
          // eslint-disable-next-line no-console
          console.error("[Editor auto-pick] any-project query failed", anyErr);
          return;
        }
        if (anyRow && anyRow.length > 0) {
          setAutoId(anyRow[0].id);
        }
        // If still nothing: stay null. Editor stays empty + browsable.
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[Editor auto-pick] threw", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlId, user, authLoading]);

  return autoId;
}
