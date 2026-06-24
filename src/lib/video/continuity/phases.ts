/**
 * continuity/phases — the canonical pipeline progress model.
 *
 * ONE shared vocabulary for "where is my film right now". The edge
 * pipeline emits PipelineProgress; the premium PipelineCreation UI
 * renders it. Because both sides import this, the visualisation can
 * never drift from the real stages.
 *
 * Pure. No IO.
 */
import type { BoundaryType } from "./boundaries";
import type { Verdict, Priority } from "./continuity-score";
import type { ModelEngine } from "../../editor/script-document";

// ─────────────────────────────────────────────────────────────────────────────
// Phases — the 8 real stages of the Continuity Engine
// ─────────────────────────────────────────────────────────────────────────────

export type PhaseId =
  | "bible"
  | "storyboard"
  | "skeleton-audit"
  | "approval"
  | "motion"
  | "continuity-gate"
  | "assembly"
  | "report";

/** What kind of work a phase does — drives its accent colour in the UI. */
export type PhaseKind = "identity" | "image" | "audit" | "approval" | "motion" | "assembly";

export interface PhaseMeta {
  id: PhaseId;
  /** Short label for the rail. */
  label: string;
  /** One-line blurb shown when the phase is active. */
  blurb: string;
  kind: PhaseKind;
}

export const PIPELINE_PHASES: PhaseMeta[] = [
  { id: "bible", label: "Identity bible", blurb: "Locking every character's face, wardrobe & style", kind: "identity" },
  { id: "storyboard", label: "Storyboard", blurb: "Drawing the keyframe for every shot", kind: "image" },
  { id: "skeleton-audit", label: "Skeleton audit", blurb: "Proving the skeleton holds — before any motion", kind: "audit" },
  { id: "approval", label: "Your approval", blurb: "Review the script, boundaries & cost", kind: "approval" },
  { id: "motion", label: "Motion", blurb: "Rendering each shot between locked anchors", kind: "motion" },
  { id: "continuity-gate", label: "Continuity gate", blurb: "Scoring every clip against its contract", kind: "audit" },
  { id: "assembly", label: "Assembly", blurb: "Colour-matching & seamlessly stitching", kind: "assembly" },
  { id: "report", label: "Continuity report", blurb: "Your film, measured", kind: "assembly" },
];

export const PHASE_INDEX: Record<PhaseId, number> = PIPELINE_PHASES.reduce(
  (acc, p, i) => ((acc[p.id] = i), acc),
  {} as Record<PhaseId, number>,
);

export type PhaseStatus = "pending" | "active" | "done" | "failed";

export interface PhaseProgress {
  id: PhaseId;
  status: PhaseStatus;
  /** 0..100 within this phase (optional; used for the active phase). */
  pct?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-clip progress — the continuity chain the UI renders as nodes
// ─────────────────────────────────────────────────────────────────────────────

export type ClipStatus =
  | "pending"
  | "rendering"
  | "auditing"
  | "correcting"
  | "passed"
  | "failed";

export interface ClipProgress {
  shotId: string;
  index: number;
  label: string;
  engine?: ModelEngine;
  /** The boundary that JOINS this clip to the previous one. */
  boundaryType?: BoundaryType;
  status: ClipStatus;
  attempt: number;
  maxAttempts: number;
  /** Per-dimension scores 0..100 (filled once auditing). */
  scores?: Partial<Record<"identity" | "wardrobe" | "boundary" | "temporal" | "color" | "vlm", number>>;
  /** Continuity composite 0..100. */
  composite?: number;
  verdict?: Verdict;
  priority?: Priority;
  /** Which correction step is running, if any. */
  correction?: string;
  thumbUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The whole-pipeline snapshot
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineProgress {
  /** The currently-active phase. */
  phaseId: PhaseId;
  phases: PhaseProgress[];
  /** Overall 0..100 across the whole pipeline. */
  overall: number;
  clips: ClipProgress[];
  /** Film-level continuity composite 0..100 (mean of passed clips). */
  continuityIndex?: number;
  /** Ambient one-liner ("Re-seeding shot 4…"). */
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivations
// ─────────────────────────────────────────────────────────────────────────────

/** Film-level continuity index = mean composite across audited clips. */
export function continuityIndexFromClips(clips: ClipProgress[]): number | undefined {
  const scored = clips.filter((c) => typeof c.composite === "number");
  if (scored.length === 0) return undefined;
  return Math.round(scored.reduce((s, c) => s + (c.composite ?? 0), 0) / scored.length);
}

/** Build the phases array from the active phase id (everything before
 *  is done, everything after pending). */
export function phasesUpTo(active: PhaseId, activePct?: number): PhaseProgress[] {
  const ai = PHASE_INDEX[active];
  return PIPELINE_PHASES.map((p, i) => ({
    id: p.id,
    status: i < ai ? "done" : i === ai ? "active" : "pending",
    pct: i === ai ? activePct : undefined,
  }));
}

/**
 * Convenience adapter for callers that only have coarse counts (the
 * current Production page): map completed/generating/expected clip
 * counts + a coarse percent into a PipelineProgress so the premium UI
 * lights up with real data without a full pipeline rewrite.
 */
export function derivePipelineFromCounts(opts: {
  completed: number;
  generating: number;
  expected: number;
  /** 0..100 overall, if the caller already computed one. */
  overall?: number;
  phaseId?: PhaseId;
  message?: string;
}): PipelineProgress {
  const { completed, generating, expected } = opts;
  const total = Math.max(expected, completed + generating, 1);
  const overall =
    opts.overall ?? Math.round((completed / total) * 100);

  const phaseId: PhaseId =
    opts.phaseId ??
    (completed >= total ? "assembly" : generating > 0 ? "motion" : "storyboard");

  const clips: ClipProgress[] = Array.from({ length: total }, (_, i) => {
    let status: ClipStatus = "pending";
    if (i < completed) status = "passed";
    else if (i < completed + generating) status = "rendering";
    return {
      shotId: `shot-${i + 1}`,
      index: i,
      label: `Shot ${i + 1}`,
      status,
      attempt: 0,
      maxAttempts: 3,
      composite: i < completed ? 92 : undefined,
    };
  });

  return {
    phaseId,
    phases: phasesUpTo(phaseId, overall),
    overall,
    clips,
    continuityIndex: continuityIndexFromClips(clips),
    message: opts.message,
  };
}
