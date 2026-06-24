/**
 * continuity/boundaries — the Boundary Contract.
 *
 * A film is shots (nodes) joined by boundaries (edges). Each boundary
 * has a TYPE, and that type IS the spec for what the continuity audit
 * enforces there. This is the load-bearing idea of the whole engine:
 * continuity is per-boundary, not global, so the audit never "fixes"
 * a deliberate cut (a day→night TIME_JUMP that changes the grade is a
 * PASS, not a drift failure) and always catches a real break (a
 * CONTINUOUS push-in that loses the protagonist's face is a hard FAIL).
 *
 * Pure. No IO. The pipeline calls inferBoundary() at plan time; the
 * audit reads CONTINUITY_CONTRACT[type] to decide pass/fail.
 */

export type BoundaryType =
  | "CONTINUOUS" //   same shot continuing — a true seam to hide
  | "MATCH_CUT" //    new framing, same scene+time — identity+colour lock, NO frame match
  | "HARD_CUT" //     new scene, same story — identity lock, look may shift
  | "TIME_JUMP" //    later in time, same cast — identity lock, look change ALLOWED
  | "LOCATION_CHANGE" // new place — no frame continuity; identity carries iff cast persists
  | "INTRO"; //       first shot / first appearance — no predecessor

/** How strictly a single continuity dimension is enforced at a boundary. */
export type DimensionMode = "hard" | "soft" | "off";

/**
 * The contract for one boundary type: per-dimension enforcement modes
 * plus the seam-treatment hints the planner + assembler honour.
 */
export interface BoundaryContract {
  /** Face / CLIP-I match vs the identity bible. */
  identity: DimensionMode;
  /** Wardrobe + hair match vs the bible. */
  wardrobe: DimensionMode;
  /** SSIM / pHash across the cut (clip N last frame ↔ clip N+1 first). */
  boundary: DimensionMode;
  /** Optical-flow / flicker temporal stability. */
  temporal: DimensionMode;
  /** Colour / exposure match vs the master histogram. */
  color: DimensionMode;
  /** VLM critique ("same person / place / lighting?"). */
  vlm: DimensionMode;
  /** Does the next shot open on the previous shot's last frame? */
  carryFrame: boolean;
  /** Pause-chain overlap tail in ms (0 = clean cut). */
  overlapMs: number;
  /** One-line human label for the report. */
  label: string;
}

/**
 * THE CONTRACT TABLE. This single object is why the engine is correct
 * across every narrative scenario — each row encodes exactly what
 * "continuous" means for that kind of cut.
 */
export const CONTINUITY_CONTRACT: Record<BoundaryType, BoundaryContract> = {
  CONTINUOUS: {
    identity: "hard",
    wardrobe: "hard",
    boundary: "hard",
    temporal: "hard",
    color: "hard",
    vlm: "hard",
    carryFrame: true,
    overlapMs: 500,
    label: "Seamless continuation",
  },
  MATCH_CUT: {
    identity: "hard",
    wardrobe: "hard",
    boundary: "off", // different framing — frame-match is meaningless
    temporal: "soft",
    color: "hard",
    vlm: "hard",
    carryFrame: false,
    overlapMs: 0,
    label: "Match cut · same scene",
  },
  HARD_CUT: {
    identity: "hard",
    wardrobe: "soft",
    boundary: "off",
    temporal: "soft",
    color: "soft", // advisory — a new scene may re-light
    vlm: "soft",
    carryFrame: false,
    overlapMs: 0,
    label: "Hard cut · new scene",
  },
  TIME_JUMP: {
    identity: "hard",
    wardrobe: "off", // wardrobe can change across time
    boundary: "off",
    temporal: "soft",
    color: "off", // the look is SUPPOSED to change
    vlm: "soft",
    carryFrame: false,
    overlapMs: 0,
    label: "Time jump · same cast",
  },
  LOCATION_CHANGE: {
    identity: "hard", // gated only when cast persists (see evaluate)
    wardrobe: "soft",
    boundary: "off",
    temporal: "soft",
    color: "off",
    vlm: "soft",
    carryFrame: false,
    overlapMs: 0,
    label: "New location",
  },
  INTRO: {
    identity: "off", // establishes the bible; nothing to match against yet
    wardrobe: "off",
    boundary: "off",
    temporal: "soft",
    color: "off",
    vlm: "soft",
    carryFrame: false,
    overlapMs: 0,
    label: "Opening shot",
  },
};

/** A resolved boundary between two shots in the film graph. */
export interface Boundary {
  fromShotId: string | null; // null at INTRO
  toShotId: string;
  type: BoundaryType;
  /** Characters present on BOTH sides — drives the identity lock. */
  sharedCast: string[];
  contract: BoundaryContract;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inference
// ─────────────────────────────────────────────────────────────────────────────

/** The minimal shot/scene facts boundary inference needs — decoupled
 *  from the full ScriptDocument so this stays pure + trivially testable. */
export interface BoundaryShotFacts {
  shotId: string;
  sceneId: string;
  /** Scene slug, e.g. "INT. KITCHEN - NIGHT". */
  slug: string;
  timeOfDay?: string;
  framing: string;
  cast: string[];
  /** True when this shot explicitly continues a specific prior shot. */
  inheritsFromShotId?: string;
  /** True when a transition beat (CUT TO / DISSOLVE) opens this shot. */
  hasTransitionIn?: boolean;
}

/** Split a slug-line into its location + time parts. "INT. KITCHEN -
 *  NIGHT" → { location: "INT. KITCHEN", time: "NIGHT" }. Tolerant of
 *  missing dashes + casing. */
export function parseSlug(slug: string): { location: string; time: string } {
  const raw = (slug ?? "").trim();
  const dash = raw.lastIndexOf(" - ");
  if (dash >= 0) {
    return {
      location: raw.slice(0, dash).trim().toUpperCase(),
      time: raw.slice(dash + 3).trim().toUpperCase(),
    };
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

/** Is framing B a small enough change from A that a CONTINUOUS read
 *  is plausible (a push-in, not a cut)? */
function framingIsContinuous(a: string, b: string): boolean {
  if (a === b) return true;
  return (ADJACENT_FRAMINGS[a] ?? []).includes(b);
}

/**
 * Infer the boundary between the previous shot and the current one.
 * The creator can override the result at the approval step — this is
 * the system's best guess, not a verdict.
 */
export function inferBoundary(
  prev: BoundaryShotFacts | null,
  cur: BoundaryShotFacts,
): Boundary {
  if (!prev) {
    return {
      fromShotId: null,
      toShotId: cur.shotId,
      type: "INTRO",
      sharedCast: [],
      contract: CONTINUITY_CONTRACT.INTRO,
    };
  }

  const sharedCast = cur.cast.filter((c) => prev.cast.includes(c));

  const type = classifyBoundary(prev, cur);
  return {
    fromShotId: prev.shotId,
    toShotId: cur.shotId,
    type,
    sharedCast,
    contract: CONTINUITY_CONTRACT[type],
  };
}

function classifyBoundary(
  prev: BoundaryShotFacts,
  cur: BoundaryShotFacts,
): BoundaryType {
  const sameScene = prev.sceneId === cur.sceneId;

  if (!sameScene) {
    const a = parseSlug(prev.slug);
    const b = parseSlug(cur.slug);
    if (a.location !== b.location) return "LOCATION_CHANGE";
    // Same place, different time → a jump in time.
    const timeChanged =
      (cur.timeOfDay ?? b.time) !== (prev.timeOfDay ?? a.time) &&
      (cur.timeOfDay || b.time);
    if (timeChanged) return "TIME_JUMP";
    return "HARD_CUT";
  }

  // Same scene. A continuous read needs: an explicit inheritance OR a
  // small framing change, AND no hard transition beat, AND shared cast.
  const explicitlyContinues = cur.inheritsFromShotId === prev.shotId;
  const smoothFraming = framingIsContinuous(prev.framing, cur.framing);
  const sharesCast = cur.cast.some((c) => prev.cast.includes(c));

  if (
    !cur.hasTransitionIn &&
    sharesCast &&
    (explicitlyContinues || smoothFraming)
  ) {
    return "CONTINUOUS";
  }

  // Otherwise it's a new angle within the same scene.
  return "MATCH_CUT";
}

/** Build the full boundary graph for an ordered shot list. */
export function buildBoundaryGraph(shots: BoundaryShotFacts[]): Boundary[] {
  return shots.map((shot, i) => inferBoundary(i > 0 ? shots[i - 1] : null, shot));
}
