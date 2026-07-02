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
  AnimatableProperty,
  AspectRatio,
  ClipProperties,
  ClipTransition,
  EditorClip,
  EditorMarker,
  EditorProject,
  EditorState,
  EditorView,
  HistoryEntry,
  Keyframe,
  TimelineTool,
  TransitionKind,
} from "./types";
import { INITIAL_EDITOR_STATE, TRANSITION_DEFAULT_SEC } from "./types";
import { IDENTITY_CURVES, IDENTITY_HSL_BY_RANGE } from "./color-grade";

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
 * Coalesced historize for CONTINUOUS drags (trim/roll/slip/slide/etc.).
 * A pointer-move drag fires this every frame; without coalescing each frame
 * pushed a separate undo entry, so one Cmd-Z reverted ~1px and undoing a drag
 * took 100+ presses. When the last history entry shares this `label` (an
 * in-progress burst), we update the project WITHOUT pushing a new entry — so
 * the whole gesture collapses to a single undo. Same pattern as
 * updateTransition/updateTextOverlay.
 */
function historizeCoalesced(nextProject: EditorProject, label: string): void {
  const last = state.history.past[state.history.past.length - 1];
  if (last?.label === label) {
    set({ project: nextProject });
  } else {
    historize(nextProject, undefined, label);
  }
}

/**
 * Recompute every VIDEO clip's timelineStartSec after a reorder /
 * trim / delete. Title clips on V2 are independent — they keep their
 * own timelineStartSec untouched so their position is sticky relative
 * to wallclock, not V1's chain. Total duration is the max of the V1
 * cursor and the last title clip's end.
 */
export function recompute(project: EditorProject): EditorProject {
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

/** Reset the singleton store to a pristine INITIAL_EDITOR_STATE.
 *  Used only by tests — production code should never need to wipe the
 *  store because each window/tab gets its own module instance. */
export function __resetForTests(): void {
  state = { ...INITIAL_EDITOR_STATE };
  for (const l of listeners) l();
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
  // Filter selection to clips that still exist in the restored project —
  // mirrors undo(). Without this, redoing an op that removed clips leaves
  // selectedClipId/selectedClipIds dangling at clips no longer present,
  // which drives the Inspector off a non-existent clip.
  const stillExists = new Set(
    next.project.scenes.flatMap((s) => s.clips.map((c) => c.id)),
  );
  const nextSelected = state.selectedClipIds.filter((id) => stillExists.has(id));
  set({
    project: next.project,
    history: {
      past,
      future: state.history.future.slice(1),
    },
    selectedClipIds: nextSelected,
    selectedClipId: nextSelected[nextSelected.length - 1] ?? null,
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
    transitions: (state.project.transitions ?? []).filter(
      (t) => !set_.has(t.fromClipId) && !set_.has(t.toClipId),
    ),
  };
  historize(recompute(project), { selectedClipId: null, selectedClipIds: [] });
  return true;
}

/** Select every clip in the project (V1 + V2 titles). The pointer
 *  selection model holds a set of ids and we set them all at once.
 *  Cmd-A binding. */
export function selectAllClips(): boolean {
  if (!state.project) return false;
  const ids = state.project.scenes.flatMap((s) => s.clips.map((c) => c.id));
  if (ids.length === 0) return false;
  set({
    selectedClipId: ids[0],
    selectedClipIds: ids,
  });
  return true;
}

/** Duplicate every selected clip — clones into the timeline directly
 *  after each source clip. Like Cmd-C followed by Cmd-V but in one
 *  step so the clipboard isn't displaced. */
export function duplicateSelected(): boolean {
  if (!state.project || state.selectedClipIds.length === 0) return false;
  const set_ = new Set(state.selectedClipIds);
  const allClips = state.project.scenes[0]?.clips ?? [];
  const sources = allClips.filter((c) => set_.has(c.id));
  if (sources.length === 0) return false;
  const newClips: EditorClip[] = sources.map((c) => ({
    ...c,
    id: `dup-${performance.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    timelineStartSec: 0,
  }));
  // Append duplicates immediately after the last selected source clip.
  const insertAfter = Math.max(...sources.map((c) => allClips.findIndex((x) => x.id === c.id)));
  const updated = [
    ...allClips.slice(0, insertAfter + 1),
    ...newClips,
    ...allClips.slice(insertAfter + 1),
  ];
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

/** Cut = copy + delete. Cmd-X binding. */
export function cutSelected(): boolean {
  if (!copySelected()) return false;
  return deleteSelected();
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

// ─── Mixer ──────────────────────────────────────────────────────────────────
export function setMasterVolume(v: number): void {
  const next = Math.max(0, Math.min(1.5, v));
  if (state.masterVolume === next) return;
  set({ masterVolume: next });
}

export function setMasterMuted(m: boolean): void {
  if (state.masterMuted === m) return;
  set({ masterMuted: m });
}

export function setTrackVolume(
  track: "V1" | "A1" | "A2",
  v: number,
): void {
  const next = Math.max(0, Math.min(1.5, v));
  if (state.trackVolumes[track] === next) return;
  set({ trackVolumes: { ...state.trackVolumes, [track]: next } });
}

export function setTrackMuted(
  track: "V1" | "A1" | "A2",
  m: boolean,
): void {
  if (state.trackMuted[track] === m) return;
  set({ trackMuted: { ...state.trackMuted, [track]: m } });
}

export function setIsPlaying(playing: boolean): void {
  if (state.isPlaying === playing) return;
  set({ isPlaying: playing });
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
  // Clamp both ends. The previous one-sided floor let the playhead
  // drag past totalSec — auto-scroll would keep chasing it forever,
  // the StitchedPlayer would clamp activeIdx to the last clip, and
  // the user could end up "playing" past the end with no way to
  // visually orient back. The ruler scrub was already two-sided
  // (Timeline.tsx:959) so this just makes setPlayhead consistent.
  // Epsilon tightened from 0.01 → 0.001 so 60fps frame-step doesn't
  // accidentally no-op when stepping single-frame from a near-equal
  // position (1/60 ≈ 0.0167 — fine, but the old 0.01 was close
  // enough to swallow tiny scrubs from the rAF playback driver).
  const dur = state.project?.durationSec ?? Number.POSITIVE_INFINITY;
  const clamped = Math.max(0, Math.min(dur, sec));
  if (Math.abs(state.playheadSec - clamped) < 0.001) return;
  set({ playheadSec: clamped });
}

export function setPxPerSec(px: number): void {
  // Raised from 400 → 4000 so users can zoom in tight enough to see
  // individual frames of a 30fps clip (~133 px per frame at 4000 px/s).
  // Best-in-class NLEs cap around 1000 frames-per-screen-width; this
  // matches that range without needing virtualization.
  const clamped = Math.max(10, Math.min(4000, px));
  if (state.pxPerSec === clamped) return;
  set({ pxPerSec: clamped });
}

// ─── Clip mutations (in-memory for v1; supabase persistence next) ────────────

/** Helper: is the clip's track locked? Defaults to V1 when the clip
 *  has no explicit trackId. Returns false when no tracks array exists
 *  (pre-Phase-A projects) — we never want to silently block edits on
 *  a project that doesn't even have the tracks model. */
function isClipOnLockedTrack(clip: EditorClip): boolean {
  if (!state.project?.tracks) return false;
  const trackId = (clip.properties?.trackId as string | null | undefined) ?? "sys:V1";
  const track = state.project.tracks.find((t) => t.id === trackId);
  return !!track?.locked;
}

/** Move a clip from its current position to `toIndex` within the project's
 *  flat clip order. Ripple: every clip's timelineStartSec recomputes. */
export function moveClip(clipId: string, toIndex: number): void {
  if (!state.project) return;
  const flat: EditorClip[] = state.project.scenes.flatMap((s) => s.clips);
  const fromIndex = flat.findIndex((c) => c.id === clipId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  // Lock check — block the move when the source clip's track is
  // locked. Without this, the visual lock icon was cosmetic and
  // every clip on a "locked" track could still be reordered.
  if (isClipOnLockedTrack(flat[fromIndex])) return;
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
 *  through recompute. Clamps to a minimum of 0.5s.
 *
 *  Trim drags fire on every pointermove (~200 events for a typical
 *  drag). Without coalescing, the history stack fills with intermediate
 *  values and a single Cmd-Z reverts ~1px of drag — the user has to
 *  hold Z for several seconds. We coalesce identical-clip trims into
 *  one history entry by reusing the label-based burst suppression that
 *  setClipProperty uses. The FIRST trim of a drag records pre-drag
 *  state; subsequent trims under the same label update the head
 *  in-place without pushing new entries.
 *
 *  On pointerup the caller invokes a NEW historize cycle implicitly
 *  via the next non-trim mutation, which closes the burst. */
/** Roll edit — adjust the shared boundary between this clip and the
 *  next sequential V1 clip. Increasing `durationSecDelta` makes this
 *  clip LONGER by that amount and the next clip SHORTER by the same
 *  amount, keeping total V1 timeline length constant. The boundary
 *  moves; neither clip's source material starts somewhere new. Useful
 *  for "give me a bit more breath before the cut without affecting
 *  anything else." Returns false when no valid neighbor exists or
 *  the proposed move would make either clip < 0.5s. */
export function rollEdit(clipId: string, durationSecDelta: number): boolean {
  if (!state.project) return false;
  const flat = state.project.scenes.flatMap((s) => s.clips).filter((c) => c.kind !== "title");
  const idx = flat.findIndex((c) => c.id === clipId);
  if (idx < 0 || idx >= flat.length - 1) return false;
  const me = flat[idx];
  const next = flat[idx + 1];
  if (isClipOnLockedTrack(me) || isClipOnLockedTrack(next)) return false;
  const newMeDur = me.durationSec + durationSecDelta;
  const newNextDur = next.durationSec - durationSecDelta;
  if (newMeDur < 0.5 || newNextDur < 0.5) return false;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id === me.id) return { ...c, durationSec: newMeDur };
        if (c.id === next.id) return { ...c, durationSec: newNextDur };
        return c;
      }),
    })),
  };
  historizeCoalesced(recompute(project), `roll:${clipId}`);
  return true;
}

/** Slip edit — shift the clip's source in/out by `deltaSec` without
 *  changing its position on the timeline or its duration. Currently a
 *  metadata mutation: `properties.sourceInSec` shifts to deltaSec.
 *  When the bake honors sourceIn (already wired via `-ss`), the
 *  visible content shifts but the surrounding timeline stays put. */
export function slipClip(clipId: string, deltaSec: number): boolean {
  if (!state.project) return false;
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const target = allClips.find((c) => c.id === clipId);
  if (!target || isClipOnLockedTrack(target)) return false;
  const currentIn = (target.properties as { sourceInSec?: number })?.sourceInSec ?? 0;
  const nextIn = Math.max(0, currentIn + deltaSec);
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) =>
        c.id === clipId
          ? { ...c, properties: { ...(c.properties ?? {}), sourceInSec: nextIn } }
          : c,
      ),
    })),
  };
  historizeCoalesced(project, `slip:${clipId}`);
  return true;
}

/** Slide edit — move this clip along the V1 timeline by `deltaSec`,
 *  compensating by shortening the previous clip's end and lengthening
 *  the next clip's start (or vice versa) so total timeline length
 *  stays constant. Returns false when no valid neighbors or the
 *  proposed move would push a neighbor below 0.5s. */
export function slideClip(clipId: string, deltaSec: number): boolean {
  if (!state.project) return false;
  const flat = state.project.scenes.flatMap((s) => s.clips).filter((c) => c.kind !== "title");
  const idx = flat.findIndex((c) => c.id === clipId);
  if (idx <= 0 || idx >= flat.length - 1) return false;
  const prev = flat[idx - 1];
  const next = flat[idx + 1];
  if (
    isClipOnLockedTrack(prev) ||
    isClipOnLockedTrack(flat[idx]) ||
    isClipOnLockedTrack(next)
  ) return false;
  const newPrevDur = prev.durationSec + deltaSec;
  const newNextDur = next.durationSec - deltaSec;
  if (newPrevDur < 0.5 || newNextDur < 0.5) return false;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id === prev.id) return { ...c, durationSec: newPrevDur };
        if (c.id === next.id) return { ...c, durationSec: newNextDur };
        return c;
      }),
    })),
  };
  historizeCoalesced(recompute(project), `slide:${clipId}`);
  return true;
}

/** Replace clip — swap the source media of an existing clip without
 *  changing its position, duration, or any other properties (effects,
 *  grade, fades, audio mix, trackId stay intact). Common UX: drag a
 *  new asset onto an existing clip block. */
export function replaceClip(
  clipId: string,
  next: { videoUrl: string; thumbnailUrl: string | null; durationSec?: number },
): boolean {
  if (!state.project) return false;
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const target = allClips.find((c) => c.id === clipId);
  if (!target || isClipOnLockedTrack(target)) return false;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              videoUrl: next.videoUrl,
              thumbnailUrl: next.thumbnailUrl,
              durationSec: next.durationSec ?? c.durationSec,
            }
          : c,
      ),
    })),
  };
  historize(recompute(project), undefined, `replace:${clipId}`);
  return true;
}

/** Overwrite at playhead — insert a clip at the current playhead and
 *  remove whatever's underneath for the same duration. Unlike a paste
 *  (which ripples), overwrite preserves the V1 chain length. Returns
 *  the new clip id on success, null when no V1 clip exists at the
 *  playhead or the new clip's duration would extend past totalSec. */
export function overwriteAtPlayhead(
  source: { videoUrl: string; thumbnailUrl: string | null; durationSec: number; prompt?: string },
): string | null {
  if (!state.project) return null;
  const ph = state.playheadSec;
  const allClips = state.project.scenes.flatMap((s) => s.clips).filter((c) => c.kind !== "title");
  const target = allClips.find(
    (c) => ph >= c.timelineStartSec && ph < c.timelineStartSec + c.durationSec,
  );
  if (!target) return null;
  const insertStart = ph;
  const overwriteEnd = insertStart + source.durationSec;
  const newId = `ow-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  // Walk every clip; trim or remove anything inside [insertStart, overwriteEnd).
  // Build the new flat list with the inserted clip exactly at insertStart.
  const allFlat = state.project.scenes.flatMap((s) => s.clips);
  const out: EditorClip[] = [];
  let inserted = false;
  for (const c of allFlat) {
    if (c.kind === "title") { out.push(c); continue; }
    const cEnd = c.timelineStartSec + c.durationSec;
    if (cEnd <= insertStart) { out.push(c); continue; }
    if (c.timelineStartSec >= overwriteEnd) {
      if (!inserted) {
        const newClip: EditorClip = {
          id: newId,
          kind: "video",
          index: c.index, // recompute() will renumber
          timelineStartSec: insertStart,
          durationSec: source.durationSec,
          videoUrl: source.videoUrl,
          thumbnailUrl: source.thumbnailUrl,
          prompt: source.prompt ?? "Overwrite",
          takes: [],
        };
        out.push(newClip);
        inserted = true;
      }
      out.push(c);
      continue;
    }
    // Clip overlaps the overwrite range — clip it or drop it.
    if (c.timelineStartSec < insertStart && cEnd > overwriteEnd) {
      // Cut a hole — left and right halves remain.
      out.push({ ...c, durationSec: insertStart - c.timelineStartSec });
      if (!inserted) {
        out.push({
          id: newId,
          kind: "video",
          index: c.index,
          timelineStartSec: insertStart,
          durationSec: source.durationSec,
          videoUrl: source.videoUrl,
          thumbnailUrl: source.thumbnailUrl,
          prompt: source.prompt ?? "Overwrite",
          takes: [],
        });
        inserted = true;
      }
      out.push({
        ...c,
        id: `${c.id}-rh-${Math.floor(performance.now())}`,
        timelineStartSec: overwriteEnd,
        durationSec: cEnd - overwriteEnd,
      });
    } else if (c.timelineStartSec < insertStart) {
      // Trim right edge to insertStart.
      out.push({ ...c, durationSec: insertStart - c.timelineStartSec });
    } else if (cEnd > overwriteEnd) {
      // Trim left edge to overwriteEnd.
      if (!inserted) {
        out.push({
          id: newId,
          kind: "video",
          index: c.index,
          timelineStartSec: insertStart,
          durationSec: source.durationSec,
          videoUrl: source.videoUrl,
          thumbnailUrl: source.thumbnailUrl,
          prompt: source.prompt ?? "Overwrite",
          takes: [],
        });
        inserted = true;
      }
      out.push({ ...c, timelineStartSec: overwriteEnd, durationSec: cEnd - overwriteEnd });
    }
    // else fully inside — drop entirely.
  }
  if (!inserted) {
    out.push({
      id: newId,
      kind: "video",
      index: out.length,
      timelineStartSec: insertStart,
      durationSec: source.durationSec,
      videoUrl: source.videoUrl,
      thumbnailUrl: source.thumbnailUrl,
      prompt: source.prompt ?? "Overwrite",
      takes: [],
    });
  }
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s, i) =>
      i === 0 ? { ...s, clips: out } : { ...s, clips: [] },
    ),
  };
  historize(recompute(project), {
    selectedClipId: newId,
    selectedClipIds: [newId],
  });
  return newId;
}

export function trimClip(clipId: string, durationSec: number): void {
  if (!state.project) return;
  // Lock check — block trim on locked-track clips.
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const target = allClips.find((c) => c.id === clipId);
  if (target && isClipOnLockedTrack(target)) return;
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
  historizeCoalesced(recompute(project), `trim:${clipId}`);
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
    speed?: number;
    muted?: boolean;
    soloed?: boolean;
    filter?: string;
    mirror?: boolean;
    titleText?: string;
    titleColor?: string;
    colorGrade?: import("./color-grade").ColorGrade | null;
    characterId?: string | null;
    voiceProfileId?: string | null;
    trackId?: string | null;
  },
): void {
  if (!state.project) return;
  // Property edits are rapid (sliders fire on every input event).
  // To avoid filling the undo stack with every intermediate value,
  // coalesce consecutive identical-key edits to the same clip into
  // a single history entry: we only record history on the FIRST
  // edit of a slider-drag burst.
  const last = state.history.past[state.history.past.length - 1];
  // Burst detection is LABEL-ONLY. The previous `&& state.project !==
  // last.project` ref check broke whenever any other mutation produced
  // a fresh project object between two slider events — the burst
  // wasn't recognized and every micro-edit pushed its own history
  // entry, so a single drag took dozens of Cmd-Z presses to undo.
  // Matches the working label-only pattern used by the effect/audio
  // mutators below.
  const isBurstContinuation = last?.label === `prop:${clipId}`;
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
    speed?: number;
    muted?: boolean;
    soloed?: boolean;
    filter?: string;
    mirror?: boolean;
    titleText?: string;
    titleColor?: string;
    colorGrade?: import("./color-grade").ColorGrade | null;
    // These three were read in the body (lines below) but missing from
    // the signature, so callers couldn't pass them — trackId routing,
    // character anchoring, and voice anchoring all silently no-op'd.
    characterId?: string | null;
    voiceProfileId?: string | null;
    trackId?: string | null;
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
        for (const k of [
          "volume",
          "opacity",
          "scale",
          "fadeInSec",
          "fadeOutSec",
          "speed",
        ] as const) {
          if (patch[k] !== undefined) propPatch[k] = patch[k];
        }
        for (const k of ["muted", "soloed", "mirror"] as const) {
          if (patch[k] !== undefined) propPatch[k] = patch[k];
        }
        if (patch.filter !== undefined) propPatch.filter = patch.filter;
        if (patch.colorGrade !== undefined) propPatch.colorGrade = patch.colorGrade;
        if (patch.characterId !== undefined) propPatch.characterId = patch.characterId;
        if (patch.voiceProfileId !== undefined) propPatch.voiceProfileId = patch.voiceProfileId;
        if (patch.trackId !== undefined) propPatch.trackId = patch.trackId;
        if (Object.keys(propPatch).length > 0) {
          next.properties = { ...(c.properties ?? {}), ...propPatch };
        }
        return next;
      }),
    })),
  };
}

/**
 * Set the full color grade for a clip. Pass null to clear the grade.
 * Coalesced into the same history burst as `setClipProperty` so slider
 * drags in the ColorGradePanel don't pollute the undo stack.
 */
export function setClipColorGrade(
  clipId: string,
  grade: import("./color-grade").ColorGrade | null,
): void {
  setClipProperty(clipId, { colorGrade: grade });
}

/**
 * Apply a color grade to multiple clips in one history entry. Used by
 * the LUT browser's "apply to scene" / "apply to all" CTAs. Argument
 * order mirrors `applyEffectToClips(filter, clipIds)` — grade first,
 * targets second — so call sites can read naturally.
 */
export function applyColorGradeToClips(
  grade: import("./color-grade").ColorGrade | null,
  clipIds: string[],
): number {
  if (!state.project) return 0;
  let project = state.project;
  let touched = 0;
  for (const id of clipIds) {
    const before = project;
    project = buildPropertyMutation(project, id, { colorGrade: grade });
    if (project !== before) touched += 1;
  }
  historize(project, undefined, `applyGrade:${clipIds.length}`);
  return touched;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crossover-recipe effects — per-clip stingers + sustained overlays
// ─────────────────────────────────────────────────────────────────────────────

/** Add an EffectInstance to a clip. Coalesced into history. */
export function addClipEffect(
  clipId: string,
  effect: import("./effects").EffectInstance,
): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map(s => ({
      ...s,
      clips: s.clips.map(c => {
        if (c.id !== clipId) return c;
        const effects = [...(c.effects ?? []), effect];
        return { ...c, effects };
      }),
    })),
  };
  historize(project, undefined, `addEffect:${clipId}:${effect.id}`);
}

/** Replace an EffectInstance on a clip by id. Coalesces into the same
 *  history burst as setClipProperty so slider drags don't fill undo. */
export function updateClipEffect(
  clipId: string,
  effectId: string,
  patch: Partial<import("./effects").EffectInstance>,
): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map(s => ({
      ...s,
      clips: s.clips.map(c => {
        if (c.id !== clipId) return c;
        const effects = (c.effects ?? []).map(fx =>
          fx.id === effectId ? { ...fx, ...patch } : fx,
        );
        return { ...c, effects };
      }),
    })),
  };
  const last = state.history.past[state.history.past.length - 1];
  const burstLabel = `fx:${clipId}:${effectId}`;
  if (last?.label === burstLabel) set({ project });
  else historize(project, undefined, burstLabel);
}

/** Remove an EffectInstance from a clip. */
export function removeClipEffect(clipId: string, effectId: string): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map(s => ({
      ...s,
      clips: s.clips.map(c => {
        if (c.id !== clipId) return c;
        const effects = (c.effects ?? []).filter(fx => fx.id !== effectId);
        return { ...c, effects };
      }),
    })),
  };
  historize(project, undefined, `removeEffect:${clipId}:${effectId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio mixing — per-clip mix + project-level master loudness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the full audio mix for a clip. Coalesced into the same history
 * burst as setClipProperty so slider drags in the AudioMixPanel don't
 * pollute the undo stack.
 */
export function setClipAudioMix(
  clipId: string,
  mix: import("./audio-mix").AudioMix | null,
): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map(s => ({
      ...s,
      clips: s.clips.map(c => {
        if (c.id !== clipId) return c;
        return { ...c, properties: { ...(c.properties ?? {}), audioMix: mix } };
      }),
    })),
  };
  const last = state.history.past[state.history.past.length - 1];
  const burstLabel = `audio:${clipId}`;
  if (last?.label === burstLabel) set({ project });
  else historize(project, undefined, burstLabel);
}

/** Set the project's master loudness preset. */
export function setMasterLoudness(
  preset: import("./audio-mix").MasterLoudnessPreset,
): void {
  if (!state.project) return;
  const project: EditorProject = { ...state.project, masterLoudness: preset };
  historize(project, undefined, `masterLoudness:${preset}`);
}

/** Set the project's aspect ratio. Triggers a re-render so PlayerCanvas
 *  remeasures its locked-aspect container. Persistence is handled by
 *  the caller (it writes movie_projects.aspect_ratio in the same tick). */
export function setAspectRatio(ratio: AspectRatio): void {
  if (!state.project || state.project.aspectRatio === ratio) return;
  const project: EditorProject = { ...state.project, aspectRatio: ratio };
  historize(project, undefined, `aspectRatio:${ratio}`);
}

/** Clear all effects from a clip. */
export function clearClipEffects(clipId: string): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map(s => ({
      ...s,
      clips: s.clips.map(c => {
        if (c.id !== clipId) return c;
        return { ...c, effects: [] };
      }),
    })),
  };
  historize(project, undefined, `clearEffects:${clipId}`);
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

// ─── Keyframes ───────────────────────────────────────────────────────────────
/**
 * Add (or update) a keyframe for `property` at the current playhead's
 * position INSIDE the given clip. If a keyframe already exists at
 * roughly the same time (within 0.05s) on this property, it gets
 * its value replaced — so dragging a slider with the keyframe button
 * "live" updates the captured value instead of stacking duplicates.
 */
export function addKeyframeAtPlayhead(
  clipId: string,
  property: AnimatableProperty,
  value: number,
): boolean {
  if (!state.project) return false;
  let captured = false;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        const relativeTime = Math.max(
          0,
          Math.min(c.durationSec, state.playheadSec - c.timelineStartSec),
        );
        if (state.playheadSec < c.timelineStartSec || state.playheadSec > c.timelineStartSec + c.durationSec) {
          // Playhead is outside the clip — nothing to capture.
          return c;
        }
        captured = true;
        const existing = (c.keyframes ?? []).filter(
          (k) => k.property === property,
        );
        const near = existing.find((k) => Math.abs(k.time - relativeTime) < 0.05);
        if (near) {
          return {
            ...c,
            keyframes: (c.keyframes ?? []).map((k) =>
              k.id === near.id ? { ...k, value } : k,
            ),
          };
        }
        const kf: Keyframe = {
          id: `kf-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6).toString(36)}`,
          property,
          time: relativeTime,
          value,
        };
        return { ...c, keyframes: [...(c.keyframes ?? []), kf] };
      }),
    })),
  };
  if (!captured) return false;
  historize(project, undefined, `kf:${clipId}:${property}`);
  return true;
}

export function removeKeyframe(clipId: string, keyframeId: string): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) =>
        c.id !== clipId
          ? c
          : {
              ...c,
              keyframes: (c.keyframes ?? []).filter((k) => k.id !== keyframeId),
            },
      ),
    })),
  };
  historize(project, undefined, `kf:remove:${clipId}`);
}

export function clearKeyframes(clipId: string, property: AnimatableProperty): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) =>
        c.id !== clipId
          ? c
          : {
              ...c,
              keyframes: (c.keyframes ?? []).filter((k) => k.property !== property),
            },
      ),
    })),
  };
  historize(project, undefined, `kf:clear:${clipId}:${property}`);
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
  // Razor only splits V1 video clips — splitting a title card has
  // no meaning (it's a static overlay) and silently produces two
  // half-titles both anchored at timelineStartSec=0. Filter on the
  // predicate so the user's split lands on the underlying video
  // even if a title overlaps the playhead.
  const target = allClips.find(
    (c) =>
      c.kind !== "title" &&
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
  // distribute back to the synthetic scene[0] model (v1). Re-number
  // every clip's `index` contiguously after the split so the right
  // half doesn't reuse the original's index (which caused duplicate
  // numbers in the timeline filmstrip).
  const newFlat: EditorClip[] = [];
  for (const c of allClips) {
    if (c.id === target.id) {
      newFlat.push(updatedTarget);
      newFlat.push(newClip);
    } else {
      newFlat.push(c);
    }
  }
  // Renumber video clips contiguously; leave titles untouched. The
  // index field becomes the filmstrip's "shot 01 / shot 02 / ..."
  // label — titles aren't shots, so giving them a sequential index
  // pollutes the numbering for every video that comes after them.
  let videoCounter = 0;
  for (let i = 0; i < newFlat.length; i++) {
    if (newFlat[i].kind === "title") continue;
    newFlat[i] = { ...newFlat[i], index: videoCounter };
    videoCounter += 1;
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
  // Was `set({ project })` — produced no undo history. Take swaps
  // are user-visible mutations; route through historize so Cmd-Z
  // restores the previous take.
  historize(project, undefined, `take:${clipId}`);
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

  // Flatten + CLONE every clip by id. The previous version stored
  // references in clipById and mutated `c.durationSec = ...` etc. in
  // place — but those references were ALSO inside prior history
  // snapshots, so undo couldn't restore the pre-edit values (both
  // "before" and "after" pointed at the same object). Cloning here
  // means each historize() call gets distinct objects to snapshot.
  const allClips: EditorClip[] = state.project.scenes.flatMap((s) => s.clips);
  const clipById = new Map<string, EditorClip>(allClips.map((c) => [c.id, { ...c }]));

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

  // 3. clip order — always pull from clipById (CLONED). The previous
  // code's `return allClips` short-circuit was passing the ORIGINAL
  // clip references through, defeating the clone-for-undo work above.
  const orderedClips: EditorClip[] = (() => {
    const cloned = (id: string): EditorClip | undefined => clipById.get(id);
    if (!edits.clipOrder) {
      return allClips.map((c) => cloned(c.id) ?? { ...c });
    }
    const seen = new Set<string>();
    const out: EditorClip[] = [];
    for (const id of edits.clipOrder) {
      const c = cloned(id);
      if (c && !seen.has(id)) {
        out.push(c);
        seen.add(id);
      }
    }
    // Append any clips not in the saved order (new from supabase)
    for (const c of allClips) {
      if (!seen.has(c.id)) out.push(cloned(c.id) ?? { ...c });
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

// ─── Transitions (between-clip crossfades on V1) ─────────────────────────────
/** Add a transition at the boundary between two adjacent V1 clips. If
 *  one already exists for that boundary, replace it. Duration is
 *  clamped to half the shorter of the two clip durations so it always
 *  fits inside both clips. */
export function addTransition(
  fromClipId: string,
  toClipId: string,
  kind: TransitionKind = "fade",
  durationSec: number = TRANSITION_DEFAULT_SEC,
): string | null {
  if (!state.project) return null;
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const from = allClips.find((c) => c.id === fromClipId);
  const to = allClips.find((c) => c.id === toClipId);
  if (!from || !to) return null;
  const maxDur = Math.max(0.05, Math.min(from.durationSec, to.durationSec) / 2);
  const dur = Math.max(0.05, Math.min(maxDur, durationSec));
  const id = `xfade-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const transition: ClipTransition = { id, fromClipId, toClipId, durationSec: dur, kind };
  const existing = state.project.transitions ?? [];
  const filtered = existing.filter(
    (t) => !(t.fromClipId === fromClipId && t.toClipId === toClipId),
  );
  const project: EditorProject = {
    ...state.project,
    transitions: [...filtered, transition],
  };
  historize(project, { selectedTransitionId: id, selectedClipId: null, selectedClipIds: [] });
  return id;
}

export function updateTransition(
  id: string,
  patch: { durationSec?: number; kind?: TransitionKind },
): void {
  if (!state.project) return;
  const existing = state.project.transitions ?? [];
  const cur = existing.find((t) => t.id === id);
  if (!cur) return;
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const from = allClips.find((c) => c.id === cur.fromClipId);
  const to = allClips.find((c) => c.id === cur.toClipId);
  const maxDur = from && to
    ? Math.max(0.05, Math.min(from.durationSec, to.durationSec) / 2)
    : 5;
  const next: ClipTransition = {
    ...cur,
    durationSec:
      patch.durationSec !== undefined
        ? Math.max(0.05, Math.min(maxDur, patch.durationSec))
        : cur.durationSec,
    kind: patch.kind ?? cur.kind,
  };
  const project: EditorProject = {
    ...state.project,
    transitions: existing.map((t) => (t.id === id ? next : t)),
  };
  const last = state.history.past[state.history.past.length - 1];
  // Label-only burst detection (see setClipProperty for rationale).
  const burst = last?.label === `xfade:${id}`;
  if (burst) {
    set({ project });
  } else {
    historize(project, undefined, `xfade:${id}`);
  }
}

export function removeTransition(id: string): void {
  if (!state.project) return;
  const existing = state.project.transitions ?? [];
  if (!existing.some((t) => t.id === id)) return;
  const project: EditorProject = {
    ...state.project,
    transitions: existing.filter((t) => t.id !== id),
  };
  historize(project, {
    selectedTransitionId: state.selectedTransitionId === id ? null : state.selectedTransitionId,
  });
}

export function selectTransition(id: string | null): void {
  if (state.selectedTransitionId === id) return;
  set({
    selectedTransitionId: id,
    selectedClipId: id ? null : state.selectedClipId,
    selectedClipIds: id ? [] : state.selectedClipIds,
  });
}

// ─── Text overlays ──────────────────────────────────────────────────
// Project-level broadcast text (chyrons, titles, captions, callouts).
// Authored from the TextStudio panel; rendered live by TextOverlayLayer
// over the StitchedPlayer; persisted via editor_state JSONB.

export function addTextOverlay(
  overlay: import("./text-overlays").TextOverlay,
): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    textOverlays: [...(state.project.textOverlays ?? []), overlay],
  };
  historize(project, undefined);
}

export function updateTextOverlay(
  id: string,
  patch: Partial<import("./text-overlays").TextOverlay>,
): void {
  if (!state.project) return;
  const existing = state.project.textOverlays ?? [];
  if (!existing.some((o) => o.id === id)) return;
  const project: EditorProject = {
    ...state.project,
    textOverlays: existing.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
  // Slider drags fire on every value — coalesce per-overlay updates
  // into a single history entry the same way clip property edits do.
  const last = state.history.past[state.history.past.length - 1];
  const burstLabel = `text:${id}`;
  // Label-only burst detection (see setClipProperty for rationale).
  if (last?.label === burstLabel) {
    set({ project });
  } else {
    historize(project, undefined, burstLabel);
  }
}

export function removeTextOverlay(id: string): void {
  if (!state.project) return;
  const existing = state.project.textOverlays ?? [];
  if (!existing.some((o) => o.id === id)) return;
  const project: EditorProject = {
    ...state.project,
    textOverlays: existing.filter((o) => o.id !== id),
  };
  historize(project, undefined);
}

// ─── Timeline tracks ──────────────────────────────────────────────────────
// CRUD for the dynamic project.tracks[] array. System tracks (V1/V2/V3/A1/A2)
// can be renamed and reordered but not deleted — the export pipeline has
// hardcoded references to them.

export function addTrack(kind: "video" | "audio"): void {
  if (!state.project) return;
  const tracks = state.project.tracks ?? [];
  // Find next available index per kind for the default label.
  const sameKind = tracks.filter((t) => t.kind === kind);
  const nextN = (sameKind.length + 1).toString();
  const prefix = kind === "video" ? "V" : "A";
  // New tracks land at the bottom of their kind cluster.
  const lastPos = tracks.length > 0 ? Math.max(...tracks.map((t) => t.position)) : -1;
  const newTrack: import("./types").EditorTrack = {
    id: `usr:${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`,
    kind,
    label: `${prefix}${nextN} · ${kind === "video" ? "Video" : "Audio"}`,
    height: kind === "video" ? 60 : 40,
    position: lastPos + 1,
  };
  const project: EditorProject = { ...state.project, tracks: [...tracks, newTrack] };
  historize(project, undefined);
}

export function removeTrack(trackId: string): void {
  if (!state.project) return;
  const tracks = state.project.tracks ?? [];
  const t = tracks.find((x) => x.id === trackId);
  if (!t || t.isSystem) return; // System tracks are protected
  // Re-pack positions so deletion doesn't leave gaps.
  const remaining = tracks
    .filter((x) => x.id !== trackId)
    .sort((a, b) => a.position - b.position)
    .map((x, i) => ({ ...x, position: i }));
  // Reassign any clip that pointed at the deleted track back to the
  // matching system default (V1 for video, A1 for audio). Without this
  // the clip's properties.trackId references a track that no longer
  // exists — the render groups by trackId and would either drop the
  // clip or mis-route it.
  const fallbackTrack = t.kind === "audio" ? "sys:A1" : "sys:V1";
  const scenes = state.project.scenes.map((s) => ({
    ...s,
    clips: s.clips.map((c) => {
      const cid = (c.properties as { trackId?: string } | undefined)?.trackId;
      if (cid !== trackId) return c;
      return { ...c, properties: { ...(c.properties ?? {}), trackId: fallbackTrack } };
    }),
  }));
  const project: EditorProject = { ...state.project, tracks: remaining, scenes };
  historize(project, undefined);
}

export function renameTrack(trackId: string, label: string): void {
  if (!state.project) return;
  const tracks = state.project.tracks ?? [];
  const trimmed = label.trim().slice(0, 40);
  if (!trimmed) return;
  const next = tracks.map((t) => (t.id === trackId ? { ...t, label: trimmed } : t));
  const project: EditorProject = { ...state.project, tracks: next };
  // Renames coalesce so a typing burst doesn't fill the history stack.
  const last = state.history.past[state.history.past.length - 1];
  const burstLabel = `track-rename:${trackId}`;
  // Label-only burst detection (see setClipProperty for rationale).
  if (last?.label === burstLabel) {
    set({ project });
  } else {
    historize(project, undefined, burstLabel);
  }
}

export function reorderTracks(trackId: string, toIndex: number): void {
  if (!state.project) return;
  const tracks = (state.project.tracks ?? []).slice().sort((a, b) => a.position - b.position);
  const fromIdx = tracks.findIndex((t) => t.id === trackId);
  if (fromIdx < 0) return;
  const clamped = Math.max(0, Math.min(tracks.length - 1, toIndex));
  if (fromIdx === clamped) return;
  const [picked] = tracks.splice(fromIdx, 1);
  tracks.splice(clamped, 0, picked);
  const repositioned = tracks.map((t, i) => ({ ...t, position: i }));
  const project: EditorProject = { ...state.project, tracks: repositioned };
  historize(project, undefined);
}

export function setTrackProps(
  trackId: string,
  patch: { muted?: boolean; soloed?: boolean; locked?: boolean; height?: number },
): void {
  if (!state.project) return;
  const tracks = state.project.tracks ?? [];
  if (!tracks.some((t) => t.id === trackId)) return;
  const next = tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t));
  const project: EditorProject = { ...state.project, tracks: next };
  historize(project, undefined);
}

// ─── Playback chrome (speed / loop / theater / fullscreen) ──────────────────
export function setPlaybackSpeed(speed: number): void {
  const clamped = Math.max(0.05, Math.min(8, speed));
  if (state.playbackSpeed === clamped) return;
  set({ playbackSpeed: clamped });
}

export function toggleLoopRegion(): void {
  set({ loopRegion: !state.loopRegion });
}

export function setLoopRegion(loop: boolean): void {
  if (state.loopRegion === loop) return;
  set({ loopRegion: loop });
}

export function toggleTheaterMode(): void {
  set({ theaterMode: !state.theaterMode });
}

export function setTheaterMode(on: boolean): void {
  if (state.theaterMode === on) return;
  set({ theaterMode: on });
}

export function setFullscreen(on: boolean): void {
  if (state.isFullscreen === on) return;
  set({ isFullscreen: on });
}

// ─── Studio Library — premium effects + project templates ───────────
/**
 * Apply a cinematic effect (CSS filter recipe) to every clip in
 * `clipIds`. When `clipIds` is empty/undefined, applies to the whole
 * V1 chain — the "let the director pick the look once" gesture. One
 * history entry per call regardless of clip count.
 */
/**
 * Map a PREMIUM_EFFECT id to the closest LUT_LIBRARY id. The render
 * pipeline only reads `properties.colorGrade.lutId`; writing just
 * `properties.filter` (CSS) means the export ships without the grade.
 * This table bridges the two so StudioLibrary tiles affect the bake.
 */
const EFFECT_TO_LUT_ID: Record<string, string> = {
  "kodak-2383":      "kodak-2383",
  "fuji-eterna":     "fuji-eterna",
  "portra-400":      "portra-400",
  "wes-anderson":    "anderson-budapest",
  "fincher-cyan":    "fincher-cold",
  "cyberpunk-neon":  "bladerunner-2049",
  "bleach-bypass":   "ilford-hp5",
  "moonlight":       "moonlight",
  "wong-kar-wai":    "wong-kar-wai",
  "roma":            "roma",
  "teal-orange":     "teal-orange",
  "golden-hour":     "70s-warm",
  "nordic-noir":     "fincher-cold",
  "16mm-grain":      "kodak-vision3-500t",
  "35mm-print":      "portra-400",
  "vhs-chroma":      "80s-neon",
  "dream-bloom":     "wong-kar-wai",
};

// CSS-filter → LUT id reverse lookup. The shared source of truth for
// both applyEffectToClips and applyProjectTemplate. Each needle is a
// distinctive substring from a PREMIUM_EFFECTS entry's cssFilter. The
// match is intentionally loose: small numeric tweaks in future
// PREMIUM_EFFECTS edits should still resolve to the same LUT.
//
// Order matters: the FIRST matching needle wins. Put longer / more
// specific needles ahead of generic ones so e.g. fincher-cyan's
// "saturate(0.85) contrast(1.18) hue-rotate(8deg)" matches before the
// generic vhs-chroma "saturate(0.85)".
const FILTER_SIGNATURES: { needle: string; lutId: string }[] = [
  // Color grades
  { needle: "saturate(1.18) contrast(1.14)",                    lutId: "teal-orange" },
  { needle: "saturate(0.45) contrast(1.32)",                    lutId: "ilford-hp5" },          // Bleach Bypass
  { needle: "saturate(1.08) contrast(1.10)",                    lutId: "kodak-2383" },
  { needle: "saturate(1.25) brightness(1.06)",                  lutId: "anderson-budapest" },   // Wes Anderson
  { needle: "saturate(1.45) contrast(1.22)",                    lutId: "bladerunner-2049" },    // Cyberpunk Neon
  { needle: "saturate(0.85) contrast(1.18) hue-rotate(8deg)",   lutId: "fincher-cold" },        // Fincher Cyan
  { needle: "saturate(1.22) brightness(1.10)",                  lutId: "70s-warm" },            // Golden Hour
  { needle: "saturate(0.55) contrast(1.20)",                    lutId: "fincher-cold" },        // Nordic Noir
  // Film textures
  { needle: "saturate(1.05) contrast(1.08)",                    lutId: "kodak-vision3-500t" },  // 16mm Grain
  { needle: "saturate(1.12) contrast(1.14)",                    lutId: "portra-400" },          // 35mm Print
  { needle: "saturate(0.85) contrast(0.92)",                    lutId: "80s-neon" },            // VHS Chroma
  // Atmosphere
  { needle: "saturate(0.90) brightness(1.12)",                  lutId: "wong-kar-wai" },        // Dream Bloom
];

function resolveLutIdFromFilter(filter: string | null | undefined): string | null {
  if (!filter) return null;
  for (const sig of FILTER_SIGNATURES) {
    if (filter.includes(sig.needle)) return sig.lutId;
  }
  return null;
}

export function applyEffectToClips(filter: string, clipIds?: string[]): boolean {
  if (!state.project) return false;
  const targetSet = clipIds && clipIds.length > 0 ? new Set(clipIds) : null;
  // Resolve a LUT id from the CSS filter string by reverse-lookup
  // through PREMIUM_EFFECTS. The library export was already imported
  // by callers that drove this function, so we can match on the
  // filter string itself when the id isn't passed in.
  // Best-effort: scan PREMIUM_EFFECTS for a matching cssFilter and
  // derive the lutId from that. Doing it inline avoids new imports.
  // Map CSS-filter substrings to a LUT id. Avoiding an import from
  // ./library here to keep the module-init graph simple; if a caller
  // wants explicit control they should drive applyColorGradeToClips
  // directly. The substring match is loose by design — slight
  // numeric variations between effect builds shouldn't drop the LUT.
  const derivedLutId = resolveLutIdFromFilter(filter);
  let touched = 0;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.kind === "title") return c;
        if (targetSet && !targetSet.has(c.id)) return c;
        touched += 1;
        // Write BOTH: the CSS filter (for live preview compat) AND a
        // colorGrade containing the lutId so seamless-stitcher's
        // bake actually applies the look on export. Without the
        // colorGrade write, every StudioLibrary tile silently
        // rendered with no grade.
        const props = { ...(c.properties ?? {}), filter };
        if (derivedLutId) {
          props.colorGrade = {
            lutId: derivedLutId,
            lutMix: 1,
            wheel: { lift: { r:0,g:0,b:0 }, gamma: { r:0,g:0,b:0 }, gain: { r:0,g:0,b:0 } },
            // Previously `{} as never` — empty objects compile to a no-op
            // grade in the bake even though the user picked a LUT.
            // IDENTITY_CURVES + IDENTITY_HSL_BY_RANGE give the bake a
            // well-formed grade where the LUT supplies the look and
            // the curves/hsl pass through unchanged.
            curves: IDENTITY_CURVES,
            hsl: IDENTITY_HSL_BY_RANGE,
            saturation: 0,
            contrast: 0,
            vibrance: 0,
            temperature: 0,
            tint: 0,
            sharpness: 0,
            highlights: 0,
            shadows: 0,
          };
        } else if (!filter || filter.trim() === "") {
          // NEUTRAL = explicitly clear the prior bake. Previously, picking
          // the Neutral chip in StudioLibrary set CSS filter to "" but
          // left colorGrade intact, so preview went neutral while the
          // rendered MP4 kept the previously-baked grade. Set null so
          // compileClipColorFilter emits no color stage at render time.
          props.colorGrade = null as never;
        }
        return {
          ...c,
          properties: props,
        };
      }),
    })),
  };
  if (touched === 0) return false;
  historize(project, undefined, `effect:apply`);
  return true;
}

/**
 * Apply a project template — sweeping recipe across the whole film:
 *   1. Set every V1 clip's filter to the template's effect (if any)
 *      and its per-clip fadeIn/fadeOut.
 *   2. Replace every boundary transition with the template's
 *      kind+duration.
 *   3. Set master playbackSpeed.
 *
 * Single history entry so the user can A/B the whole template with
 * one undo. Returns the count of boundaries that got a transition.
 */
export function applyProjectTemplate(input: {
  filter?: string;
  fadeInSec: number;
  fadeOutSec: number;
  transitionKind: TransitionKind;
  transitionDurationSec: number;
  playbackSpeed: number;
}): { clipsTouched: number; boundariesTouched: number } {
  if (!state.project) return { clipsTouched: 0, boundariesTouched: 0 };
  let clipsTouched = 0;
  // Reuse the same CSS-filter → LUT mapping applyEffectToClips uses
  // so a template applied via the Studio Library reaches the bake.
  // Without this, every PROJECT_TEMPLATE silently shipped a neutral
  // render even though the live preview showed the look.
  const templateLutId = resolveLutIdFromFilter(input.filter);
  const updatedScenes = state.project.scenes.map((s) => ({
    ...s,
    clips: s.clips.map((c) => {
      if (c.kind === "title") return c;
      clipsTouched += 1;
      const props: ClipProperties = {
        ...(c.properties as ClipProperties | undefined ?? ({} as ClipProperties)),
      } as ClipProperties;
      if (input.filter !== undefined) props.filter = input.filter;
      if (templateLutId) {
        props.colorGrade = {
          lutId: templateLutId,
          lutMix: 1,
          wheel: { lift: { r:0,g:0,b:0 }, gamma: { r:0,g:0,b:0 }, gain: { r:0,g:0,b:0 } },
          curves: IDENTITY_CURVES,
          hsl: IDENTITY_HSL_BY_RANGE,
          saturation: 0,
          contrast: 0,
          vibrance: 0,
          temperature: 0,
          tint: 0,
          sharpness: 0,
          highlights: 0,
          shadows: 0,
        };
      }
      props.fadeInSec = input.fadeInSec;
      props.fadeOutSec = input.fadeOutSec;
      return { ...c, properties: { ...c.properties, ...props } };
    }),
  }));

  // Build a transition for every V1 boundary.
  const v1Clips = updatedScenes
    .flatMap((s) => s.clips)
    .filter((c) => c.kind !== "title");
  const transitions: ClipTransition[] = [];
  for (let i = 0; i < v1Clips.length - 1; i++) {
    const from = v1Clips[i];
    const to = v1Clips[i + 1];
    const maxDur = Math.max(0.05, Math.min(from.durationSec, to.durationSec) / 2);
    const id = `xfade-template-${i}-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    transitions.push({
      id,
      fromClipId: from.id,
      toClipId: to.id,
      kind: input.transitionKind,
      durationSec: Math.max(0.05, Math.min(maxDur, input.transitionDurationSec)),
    });
  }

  const project: EditorProject = {
    ...state.project,
    scenes: updatedScenes,
    transitions,
  };
  const playbackSpeed = Math.max(0.05, Math.min(8, input.playbackSpeed));
  historize(project, { playbackSpeed }, `template:apply`);
  return { clipsTouched, boundariesTouched: transitions.length };
}


// ─── Inline clip creation (Editor → Studio path) ────────────────────
/**
 * Append a freshly-generating clip to the project's V1 chain so the
 * UI shows it immediately while the edge function runs in the
 * background. The clip carries videoUrl=null and a pending takes
 * marker so PlayerCanvas renders the "still rendering" state.
 *
 * Called by the CreatePanel after it has POSTed to
 * editor-generate-clip and persisted a video_clips row. Returns the
 * EditorClip id so the caller can update durationSec / videoUrl when
 * the prediction lands.
 */
export function appendPendingClip(input: {
  id: string;
  prompt: string;
  durationSec: number;
  thumbnailUrl: string | null;
  /** Optional take metadata — when present, the takes drawer shows
   *  the pending clip in its takes list too. */
  takeNumber?: number;
}): string | null {
  if (!state.project) return null;
  const clip: EditorClip = {
    id: input.id,
    index: state.project.scenes[0]?.clips.length ?? 0,
    timelineStartSec: 0, // recomputes below
    durationSec: Math.max(0.5, input.durationSec),
    videoUrl: null,
    thumbnailUrl: input.thumbnailUrl,
    prompt: input.prompt,
    takes: input.takeNumber
      ? [
          {
            id: `${input.id}-take`,
            takeNumber: input.takeNumber,
            videoUrl: null,
            thumbnailUrl: input.thumbnailUrl,
            promptUsed: input.prompt,
            status: "pending",
            createdAt: new Date(0).toISOString(),
          },
        ]
      : [],
  };
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s, i) =>
      i === 0 ? { ...s, clips: [...s.clips, clip] } : s,
    ),
  };
  historize(recompute(project), {
    selectedClipId: clip.id,
    selectedClipIds: [clip.id],
  });
  return clip.id;
}

/**
 * Once the edge function returns a completed prediction, swap the
 * pending clip's videoUrl + thumbnail in place. Does NOT push to the
 * undo stack — the clip is conceptually the SAME atom going from
 * pending → ready, not a new edit the user should be able to undo
 * back to "no video".
 */
export function resolvePendingClip(
  clipId: string,
  patch: { videoUrl: string; thumbnailUrl?: string | null; durationSec?: number },
): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        return {
          ...c,
          videoUrl: patch.videoUrl,
          thumbnailUrl: patch.thumbnailUrl ?? c.thumbnailUrl,
          durationSec:
            patch.durationSec !== undefined
              ? Math.max(0.5, patch.durationSec)
              : c.durationSec,
          takes: c.takes.map((t, i) =>
            i === 0 && t.status === "pending"
              ? { ...t, videoUrl: patch.videoUrl, status: "completed" }
              : t,
          ),
        };
      }),
    })),
  };
  set({ project: recompute(project) });
}

/**
 * Drop a pending clip if the edge function fails — keeps the project
 * clean of zombie rows. No history push (mirror of resolvePendingClip).
 */
export function dropPendingClip(clipId: string): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.filter((c) => c.id !== clipId),
    })),
  };
  set({ project: recompute(project) });
}

/** Remove a clip from the timeline. Ripple closes the gap. */
/**
 * clearAllClips — wipe every clip across every scene, plus the transition
 * graph. The scenes themselves stay (so the doc layer's scene metadata
 * survives), but each scene returns with `clips: []`. Pushed to history
 * so the user can Cmd-Z back to their full timeline.
 */
export function clearAllClips(): void {
  if (!state.project) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({ ...s, clips: [] })),
    transitions: [],
  };
  const next = recompute(project);
  historize(next, {
    selectedClipId: null,
    selectedClipIds: [],
  });
}

export function deleteClip(clipId: string): void {
  if (!state.project) return;
  // Lock check — block deletion of clips on locked tracks.
  const allClips = state.project.scenes.flatMap((s) => s.clips);
  const target = allClips.find((c) => c.id === clipId);
  if (target && isClipOnLockedTrack(target)) return;
  const project: EditorProject = {
    ...state.project,
    scenes: state.project.scenes.map((s) => ({
      ...s,
      clips: s.clips.filter((c) => c.id !== clipId),
    })),
    transitions: (state.project.transitions ?? []).filter(
      (t) => t.fromClipId !== clipId && t.toClipId !== clipId,
    ),
  };
  const next = recompute(project);
  historize(next, {
    selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    selectedClipIds: state.selectedClipIds.filter((id) => id !== clipId),
  });
}
