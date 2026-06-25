/**
 * generation/orchestrator — the queue + state machine that drives
 * shot generation across a project.
 *
 * Responsibilities:
 *   - Hold the queue of jobs (one entry per shot that's been
 *     submitted for generation).
 *   - Run the state machine: queued → preparing → submitting →
 *     rendering → post-processing → completed/failed.
 *   - At each transition, emit a StatusEvent to the bus.
 *   - At terminal stages (completed / failed), patch the document
 *     via the write API so the durable record reflects the result.
 *
 * Non-responsibilities (intentionally):
 *   - Engine-specific submit / poll bodies — that's pipeline.ts +
 *     the supabase edge function.
 *   - Choosing WHICH shots to enqueue — that's the inspector + the
 *     approval gate. The orchestrator only handles things already
 *     in the queue.
 *
 * Concurrency:
 *   The orchestrator runs jobs serially per project — frame chains
 *   need the previous shot's last frame before the next can start.
 *   When the user has multiple unrelated projects, those run
 *   independently (one queue per project).
 *
 * Failure handling:
 *   Jobs retry up to maxAttempts on transient errors (network,
 *   provider rate-limit, transient 5xx). Hard errors
 *   (insufficient_credits, invalid_prompt) skip retry. After
 *   maxAttempts, the job lands in `failed` and the shot's
 *   approval.state becomes "failed" so the user sees the issue +
 *   the retry CTA.
 */
import { newScriptId } from "../script-document";
import type {
  GenerationJob,
  JobStage,
  EngineInput,
} from "./types";
import { jobStageToApprovalState, estimateProgress } from "./types";
import { emitStatus } from "./status-bus";

// ─────────────────────────────────────────────────────────────────────────────
// Queue state — single-file external state, useSyncExternalStore
// compatible.
// ─────────────────────────────────────────────────────────────────────────────

interface QueueState {
  /** Active jobs keyed by id. */
  jobs: Map<string, GenerationJob>;
  /** Per-project queue order — orchestrator pops from the front. */
  queues: Map<string /* projectId */, string /* jobId */[]>;
  /** Currently-running job per project (serial execution). */
  running: Map<string /* projectId */, string /* jobId */>;
}

const state: QueueState = {
  jobs: new Map(),
  queues: new Map(),
  running: new Map(),
};

const listeners = new Set<() => void>();

export function getOrchestratorState(): QueueState {
  return state;
}

export function subscribeOrchestrator(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — used by the inspector's "Approve & Render" CTA + the
// upload ingestion + the Director Chat.
// ─────────────────────────────────────────────────────────────────────────────

interface EnqueueArgs {
  projectId: string;
  shotId: string;
  inputs: EngineInput;
  engine: import("../script-document").ModelEngine;
  tier: "draft" | "pro" | "studio";
  maxAttempts?: number;
}

/**
 * Enqueue a shot for generation. Returns the job id immediately;
 * subscribers can watch the status bus for state transitions.
 *
 * If the project's queue is empty, the job starts immediately. If
 * there's already a job running, this one waits its turn.
 */
export function enqueueShot(args: EnqueueArgs): string {
  const jobId = newScriptId("job");
  const now = new Date().toISOString();
  const job: GenerationJob = {
    id: jobId,
    projectId: args.projectId,
    shotId: args.shotId,
    stage: "queued",
    engine: args.engine,
    tier: args.tier,
    predictionId: null,
    attempts: 0,
    maxAttempts: args.maxAttempts ?? 2,
    inputs: args.inputs,
    outputs: null,
    timeline: { queuedAt: now },
    lastError: null,
  };
  state.jobs.set(jobId, job);

  const q = state.queues.get(args.projectId) ?? [];
  q.push(jobId);
  state.queues.set(args.projectId, q);

  emit(job, "queued", "Queued for generation");
  notify();

  // Drain the queue if nothing is running for this project.
  void drainQueue(args.projectId);

  return jobId;
}

/**
 * Transition a job to the next stage. Used by the pipeline's
 * submit/poll loop running inside the edge function — when the
 * function reports progress, the orchestrator records it here.
 *
 * In wave 4 this becomes the receive side of a realtime channel;
 * the orchestrator runs in the browser and the edge function emits
 * via supabase realtime. For now `transitionJob` is called
 * directly by the in-browser pipeline (kept open for both).
 */
export function transitionJob(
  jobId: string,
  stage: JobStage,
  message: string,
  patch?: Partial<GenerationJob>,
): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  const next: GenerationJob = {
    ...job,
    ...patch,
    stage,
    timeline: {
      ...job.timeline,
      ...(stage === "preparing" && !job.timeline.preparingAt
        ? { preparingAt: new Date().toISOString() }
        : {}),
      ...(stage === "submitting" && !job.timeline.submittingAt
        ? { submittingAt: new Date().toISOString() }
        : {}),
      ...(stage === "rendering" && !job.timeline.renderingAt
        ? { renderingAt: new Date().toISOString() }
        : {}),
      ...(stage === "post-processing" && !job.timeline.postProcessingAt
        ? { postProcessingAt: new Date().toISOString() }
        : {}),
      ...(stage === "completed"
        ? { completedAt: new Date().toISOString() }
        : {}),
      ...(stage === "failed"
        ? { failedAt: new Date().toISOString() }
        : {}),
    },
  };
  state.jobs.set(jobId, next);
  emit(next, stage, message);

  // Terminal — release the project's running slot + drain the next.
  if (stage === "completed" || stage === "failed") {
    state.running.delete(next.projectId);
    void drainQueue(next.projectId);
  }
  notify();
}

/** Cancel a queued or in-flight job. Cleans up the queue +
 *  running slot. Does NOT cancel work already submitted to a
 *  provider — engine-side cancellation goes through the edge
 *  function. */
export function cancelJob(jobId: string): void {
  const job = state.jobs.get(jobId);
  if (!job) return;
  const q = state.queues.get(job.projectId) ?? [];
  const idx = q.indexOf(jobId);
  if (idx >= 0) {
    q.splice(idx, 1);
    state.queues.set(job.projectId, q);
  }
  if (state.running.get(job.projectId) === jobId) {
    state.running.delete(job.projectId);
  }
  state.jobs.delete(jobId);
  notify();
}

/** Read a job by id. */
export function getJob(jobId: string): GenerationJob | undefined {
  return state.jobs.get(jobId);
}

/** Get the active job for a given shot — used by the inspector to
 *  show the right state when the user navigates to a shot that's
 *  mid-flight. */
export function getJobForShot(shotId: string): GenerationJob | undefined {
  for (const job of state.jobs.values()) {
    if (job.shotId === shotId) return job;
  }
  return undefined;
}

/** Every job for a given project — used by the status bar's
 *  "N rendering" counter. */
export function jobsForProject(projectId: string): GenerationJob[] {
  return Array.from(state.jobs.values()).filter(
    (j) => j.projectId === projectId,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drain the project's queue: if nothing is currently running, pop
 * the front of the queue + call the runner. The runner itself is
 * intentionally NOT in this file — it's injected at module-load
 * time by the wire-up so this file can ship as a pure brain
 * without depending on supabase / fetch.
 */
async function drainQueue(projectId: string): Promise<void> {
  if (state.running.has(projectId)) return;
  const q = state.queues.get(projectId) ?? [];
  const nextId = q.shift();
  if (!nextId) {
    state.queues.delete(projectId);
    return;
  }
  state.queues.set(projectId, q);

  // Check the runner BEFORE claiming the serial slot. Previously the slot was
  // claimed first and, when no runner was installed, drainQueue just returned —
  // leaving the job stuck in "running" forever and wedging every later shot for
  // the project behind it. If no engine is wired, fail the job honestly: that
  // releases the slot and drains the next one (see transitionJob) instead of
  // showing an eternal "rendering" spinner.
  const runner = installedRunner;
  if (!runner) {
    transitionJob(nextId, "failed", "No render engine is connected.");
    return;
  }

  state.running.set(projectId, nextId);
  notify();

  try {
    await runner(nextId);
  } catch (e) {
    // The runner should call transitionJob internally; if it threw
    // before reaching that, mark the job failed here as a safety net.
    transitionJob(nextId, "failed", e instanceof Error ? e.message : "runner threw");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner installation — the surface that actually talks to engines
// installs itself here at module load.
// ─────────────────────────────────────────────────────────────────────────────

type Runner = (jobId: string) => Promise<void>;

let installedRunner: Runner | null = null;

/** Install the runner. Called once by the editor's runtime
 *  bootstrap. Each call replaces the previous runner (test hook). */
export function installJobRunner(runner: Runner): void {
  installedRunner = runner;
}

// ─────────────────────────────────────────────────────────────────────────────
// emit — wrap the status bus call with progress derivation
// ─────────────────────────────────────────────────────────────────────────────

function emit(job: GenerationJob, stage: JobStage, message: string): void {
  emitStatus({
    jobId: job.id,
    projectId: job.projectId,
    shotId: job.shotId,
    stage,
    progress: estimateProgress({ ...job, stage }),
    message,
    at: new Date().toISOString(),
  });
  // Re-export for callers that want the type:
  void jobStageToApprovalState;
}
