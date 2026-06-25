/**
 * useScriptDocument — load + subscribe to a project's ScriptDocument.
 *
 * Pattern:
 *   1. On mount (or projectId change), fetch the doc + every legacy
 *      table the hydration function needs. If the doc is well-
 *      formed, use it directly; otherwise hydrate from the legacy
 *      tables and use that. Either way, the result is fed to the
 *      document-store, which becomes the in-memory source of truth.
 *   2. Subscribe to supabase realtime on movie_projects so external
 *      writes (the orchestrator finishing a render, another tab
 *      saving, Director Chat) flow into the local store.
 *
 * The hook returns the current document + saving state + flush
 * helpers. The editor's surfaces subscribe via the document-store
 * directly (useSyncExternalStore) — this hook is responsible for
 * loading + subscribing, not for being the read API.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  hydrateScriptDocument,
  type CharacterRow,
  type ClipRow,
  type MovieProjectRow,
  type SceneRow,
  type TakeRow,
} from "@/lib/editor/hydrate-document";
import {
  getDocumentState,
  subscribeDocument,
  setDocument,
  flushNow,
} from "@/lib/editor/document-store";
import type { ScriptDocument } from "@/lib/editor/script-document";

interface UseScriptDocumentResult {
  doc: ScriptDocument | null;
  loading: boolean;
  saving: boolean;
  lastError: string | null;
  /** Force-flush any pending writes (e.g. on tab close). */
  flush: () => Promise<void>;
}

export function useScriptDocument(projectId: string | undefined): UseScriptDocumentResult {
  // Subscribe to the document-store's external state.
  const docState = useSyncExternalStore(
    subscribeDocument,
    getDocumentState,
    getDocumentState,
  );

  // Loading flag is local — useState-managed so it doesn't leak
  // into the document-store.
  // (Inline pattern instead of useState to keep this hook lean.)
  // We treat `doc === null + projectId set` as "loading."
  const loading = !!projectId && docState.doc === null;

  useEffect(() => {
    if (!projectId) {
      setDocument(null);
      return;
    }
    let cancelled = false;
    // Clear the previous project's doc FIRST so `loading` (doc === null) flips
    // true during the switch. Otherwise the global singleton store still holds
    // project A's document and the editor renders A's scenes/clips under
    // project B until B's async load resolves.
    setDocument(null);
    void (async () => {
      try {
        // Fetch the project row + every legacy table the hydration
        // function needs. Done in parallel.
        const [{ data: project }, clipsRes, takesRes, charsRes] =
          await Promise.all([
            supabase
              .from("movie_projects")
              .select("*")
              .eq("id", projectId)
              .maybeSingle(),
            supabase
              .from("video_clips")
              .select(
                "id, prompt, duration_seconds, video_url, start_image_url, last_frame_url, created_at, project_id, status",
              )
              .eq("project_id", projectId)
              .order("created_at", { ascending: true }),
            supabase
              .from("shot_takes")
              .select(
                "id, shot_index, take_number, video_url, thumbnail_url, prompt_used, status, created_at",
              )
              .eq("project_id", projectId)
              .order("shot_index", { ascending: true })
              .order("take_number", { ascending: false }),
            supabase
              .from("project_characters")
              .select(
                "id, name, role, description, identity_dna, wardrobe, physical_description, reference_image_url, avatar_id, voice_profile_id",
              )
              .eq("project_id", projectId),
          ]);
        if (cancelled || !project) return;

        const doc = hydrateScriptDocument({
          project: project as unknown as MovieProjectRow,
          scenes: [] as SceneRow[],
          clips: (clipsRes.data ?? []) as ClipRow[],
          takes: (takesRes.data ?? []) as TakeRow[],
          characters: (charsRes.data ?? []) as CharacterRow[],
        });
        setDocument(doc);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[useScriptDocument] load failed", e);
        setDocument(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Realtime: subscribe to movie_projects changes for this project.
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`script-document-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "movie_projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as { script_document?: unknown };
          if (!row.script_document || typeof row.script_document !== "object") {
            return;
          }
          const incoming = row.script_document as ScriptDocument;
          // Only swap when the incoming doc is FRESHER than ours —
          // otherwise our just-flushed in-flight writes get
          // overwritten by the realtime echo.
          const cur = getDocumentState().doc;
          if (
            cur &&
            cur.meta.authoredAt > incoming.meta.authoredAt
          ) {
            return;
          }
          setDocument(incoming);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    doc: docState.doc,
    loading,
    saving: !!docState.dirtyAt,
    lastError: docState.lastError,
    flush: flushNow,
  };
}
