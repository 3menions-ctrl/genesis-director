import { describe, it, expect } from "vitest";
import {
  PIPELINE_PHASES,
  PHASE_INDEX,
  phasesUpTo,
  continuityIndexFromClips,
  derivePipelineFromCounts,
  type ClipProgress,
} from "../phases";

const clip = (o: Partial<ClipProgress> & { index: number }): ClipProgress => ({
  shotId: `s${o.index}`,
  label: `Shot ${o.index + 1}`,
  status: "pending",
  attempt: 0,
  maxAttempts: 3,
  ...o,
});

describe("phase helpers", () => {
  it("PHASE_INDEX matches array order", () => {
    PIPELINE_PHASES.forEach((p, i) => expect(PHASE_INDEX[p.id]).toBe(i));
  });

  it("phasesUpTo marks done/active/pending correctly", () => {
    const ph = phasesUpTo("motion", 42);
    const motion = ph.find((p) => p.id === "motion")!;
    expect(motion.status).toBe("active");
    expect(motion.pct).toBe(42);
    expect(ph.find((p) => p.id === "bible")!.status).toBe("done");
    expect(ph.find((p) => p.id === "report")!.status).toBe("pending");
  });

  it("continuityIndex is the mean of audited composites, undefined when none", () => {
    expect(continuityIndexFromClips([clip({ index: 0 })])).toBeUndefined();
    expect(
      continuityIndexFromClips([
        clip({ index: 0, composite: 90 }),
        clip({ index: 1, composite: 100 }),
        clip({ index: 2 }), // unscored — ignored
      ]),
    ).toBe(95);
  });
});

describe("derivePipelineFromCounts", () => {
  it("maps completed/generating/pending into clip statuses", () => {
    const p = derivePipelineFromCounts({ completed: 2, generating: 1, expected: 5 });
    expect(p.clips).toHaveLength(5);
    expect(p.clips[0].status).toBe("passed");
    expect(p.clips[1].status).toBe("passed");
    expect(p.clips[2].status).toBe("rendering");
    expect(p.clips[3].status).toBe("pending");
    expect(p.overall).toBe(40);
    expect(p.phaseId).toBe("motion");
  });

  it("never produces zero-length even with no expected clips", () => {
    const p = derivePipelineFromCounts({ completed: 0, generating: 0, expected: 0 });
    expect(p.clips.length).toBeGreaterThanOrEqual(1);
    expect(p.phaseId).toBe("storyboard");
  });

  it("honours an explicit overall + phase override", () => {
    const p = derivePipelineFromCounts({ completed: 3, generating: 0, expected: 3, overall: 88, phaseId: "assembly" });
    expect(p.overall).toBe(88);
    expect(p.phaseId).toBe("assembly");
    // Coarse counts carry no real continuity scores, so the index is not
    // fabricated — it stays undefined rather than a measured-looking number.
    expect(p.continuityIndex).toBeUndefined();
  });
});
