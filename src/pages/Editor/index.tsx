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
import { useScriptDocument } from "@/hooks/editor/useScriptDocument";
import { usePersistence } from "@/hooks/editor/usePersistence";
import { useClipPropertiesSync } from "@/hooks/editor/useClipPropertiesSync";
import { useEditorStateSync } from "@/hooks/editor/useEditorStateSync";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EditorShell } from "./EditorShell";

export default function Editor() {
  const { id: urlId } = useParams<{ id?: string }>();
  // The editor NEVER auto-loads a project. When the route has no id,
  // we render the empty NLE surface and let the user explicitly open
  // a project (Library, Create, Upload, Media). Loading something the
  // user didn't ask for surprises them with broken or stale content.
  const effectiveId = urlId;

  usePageMeta({
    title: effectiveId
      ? `Editor — ${effectiveId.slice(0, 8)} — Small Bridges`
      : "Editor — Small Bridges",
    description:
      "The Small Bridges Editor — Stage, Timeline, Script, Storyboard. AI as a first-class collaborator. Versions, not undo.",
  });

  useProject(effectiveId);
  usePersistence(effectiveId);
  // Round-trip per-clip post-prod state (colorGrade, audioMix, effects)
  // and project-level master loudness to the DB so the project-mode
  // stitch path (final-assembly → seamless-stitcher) honors the same
  // edits the user sees in the Inspector. Debounced 500ms.
  useClipPropertiesSync(effectiveId);
  // Round-trip project-level editor state (transitions + title overlays)
  // to movie_projects.editor_state so reload doesn't wipe them.
  useEditorStateSync(effectiveId);
  // Load + subscribe to the ScriptDocument constitution. New surfaces
  // (ShotInspectorCard, cost preview, Script v3, Director Chat typed
  // writes) read from the document store. Legacy surfaces continue
  // through useProject's EditorProject path so this is purely
  // additive — both stores live side by side during the integration
  // sweep.
  useScriptDocument(effectiveId);

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
        // Auto-pick a project that has at least one playable clip — a
        // completed video_clips row with a non-null video_url. Without
        // this filter the editor was landing on projects with 0 clips
        // or pending generations, leaving the user staring at a poster
        // or a black frame and wondering why nothing plays. We do the
        // join on the DB side so we don't have to round-trip every
        // candidate.
        const playableSelect = "id, video_clips!inner(id, video_url, status)";

        // Step 1 — personal projects with playable clips.
        const { data: own, error: ownErr } = await supabase
          .from("movie_projects")
          .select(playableSelect)
          .eq("user_id", user.id)
          .eq("video_clips.status", "completed")
          .not("video_clips.video_url", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (ownErr) {
          // eslint-disable-next-line no-console
          console.warn("[Editor auto-pick] personal query failed", ownErr);
        }
        if (own && own.length > 0) {
          setAutoId(own[0].id);
          return;
        }

        // Step 2 — any visible (RLS-scoped) project with playable clips.
        const { data: anyRow, error: anyErr } = await supabase
          .from("movie_projects")
          .select(playableSelect)
          .eq("video_clips.status", "completed")
          .not("video_clips.video_url", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (anyErr) {
          // eslint-disable-next-line no-console
          console.warn("[Editor auto-pick] any-project query failed", anyErr);
          return;
        }
        if (anyRow && anyRow.length > 0) {
          setAutoId(anyRow[0].id);
          return;
        }
        // Nothing playable exists — stay null. Editor shows its empty
        // state instead of loading a project whose clips can't render.
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
