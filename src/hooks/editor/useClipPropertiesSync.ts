/**
 * useClipPropertiesSync — debounced save-back of per-clip post-prod
 * state (properties, effects) and project-level master loudness to
 * the database.
 *
 * Why this exists
 *   The editor mutates per-clip JSONB in memory (colorGrade, audioMix,
 *   volume, effects[]). Without this hook those edits live only in the
 *   in-memory store + the localStorage edits snapshot from
 *   usePersistence. The seamless-stitcher's project-mode reads those
 *   same columns straight from the database, so without persisting
 *   them every project-mode render shipped with the raw mix and zero
 *   grading regardless of what the user had set in the Inspector.
 *
 * Mechanism
 *   • Hash each clip's (properties, effects) tuple at the React layer.
 *   • When the hash changes from the last-saved value, schedule a
 *     500ms debounced upsert to `video_clips` patching just those two
 *     columns. The debounce coalesces slider-burst writes so a single
 *     EQ tweak ends up as one PATCH not fifty.
 *   • Same flow for project.masterLoudness against `movie_projects`.
 *   • Skip the demo project (synthetic, no DB row).
 *   • Skip the very first hash baseline (the load) so we don't
 *     immediately write back identical data after hydrate.
 */
import { useEffect, useRef } from "react";
import { useEditor } from "./useEditor";
import { supabase } from "@/integrations/supabase/client";
import { isDemoId } from "@/lib/editor/demoProject";

const DEBOUNCE_MS = 500;

/**
 * Module-level pending-write registry. The hook registers each clip's
 * pending payload here so an external caller (ExportPanel before kicking
 * off a render) can synchronously flush everything before invoking
 * final-assembly. Without this, the user can apply a LUT and click
 * Export within 500ms and the rendered video has no effects.
 */
type PendingWrite = { properties: Record<string, unknown>; effects: unknown };
const pendingWrites = new Map<string, PendingWrite>();
// Module-level mirror of the per-clip debounce timers. Lets
// flushPendingClipWrites cancel them all so a stale timer firing
// AFTER the flush completes can't clobber the just-written row.
// Number because window.setTimeout returns a number in the browser.
const moduleTimers = new Map<string, number>();

/**
 * Flush every pending clip-properties write synchronously to the DB
 * and wait for them to complete. Returns when all writes settled.
 * Safe to call any time — no-ops if nothing is pending.
 *
 * Use from ExportPanel BEFORE kicking off the render so the
 * seamless-stitcher reads the user's latest effects + grades, not
 * whatever the debounce was about to save.
 */
export async function flushPendingClipWrites(): Promise<void> {
  // Cancel every outstanding debounce timer first — the writes they
  // were about to make are now being handled inline here.
  for (const t of moduleTimers.values()) window.clearTimeout(t);
  moduleTimers.clear();
  if (pendingWrites.size === 0) return;
  // Snapshot the entries WITHOUT clearing the map yet. Previously we
  // cleared up-front; any write that failed (network blip, RLS, schema
  // drift) had no entry to retry from and the user's edits silently
  // vanished — directly upstream of "no effects in render."
  const entries = Array.from(pendingWrites.entries());
  const failures: Array<{ clipId: string; message: string }> = [];
  await Promise.all(entries.map(async ([clipId, payload]) => {
    const { error } = await supabase
      .from("video_clips")
      .update(payload as never)
      .eq("id", clipId);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[clip-sync] flush failed for", clipId, error.message);
      failures.push({ clipId, message: error.message });
      return;
    }
    // Only drop the entry from pendingWrites after a CONFIRMED success.
    // A new edit that landed mid-flight (different payload, same key)
    // is preserved — the next debounce or flush picks it up.
    if (pendingWrites.get(clipId) === payload) pendingWrites.delete(clipId);
  }));
  if (failures.length > 0) {
    // Re-throw a synthesized error so the caller (ExportPanel /
    // SaveDialog) can decide whether to proceed with stale data or
    // halt the render. The message lists every failed clip so the
    // user has a triage trail.
    const msg = failures.length === 1
      ? `Clip save failed: ${failures[0].message}`
      : `${failures.length} clip saves failed — ` +
        failures.slice(0, 3).map((f) => f.message).join(" · ") +
        (failures.length > 3 ? ` (+${failures.length - 3} more)` : "");
    throw new Error(msg);
  }
}

function hashClipState(properties: unknown, effects: unknown, keyframes: unknown): string {
  // JSON.stringify with stable key order isn't worth it here — the
  // editor writes both as plain objects authored by typed mutators, so
  // key order is deterministic. If we ever introduce a writer that
  // reorders keys, swap to a stable stringify.
  // Keyframes ride here too — they live on clip.keyframes in memory
  // but we nest them under properties.keyframes on the DB write so
  // they share the existing JSONB column rather than needing another.
  return JSON.stringify({ p: properties ?? null, e: effects ?? null, k: keyframes ?? null });
}

export function useClipPropertiesSync(projectId: string | undefined) {
  const { project } = useEditor();
  /** Last hash we successfully wrote per clip — initialized after
   *  hydrate so the first observed hash is the loaded state, not a
   *  blank one that would trigger a spurious save. */
  const lastSavedClip = useRef<Map<string, string>>(new Map());
  const lastSavedLoudness = useRef<string | null>(null);
  /** Per-clip debounce timers, keyed by clip id. */
  const clipTimers = useRef<Map<string, number>>(new Map());
  const loudnessTimer = useRef<number | null>(null);
  /** Set true after we've seen the hydrate-pass for this projectId.
   *  Until then, observed hashes are treated as baseline, not as
   *  "changes to write". */
  const hydratedFor = useRef<string | null>(null);

  // Reset when projectId changes
  useEffect(() => {
    lastSavedClip.current = new Map();
    lastSavedLoudness.current = null;
    clipTimers.current.forEach((t) => window.clearTimeout(t));
    clipTimers.current.clear();
    if (loudnessTimer.current) {
      window.clearTimeout(loudnessTimer.current);
      loudnessTimer.current = null;
    }
    hydratedFor.current = null;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !project) return;
    if (isDemoId(projectId)) return;
    if (project.id !== projectId) return; // still loading the right one

    const allClips = project.scenes.flatMap((s) => s.clips);

    // ── First pass after load: snapshot all hashes as baseline ────
    if (hydratedFor.current !== projectId) {
      for (const c of allClips) {
        lastSavedClip.current.set(c.id, hashClipState(c.properties, c.effects, c.keyframes));
      }
      lastSavedLoudness.current = project.masterLoudness ?? null;
      hydratedFor.current = projectId;
      return;
    }

    // ── Per-clip diff + debounced write ────────────────────────────
    for (const c of allClips) {
      const h = hashClipState(c.properties, c.effects, c.keyframes);
      const last = lastSavedClip.current.get(c.id);
      if (h === last) continue;

      // Schedule the write; cancel any pending one for this clip
      const existing = clipTimers.current.get(c.id);
      if (existing) window.clearTimeout(existing);

      const clipId = c.id;
      // Keyframes nest into properties for the DB write so we don't
      // need a separate JSONB column. Hydration unpacks them back to
      // clip.keyframes (see useProject). Skip the nest when there are
      // no keyframes to keep the JSONB tidy.
      const properties: Record<string, unknown> = { ...(c.properties ?? {}) };
      if (c.keyframes && c.keyframes.length > 0) {
        properties.keyframes = c.keyframes;
      } else {
        delete properties.keyframes;
      }
      const effects = c.effects ?? null;
      // Stage the payload in the module-level registry so
      // flushPendingClipWrites can drain it on demand (ExportPanel
      // calls this before rendering).
      pendingWrites.set(clipId, { properties, effects });
      const timer = window.setTimeout(async () => {
        clipTimers.current.delete(clipId);
        moduleTimers.delete(clipId);
        // If flushPendingClipWrites already drained us, do nothing —
        // the payload is already in the DB. This is the actual fix
        // for the "stale debounce clobbers fresh flush" race.
        if (!pendingWrites.has(clipId)) return;
        pendingWrites.delete(clipId);
        const { error } = await supabase
          .from("video_clips")
          .update({ properties, effects })
          .eq("id", clipId);
        if (!error) {
          lastSavedClip.current.set(clipId, h);
        } else {
          // eslint-disable-next-line no-console
          console.warn("[clip-sync] save failed", clipId, error.message);
        }
      }, DEBOUNCE_MS);
      clipTimers.current.set(clipId, timer);
      moduleTimers.set(clipId, timer);
    }

    // ── Master loudness diff + debounced write ─────────────────────
    const loud = project.masterLoudness ?? null;
    if (loud !== lastSavedLoudness.current) {
      if (loudnessTimer.current) window.clearTimeout(loudnessTimer.current);
      const targetProjectId = projectId;
      const targetLoud = loud;
      loudnessTimer.current = window.setTimeout(async () => {
        loudnessTimer.current = null;
        const { error } = await supabase
          .from("movie_projects")
          .update({ master_loudness: targetLoud })
          .eq("id", targetProjectId);
        if (!error) {
          lastSavedLoudness.current = targetLoud;
        } else {
          // eslint-disable-next-line no-console
          console.warn("[clip-sync] loudness save failed", error.message);
        }
      }, DEBOUNCE_MS);
    }
  }, [projectId, project]);

  // Flush any pending writes on unmount so a navigation away doesn't
  // drop the last edit. Previously the cleanup only cancelled timers —
  // any edit inside the debounce window when the user navigated away
  // was lost forever. We now fire flushPendingClipWrites so the writes
  // queued by setTimeout still land. The promise is fire-and-forget
  // because React doesn't await cleanup; the worst case is the request
  // continues after unmount, which the browser handles fine.
  useEffect(() => {
    return () => {
      // Don't clearTimeout here — flushPendingClipWrites does it
      // synchronously up front, and clearing twice is harmless but
      // confusing to read.
      void flushPendingClipWrites();
    };
  }, []);
}
