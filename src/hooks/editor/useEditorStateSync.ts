/**
 * useEditorStateSync — round-trips project-level editor mutations
 * (transitions + title clips) to `movie_projects.editor_state` JSONB
 * so a reload doesn't wipe them.
 *
 * Why this hook exists
 *   Transitions live on `EditorProject.transitions[]` and titles live
 *   on `scenes[0].clips[]` with `kind: "title"`. Neither has a
 *   dedicated DB row — they're synthetic editor concepts, not media.
 *   Without this hook the user adds a fade between clip A and B,
 *   navigates away, comes back, and the transition is gone.
 *   ExportPanel still consumes them live for a render, but the
 *   persistence layer was the open hole.
 *
 * Mechanism
 *   • Walk the in-memory project, collect transitions[] and the
 *     title-kind clips out of scene[0].
 *   • Hash the (transitions, titles) tuple. When the hash differs
 *     from the last written value, schedule a 600ms debounced UPDATE
 *     to `movie_projects.editor_state`.
 *   • First post-hydrate pass is treated as baseline (no spurious
 *     save back of identical data).
 *   • Skip the demo project (synthetic, no DB row).
 *
 * Why we don't persist keyframes here
 *   Keyframes are per-clip and live on `clip.keyframes`. They're
 *   covered by useClipPropertiesSync — the clip-properties hash
 *   includes keyframes via the `clip.properties` round-trip pattern
 *   (see store.setKeyframes flow when wired). Don't duplicate.
 */
import { useEffect, useRef } from "react";
import { useEditor } from "./useEditor";
import { supabase } from "@/integrations/supabase/client";
import { isDemoId } from "@/lib/editor/demoProject";
import type { EditorClip, EditorProject } from "@/lib/editor/types";

const DEBOUNCE_MS = 600;

interface EditorStateSnap {
  transitions: unknown[];
  titles: EditorClip[];
  textOverlays: unknown[];
  tracks: unknown[];
  /** Timeline markers — previously store-only, so they vanished on reload.
   *  Now persisted with the rest of the editor state. */
  markers: unknown[];
  /** The FULL timeline clip list (every scene, every kind). This is
   *  the durable record of the user's edit — splits, trims, reorders,
   *  and per-clip effects/keyframes that don't map 1:1 to a
   *  `video_clips` row. Without it, reload rebuilds the timeline from
   *  video_clips rows alone and collapses any structural edit. */
  clips: EditorClip[];
}

function collect(project: {
  scenes: { clips: EditorClip[] }[];
  transitions: unknown[];
  textOverlays?: EditorProject["textOverlays"];
  tracks?: EditorProject["tracks"];
}, markers: unknown[]): EditorStateSnap {
  const allClips: EditorClip[] = [];
  const titles: EditorClip[] = [];
  for (const s of project.scenes) {
    for (const c of s.clips) {
      allClips.push(c);
      if (c.kind === "title") titles.push(c);
    }
  }
  return {
    transitions: project.transitions ?? [],
    titles,
    textOverlays: project.textOverlays ?? [],
    tracks: project.tracks ?? [],
    markers: markers ?? [],
    clips: allClips,
  };
}

function hashSnap(snap: EditorStateSnap): string {
  return JSON.stringify(snap);
}

// ── Module-level flush registry ───────────────────────────────────────
// Holds the latest snapshot so SaveDialog (and unmount) can force the
// editor_state write immediately instead of waiting for the debounce —
// previously a Save within 600ms of an edit, or navigating away, lost
// the transitions/clips write entirely.
let pendingEditorState: { projectId: string; snap: EditorStateSnap; hash: string } | null = null;

/**
 * Force-write the most recent editor_state snapshot now. No-op when
 * nothing is pending. Throws on DB error so the caller can surface it.
 */
export async function flushEditorState(): Promise<void> {
  const pending = pendingEditorState;
  if (!pending) return;
  const { error } = await supabase
    .from("movie_projects")
    .update({ editor_state: pending.snap as unknown as Record<string, unknown> })
    .eq("id", pending.projectId);
  if (error) throw new Error(`editor_state save failed: ${error.message}`);
  // Clear only if nothing newer queued while we were writing.
  if (pendingEditorState === pending) pendingEditorState = null;
  try {
    window.dispatchEvent(new CustomEvent("editor:project-saved", { detail: { projectId: pending.projectId } }));
  } catch { /* non-fatal */ }
}

export function useEditorStateSync(projectId: string | undefined) {
  const { project, markers } = useEditor();
  /** Last hash successfully written to the DB. After hydrate, seeded
   *  with the loaded shape so the first observed hash is baseline,
   *  not a spurious change. */
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    lastSaved.current = null;
    hydratedFor.current = null;
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !project) return;
    if (isDemoId(projectId)) return;
    if (project.id !== projectId) return;

    const snap = collect(project, markers);
    const h = hashSnap(snap);

    // First pass — accept whatever loaded as the baseline.
    if (hydratedFor.current !== projectId) {
      lastSaved.current = h;
      hydratedFor.current = projectId;
      return;
    }
    if (h === lastSaved.current) return;

    // Stage the latest snapshot so flushEditorState() (SaveDialog,
    // unmount) can force-write it even before the debounce fires.
    pendingEditorState = { projectId, snap, hash: h };

    if (timer.current) window.clearTimeout(timer.current);
    const targetHash = h;
    timer.current = window.setTimeout(async () => {
      timer.current = null;
      try {
        await flushEditorState();
        lastSaved.current = targetHash;
      } catch (e) {
        console.warn("[editor-state] save failed", e instanceof Error ? e.message : e);
      }
    }, DEBOUNCE_MS);
  }, [projectId, project, markers]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      // Flush any staged-but-unwritten editor_state so navigating away
      // mid-debounce doesn't drop the edit. Fire-and-forget — React
      // doesn't await cleanup.
      void flushEditorState();
    };
  }, []);
}
