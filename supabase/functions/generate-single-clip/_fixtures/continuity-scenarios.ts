/**
 * Continuity test fixtures
 * ────────────────────────
 * Single source of truth for the contract between the Studio client and the
 * generate-single-clip server-side ordering gate. Every scenario describes:
 *
 *   • the scene's intent      (Continuous vs Independent)
 *   • the predecessor state   (as observed in `video_clips`)
 *   • what the client sent    (the `startImageUrl` it would compute)
 *   • the EXPECTED outcome    (render now / park, plus which image source
 *                              must end up stamped as `startImageUrl`)
 *
 * These fixtures power continuity_test.ts. They also serve as executable
 * documentation — read the table to understand the contract instead of
 * spelunking through 2 000+ lines of edge-function code.
 *
 * A scene's `startImageUrl` always resolves from ONE of these sources, in
 * priority order:
 *
 *   1. predecessor.last_frame_url  (chained + predecessor completed)
 *   2. scene.refImageUrl           (per-scene reference)
 *   3. brief.refImageUrl           (project-level reference)
 *   4. cast.imageUrl               (avatar portrait)
 *   5. null                        (pure T2V)
 *
 * Independent scenes (chainFromPrevious === false) MUST skip source #1 even
 * if the predecessor has finished — that's the whole point of Independent.
 */

export type ImageSource =
  | "predecessor_tail"
  | "scene_ref"
  | "brief_ref"
  | "cast_portrait"
  | "none";

export type PredecessorState =
  | { status: "completed"; last_frame_url: string }
  | { status: "generating"; last_frame_url: null }
  | { status: "pending"; last_frame_url: null }
  | { status: "failed"; last_frame_url: null }
  | { status: "missing"; last_frame_url: null };

export interface SceneInput {
  shotIndex: number;
  chainFromPrevious: boolean;        // false => Independent
  refImageUrl?: string | null;
  briefRefImageUrl?: string | null;
  castImageUrl?: string | null;
  /** The startImageUrl the CLIENT would send. Server may override. */
  clientStartImageUrl?: string | null;
  predecessor?: PredecessorState;    // omitted/ignored when shotIndex === 0
}

export type Outcome =
  | {
      action: "render";
      startImageUrl: string | null;
      source: ImageSource;
    }
  | {
      action: "queue";
      waitingOnShot: number;
      predecessorStatus: PredecessorState["status"];
    };

export interface Scenario {
  name: string;
  description: string;
  input: SceneInput;
  expected: Outcome;
}

const TAIL = "https://cdn.example.com/tail/shot-0.jpg";
const TAIL_PREV = "https://cdn.example.com/tail/shot-1.jpg";
const SCENE_REF = "https://cdn.example.com/ref/scene-2.jpg";
const BRIEF_REF = "https://cdn.example.com/ref/brief.jpg";
const CAST = "https://cdn.example.com/cast/emma.png";
const STALE_BRIEF = "https://cdn.example.com/ref/STALE-brief.jpg";

export const SCENARIOS: Scenario[] = [
  // ── shot 0 always renders (no predecessor possible) ────────────────────
  {
    name: "shot0_continuous_uses_brief_ref",
    description:
      "First shot of a Continuous run has no predecessor; falls back to the brief reference image.",
    input: {
      shotIndex: 0,
      chainFromPrevious: true,
      briefRefImageUrl: BRIEF_REF,
      castImageUrl: CAST,
      clientStartImageUrl: BRIEF_REF,
    },
    expected: { action: "render", startImageUrl: BRIEF_REF, source: "brief_ref" },
  },
  {
    name: "shot0_independent_uses_cast_when_no_refs",
    description:
      "Independent shot 0 with no scene/brief ref falls back to the cast portrait.",
    input: {
      shotIndex: 0,
      chainFromPrevious: false,
      castImageUrl: CAST,
      clientStartImageUrl: CAST,
    },
    expected: { action: "render", startImageUrl: CAST, source: "cast_portrait" },
  },
  {
    name: "shot0_pure_t2v",
    description:
      "Independent shot 0 with no images at all is a pure text-to-video render.",
    input: {
      shotIndex: 0,
      chainFromPrevious: false,
      clientStartImageUrl: null,
    },
    expected: { action: "render", startImageUrl: null, source: "none" },
  },

  // ── Continuous + predecessor ready → server overrides with tail frame ──
  {
    name: "continuous_predecessor_done_overrides_stale_client_ref",
    description:
      "Parallel fire: client sent a stale brief ref, but the predecessor has a real " +
      "tail frame. Server MUST override with predecessor.last_frame_url.",
    input: {
      shotIndex: 1,
      chainFromPrevious: true,
      clientStartImageUrl: STALE_BRIEF,
      briefRefImageUrl: STALE_BRIEF,
      predecessor: { status: "completed", last_frame_url: TAIL },
    },
    expected: { action: "render", startImageUrl: TAIL, source: "predecessor_tail" },
  },
  {
    name: "continuous_predecessor_done_already_matches_tail",
    description:
      "Client already extracted the tail frame correctly — server keeps it.",
    input: {
      shotIndex: 1,
      chainFromPrevious: true,
      clientStartImageUrl: TAIL,
      predecessor: { status: "completed", last_frame_url: TAIL },
    },
    expected: { action: "render", startImageUrl: TAIL, source: "predecessor_tail" },
  },

  // ── Continuous + predecessor NOT ready → park ──────────────────────────
  {
    name: "continuous_predecessor_generating_parks",
    description:
      "Parallel fire: predecessor is still generating. Scene must be queued, " +
      "not rendered with a stale anchor.",
    input: {
      shotIndex: 2,
      chainFromPrevious: true,
      clientStartImageUrl: BRIEF_REF,
      briefRefImageUrl: BRIEF_REF,
      predecessor: { status: "generating", last_frame_url: null },
    },
    expected: { action: "queue", waitingOnShot: 1, predecessorStatus: "generating" },
  },
  {
    name: "continuous_predecessor_pending_parks",
    description:
      "Predecessor hasn't even started — gate parks the scene rather than racing.",
    input: {
      shotIndex: 3,
      chainFromPrevious: true,
      clientStartImageUrl: BRIEF_REF,
      predecessor: { status: "pending", last_frame_url: null },
    },
    expected: { action: "queue", waitingOnShot: 2, predecessorStatus: "pending" },
  },
  {
    name: "continuous_predecessor_missing_parks",
    description:
      "Predecessor row doesn't exist yet (out-of-order parallel hit). Park, don't render.",
    input: {
      shotIndex: 1,
      chainFromPrevious: true,
      clientStartImageUrl: BRIEF_REF,
      predecessor: { status: "missing", last_frame_url: null },
    },
    expected: { action: "queue", waitingOnShot: 0, predecessorStatus: "missing" },
  },
  {
    name: "continuous_predecessor_completed_without_tail_parks",
    description:
      "Edge case: predecessor reports completed but has no last_frame_url stored " +
      "(extraction failed). Gate still parks because the chain anchor is missing.",
    input: {
      shotIndex: 1,
      chainFromPrevious: true,
      clientStartImageUrl: BRIEF_REF,
      // Cast to any to model a real-world dirty row.
      predecessor: { status: "completed", last_frame_url: null as unknown as string },
    },
    expected: { action: "queue", waitingOnShot: 0, predecessorStatus: "completed" },
  },

  // ── Independent: gate is bypassed entirely, predecessor irrelevant ─────
  {
    name: "independent_predecessor_generating_still_renders",
    description:
      "Independent scenes parallelize freely. Even if the prior shot is mid-render, " +
      "this one fires immediately using its own scene ref.",
    input: {
      shotIndex: 2,
      chainFromPrevious: false,
      refImageUrl: SCENE_REF,
      briefRefImageUrl: BRIEF_REF,
      castImageUrl: CAST,
      clientStartImageUrl: SCENE_REF,
      predecessor: { status: "generating", last_frame_url: null },
    },
    expected: { action: "render", startImageUrl: SCENE_REF, source: "scene_ref" },
  },
  {
    name: "independent_does_not_inherit_predecessor_tail",
    description:
      "CRITICAL: even when a predecessor tail frame exists, an Independent scene " +
      "must NOT inherit it — that would silently re-introduce continuity.",
    input: {
      shotIndex: 1,
      chainFromPrevious: false,
      refImageUrl: SCENE_REF,
      briefRefImageUrl: BRIEF_REF,
      castImageUrl: CAST,
      clientStartImageUrl: SCENE_REF,
      predecessor: { status: "completed", last_frame_url: TAIL_PREV },
    },
    expected: { action: "render", startImageUrl: SCENE_REF, source: "scene_ref" },
  },
  {
    name: "independent_falls_back_to_cast_when_no_scene_or_brief_ref",
    description:
      "Independent scene with no scene/brief ref falls back to cast portrait — " +
      "never to the predecessor's tail frame.",
    input: {
      shotIndex: 4,
      chainFromPrevious: false,
      castImageUrl: CAST,
      clientStartImageUrl: CAST,
      predecessor: { status: "completed", last_frame_url: TAIL },
    },
    expected: { action: "render", startImageUrl: CAST, source: "cast_portrait" },
  },
];

/**
 * Pure reference implementation of the server-side continuity gate. Mirrors
 * the logic in supabase/functions/generate-single-clip/index.ts (chain gate
 * block, ~line 1136). Lives here so:
 *
 *   1. Tests can run it without bringing up the full edge function.
 *   2. Drift between this resolver and the real gate surfaces as failing
 *      fixtures (which then prompt a sync — DO NOT silently re-align the
 *      resolver; instead fix whichever side regressed).
 */
export function resolveContinuity(input: SceneInput): Outcome {
  const {
    shotIndex,
    chainFromPrevious,
    refImageUrl,
    briefRefImageUrl,
    castImageUrl,
    predecessor,
  } = input;

  // Server gate only applies to chained, non-first shots.
  if (chainFromPrevious && shotIndex > 0) {
    const ready =
      predecessor?.status === "completed" &&
      typeof predecessor.last_frame_url === "string" &&
      predecessor.last_frame_url.length > 0;
    if (!ready) {
      return {
        action: "queue",
        waitingOnShot: shotIndex - 1,
        predecessorStatus: predecessor?.status ?? "missing",
      };
    }
    // Server overrides client-provided startImageUrl with the persisted
    // tail frame — DB is source of truth.
    return {
      action: "render",
      startImageUrl: predecessor!.last_frame_url as string,
      source: "predecessor_tail",
    };
  }

  // Independent scene OR shot 0 → resolve from local priority order.
  if (refImageUrl) return { action: "render", startImageUrl: refImageUrl, source: "scene_ref" };
  if (briefRefImageUrl)
    return { action: "render", startImageUrl: briefRefImageUrl, source: "brief_ref" };
  if (castImageUrl)
    return { action: "render", startImageUrl: castImageUrl, source: "cast_portrait" };
  return { action: "render", startImageUrl: null, source: "none" };
}

/**
 * Simulate the effect of firing every scene in parallel. Returns the
 * outcome for each scene as seen by the server, given the predecessor
 * states snapshot at the moment of the parallel fire.
 *
 * Useful for asserting that, e.g., a 5-scene Continuous run fires shot 0
 * and parks shots 1-4, while a 5-scene Independent run fires all 5.
 */
export function simulateParallelFire(scenes: SceneInput[]): Outcome[] {
  return scenes.map(resolveContinuity);
}