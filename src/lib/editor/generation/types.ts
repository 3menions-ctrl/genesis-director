/**
 * generation/types — shared types for the generation pipeline.
 *
 * The orchestrator, pipeline, chains, and status bus all speak this
 * vocabulary. ScriptDocument is the constitution; this is the
 * runtime layer that turns shots in the document into rendered
 * artifacts.
 */
import type { AspectRatio } from "../types";
import type { ModelEngine, ShotApprovalState, Shot } from "../script-document";

// ─────────────────────────────────────────────────────────────────────────────
// Job — one shot in flight through the pipeline
// ─────────────────────────────────────────────────────────────────────────────

export type JobStage =
  | "queued"           // user approved, waiting for a slot
  | "preparing"        // building inputs (frame extract, identity pack)
  | "submitting"       // POSTing to the engine
  | "rendering"        // engine working
  | "post-processing"  // persisting outputs, extracting last frame
  | "completed"        // success — artifact written into document
  | "failed";          // gave up after retries

export interface GenerationJob {
  id: string;
  /** ScriptDocument.meta.projectId. */
  projectId: string;
  /** Shot.id. */
  shotId: string;
  /** Pipeline stage. Drives the visible progress + status pills. */
  stage: JobStage;
  /** Engine handling this job (carried so a mid-flight engine swap
   *  in the document doesn't confuse polling). */
  engine: ModelEngine;
  tier: "draft" | "pro" | "studio";
  /** Engine-side prediction id, set after submitting. */
  predictionId: string | null;
  /** Number of submit attempts so far. */
  attempts: number;
  /** Maximum attempts before the job is marked failed. */
  maxAttempts: number;
  /** Inputs the pipeline built from the shot + chains. */
  inputs: EngineInput;
  /** Outputs once the engine returns. */
  outputs: EngineOutput | null;
  /** ISO 8601 timestamps for each transition — surfaces in the
   *  status bar's ETA estimator + the Versions panel. */
  timeline: {
    queuedAt: string;
    preparingAt?: string;
    submittingAt?: string;
    renderingAt?: string;
    postProcessingAt?: string;
    completedAt?: string;
    failedAt?: string;
  };
  /** Last error message. Cleared when a retry succeeds. */
  lastError: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine input + output — engine-agnostic payloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The pipeline's `buildEngineInput` function transforms a (Shot,
 * ScriptDocument, ChainContext) tuple into this shape. Submitters
 * for each engine know how to translate it into their provider-
 * specific payload (e.g. Seedance's `image + prompt + duration`).
 */
export interface EngineInput {
  prompt: string;
  durationSec: number;
  aspectRatio: AspectRatio;
  /** Continuity-chain start frame URL (previous shot's last frame). */
  startImageUrl: string | null;
  /** Character reference images used for identity lock. Some engines
   *  accept multi-ref; some accept only the first; submitters know. */
  identityRefs: IdentityRef[];
  /** Last engine input the previous shot used (when chained) — some
   *  engines benefit from seeing the prior input verbatim. */
  inheritedFromShotId: string | null;
  /** Optional VFX recipe — set for Crossover-style shots that flow
   *  through the mode-router VFX pipeline instead of pure
   *  text/image-to-video. */
  vfxRecipeSlug?: string;
  /** Free-form engine-specific overrides (lens hints, negative
   *  prompts, custom seeds). Carried through verbatim. */
  extras?: Record<string, unknown>;
}

export interface IdentityRef {
  characterId: string;
  characterName: string;
  /** Distilled identity description woven into the prompt. */
  identityDNA: string;
  /** Reference image URL if any. */
  referenceImageUrl?: string;
}

/**
 * What the pipeline writes back into the shot's `generated` field
 * once the engine completes.
 */
export interface EngineOutput {
  videoUrl: string;
  lastFrameUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  /** Raw provider response — kept for diagnostics. Never surfaced
   *  in the editor UI. */
  providerMeta?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain context — what's available to the input builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The previous shot's outputs + any character references the
 * current shot needs. Passed to the input builder so frame-chain
 * + identity-chain logic doesn't have to walk the document itself.
 */
export interface ChainContext {
  /** Previous shot's outputs, if any. The chain selector decides
   *  whether to feed its lastFrameUrl as this shot's start image. */
  previousShot: {
    shotId: string;
    lastFrameUrl?: string;
    videoUrl?: string;
  } | null;
  /** Identity references for every character mentioned in this
   *  shot's beats — already resolved against the document's cast. */
  identityRefs: IdentityRef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Status bus — what subscribers see
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compact event shape emitted by the status bus on every stage
 * change. The editor's status bar + inspector + the editor-shell
 * subscribe to derive their ambient state.
 */
export interface StatusEvent {
  jobId: string;
  projectId: string;
  shotId: string;
  stage: JobStage;
  /** Approximate progress 0..1 — null when unknown. Used by the
   *  inspector's progress arc + the status bar's ETA. */
  progress: number | null;
  message: string;
  at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Map a job stage → an approval state on the underlying shot.
 *  Used when the orchestrator writes back to the document. */
export function jobStageToApprovalState(stage: JobStage): ShotApprovalState {
  switch (stage) {
    case "queued":
    case "preparing":
    case "submitting":
    case "rendering":
    case "post-processing":
      return "rendering";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
  }
}

/** A shot is eligible for the queue when the user has explicitly
 *  approved it (ready state) or it failed and the user is retrying. */
export function isShotEligible(shot: Shot): boolean {
  return (
    shot.approval.state === "ready" ||
    shot.approval.state === "needs-regen" ||
    shot.approval.state === "failed"
  );
}

/** Estimate progress 0..1 from a job's stage transitions.
 *  Rough heuristic; the status pill / arc uses it only as a hint. */
export function estimateProgress(job: GenerationJob): number {
  switch (job.stage) {
    case "queued": return 0.05;
    case "preparing": return 0.18;
    case "submitting": return 0.25;
    case "rendering": return 0.65;
    case "post-processing": return 0.92;
    case "completed": return 1.0;
    case "failed": return 0;
  }
}
