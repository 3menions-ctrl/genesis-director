/**
 * document-store — the typed mutation layer for ScriptDocument.
 *
 * Every change to a project's document — whether from the editor's
 * inspector, the upload-ingest, the generation orchestrator, or
 * Director Chat — flows through this file. One write API, one
 * persistence path, one snapshot per mutation for the Versions
 * panel.
 *
 * Same external-state pattern as editor-store + cast-store: a
 * single ScriptDocument lives here in memory, useSyncExternalStore
 * subscribers read it, mutations write it + flush to supabase.
 *
 * Why a separate store from editor-store:
 *   - editor-store holds editor-time state (selection, playhead,
 *     view, history) — none of which touches supabase.
 *   - document-store holds the durable project record. Every write
 *     becomes a supabase UPDATE + a versions snapshot.
 *
 *   Cleanly separated so the editor's per-keystroke state doesn't
 *   thrash the network. The document store fires on coarse-grain
 *   user intent (approve shot, regenerate, swap engine).
 */
import type {
  ScriptDocument,
  Shot,
  Beat,
  Scene,
  Character,
  AuthorshipSource,
  ShotApprovalState,
  ModelEngine,
  GeneratedArtifact,
} from "./script-document";
import { newScriptId } from "./script-document";
import { estimateShotCredits } from "./model-catalog";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// External state
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentStoreState {
  doc: ScriptDocument | null;
  /** ISO timestamp of the last successful supabase flush. */
  lastFlushAt: string | null;
  /** ISO timestamp of the last local mutation that hasn't flushed
   *  yet. Drives "saving…" / "saved" indicators. */
  dirtyAt: string | null;
  /** Most recent error from a flush attempt. */
  lastError: string | null;
}

const state: DocumentStoreState = {
  doc: null,
  lastFlushAt: null,
  dirtyAt: null,
  lastError: null,
};

const listeners = new Set<() => void>();

// Snapshot handed to useSyncExternalStore subscribers. Mutators below edit
// `state` (and `state.doc`) IN PLACE, so the snapshot's identity must be
// refreshed on every notify() — otherwise getDocumentState() keeps returning
// the same object reference, React's Object.is bail-out skips the re-render,
// and surfaces like CastEditor never reflect add/remove/edit. We recreate a
// shallow copy only inside notify() (never on every getSnapshot call) so
// repeated getDocumentState() reads between mutations stay referentially
// stable and don't trip the "getSnapshot should be cached" warning / loop.
let snapshot: DocumentStoreState = { ...state };

export function getDocumentState(): DocumentStoreState {
  return snapshot;
}

export function subscribeDocument(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  snapshot = { ...state };
  for (const l of listeners) l();
}

// ─────────────────────────────────────────────────────────────────────────────
// Doc load
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace the active document. Called by the read path
 * (`useScriptDocument`) on mount + on realtime updates. Resets the
 * dirty marker so a fresh-load doesn't immediately read as "saving."
 */
export function setDocument(doc: ScriptDocument | null): void {
  state.doc = doc;
  state.lastFlushAt = doc ? new Date().toISOString() : null;
  state.dirtyAt = null;
  state.lastError = null;
  notify();
}

/** Read the current document — selectors use this. */
export function getDocument(): ScriptDocument | null {
  return state.doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flush — write the document back to supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Debounced flush. Mutations call `markDirty()` synchronously; the
 * actual UPDATE runs FLUSH_DELAY_MS later. Consecutive mutations
 * within the window batch into one UPDATE — important for slider-
 * style edits the inspector emits.
 */
const FLUSH_DELAY_MS = 600;
let flushHandle: number | null = null;

function markDirty(by: AuthorshipSource): void {
  // MUST be wall-clock "now": meta.authoredAt is the monotonic key the
  // realtime conflict guard in useScriptDocument uses to skip stale echoes
  // (cur.authoredAt > incoming.authoredAt). A constant timestamp here (e.g.
  // the 1970 epoch) makes that comparison always false, so every realtime
  // echo overwrites the in-flight local edit → silent lost-update.
  state.dirtyAt = new Date().toISOString();
  if (state.doc) {
    state.doc.meta.authoredAt = state.dirtyAt;
    state.doc.meta.authoredBy = by;
  }
  notify();
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushHandle !== null) {
    window.clearTimeout(flushHandle);
  }
  flushHandle = window.setTimeout(() => {
    flushHandle = null;
    void flushNow();
  }, FLUSH_DELAY_MS);
}

/**
 * Write the in-memory document straight to supabase. Public so the
 * editor can force a flush (e.g. on tab close, before navigation).
 */
export async function flushNow(): Promise<void> {
  const doc = state.doc;
  if (!doc) return;
  try {
    // Try the dedicated column first. If the column doesn't exist
    // (PGRST204), fall back to nesting under pipeline_state.scriptDocument
    // so writes never silently disappear. After migration
    // 20260621000000_add_script_document.sql is applied, the first path
    // succeeds and we stop touching pipeline_state.
    const { error } = await supabase
      .from("movie_projects")
      .update({ script_document: doc } as never)
      .eq("id", doc.meta.projectId);
    if (error) {
      const msg = error.message || "";
      const isColumnMissing = /script_document/.test(msg) && /does not exist|PGRST204/i.test(msg);
      if (!isColumnMissing) throw error;
      // Fallback path — fetch + merge into pipeline_state.
      const { data: row } = await supabase
        .from("movie_projects")
        .select("pipeline_state")
        .eq("id", doc.meta.projectId)
        .maybeSingle();
      const pipeline = ((row as { pipeline_state?: Record<string, unknown> } | null)?.pipeline_state ?? {}) as Record<string, unknown>;
      pipeline.scriptDocument = doc;
      const { error: fbErr } = await supabase
        .from("movie_projects")
        .update({ pipeline_state: pipeline as never } as never)
        .eq("id", doc.meta.projectId);
      if (fbErr) throw fbErr;
    }
    state.lastFlushAt = new Date().toISOString();
    state.dirtyAt = null;
    state.lastError = null;
  } catch (e) {
    state.lastError = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn("[document-store] flush failed:", e);
  }
  notify();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutators — typed write API
// ─────────────────────────────────────────────────────────────────────────────

interface MutateContext {
  /** Who authored this change — affects the version snapshot. */
  by?: AuthorshipSource;
}

/**
 * Patch a shot in place. Mutators take the shot id + a partial; the
 * implementation finds the right shot, applies the patch, and
 * recomputes derived fields (cost, etc).
 */
export function updateShot(
  shotId: string,
  patch: Partial<Shot>,
  ctx: MutateContext = {},
): boolean {
  const doc = state.doc;
  if (!doc) return false;
  let found = false;
  for (const scene of doc.scenes) {
    for (let i = 0; i < scene.shots.length; i++) {
      if (scene.shots[i].id === shotId) {
        const cur = scene.shots[i];
        const next: Shot = { ...cur, ...patch };
        // Re-derive cost when engine, duration, or tier changes.
        if (
          patch.engineOverride !== undefined ||
          patch.durationSec !== undefined
        ) {
          const engine = next.engineOverride ?? doc.capabilities.defaultEngine;
          next.cost = {
            credits: estimateShotCredits(
              engine,
              doc.capabilities.qualityTier,
              next.durationSec,
            ),
            computedFor: { engine, tier: doc.capabilities.qualityTier },
          };
        }
        scene.shots[i] = next;
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (found) markDirty(ctx.by ?? "user");
  return found;
}

/** Update a beat — text, voice override, audio bus, etc. */
export function updateBeat(
  beatId: string,
  patch: Partial<Beat>,
  ctx: MutateContext = {},
): boolean {
  const doc = state.doc;
  if (!doc) return false;
  let found = false;
  for (const scene of doc.scenes) {
    for (let i = 0; i < scene.beats.length; i++) {
      if (scene.beats[i].id === beatId) {
        scene.beats[i] = { ...scene.beats[i], ...patch };
        // Beat edits to an approved shot mean we're out of sync —
        // mark the shot's approval as needs-regen so the user
        // reconfirms before the engine sees the new prompt.
        const owningShot = scene.shots.find((s) => s.beatRefs.includes(beatId));
        if (owningShot && owningShot.approval.state === "completed") {
          owningShot.approval = {
            ...owningShot.approval,
            state: "needs-regen",
            changedAt: new Date().toISOString(),
            changedBy: ctx.by ?? "user",
            reason: "Beat edited after approval",
          };
        }
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (found) markDirty(ctx.by ?? "user");
  return found;
}

/** Update scene-level metadata (slug, mood, time-of-day). */
export function updateScene(
  sceneId: string,
  patch: Partial<Scene>,
  ctx: MutateContext = {},
): boolean {
  const doc = state.doc;
  if (!doc) return false;
  const idx = doc.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return false;
  doc.scenes[idx] = { ...doc.scenes[idx], ...patch };
  markDirty(ctx.by ?? "user");
  return true;
}

/** Add a character. Returns the new id. */
export function addCharacter(
  base: Partial<Character> & { name: string },
  ctx: MutateContext = {},
): string {
  const doc = state.doc;
  if (!doc) throw new Error("no document loaded");
  const id = base.id ?? newScriptId("char");
  doc.cast.push({
    id,
    role: "supporting",
    description: "",
    ...base,
  } as Character);
  markDirty(ctx.by ?? "user");
  return id;
}

/** Add a fresh scene at the end of the document. Returns its id. */
export function addScene(
  base: Partial<Scene> & { slug: string },
  ctx: MutateContext = {},
): string {
  const doc = state.doc;
  if (!doc) throw new Error("no document loaded");
  const id = base.id ?? newScriptId("scene");
  doc.scenes.push({
    id,
    number: doc.scenes.length + 1,
    description: "",
    beats: [],
    shots: [],
    ...base,
  } as Scene);
  markDirty(ctx.by ?? "user");
  return id;
}

/** Add a shot to a scene. Returns the new shot id. */
export function addShot(
  sceneId: string,
  base: Partial<Shot> & { modelPrompt: string; durationSec: number },
  ctx: MutateContext = {},
): string | null {
  const doc = state.doc;
  if (!doc) return null;
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  const id = base.id ?? newScriptId("shot");
  const engine = base.engineOverride ?? doc.capabilities.defaultEngine;
  const shot: Shot = {
    id,
    number: scene.shots.length + 1,
    beatRefs: base.beatRefs ?? [],
    framing: base.framing ?? "medium",
    cameraDirection: base.cameraDirection ?? "",
    durationSec: base.durationSec,
    modelPrompt: base.modelPrompt,
    modelInput: base.modelInput,
    inheritsFromShotId: base.inheritsFromShotId,
    generated: base.generated,
    approval: base.approval ?? {
      state: "draft",
      changedAt: new Date().toISOString(),
      changedBy: ctx.by ?? "user",
    },
    cost: {
      credits: estimateShotCredits(
        engine,
        doc.capabilities.qualityTier,
        base.durationSec,
      ),
      computedFor: { engine, tier: doc.capabilities.qualityTier },
    },
    notes: base.notes,
    engineOverride: base.engineOverride,
    lensIntent: base.lensIntent,
  };
  scene.shots.push(shot);
  markDirty(ctx.by ?? "user");
  return id;
}

/**
 * Change a shot's approval state. This is the ONE GATE. The
 * inspector calls this when the user clicks "Approve & Render."
 * The orchestrator calls it when a job transitions to terminal
 * states. Director Chat calls it via the same path so its writes
 * are auditable in the Versions panel.
 */
export function setShotApproval(
  shotId: string,
  next: ShotApprovalState,
  ctx: MutateContext & { reason?: string } = {},
): boolean {
  return updateShot(
    shotId,
    {
      approval: {
        state: next,
        changedAt: new Date().toISOString(),
        changedBy: ctx.by ?? "user",
        reason: ctx.reason,
      },
    },
    ctx,
  );
}

/** Swap the engine for a single shot. Triggers cost re-derivation. */
export function setShotEngine(
  shotId: string,
  engine: ModelEngine | null,
  ctx: MutateContext = {},
): boolean {
  return updateShot(
    shotId,
    { engineOverride: engine === null ? undefined : engine },
    ctx,
  );
}

/**
 * Write the orchestrator's GeneratedArtifact back into the shot.
 * Called when a job hits the `completed` stage. Marks the shot's
 * approval as `completed` so the editor flips to playback view.
 */
export function persistGenerated(
  shotId: string,
  artifact: GeneratedArtifact,
  ctx: MutateContext = {},
): boolean {
  const ok = updateShot(shotId, {
    generated: artifact,
    approval: {
      state: "completed",
      changedAt: new Date().toISOString(),
      changedBy: ctx.by ?? "manual-edit",
    },
  });
  return ok;
}

/** Drop a shot's generation result and mark it failed. */
export function persistFailure(
  shotId: string,
  errorMessage: string,
  ctx: MutateContext = {},
): boolean {
  return updateShot(shotId, {
    approval: {
      state: "failed",
      changedAt: new Date().toISOString(),
      changedBy: ctx.by ?? "user",
      reason: errorMessage,
    },
  });
}
