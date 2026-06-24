/**
 * continuity/continuity-score — the blocking audit's scoring brain.
 *
 * Reconciles the existing comprehensive-validation-orchestrator output
 * (overallScore + regenerationPriority) with the per-boundary contract.
 * The key property: a clip's verdict is computed RELATIVE TO ITS
 * BOUNDARY CONTRACT, not a flat global threshold. A TIME_JUMP with a
 * changed colour grade passes; a CONTINUOUS with a broken seam fails.
 *
 * Pure. No IO. The edge audit fills DimensionScores from real models
 * (face embedding, SSIM, optical flow, VLM); this module decides what
 * those numbers MEAN at this particular cut.
 */
import type { Boundary, DimensionMode } from "./boundaries";

/** Every score is 0..100, or null when not yet measured / not applicable. */
export interface DimensionScores {
  identity: number | null; //  face cosine + CLIP-I vs bible
  wardrobe: number | null; //  region-masked match vs bible
  boundary: number | null; //  SSIM / pHash across the cut
  temporal: number | null; //  optical-flow variance / flicker
  color: number | null; //     histogram distance vs master
  vlm: number | null; //       VLM critique 0..100
}

export type Verdict = "pass" | "soft-fail" | "hard-fail";
export type Priority = "none" | "low" | "medium" | "high" | "critical";

export interface ContinuityScore {
  scores: DimensionScores;
  /** Weighted composite over the dimensions that are live at this
   *  boundary — maps onto the orchestrator's overallScore. */
  composite: number;
  verdict: Verdict;
  /** Maps onto the orchestrator's regenerationPriority. */
  priority: Priority;
  /** Dimensions that failed, with the mode they failed under. */
  failures: Array<{ dimension: keyof DimensionScores; mode: DimensionMode; score: number }>;
  /** Human-readable lines for the report + corrective prompt. */
  notes: string[];
}

export type Dimension = keyof DimensionScores;

/** Relative importance of each dimension inside the composite. */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  identity: 0.3,
  wardrobe: 0.15,
  boundary: 0.2,
  temporal: 0.1,
  color: 0.1,
  vlm: 0.15,
};

/** Pass lines. A "hard" dimension must clear HARD; a "soft" dimension
 *  below SOFT is advisory (soft-fail), below HARD is a real problem. */
export const THRESHOLDS = {
  hard: 78, // a hard-gated dimension must be ≥ this
  soft: 62, // a soft-gated dimension below this is advisory
} as const;

const DIMENSIONS: Dimension[] = [
  "identity",
  "wardrobe",
  "boundary",
  "temporal",
  "color",
  "vlm",
];

/**
 * Score a clip against its boundary contract.
 *
 * Special case wired in: LOCATION_CHANGE only hard-gates identity when
 * cast actually persists across the cut (different people in a new
 * place must not be flagged as drift).
 */
export function evaluateContinuity(
  scores: DimensionScores,
  boundary: Boundary,
): ContinuityScore {
  const contract = boundary.contract;

  // Resolve the effective mode per dimension, applying contextual
  // overrides the static table can't express.
  const modeFor = (d: Dimension): DimensionMode => {
    let mode = contract[d];
    // Identity + wardrobe can only be enforced when a character actually
    // persists across the cut. A HARD_CUT / TIME_JUMP / LOCATION_CHANGE to
    // an entirely new cast has nothing to match against, so gating it
    // would falsely hard-fail a perfectly correct shot. (INTRO is already
    // off; same-scene CONTINUOUS / MATCH_CUT presume a shared subject.)
    if (
      (d === "identity" || d === "wardrobe") &&
      boundary.sharedCast.length === 0 &&
      boundary.type !== "INTRO"
    ) {
      mode = "off";
    }
    return mode;
  };

  const failures: ContinuityScore["failures"] = [];
  const notes: string[] = [];

  let weightedSum = 0;
  let weightTotal = 0;

  for (const d of DIMENSIONS) {
    const mode = modeFor(d);
    const score = scores[d];
    if (mode === "off" || score == null) continue;

    weightedSum += score * DIMENSION_WEIGHTS[d];
    weightTotal += DIMENSION_WEIGHTS[d];

    if (mode === "hard" && score < THRESHOLDS.hard) {
      failures.push({ dimension: d, mode, score });
      notes.push(`${d} ${Math.round(score)} < ${THRESHOLDS.hard} (required)`);
    } else if (mode === "soft" && score < THRESHOLDS.soft) {
      failures.push({ dimension: d, mode, score });
      notes.push(`${d} ${Math.round(score)} < ${THRESHOLDS.soft} (advisory)`);
    }
  }

  const composite = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 100;

  const verdict = resolveVerdict(failures, composite);
  const priority = resolvePriority(verdict, failures, composite);

  if (failures.length === 0) {
    notes.unshift(`${contract.label}: all live dimensions within contract`);
  }

  return { scores, composite, verdict, priority, failures, notes };
}

function resolveVerdict(
  failures: ContinuityScore["failures"],
  composite: number,
): Verdict {
  const hardFails = failures.filter((f) => f.mode === "hard");
  if (hardFails.length > 0) return "hard-fail";
  if (failures.length > 0 || composite < THRESHOLDS.soft) return "soft-fail";
  return "pass";
}

/** Mirrors the validation-orchestrator's regenerationPriority bands. */
function resolvePriority(
  verdict: Verdict,
  failures: ContinuityScore["failures"],
  composite: number,
): Priority {
  if (verdict === "pass") return "none";
  if (composite < 40) return "critical";
  const hardFails = failures.filter((f) => f.mode === "hard").length;
  if (hardFails >= 2) return "high";
  if (hardFails === 1) return "medium";
  return "low";
}

/** Convenience: does this score clear its contract well enough to ship? */
export function admits(score: ContinuityScore): boolean {
  return score.verdict === "pass";
}
