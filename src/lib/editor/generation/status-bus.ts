/**
 * generation/status-bus — pub/sub for generation status events.
 *
 * The orchestrator emits StatusEvents; the inspector + status bar
 * + any future surface that cares about generation progress
 * subscribe.
 *
 * Same useSyncExternalStore pattern as the editor-store + cast-
 * store: no Context provider, no third-party dependency, single
 * file external state.
 *
 * Keeps a rolling 200-event ring so a late subscriber can still
 * see the last few transitions. Older events are dropped to keep
 * memory bounded; the document is the durable record.
 */
import type { StatusEvent, JobStage } from "./types";

const MAX_EVENTS = 200;

interface StatusBusState {
  events: StatusEvent[];
  /** Index by jobId for fast lookup ("what stage is job X in?"). */
  current: Map<string, StatusEvent>;
}

const state: StatusBusState = {
  events: [],
  current: new Map(),
};

const listeners = new Set<() => void>();

export function getStatusBus(): StatusBusState {
  return state;
}

export function subscribeStatusBus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push a new event onto the bus. Updates the per-job index so
 * subscribers can read "current stage of job X" in O(1).
 */
export function emitStatus(event: StatusEvent): void {
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }
  state.current.set(event.jobId, event);

  // Once a job reaches a terminal state, evict from `current` after
  // a short delay so dashboards can still show the final state for
  // a beat without leaking job records forever.
  if (event.stage === "completed" || event.stage === "failed") {
    setTimeout(() => {
      // Re-check — a retry might have started in the meantime and
      // we don't want to drop a fresh in-flight job.
      const latest = state.current.get(event.jobId);
      if (latest && latest.at === event.at) {
        state.current.delete(event.jobId);
        notify();
      }
    }, 4000);
  }
  notify();
}

// ─────────────────────────────────────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────────────────────────────────────

/** Latest event for a given job. */
export function getJobStatus(jobId: string): StatusEvent | undefined {
  return state.current.get(jobId);
}

/** Every active job for a given project — used by the status bar
 *  to surface "N rendering" at any time. */
export function activeJobsForProject(projectId: string): StatusEvent[] {
  return Array.from(state.current.values()).filter(
    (e) => e.projectId === projectId,
  );
}

/** Most recent event for a shot — surfaces the inspector's progress
 *  pill even when the shot's job already finished a moment ago. */
export function latestEventForShot(shotId: string): StatusEvent | null {
  // Scan from the tail (newest first) so we land on the most recent
  // event without traversing the whole ring.
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i].shotId === shotId) return state.events[i];
  }
  return null;
}

/** Quick stage check — does this shot currently have an active job? */
export function isShotRendering(shotId: string): boolean {
  for (const ev of state.current.values()) {
    if (ev.shotId === shotId && isInFlightStage(ev.stage)) return true;
  }
  return false;
}

function isInFlightStage(stage: JobStage): boolean {
  return (
    stage === "queued" ||
    stage === "preparing" ||
    stage === "submitting" ||
    stage === "rendering" ||
    stage === "post-processing"
  );
}

/** Reset — used by tests + by the editor when switching projects so
 *  stale jobs from an old project don't bleed into the new one's
 *  status panels. */
export function resetStatusBus(): void {
  state.events.length = 0;
  state.current.clear();
  notify();
}
