/**
 * continuity/correction-ladder — deterministic, cost-ordered recovery.
 *
 * When a clip fails its continuity contract, we escalate cheapest-first
 * in a fixed order. NO open "regenerate until perfect" loop — every
 * failure maps to exactly one next action, bounded by the retry budget
 * (clipCount × retriesPerClip) and the circuit breaker. The ladder is
 * resumable: given the attempt count + the failing dimensions, the next
 * step is a pure function.
 *
 * Pure. No IO.
 */
import type { ContinuityScore, Dimension } from "./continuity-score";
import type { ModelEngine } from "../../editor/script-document";

export type CorrectionStep =
  | "reseed" //           same engine + anchors, new noise seed (cheap)
  | "strengthen-anchor" //re-extract a cleaner tail / re-pin the anchor still
  | "swap-engine" //      route to the engine whose strength fits the failure
  | "shorten-beat" //     split the clip so the engine drifts less per clip
  | "escalate"; //        budget exhausted → dead-letter + surface to creator

export interface CorrectionDecision {
  step: CorrectionStep;
  /** When step === "swap-engine", the suggested target (may be null if
   *  no better engine is available — caller falls through to next step). */
  targetEngine?: ModelEngine | null;
  /** Why this step — for the audit trail + the UI. */
  reason: string;
}

/** Which engine best repairs a given failing dimension. */
function engineForFailure(
  failures: ContinuityScore["failures"],
  available: ModelEngine[],
): ModelEngine | null {
  const worst = [...failures].sort((a, b) => a.score - b.score)[0];
  const has = (e: ModelEngine) => available.includes(e);

  switch (worst?.dimension as Dimension | undefined) {
    case "identity":
    case "wardrobe":
      // Runway is best-in-class for identity preservation.
      return has("runway-gen-4") ? "runway-gen-4" : null;
    case "boundary":
      // Kling takes both anchors → bounded interpolation hides the seam.
      return has("kling-2-master")
        ? "kling-2-master"
        : has("kling-1-6-pro")
        ? "kling-1-6-pro"
        : null;
    case "temporal":
      // Seedance's motion physics are the most stable.
      return has("seedance-1-pro") ? "seedance-1-pro" : null;
    case "color":
    case "vlm":
      return has("seedance-1-pro") ? "seedance-1-pro" : null;
    default:
      return null;
  }
}

export interface LadderContext {
  /** Attempts ALREADY spent on this clip (0 on the first failure). */
  attempt: number;
  /** Hard cap from the retry budget. */
  maxAttempts: number;
  /** Whether the current engine even supports a distinct end anchor —
   *  if it does and the seam failed, strengthen-anchor is worth more. */
  currentEngine: ModelEngine;
  /** Engines we're allowed to route to. */
  availableEngines: ModelEngine[];
  /** Has this beat already been split once? (prevents infinite splitting) */
  alreadyShortened?: boolean;
}

/**
 * Decide the next corrective action for a failing clip. Deterministic:
 * same (score, context) → same decision, so a watchdog can resume a
 * half-run ladder without duplicating work.
 */
export function nextCorrection(
  score: ContinuityScore,
  ctx: LadderContext,
): CorrectionDecision {
  // Budget exhausted → escalate, full stop.
  if (ctx.attempt >= ctx.maxAttempts - 1) {
    return {
      step: "escalate",
      reason: `retry budget exhausted (${ctx.attempt + 1}/${ctx.maxAttempts})`,
    };
  }

  // Step ladder by attempt, but let the failure shape pull a step
  // forward when it clearly dominates.
  const hardFails = score.failures.filter((f) => f.mode === "hard");
  const seamFailed = hardFails.some((f) => f.dimension === "boundary");
  const identityFailed = hardFails.some(
    (f) => f.dimension === "identity" || f.dimension === "wardrobe",
  );

  switch (ctx.attempt) {
    case 0:
      // First retry is always the cheap one — a fresh seed fixes a lot.
      return { step: "reseed", reason: "first retry — new noise seed" };

    case 1: {
      // Seam or identity break → fix the conditioning before spending
      // on an engine swap.
      if (seamFailed || identityFailed) {
        return {
          step: "strengthen-anchor",
          reason: seamFailed
            ? "seam failed — re-extract a cleaner anchor frame"
            : "identity failed — re-pin against the bible still",
        };
      }
      return { step: "reseed", reason: "second seed attempt" };
    }

    case 2: {
      const target = engineForFailure(score.failures, ctx.availableEngines);
      if (target && target !== ctx.currentEngine) {
        return {
          step: "swap-engine",
          targetEngine: target,
          reason: `swap to ${target} for ${score.failures[0]?.dimension ?? "quality"}`,
        };
      }
      // No better engine — try shortening the beat instead.
      if (!ctx.alreadyShortened) {
        return {
          step: "shorten-beat",
          reason: "no better engine — split the beat to reduce drift",
        };
      }
      return { step: "reseed", reason: "fallback reseed" };
    }

    default: {
      if (!ctx.alreadyShortened) {
        return {
          step: "shorten-beat",
          reason: "persistent drift — split the beat",
        };
      }
      return {
        step: "escalate",
        reason: "ladder exhausted without a pass",
      };
    }
  }
}
