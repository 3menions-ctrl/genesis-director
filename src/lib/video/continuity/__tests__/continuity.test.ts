import { describe, it, expect } from "vitest";
import {
  inferBoundary,
  buildBoundaryGraph,
  parseSlug,
  type BoundaryShotFacts,
} from "../boundaries";
import { evaluateContinuity, type DimensionScores } from "../continuity-score";
import { nextCorrection } from "../correction-ladder";
import { routeEngineForBoundary } from "../engine-routing";
import { buildIdentityBible, validateBible } from "../identity-bible";

const shot = (o: Partial<BoundaryShotFacts> & { shotId: string }): BoundaryShotFacts => ({
  sceneId: "s1",
  slug: "INT. KITCHEN - DAY",
  framing: "medium",
  cast: ["hero"],
  ...o,
});

// Perfect scores everywhere — used to isolate what the contract gates.
const perfect: DimensionScores = {
  identity: 99, wardrobe: 99, boundary: 99, temporal: 99, color: 99, vlm: 99,
};

describe("boundary inference", () => {
  it("first shot is INTRO", () => {
    expect(inferBoundary(null, shot({ shotId: "a" })).type).toBe("INTRO");
  });

  it("same scene, smooth framing, shared cast → CONTINUOUS", () => {
    const prev = shot({ shotId: "a", framing: "medium" });
    const cur = shot({ shotId: "b", framing: "close" });
    expect(inferBoundary(prev, cur).type).toBe("CONTINUOUS");
  });

  it("same scene, jarring framing change → MATCH_CUT", () => {
    const prev = shot({ shotId: "a", framing: "extreme-close" });
    const cur = shot({ shotId: "b", framing: "wide" });
    expect(inferBoundary(prev, cur).type).toBe("MATCH_CUT");
  });

  it("transition beat forces a cut even with smooth framing", () => {
    const prev = shot({ shotId: "a", framing: "medium" });
    const cur = shot({ shotId: "b", framing: "medium", hasTransitionIn: true });
    expect(inferBoundary(prev, cur).type).toBe("MATCH_CUT");
  });

  it("different location → LOCATION_CHANGE", () => {
    const prev = shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY" });
    const cur = shot({ shotId: "b", sceneId: "s2", slug: "EXT. BEACH - DAY" });
    expect(inferBoundary(prev, cur).type).toBe("LOCATION_CHANGE");
  });

  it("same location, new time → TIME_JUMP", () => {
    const prev = shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY", timeOfDay: "DAY" });
    const cur = shot({ shotId: "b", sceneId: "s2", slug: "INT. KITCHEN - NIGHT", timeOfDay: "NIGHT" });
    expect(inferBoundary(prev, cur).type).toBe("TIME_JUMP");
  });

  it("same location + time, different scene → HARD_CUT", () => {
    const prev = shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY" });
    const cur = shot({ shotId: "b", sceneId: "s2", slug: "INT. KITCHEN - DAY" });
    expect(inferBoundary(prev, cur).type).toBe("HARD_CUT");
  });

  it("explicit inheritance keeps it CONTINUOUS across framing jumps", () => {
    const prev = shot({ shotId: "a", framing: "wide" });
    const cur = shot({ shotId: "b", framing: "extreme-close", inheritsFromShotId: "a" });
    expect(inferBoundary(prev, cur).type).toBe("CONTINUOUS");
  });

  it("parseSlug splits location and time", () => {
    expect(parseSlug("INT. KITCHEN - NIGHT")).toEqual({ location: "INT. KITCHEN", time: "NIGHT" });
  });

  it("builds a full graph of length N", () => {
    const g = buildBoundaryGraph([shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" })]);
    expect(g).toHaveLength(2);
    expect(g[0].type).toBe("INTRO");
  });
});

describe("continuity score is contract-relative (the core property)", () => {
  it("CONTINUOUS hard-fails when the seam breaks", () => {
    const b = inferBoundary(shot({ shotId: "a", framing: "medium" }), shot({ shotId: "b", framing: "close" }));
    expect(b.type).toBe("CONTINUOUS");
    const score = evaluateContinuity({ ...perfect, boundary: 40 }, b);
    expect(score.verdict).toBe("hard-fail");
    expect(score.failures.map((f) => f.dimension)).toContain("boundary");
  });

  it("TIME_JUMP PASSES even when colour changes (look is meant to change)", () => {
    const b = inferBoundary(
      shot({ shotId: "a", sceneId: "s1", slug: "INT. ROOM - DAY", timeOfDay: "DAY" }),
      shot({ shotId: "b", sceneId: "s2", slug: "INT. ROOM - NIGHT", timeOfDay: "NIGHT" }),
    );
    expect(b.type).toBe("TIME_JUMP");
    const score = evaluateContinuity({ ...perfect, color: 20, boundary: 10 }, b);
    expect(score.verdict).toBe("pass");
  });

  it("CONTINUOUS hard-fails when identity drifts", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    const score = evaluateContinuity({ ...perfect, identity: 50 }, b);
    expect(score.verdict).toBe("hard-fail");
    expect(score.priority === "medium" || score.priority === "high" || score.priority === "critical").toBe(true);
  });

  it("LOCATION_CHANGE with NO shared cast ignores identity", () => {
    const b = inferBoundary(
      shot({ shotId: "a", sceneId: "s1", slug: "INT. A - DAY", cast: ["hero"] }),
      shot({ shotId: "b", sceneId: "s2", slug: "EXT. B - DAY", cast: ["villain"] }),
    );
    expect(b.type).toBe("LOCATION_CHANGE");
    expect(b.sharedCast).toHaveLength(0);
    const score = evaluateContinuity({ ...perfect, identity: 10 }, b);
    expect(score.verdict).toBe("pass");
  });

  it("HARD_CUT to an entirely new cast does NOT gate identity (the missed scenario)", () => {
    const b = inferBoundary(
      shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY", cast: ["hero"] }),
      shot({ shotId: "b", sceneId: "s2", slug: "INT. KITCHEN - DAY", cast: ["stranger"] }),
    );
    expect(b.type).toBe("HARD_CUT");
    expect(b.sharedCast).toHaveLength(0);
    // A new person legitimately scores low against the protagonist's bible —
    // that must NOT be flagged as drift.
    const score = evaluateContinuity({ ...perfect, identity: 12, wardrobe: 20 }, b);
    expect(score.verdict).toBe("pass");
  });

  it("HARD_CUT with the SAME cast still gates identity", () => {
    const b = inferBoundary(
      shot({ shotId: "a", sceneId: "s1", slug: "INT. KITCHEN - DAY", cast: ["hero"] }),
      shot({ shotId: "b", sceneId: "s2", slug: "INT. KITCHEN - DAY", cast: ["hero"] }),
    );
    expect(b.sharedCast).toEqual(["hero"]);
    expect(evaluateContinuity({ ...perfect, identity: 30 }, b).verdict).toBe("hard-fail");
  });

  it("LOCATION_CHANGE WITH shared cast still gates identity", () => {
    const b = inferBoundary(
      shot({ shotId: "a", sceneId: "s1", slug: "INT. A - DAY", cast: ["hero"] }),
      shot({ shotId: "b", sceneId: "s2", slug: "EXT. B - DAY", cast: ["hero"] }),
    );
    expect(b.sharedCast).toEqual(["hero"]);
    const score = evaluateContinuity({ ...perfect, identity: 30 }, b);
    expect(score.verdict).toBe("hard-fail");
  });

  it("a clean clip passes and reports priority none", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    const score = evaluateContinuity(perfect, b);
    expect(score.verdict).toBe("pass");
    expect(score.priority).toBe("none");
    expect(score.composite).toBeGreaterThan(90);
  });

  it("null (unmeasured) dimensions don't sink the composite", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    const partial: DimensionScores = { identity: 95, wardrobe: null, boundary: 95, temporal: null, color: null, vlm: null };
    const score = evaluateContinuity(partial, b);
    expect(score.composite).toBeGreaterThan(90);
  });
});

describe("correction ladder is deterministic + bounded", () => {
  const base = {
    maxAttempts: 4,
    currentEngine: "seedance-1-pro" as const,
    availableEngines: ["seedance-1-pro", "kling-2-master", "runway-gen-4"] as const,
  };
  const seamFail = evaluateContinuity(
    { identity: 99, wardrobe: 99, boundary: 40, temporal: 99, color: 99, vlm: 99 },
    inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" })),
  );

  it("first failure → cheap reseed", () => {
    expect(nextCorrection(seamFail, { ...base, attempt: 0, availableEngines: [...base.availableEngines] }).step).toBe("reseed");
  });

  it("seam failure on second attempt → strengthen-anchor", () => {
    expect(nextCorrection(seamFail, { ...base, attempt: 1, availableEngines: [...base.availableEngines] }).step).toBe("strengthen-anchor");
  });

  it("third attempt → swap to a seam-fixing engine (Kling)", () => {
    const d = nextCorrection(seamFail, { ...base, attempt: 2, availableEngines: [...base.availableEngines] });
    expect(d.step).toBe("swap-engine");
    expect(d.targetEngine).toBe("kling-2-master");
  });

  it("budget exhausted → escalate, never loops", () => {
    expect(nextCorrection(seamFail, { ...base, attempt: 3, availableEngines: [...base.availableEngines] }).step).toBe("escalate");
  });

  it("same inputs → same decision (resumable)", () => {
    const ctx = { ...base, attempt: 1, availableEngines: [...base.availableEngines] };
    expect(nextCorrection(seamFail, ctx)).toEqual(nextCorrection(seamFail, ctx));
  });
});

describe("engine routing by boundary demand", () => {
  const all = ["seedance-1-pro", "kling-2-master", "runway-gen-4", "veo-3-pro", "sora-2"] as const;

  it("CONTINUOUS with both anchors → Kling (interpolation)", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    const r = routeEngineForBoundary(b, [...all], { hasBothAnchors: true });
    expect(r.engine).toBe("kling-2-master");
  });

  it("dialogue → Kling (lip-sync)", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    expect(routeEngineForBoundary(b, [...all], { hasDialogue: true }).engine).toBe("kling-2-master");
  });

  it("identity-critical cut → Runway", () => {
    const b = inferBoundary(
      shot({ shotId: "a", sceneId: "s1", slug: "INT. A - DAY", cast: ["hero"] }),
      shot({ shotId: "b", sceneId: "s2", slug: "INT. A - DAY", cast: ["hero"] }),
    );
    expect(b.type).toBe("HARD_CUT");
    expect(routeEngineForBoundary(b, [...all], {}).engine).toBe("runway-gen-4");
  });

  it("action → Seedance", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    expect(routeEngineForBoundary(b, [...all], { isAction: true }).engine).toBe("seedance-1-pro");
  });

  it("falls back to an available engine when the ideal is missing", () => {
    const b = inferBoundary(shot({ shotId: "a" }), shot({ shotId: "b", framing: "close" }));
    const r = routeEngineForBoundary(b, ["seedance-1-pro"], { hasBothAnchors: true });
    expect(r.engine).toBe("seedance-1-pro");
  });
});

describe("identity bible", () => {
  it("orders by role priority and distils DNA", () => {
    const bible = buildIdentityBible(
      [
        { characterId: "x", name: "Sidekick", role: "supporting", physicalDescription: "tall" },
        { characterId: "y", name: "Hero", role: "protagonist", physicalDescription: "scarred" },
      ],
      { palette: "teal", grade: "filmic", lens: "anamorphic" },
    );
    expect(bible.characters[0].name).toBe("Hero");
    expect(bible.characters[0].identityDNA).toContain("scarred");
  });

  it("validateBible repairs empty DNA + flags missing visual anchor", () => {
    const bible = buildIdentityBible(
      [{ characterId: "z", name: "Ghost", identityDNA: "" }],
      { palette: "", grade: "", lens: "" },
    );
    const { fixed, errors } = validateBible(bible);
    expect(fixed.characters[0].identityDNA.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("no visual anchor"))).toBe(true);
  });
});
