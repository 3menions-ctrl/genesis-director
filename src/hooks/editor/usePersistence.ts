/**
 * usePersistence — keeps the editor's user edits across reloads.
 *
 * Saves a small JSON snapshot of "what the user has changed" to
 * localStorage on every state change (debounced ~600ms). On project
 * load, after useProject has called setProject(), we re-apply the
 * snapshot via the store's applyEdits() mutator in a single pass.
 *
 * What we persist (v1 — conservative)
 *   - clipOrder         left → right order of clip IDs on the timeline
 *   - sceneOrder        order of scene IDs in the storyboard
 *   - clipDurations     per-clip duration overrides (from trim)
 *   - activeTakes       per-clip active take_number (from version swap)
 *
 * What we deliberately do NOT persist (yet)
 *   - clip deletions    — reload reveals them again, intentional v1
 *                         "undo by refresh" affordance until we wire
 *                         a real history stack
 *   - pending takes     — server-truth; reload re-queries shot_takes
 *
 * Migration to supabase: v2 swaps localStorage for
 * movie_projects.pipeline_state (a JSONB column already on the
 * schema). The shape stays the same; only the storage backend moves.
 */
import { useEffect, useRef } from "react";
import { useEditor } from "./useEditor";
import { applyEdits } from "@/lib/editor/store";

const STORAGE_VERSION = 1;

interface ProjectEditsSnapshot {
  version: typeof STORAGE_VERSION;
  updatedAt: number;
  clipOrder: string[];
  sceneOrder: string[];
  clipDurations: Record<string, number>;
  activeTakes: Record<string, number>;
}

function storageKey(projectId: string): string {
  return `smallbridges.editor.${projectId}`;
}

function read(projectId: string): ProjectEditsSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectEditsSnapshot;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(projectId: string, snap: ProjectEditsSnapshot): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(snap));
  } catch {
    // Quota exceeded / private mode — silent.
  }
}

export function usePersistence(projectId: string | undefined) {
  const { project } = useEditor();
  /** Tracks whether the restore for this projectId has already run. */
  const restoredFor = useRef<string | null>(null);

  // ── Restore ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !project) return;
    if (restoredFor.current === projectId) return;
    if (project.id !== projectId) return; // project still loading the right one

    const snap = read(projectId);
    if (snap) {
      applyEdits({
        clipOrder: snap.clipOrder,
        sceneOrder: snap.sceneOrder,
        clipDurations: snap.clipDurations,
        activeTakes: snap.activeTakes,
      });
    }
    restoredFor.current = projectId;
  }, [projectId, project]);

  // ── Save (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !project) return;
    if (restoredFor.current !== projectId) return; // wait until after restore

    const t = window.setTimeout(() => {
      const allClips = project.scenes.flatMap((s) => s.clips);
      const clipOrder = allClips.map((c) => c.id);
      const sceneOrder = project.scenes.map((s) => s.id);
      const clipDurations: Record<string, number> = {};
      const activeTakes: Record<string, number> = {};
      for (const c of allClips) {
        clipDurations[c.id] = c.durationSec;
        const active = c.takes[0];
        if (active) activeTakes[c.id] = active.takeNumber;
      }
      const snap: ProjectEditsSnapshot = {
        version: STORAGE_VERSION,
        updatedAt: Date.now(),
        clipOrder,
        sceneOrder,
        clipDurations,
        activeTakes,
      };
      write(projectId, snap);
    }, 600);

    return () => window.clearTimeout(t);
  }, [projectId, project]);

  // Reset restored ref when the projectId changes so a switch to a
  // different project triggers a fresh restore.
  useEffect(() => {
    return () => {
      restoredFor.current = null;
    };
  }, [projectId]);
}

/**
 * Clear the persisted edits for a project — used by the "discard
 * edits" affordance (TopStatusBar in a follow-up). Exposed here so
 * the rest of the editor doesn't have to know about storage keys.
 */
export function clearPersistedEdits(projectId: string): void {
  try {
    localStorage.removeItem(storageKey(projectId));
  } catch {
    // silent
  }
}
