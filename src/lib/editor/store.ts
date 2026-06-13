/**
 * editor-store — the canonical external state for the rebuilt Editor.
 *
 * Same useSyncExternalStore pattern as left-rail-store and cast-store
 * elsewhere in the app — no Context provider, no third-party state
 * library, no prop drilling.
 *
 * IMPORTANT: the player's `currentTime` is NOT in this store. The
 * Stage view's <video> element owns its own time; UI that needs to
 * react at frame rate (timecode display, playhead bar) subscribes to
 * the player ref via RAF, not the store. This keeps the store from
 * triggering a tree-wide re-render 60 times per second.
 */
import type { EditorProject, EditorState, EditorView } from "./types";
import { INITIAL_EDITOR_STATE } from "./types";

let state: EditorState = { ...INITIAL_EDITOR_STATE };
const listeners = new Set<() => void>();

export function getEditorState(): EditorState {
  return state;
}

export function subscribeEditor(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(next: Partial<EditorState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

// ─── Mutators ────────────────────────────────────────────────────────────────
export function setView(view: EditorView): void {
  if (state.view === view) return;
  set({ view });
}

export function setProject(project: EditorProject | null): void {
  set({
    project,
    loading: false,
    error: null,
    // Reset selection when project changes
    selectedSceneId: null,
    selectedClipId: null,
  });
}

export function setLoading(loading: boolean): void {
  set({ loading });
}

export function setError(error: string | null): void {
  set({ error, loading: false });
}

export function selectScene(sceneId: string | null): void {
  if (state.selectedSceneId === sceneId) return;
  set({ selectedSceneId: sceneId, selectedClipId: null });
}

export function selectClip(clipId: string | null): void {
  if (state.selectedClipId === clipId) return;
  // Selecting a clip implicitly selects its scene.
  let sceneId = state.selectedSceneId;
  if (clipId && state.project) {
    for (const s of state.project.scenes) {
      if (s.clips.some((c) => c.id === clipId)) {
        sceneId = s.id;
        break;
      }
    }
  }
  set({ selectedClipId: clipId, selectedSceneId: sceneId });
}

export function resetEditor(): void {
  state = { ...INITIAL_EDITOR_STATE };
  for (const l of listeners) l();
}
