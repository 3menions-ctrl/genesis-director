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
import type { EditorClip, EditorProject, EditorState, EditorView } from "./types";
import { INITIAL_EDITOR_STATE } from "./types";

/** Recompute every clip's timelineStartSec after a reorder/trim/delete. */
function recompute(project: EditorProject): EditorProject {
  let cursor = 0;
  const scenes = project.scenes.map((scene) => {
    const clips = scene.clips.map((c) => {
      const next: EditorClip = { ...c, timelineStartSec: cursor };
      cursor += c.durationSec;
      return next;
    });
    return { ...scene, clips, durationSec: clips.reduce((s, c) => s + c.durationSec, 0) };
  });
  return { ...project, scenes, durationSec: cursor };
}

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

// ─── Playhead + zoom ─────────────────────────────────────────────────────────
export function setPlayhead(sec: number): void {
  const clamped = Math.max(0, sec);
  if (Math.abs(state.playheadSec - clamped) < 0.01) return;
  set({ playheadSec: clamped });
}

export function setPxPerSec(px: number): void {
  const clamped = Math.max(20, Math.min(400, px));
  if (state.pxPerSec === clamped) return;
  set({ pxPerSec: clamped });
}

// ─── Clip mutations (in-memory for v1; supabase persistence next) ────────────
/** Move a clip from its current position to `toIndex` within the project's
 *  flat clip order. Ripple: every clip's timelineStartSec recomputes. */
export function moveClip(clipId: string, toIndex: number): void {
  if (!state.project) return;
  const flat: EditorClip[] = state.project.scenes.flatMap((s) => s.clips);
  const fromIndex = flat.findIndex((c) => c.id === clipId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  const clamped = Math.max(0, Math.min(flat.length - 1, toIndex));
  const [moved] = flat.splice(fromIndex, 1);
  flat.splice(clamped, 0, moved);
  // For v1, all clips live on scene[0] (synthetic scene from useProject).
  // When scene_id linkage lands the mover distributes clips per scene.
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s, i) =>
      i === 0 ? { ...s, clips: flat } : { ...s, clips: [] },
    ),
  };
  set({ project: recompute(project) });
}

/** Update a clip's duration (trim). Maintains all later clips' positions
 *  through recompute. Clamps to a minimum of 0.5s. */
export function trimClip(clipId: string, durationSec: number): void {
  if (!state.project) return;
  const newDur = Math.max(0.5, durationSec);
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, durationSec: newDur } : c,
      ),
    })),
  };
  set({ project: recompute(project) });
}

/**
 * Switch which take is "active" for a clip — swaps the clip's
 * videoUrl + thumbnailUrl + prompt to the selected take. The full
 * takes list stays intact (versions-not-undo). Reordering the
 * takes list puts the active take first so future reads are
 * cheap.
 */
export function switchActiveTake(clipId: string, takeId: string): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        const take = c.takes.find((t) => t.id === takeId);
        if (!take || !take.videoUrl) return c;
        const reordered = [
          take,
          ...c.takes.filter((t) => t.id !== takeId),
        ];
        return {
          ...c,
          videoUrl: take.videoUrl,
          thumbnailUrl: take.thumbnailUrl ?? c.thumbnailUrl,
          prompt: take.promptUsed ?? c.prompt,
          takes: reordered,
        };
      }),
    })),
  };
  set({ project });
}

/**
 * Optimistically append a pending take to a clip — used by the AI
 * regenerate flow so the takes drawer immediately shows the new
 * take as "pending" before the edge function returns. When the
 * server returns the real row, the optimistic one gets replaced
 * via replacePendingTake().
 */
export function appendPendingTake(
  clipId: string,
  take: { id: string; takeNumber: number; promptUsed: string },
): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              takes: [
                {
                  id: take.id,
                  takeNumber: take.takeNumber,
                  videoUrl: null,
                  thumbnailUrl: null,
                  promptUsed: take.promptUsed,
                  status: "pending",
                  createdAt: new Date(0).toISOString(),
                },
                ...c.takes,
              ],
            }
          : c,
      ),
    })),
  };
  set({ project });
}

/** Remove a clip from the timeline. Ripple closes the gap. */
export function deleteClip(clipId: string): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.filter((c) => c.id !== clipId),
    })),
  };
  const next = recompute(project);
  set({
    project: next,
    selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
  });
}
