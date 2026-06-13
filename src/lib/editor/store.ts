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
import type {
  EditorClip,
  EditorMarker,
  EditorProject,
  EditorState,
  EditorView,
  HistoryEntry,
  TimelineTool,
} from "./types";
import { INITIAL_EDITOR_STATE } from "./types";

const HISTORY_MAX = 50;

/**
 * historize — set the project AND record the previous project to the
 * undo stack. Future is cleared on every new edit (canonical UX).
 * Called by every project-mutating action; not by loaders or by
 * server-driven optimistic mutations (pending takes, etc).
 */
function historize(
  nextProject: EditorProject,
  extra?: Partial<EditorState>,
  label?: string,
): void {
  const past = state.project
    ? [
        ...state.history.past.slice(
          Math.max(0, state.history.past.length - HISTORY_MAX + 1),
        ),
        { project: state.project, label } satisfies HistoryEntry,
      ]
    : state.history.past;
  set({
    project: nextProject,
    history: { past, future: [] },
    ...extra,
  });
}

/**
 * Recompute every VIDEO clip's timelineStartSec after a reorder /
 * trim / delete. Title clips on V2 are independent — they keep their
 * own timelineStartSec untouched so their position is sticky relative
 * to wallclock, not V1's chain. Total duration is the max of the V1
 * cursor and the last title clip's end.
 */
function recompute(project: EditorProject): EditorProject {
  let cursor = 0;
  let maxEnd = 0;
  const scenes = project.scenes.map((scene) => {
    const clips = scene.clips.map((c) => {
      if (c.kind === "title") {
        const end = c.timelineStartSec + c.durationSec;
        if (end > maxEnd) maxEnd = end;
        return c;
      }
      const next: EditorClip = { ...c, timelineStartSec: cursor };
      cursor += c.durationSec;
      if (cursor > maxEnd) maxEnd = cursor;
      return next;
    });
    return {
      ...scene,
      clips,
      durationSec: clips
        .filter((c) => c.kind !== "title")
        .reduce((s, c) => s + c.durationSec, 0),
    };
  });
  return { ...project, scenes, durationSec: Math.max(cursor, maxEnd) };
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
  if (
    state.selectedClipId === clipId &&
    state.selectedClipIds.length === (clipId ? 1 : 0) &&
    (!clipId || state.selectedClipIds[0] === clipId)
  ) {
    return;
  }
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
  set({
    selectedClipId: clipId,
    selectedClipIds: clipId ? [clipId] : [],
    selectedSceneId: sceneId,
  });
}

/** Add a clip to the multi-selection (Shift-click). The added clip
 *  becomes the new primary. */
export function extendClipSelection(clipId: string): void {
  if (state.selectedClipIds.includes(clipId)) {
    // Already there — just promote to primary.
    if (state.selectedClipId !== clipId) {
      set({ selectedClipId: clipId });
    }
    return;
  }
  set({
    selectedClipId: clipId,
    selectedClipIds: [...state.selectedClipIds, clipId],
  });
}

/** Toggle a clip in the multi-selection (Cmd/Ctrl-click). */
export function toggleClipSelection(clipId: string): void {
  if (state.selectedClipIds.includes(clipId)) {
    const next = state.selectedClipIds.filter((id) => id !== clipId);
    set({
      selectedClipIds: next,
      selectedClipId:
        state.selectedClipId === clipId ? next[next.length - 1] ?? null : state.selectedClipId,
    });
  } else {
    set({
      selectedClipId: clipId,
      selectedClipIds: [...state.selectedClipIds, clipId],
    });
  }
}

export function clearSelection(): void {
  if (!state.selectedClipId && state.selectedClipIds.length === 0) return;
  set({ selectedClipId: null, selectedClipIds: [] });
}

export function resetEditor(): void {
  state = { ...INITIAL_EDITOR_STATE };
  for (const l of listeners) l();
}

// ─── Undo / Redo ─────────────────────────────────────────────────────────────
export function undo(): boolean {
  if (!state.project || state.history.past.length === 0) return false;
  const prev = state.history.past[state.history.past.length - 1];
  const currentSnapshot: HistoryEntry = { project: state.project };
  // Filter selection to clips that still exist in the restored project.
  const stillExists = new Set(
    prev.project.scenes.flatMap((s) => s.clips.map((c) => c.id)),
  );
  const nextSelected = state.selectedClipIds.filter((id) => stillExists.has(id));
  set({
    project: prev.project,
    history: {
      past: state.history.past.slice(0, -1),
      future: [
        currentSnapshot,
        ...state.history.future.slice(0, HISTORY_MAX - 1),
      ],
    },
    selectedClipIds: nextSelected,
    selectedClipId: nextSelected[nextSelected.length - 1] ?? null,
  });
  return true;
}

export function redo(): boolean {
  if (state.history.future.length === 0) return false;
  const next = state.history.future[0];
  const past = state.project
    ? [
        ...state.history.past.slice(
          Math.max(0, state.history.past.length - HISTORY_MAX + 1),
        ),
        { project: state.project } satisfies HistoryEntry,
      ]
    : state.history.past;
  set({
    project: next.project,
    history: {
      past,
      future: state.history.future.slice(1),
    },
  });
  return true;
}

// ─── Copy / Paste ────────────────────────────────────────────────────────────
export function copySelected(): boolean {
  if (!state.project || state.selectedClipIds.length === 0) return false;
  const set_ = new Set(state.selectedClipIds);
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const clips = allClips.filter((c) => set_.has(c.id)).map((c) => ({ ...c }));
  if (clips.length === 0) return false;
  set({ clipboard: { clips, copiedAt: Date.now() } });
  return true;
}

/**
 * Paste clips from the clipboard. New clips are inserted immediately
 * AFTER the currently-selected clip in the V1 chain — the closest
 * thing to "paste at the cursor" given that V1 is sequential. If
 * nothing is selected, appends at the end. All clip ids are
 * regenerated; properties (volume / opacity / fades / title text)
 * carry over.
 */
export function pasteFromClipboard(): boolean {
  if (!state.project || !state.clipboard || state.clipboard.clips.length === 0)
    return false;
  const allClips = state.project.scenes[0]?.clips ?? [];
  const insertAfter = state.selectedClipId
    ? allClips.findIndex((c) => c.id === state.selectedClipId)
    : -1;
  const newClips: EditorClip[] = state.clipboard.clips.map((c) => ({
    ...c,
    id: `paste-${performance.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    timelineStartSec: 0,
  }));
  const updated = insertAfter >= 0
    ? [
        ...allClips.slice(0, insertAfter + 1),
        ...newClips,
        ...allClips.slice(insertAfter + 1),
      ]
    : [...allClips, ...newClips];
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s, i) =>
      i === 0 ? { ...s, clips: updated } : { ...s, clips: [] },
    ),
  };
  const newIds = newClips.map((c) => c.id);
  historize(recompute(project), {
    selectedClipId: newIds[newIds.length - 1],
    selectedClipIds: newIds,
  });
  return true;
}

/** Delete every clip in the multi-selection. Ripple closes gaps. */
export function deleteSelected(): boolean {
  if (!state.project || state.selectedClipIds.length === 0) return false;
  const set_ = new Set(state.selectedClipIds);
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.filter((c) => !set_.has(c.id)),
    })),
  };
  historize(recompute(project), { selectedClipId: null, selectedClipIds: [] });
  return true;
}

// ─── Tool, snap, markers, in/out ─────────────────────────────────────────────
export function setTool(tool: TimelineTool): void {
  if (state.tool === tool) return;
  set({ tool });
}

export function toggleSnap(): void {
  set({ snapEnabled: !state.snapEnabled });
}

const MARKER_COLORS = [
  "hsl(45 95% 60%)",   // amber
  "hsl(160 75% 55%)",  // emerald
  "hsl(212 100% 60%)", // accent-blue
  "hsl(280 75% 65%)",  // violet
  "hsl(340 80% 60%)",  // rose
];

export function addMarkerAtPlayhead(label?: string): string {
  const id = `marker-${Math.floor(performance.now())}`;
  const m: EditorMarker = {
    id,
    timelineSec: state.playheadSec,
    label: label ?? `Marker ${state.markers.length + 1}`,
    color: MARKER_COLORS[state.markers.length % MARKER_COLORS.length],
  };
  set({ markers: [...state.markers, m].sort((a, b) => a.timelineSec - b.timelineSec) });
  return id;
}

export function removeMarker(id: string): void {
  set({ markers: state.markers.filter((m) => m.id !== id) });
}

export function updateMarker(id: string, patch: Partial<EditorMarker>): void {
  set({
    markers: state.markers
      .map((m) => (m.id === id ? { ...m, ...patch } : m))
      .sort((a, b) => a.timelineSec - b.timelineSec),
  });
}

export function setInPoint(sec: number | null): void {
  if (sec === null) {
    set({ inSec: null });
    return;
  }
  // Don't allow in past out
  const next = state.outSec !== null && sec >= state.outSec
    ? Math.max(0, state.outSec - 0.1)
    : Math.max(0, sec);
  set({ inSec: next });
}

export function setOutPoint(sec: number | null): void {
  if (sec === null) {
    set({ outSec: null });
    return;
  }
  const next = state.inSec !== null && sec <= state.inSec
    ? state.inSec + 0.1
    : sec;
  set({ outSec: next });
}

export function clearInOut(): void {
  set({ inSec: null, outSec: null });
}

/** Update the project's scriptContent in memory. Persistence happens
 *  separately — the caller (Script view) writes to supabase. */
export function setScriptContent(content: string): void {
  if (!state.project) return;
  if (state.project.scriptContent === content) return;
  historize({ ...state.project, scriptContent: content });
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
  historize(recompute(project));
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
  historize(recompute(project));
}

/**
 * Update a single clip property (volume / opacity / scale / fades /
 * titleText / titleColor). Sparse — undefined keys fall back to
 * CLIP_PROPERTY_DEFAULTS on the read path via getClipProperty().
 */
export function setClipProperty(
  clipId: string,
  patch: {
    volume?: number;
    opacity?: number;
    scale?: number;
    fadeInSec?: number;
    fadeOutSec?: number;
    titleText?: string;
    titleColor?: string;
  },
): void {
  if (!state.project) return;
  // Property edits are rapid (sliders fire on every input event).
  // To avoid filling the undo stack with every intermediate value,
  // coalesce consecutive identical-key edits to the same clip into
  // a single history entry: we only record history on the FIRST
  // edit of a slider-drag burst.
  const last = state.history.past[state.history.past.length - 1];
  const isBurstContinuation =
    last?.label === `prop:${clipId}` && state.project !== last.project;
  if (isBurstContinuation) {
    // Skip history push — same drag burst.
    const project: EditorProject = buildPropertyMutation(state.project, clipId, patch);
    set({ project });
  } else {
    const project: EditorProject = buildPropertyMutation(state.project, clipId, patch);
    historize(project, undefined, `prop:${clipId}`);
  }
}

function buildPropertyMutation(
  project: EditorProject,
  clipId: string,
  patch: {
    volume?: number;
    opacity?: number;
    scale?: number;
    fadeInSec?: number;
    fadeOutSec?: number;
    titleText?: string;
    titleColor?: string;
  },
): EditorProject {
  return {
    ...project,
    scenes: project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        const next: EditorClip = { ...c };
        if (patch.titleText !== undefined) next.titleText = patch.titleText;
        if (patch.titleColor !== undefined) next.titleColor = patch.titleColor;
        const propPatch: Partial<EditorClip["properties"]> = {};
        for (const k of ["volume", "opacity", "scale", "fadeInSec", "fadeOutSec"] as const) {
          if (patch[k] !== undefined) propPatch[k] = patch[k];
        }
        if (Object.keys(propPatch).length > 0) {
          next.properties = { ...(c.properties ?? {}), ...propPatch };
        }
        return next;
      }),
    })),
  };
}

/**
 * Insert a title-card clip at the current playhead on V2. Default
 * duration 3s, default text "TITLE". The title is a SEPARATE clip
 * (not part of the V1 video chain) — it doesn't shift any video
 * positions. Two title clips can overlap; the renderer paints them
 * in insertion order so the most-recent wins.
 */
export function insertTitleAtPlayhead(initialText: string = "TITLE"): string | null {
  if (!state.project) return null;
  const newClip: EditorClip = {
    id: `title-${Math.floor(performance.now())}`,
    kind: "title",
    index: 0,
    timelineStartSec: state.playheadSec,
    durationSec: 3,
    videoUrl: null,
    thumbnailUrl: null,
    prompt: initialText,
    titleText: initialText,
    titleColor: "hsl(220 30% 4%)",
    properties: { opacity: 0.95 },
    takes: [],
  };
  // Append title clips to scene[0].clips so the existing mutators see
  // them too, but they're identified by kind === "title" — the
  // Timeline filters and the Stage overlay both branch on it.
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s, i) =>
      i === 0 ? { ...s, clips: [...s.clips, newClip] } : s,
    ),
  };
  historize(project, { selectedClipId: newClip.id, selectedClipIds: [newClip.id] });
  return newClip.id;
}

/**
 * Razor — split the clip at the timeline-absolute playhead into two
 * adjacent clips. Both halves keep the same source video, thumbnail,
 * prompt, and takes. The original clip's duration becomes the time
 * from its start to the playhead; the new clip carries the
 * remainder. No-op when the playhead isn't inside a clip or is too
 * close to a clip edge (< 0.1s — splits below that aren't useful).
 *
 * Used by the B keyboard shortcut. Pro editors split at the playhead
 * a thousand times per session; this is the highest-frequency edit
 * after a trim.
 */
export function splitAtPlayhead(): boolean {
  if (!state.project) return false;
  const ph = state.playheadSec;
  const allClips: EditorClip[] = state.project.scenes.flatMap((s) => s.clips);
  const target = allClips.find(
    (c) =>
      ph > c.timelineStartSec + 0.1 &&
      ph < c.timelineStartSec + c.durationSec - 0.1,
  );
  if (!target) return false;
  const splitRel = ph - target.timelineStartSec;
  const leftDur = splitRel;
  const rightDur = target.durationSec - splitRel;
  const newClip: EditorClip = {
    ...target,
    id: `${target.id}-split-${Math.floor(performance.now())}`,
    index: target.index + 1,
    durationSec: rightDur,
    // timelineStartSec recomputes in recompute() below
    timelineStartSec: 0,
    // Same takes list — both halves are "the same generation"
    takes: target.takes,
  };
  const updatedTarget: EditorClip = { ...target, durationSec: leftDur };

  // Insert newClip right after target in the flat clip list, then
  // distribute back to the synthetic scene[0] model (v1).
  const newFlat: EditorClip[] = [];
  for (const c of allClips) {
    if (c.id === target.id) {
      newFlat.push(updatedTarget);
      newFlat.push(newClip);
    } else {
      newFlat.push(c);
    }
  }
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s, i) =>
      i === 0 ? { ...s, clips: newFlat } : { ...s, clips: [] },
    ),
  };
  historize(recompute(project), {
    selectedClipId: newClip.id,
    selectedClipIds: [newClip.id],
  });
  return true;
}

/**
 * Reorder scenes — used by the Storyboard view's drag-to-reorder.
 * Scene_number gets renumbered to match the new positions; the
 * timeline cursor recomputes so the global timecode stays accurate.
 */
export function moveScene(sceneId: string, toIndex: number): void {
  if (!state.project) return;
  const scenes = [...state.project.scenes];
  const fromIndex = scenes.findIndex((s) => s.id === sceneId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  const clamped = Math.max(0, Math.min(scenes.length - 1, toIndex));
  const [moved] = scenes.splice(fromIndex, 1);
  scenes.splice(clamped, 0, moved);
  // Renumber sequentially so the storyboard labels are correct.
  const renumbered = scenes.map((s, i) => ({ ...s, number: i + 1 }));
  const project: EditorProject = { ...state.project, scenes: renumbered };
  historize(recompute(project));
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

/**
 * Apply a saved-edit snapshot to the current project in one shot.
 * Used by usePersistence after the supabase loader sets the project,
 * to overlay the user's prior reorders / trims / active-take picks
 * without re-firing every individual mutator (each of which would
 * trigger a re-render + recompute).
 *
 * Merge strategy:
 *   - Reorder clips by saved.clipOrder; any clip not in the saved
 *     order is appended at the end so newly-rendered Studio clips
 *     don't disappear.
 *   - Reorder scenes the same way.
 *   - For each clip with a saved duration, overwrite durationSec.
 *   - For each clip with a saved active take, swap to that take by
 *     take_number (stable across reloads, unlike take id).
 *   - Recompute timelineStartSec at the end.
 */
export function applyEdits(edits: {
  clipOrder?: string[];
  sceneOrder?: string[];
  clipDurations?: Record<string, number>;
  activeTakes?: Record<string, number>;
}): void {
  if (!state.project) return;

  // Flatten + index every clip by id
  const allClips: EditorClip[] = state.project.scenes.flatMap((s) => s.clips);
  const clipById = new Map<string, EditorClip>(allClips.map((c) => [c.id, c]));

  // 1. duration overrides
  if (edits.clipDurations) {
    for (const [id, dur] of Object.entries(edits.clipDurations)) {
      const c = clipById.get(id);
      if (c) c.durationSec = Math.max(0.5, dur);
    }
  }

  // 2. active take swaps
  if (edits.activeTakes) {
    for (const [id, takeNum] of Object.entries(edits.activeTakes)) {
      const c = clipById.get(id);
      if (!c) continue;
      const take = c.takes.find((t) => t.takeNumber === takeNum);
      if (!take || !take.videoUrl) continue;
      c.videoUrl = take.videoUrl;
      c.thumbnailUrl = take.thumbnailUrl ?? c.thumbnailUrl;
      c.prompt = take.promptUsed ?? c.prompt;
      c.takes = [take, ...c.takes.filter((t) => t.id !== take.id)];
    }
  }

  // 3. clip order
  const orderedClips: EditorClip[] = (() => {
    if (!edits.clipOrder) return allClips;
    const seen = new Set<string>();
    const out: EditorClip[] = [];
    for (const id of edits.clipOrder) {
      const c = clipById.get(id);
      if (c && !seen.has(id)) {
        out.push(c);
        seen.add(id);
      }
    }
    // Append any clips not in the saved order (new from supabase)
    for (const c of allClips) {
      if (!seen.has(c.id)) out.push(c);
    }
    return out;
  })();

  // 4. scene order — for v1 we put all clips in scene[0], so scene
  //    order matters only for the storyboard. Apply if present.
  const scenesOrdered = (() => {
    if (!edits.sceneOrder) return state.project!.scenes;
    const byId = new Map(state.project!.scenes.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const out = [];
    for (const id of edits.sceneOrder) {
      const s = byId.get(id);
      if (s && !seen.has(id)) {
        out.push(s);
        seen.add(id);
      }
    }
    for (const s of state.project!.scenes) {
      if (!seen.has(s.id)) out.push(s);
    }
    return out.map((s, i) => ({ ...s, number: i + 1 }));
  })();

  const project: EditorProject = {
    ...state.project,
    scenes: scenesOrdered.map((s, i) => ({
      ...s,
      // v1: synthetic scene model puts all clips on scene[0]
      clips: i === 0 ? orderedClips : [],
    })),
  };
  historize(recompute(project));
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
  historize(next, {
    selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    selectedClipIds: state.selectedClipIds.filter((id) => id !== clipId),
  });
}
