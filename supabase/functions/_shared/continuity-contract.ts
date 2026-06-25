/**
 * continuity-contract — the production-side twin of the client
 * Continuity Engine brain (src/lib/video/continuity).
 *
 * Self-contained: no imports, no Deno globals, so it runs in the edge
 * runtime AND under vitest (parity is asserted in a test). It turns the
 * comprehensive-validation-orchestrator's measured dimension scores into
 * a CONTRACT-RELATIVE verdict + the next deterministic corrective step.
 *
 * Keep this in lock-step with src/lib/video/continuity/{boundaries,
 * continuity-score,correction-ladder}.ts.
 */

// ── Boundary contract ────────────────────────────────────────────────────────

export type BoundaryType =
  | "CONTINUOUS"
  | "MATCH_CUT"
  | "HARD_CUT"
  | "TIME_JUMP"
  | "LOCATION_CHANGE"
  | "INTRO";

export type DimensionMode = "hard" | "soft" | "off";

export interface BoundaryContract {
  identity: DimensionMode;
  wardrobe: DimensionMode;
  boundary: DimensionMode;
  temporal: DimensionMode;
  color: DimensionMode;
  vlm: DimensionMode;
  carryFrame: boolean;
  overlapMs: number;
  label: string;
}

export const CONTINUITY_CONTRACT: Record<BoundaryType, BoundaryContract> = {
  CONTINUOUS: { identity: "hard", wardrobe: "hard", boundary: "hard", temporal: "hard", color: "hard", vlm: "hard", carryFrame: true, overlapMs: 500, label: "Seamless continuation" },
  MATCH_CUT: { identity: "hard", wardrobe: "hard", boundary: "off", temporal: "soft", color: "hard", vlm: "hard", carryFrame: false, overlapMs: 0, label: "Match cut · same scene" },
  HARD_CUT: { identity: "hard", wardrobe: "soft", boundary: "off", temporal: "soft", color: "soft", vlm: "soft", carryFrame: false, overlapMs: 0, label: "Hard cut · new scene" },
  TIME_JUMP: { identity: "hard", wardrobe: "off", boundary: "off", temporal: "soft", color: "off", vlm: "soft", carryFrame: false, overlapMs: 0, label: "Time jump · same cast" },
  LOCATION_CHANGE: { identity: "hard", wardrobe: "soft", boundary: "off", temporal: "soft", color: "off", vlm: "soft", carryFrame: false, overlapMs: 0, label: "New location" },
  INTRO: { identity: "off", wardrobe: "off", boundary: "off", temporal: "soft", color: "off", vlm: "soft", carryFrame: false, overlapMs: 0, label: "Opening shot" },
};

// ── Boundary inference ───────────────────────────────────────────────────────
// Mirror of src/lib/video/continuity/boundaries.ts inferBoundary. The
// edge pipeline has the full script at validation time, so it can
// compute the boundary type for each clip from the shot facts. Keep in
// lock-step with the client (parity is asserted in a test).

export interface ShotFacts {
  shotId: string;
  sceneId: string;
  slug: string; // "INT. KITCHEN - NIGHT"
  timeOfDay?: string;
  framing: string;
  cast: string[];
  inheritsFromShotId?: string;
  hasTransitionIn?: boolean;
}

export function parseSlug(slug: string): { location: string; time: string } {
  const raw = (slug ?? "").trim();
  const dash = raw.lastIndexOf(" - ");
  if (dash >= 0) {
    return { location: raw.slice(0, dash).trim().toUpperCase(), time: raw.slice(dash + 3).trim().toUpperCase() };
  }
  return { location: raw.toUpperCase(), time: "" };
}

const ADJACENT_FRAMINGS: Record<string, string[]> = {
  wide: ["establishing", "wide"],
  establishing: ["wide", "establishing"],
  medium: ["medium", "two-shot", "over-shoulder", "close"],
  "two-shot": ["medium", "over-shoulder"],
  "over-shoulder": ["medium", "two-shot", "close"],
  close: ["medium", "over-shoulder", "extreme-close"],
  "extreme-close": ["close"],
};

function framingIsContinuous(a: string, b: string): boolean {
  if (a === b) return true;
  return (ADJACENT_FRAMINGS[a] ?? []).includes(b);
}

export function inferBoundaryType(
  prev: ShotFacts | null,
  cur: ShotFacts,
): { type: BoundaryType; sharedCast: string[] } {
  if (!prev) return { type: "INTRO", sharedCast: [] };
  const sharedCast = cur.cast.filter((c) => prev.cast.includes(c));

  const sameScene = prev.sceneId === cur.sceneId;
  let type: BoundaryType;

  if (!sameScene) {
    const a = parseSlug(prev.slug);
    const b = parseSlug(cur.slug);
    if (a.location !== b.location) {
      type = "LOCATION_CHANGE";
    } else {
      const timeChanged =
        (cur.timeOfDay ?? b.time) !== (prev.timeOfDay ?? a.time) && (cur.timeOfDay || b.time);
      type = timeChanged ? "TIME_JUMP" : "HARD_CUT";
    }
  } else {
    const explicitlyContinues = cur.inheritsFromShotId === prev.shotId;
    const smoothFraming = framingIsContinuous(prev.framing, cur.framing);
    const sharesCast = cur.cast.some((c) => prev.cast.includes(c));
    type =
      !cur.hasTransitionIn && sharesCast && (explicitlyContinues || smoothFraming)
        ? "CONTINUOUS"
        : "MATCH_CUT";
  }

  return { type, sharedCast };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface DimensionScores {
  identity: number | null;
  wardrobe: number | null;
  boundary: number | null;
  temporal: number | null;
  color: number | null;
  vlm: number | null;
}

export type Dimension = keyof DimensionScores;
export type Verdict = "pass" | "soft-fail" | "hard-fail";
export type Priority = "none" | "low" | "medium" | "high" | "critical";

export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  identity: 0.3, wardrobe: 0.15, boundary: 0.2, temporal: 0.1, color: 0.1, vlm: 0.15,
};

export const THRESHOLDS = { hard: 78, soft: 62 } as const;

const DIMENSIONS: Dimension[] = ["identity", "wardrobe", "boundary", "temporal", "color", "vlm"];

export interface ContinuityScore {
  scores: DimensionScores;
  composite: number;
  verdict: Verdict;
  priority: Priority;
  failures: Array<{ dimension: Dimension; mode: DimensionMode; score: number }>;
  notes: string[];
}

/**
 * Score measured dimensions against a boundary contract.
 *
 * `sharedCastCount` lets LOCATION_CHANGE skip the identity gate when no
 * character persists across the cut (new place, new people = no drift).
 */
export function evaluateContinuity(
  scores: DimensionScores,
  boundaryType: BoundaryType,
  sharedCastCount = 1,
): ContinuityScore {
  const contract = CONTINUITY_CONTRACT[boundaryType];

  const modeFor = (d: Dimension): DimensionMode => {
    let mode = contract[d];
    // Identity + wardrobe are only meaningful when a character persists
    // across the cut — a cut to an entirely new cast has nothing to match
    // against. Keep this in lock-step with the client modeFor.
    if (
      (d === "identity" || d === "wardrobe") &&
      sharedCastCount === 0 &&
      boundaryType !== "INTRO"
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
    if (mode === "off" || score === null || score === undefined) continue;

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
  if (failures.length === 0) notes.unshift(`${contract.label}: all live dimensions within contract`);

  return { scores, composite, verdict, priority, failures, notes };
}

function resolveVerdict(failures: ContinuityScore["failures"], composite: number): Verdict {
  if (failures.some((f) => f.mode === "hard")) return "hard-fail";
  if (failures.length > 0 || composite < THRESHOLDS.soft) return "soft-fail";
  return "pass";
}

function resolvePriority(verdict: Verdict, failures: ContinuityScore["failures"], composite: number): Priority {
  if (verdict === "pass") return "none";
  if (composite < 40) return "critical";
  const hardFails = failures.filter((f) => f.mode === "hard").length;
  if (hardFails >= 2) return "high";
  if (hardFails === 1) return "medium";
  return "low";
}

// ── Correction ladder ────────────────────────────────────────────────────────

export type CorrectionStep =
  | "reseed"
  | "strengthen-anchor"
  | "swap-engine"
  | "shorten-beat"
  | "escalate";

export interface CorrectionDecision {
  step: CorrectionStep;
  targetEngine?: string | null;
  reason: string;
}

export interface LadderContext {
  attempt: number;
  maxAttempts: number;
  currentEngine: string;
  availableEngines: string[];
  alreadyShortened?: boolean;
}

function engineForFailure(failures: ContinuityScore["failures"], available: string[]): string | null {
  const worst = [...failures].sort((a, b) => a.score - b.score)[0];
  const has = (e: string) => available.includes(e);
  switch (worst?.dimension) {
    case "identity":
    case "wardrobe":
      return has("runway-gen-4") ? "runway-gen-4" : null;
    case "boundary":
      return has("kling-2-master") ? "kling-2-master" : has("kling-1-6-pro") ? "kling-1-6-pro" : null;
    case "temporal":
    case "color":
    case "vlm":
      return has("seedance-1-pro") ? "seedance-1-pro" : null;
    default:
      return null;
  }
}

export function nextCorrection(score: ContinuityScore, ctx: LadderContext): CorrectionDecision {
  if (ctx.attempt >= ctx.maxAttempts - 1) {
    return { step: "escalate", reason: `retry budget exhausted (${ctx.attempt + 1}/${ctx.maxAttempts})` };
  }

  const hardFails = score.failures.filter((f) => f.mode === "hard");
  const seamFailed = hardFails.some((f) => f.dimension === "boundary");
  const identityFailed = hardFails.some((f) => f.dimension === "identity" || f.dimension === "wardrobe");

  switch (ctx.attempt) {
    case 0:
      return { step: "reseed", reason: "first retry — new noise seed" };
    case 1:
      if (seamFailed || identityFailed) {
        return {
          step: "strengthen-anchor",
          reason: seamFailed ? "seam failed — re-extract a cleaner anchor frame" : "identity failed — re-pin against the bible still",
        };
      }
      return { step: "reseed", reason: "second seed attempt" };
    case 2: {
      const target = engineForFailure(score.failures, ctx.availableEngines);
      if (target && target !== ctx.currentEngine) {
        return { step: "swap-engine", targetEngine: target, reason: `swap to ${target} for ${score.failures[0]?.dimension ?? "quality"}` };
      }
      if (!ctx.alreadyShortened) return { step: "shorten-beat", reason: "no better engine — split the beat to reduce drift" };
      return { step: "reseed", reason: "fallback reseed" };
    }
    default:
      if (!ctx.alreadyShortened) return { step: "shorten-beat", reason: "persistent drift — split the beat" };
      return { step: "escalate", reason: "ladder exhausted without a pass" };
  }
}

/**
 * One call the orchestrator can make per clip: score it, and if it
 * doesn't pass, attach the next corrective step. This is the blocking
 * gate's decision in a single function.
 */
export function auditClip(input: {
  scores: DimensionScores;
  boundaryType: BoundaryType;
  sharedCastCount?: number;
  attempt: number;
  maxAttempts: number;
  currentEngine: string;
  availableEngines: string[];
  alreadyShortened?: boolean;
}): { score: ContinuityScore; admit: boolean; correction: CorrectionDecision | null } {
  const score = evaluateContinuity(input.scores, input.boundaryType, input.sharedCastCount ?? 1);
  const admit = score.verdict === "pass";
  const correction = admit
    ? null
    : nextCorrection(score, {
        attempt: input.attempt,
        maxAttempts: input.maxAttempts,
        currentEngine: input.currentEngine,
        availableEngines: input.availableEngines,
        alreadyShortened: input.alreadyShortened,
      });
  return { score, admit, correction };
}
