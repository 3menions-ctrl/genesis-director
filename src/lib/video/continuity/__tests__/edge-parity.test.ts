/**
 * Parity guard: the edge-side continuity contract
 * (supabase/functions/_shared/continuity-contract.ts) must agree with
 * the client brain (src/lib/video/continuity) on verdicts, priorities,
 * composites, and corrective steps. If you change one, change both —
 * this test fails the moment they diverge.
 */
import { describe, it, expect } from "vitest";
import { evaluateContinuity as clientEval } from "../continuity-score";
import { nextCorrection as clientLadder } from "../correction-ladder";
import { inferBoundary, type BoundaryShotFacts } from "../boundaries";
import {
  evaluateContinuity as edgeEval,
  nextCorrection as edgeLadder,
  inferBoundaryType as edgeInfer,
  auditClip,
  type BoundaryType,
  type DimensionScores,
} from "../../../../../supabase/functions/_shared/continuity-contract";

const shot = (o: Partial<BoundaryShotFacts> & { shotId: string }): BoundaryShotFacts => ({
  sceneId: "s1", slug: "INT. KITCHEN - DAY", framing: "medium", cast: ["hero"], ...o,
});

const SCORE_CASES: DimensionScores[] = [
  { identity: 99, wardrobe: 99, boundary: 99, temporal: 99, color: 99, vlm: 99 },
  { identity: 99, wardrobe: 99, boundary: 40, temporal: 99, color: 99, vlm: 99 },
  { identity: 50, wardrobe: 80, boundary: 90, temporal: 90, color: 90, vlm: 80 },
  { identity: 99, wardrobe: 99, boundary: 10, temporal: 99, color: 20, vlm: 99 },
  { identity: 30, wardrobe: 40, boundary: 30, temporal: 30, color: 30, vlm: 30 },
  { identity: 95, wardrobe: null, boundary: 95, temporal: null, color: null, vlm: null },
];

const BOUNDARIES: Array<{ type: BoundaryType; shared: number }> = [
  { type: "CONTINUOUS", shared: 1 },
  { type: "MATCH_CUT", shared: 1 },
  { type: "HARD_CUT", shared: 1 },
  { type: "HARD_CUT", shared: 0 }, // cut to a new cast — identity must not gate
  { type: "TIME_JUMP", shared: 1 },
  { type: "TIME_JUMP", shared: 0 },
  { type: "LOCATION_CHANGE", shared: 0 },
  { type: "LOCATION_CHANGE", shared: 1 },
  { type: "INTRO", shared: 0 },
];

describe("edge ↔ client scoring parity", () => {
  for (const b of BOUNDARIES) {
    for (const [i, scores] of SCORE_CASES.entries()) {
      it(`${b.type} (shared=${b.shared}) case ${i}`, () => {
        // Build a client boundary of the right type, then compare.
        const clientBoundary = boundaryOfType(b.type, b.shared);
        const client = clientEval(scores, clientBoundary);
        const edge = edgeEval(scores, b.type, b.shared);
        expect(edge.verdict).toBe(client.verdict);
        expect(edge.priority).toBe(client.priority);
        expect(edge.composite).toBe(client.composite);
        expect(edge.failures.map((f) => f.dimension).sort()).toEqual(
          client.failures.map((f) => f.dimension).sort(),
        );
      });
    }
  }
});

describe("edge ↔ client ladder parity", () => {
  const seamFail = edgeEval(
    { identity: 99, wardrobe: 99, boundary: 40, temporal: 99, color: 99, vlm: 99 },
    "CONTINUOUS",
    1,
  );
  const clientSeamFail = clientEval(
    { identity: 99, wardrobe: 99, boundary: 40, temporal: 99, color: 99, vlm: 99 },
    boundaryOfType("CONTINUOUS", 1),
  );
  const ctx = {
    maxAttempts: 4,
    currentEngine: "seedance-1-pro",
    availableEngines: ["seedance-1-pro", "kling-2-master", "runway-gen-4"],
  };

  for (const attempt of [0, 1, 2, 3]) {
    it(`attempt ${attempt} agrees`, () => {
      const edge = edgeLadder(seamFail, { ...ctx, attempt });
      const client = clientLadder(clientSeamFail as never, { ...ctx, attempt } as never);
      expect(edge.step).toBe(client.step);
      expect(edge.targetEngine ?? null).toBe(client.targetEngine ?? null);
    });
  }
});

describe("edge ↔ client boundary inference parity", () => {
  const pairs: Array<[BoundaryShotFacts | null, BoundaryShotFacts]> = [
    [null, shot({ shotId: "b" })],
    [shot({ shotId: "a", framing: "medium" }), shot({ shotId: "b", framing: "close" })],
    [shot({ shotId: "a", framing: "extreme-close" }), shot({ shotId: "b", framing: "wide" })],
    [shot({ shotId: "a", framing: "medium" }), shot({ shotId: "b", framing: "medium", hasTransitionIn: true })],
    [shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY" }), shot({ shotId: "b", sceneId: "s2", slug: "EXT. BEACH - DAY", cast: ["x"] })],
    [shot({ shotId: "a", sceneId: "s1", slug: "INT. ROOM - DAY", timeOfDay: "DAY" }), shot({ shotId: "b", sceneId: "s2", slug: "INT. ROOM - NIGHT", timeOfDay: "NIGHT" })],
    [shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY" }), shot({ shotId: "b", sceneId: "s2", slug: "INT. KITCHEN - DAY" })],
    [shot({ shotId: "a", framing: "wide" }), shot({ shotId: "b", framing: "extreme-close", inheritsFromShotId: "a" })],
  ];
  for (const [i, [prev, cur]] of pairs.entries()) {
    it(`pair ${i} agrees on type + sharedCast`, () => {
      const client = inferBoundary(prev, cur);
      const edge = edgeInfer(prev, cur);
      expect(edge.type).toBe(client.type);
      expect(edge.sharedCast.sort()).toEqual(client.sharedCast.sort());
    });
  }
});

describe("auditClip is the one-call gate", () => {
  it("admits a clean clip with no correction", () => {
    const r = auditClip({
      scores: { identity: 95, wardrobe: 95, boundary: 95, temporal: 95, color: 95, vlm: 95 },
      boundaryType: "CONTINUOUS",
      attempt: 0, maxAttempts: 3, currentEngine: "kling-2-master", availableEngines: ["kling-2-master"],
    });
    expect(r.admit).toBe(true);
    expect(r.correction).toBeNull();
  });

  it("blocks a seam break and attaches a corrective step", () => {
    const r = auditClip({
      scores: { identity: 95, wardrobe: 95, boundary: 35, temporal: 95, color: 95, vlm: 95 },
      boundaryType: "CONTINUOUS",
      attempt: 0, maxAttempts: 3, currentEngine: "seedance-1-pro", availableEngines: ["seedance-1-pro", "kling-2-master"],
    });
    expect(r.admit).toBe(false);
    expect(r.correction?.step).toBe("reseed");
  });
});

// Build a client Boundary object whose `type` is exactly `t`, by
// constructing shot facts the inferrer will classify that way.
function boundaryOfType(t: BoundaryType, sharedCast: number) {
  const castA = ["hero"];
  const castB = sharedCast > 0 ? ["hero"] : ["villain"];
  switch (t) {
    case "INTRO":
      return inferBoundary(null, shot({ shotId: "b", cast: castB }));
    case "CONTINUOUS":
      return inferBoundary(shot({ shotId: "a", framing: "medium", cast: castA }), shot({ shotId: "b", framing: "close", cast: castB.includes("hero") ? castB : ["hero"] }));
    case "MATCH_CUT":
      return inferBoundary(shot({ shotId: "a", framing: "extreme-close", cast: castA }), shot({ shotId: "b", framing: "wide", cast: ["hero"] }));
    case "HARD_CUT":
      // Cut classification is cast-independent — vary cast to exercise sharedCast.
      return inferBoundary(shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY", cast: castA }), shot({ shotId: "b", sceneId: "s2", slug: "INT. KITCHEN - DAY", cast: castB }));
    case "TIME_JUMP":
      return inferBoundary(shot({ shotId: "a", sceneId: "s1", slug: "INT. ROOM - DAY", timeOfDay: "DAY", cast: castA }), shot({ shotId: "b", sceneId: "s2", slug: "INT. ROOM - NIGHT", timeOfDay: "NIGHT", cast: castB }));
    case "LOCATION_CHANGE":
      return inferBoundary(shot({ shotId: "a", sceneId: "s1", slug: "INT. A - DAY", cast: castA }), shot({ shotId: "b", sceneId: "s2", slug: "EXT. B - DAY", cast: castB }));
  }
}
