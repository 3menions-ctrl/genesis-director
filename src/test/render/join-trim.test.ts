/**
 * Continuity v2 — join-trim + matched-frame hard cuts in the stitcher
 * command builder.
 *
 * Frame-chained pipeline renders join clips on a matched handoff frame.
 * The vendor recipe (BytePlus Seedance guide, 2026-06): trim 6 frames off
 * the outgoing tail (generation quality decays into the last frames) and
 * 1 frame off the incoming head (it duplicates the handoff frame), then
 * HARD CUT — a crossfade would blend the residual mismatch into ghosting.
 *
 * These tests pin: (1) trim filters land in the graph before any other
 * processing, (2) "cut" boundaries emit concat (not xfade), (3) xfade
 * offset math uses post-trim durations, (4) mixed cut/xfade chains keep
 * label continuity.
 */

import { describe, it, expect } from "vitest";
import {
  buildSeamlessCommand,
  effectiveDuration,
  type StitchInput,
} from "../../../supabase/functions/_shared/seamless-command.ts";

const clip = (partial: Partial<StitchInput> = {}): StitchInput => ({
  url: "https://example.com/clip.mp4",
  duration: 10,
  isIntro: false,
  ...partial,
});

describe("effectiveDuration", () => {
  it("subtracts head+tail trims from the source duration", () => {
    expect(effectiveDuration(clip({ trimStartSec: 1 / 30, trimEndSec: 0.2 }))).toBeCloseTo(10 - 1 / 30 - 0.2, 5);
  });
  it("is the raw duration when no trims are set", () => {
    expect(effectiveDuration(clip())).toBe(10);
  });
});

describe("join trim in the filter graph", () => {
  it("emits trim + setpts (video) and atrim + asetpts (audio) before scaling", () => {
    const { command } = buildSeamlessCommand({
      inputs: [clip({ trimEndSec: 0.2 }), clip({ trimStartSec: 1 / 30 })],
      transitionDuration: 0.4,
      transitionType: "fade",
    });
    // Outgoing tail: end = 10 - 0.2 = 9.8, from t=0.
    expect(command).toContain("[0:v]trim=start=0:end=9.8,setpts=PTS-STARTPTS,scale=");
    expect(command).toContain("[0:a]atrim=start=0:end=9.8,asetpts=PTS-STARTPTS,aresample=");
    // Incoming head: start = 1/30 ≈ 0.033 (ms-rounded).
    expect(command).toContain("[1:v]trim=start=0.033:end=10,setpts=PTS-STARTPTS,scale=");
    expect(command).toContain("[1:a]atrim=start=0.033:end=10,asetpts=PTS-STARTPTS,aresample=");
  });

  it("emits no trim stage for untrimmed inputs", () => {
    const { command } = buildSeamlessCommand({
      inputs: [clip(), clip()],
      transitionDuration: 0.4,
      transitionType: "fade",
    });
    expect(command).not.toContain("trim=");
  });
});

describe("cut boundaries", () => {
  it("joins with concat instead of xfade", () => {
    const { command } = buildSeamlessCommand({
      inputs: [clip(), clip()],
      transitionDuration: 0.4,
      transitionType: "fade",
      perBoundaryTransitions: [{ kind: "cut", durationSec: 0 }],
    });
    expect(command).toContain("[v0][v1]concat=n=2:v=1:a=0[vx0]");
    expect(command).toContain("[a0][a1]concat=n=2:v=0:a=1[ax0]");
    expect(command).not.toContain("xfade");
    expect(command).not.toContain("acrossfade");
  });

  it("mixed chains keep label continuity (cut then fade)", () => {
    const { command } = buildSeamlessCommand({
      inputs: [clip(), clip(), clip()],
      transitionDuration: 0.4,
      transitionType: "fade",
      perBoundaryTransitions: [
        { kind: "cut", durationSec: 0 },
        { kind: "fade", durationSec: 0.4 },
      ],
    });
    expect(command).toContain("[v0][v1]concat=n=2:v=1:a=0[vx0]");
    // The following fade consumes the concat output label.
    expect(command).toContain("[vx0][v2]xfade=transition=fade:duration=0.4");
  });

  it("xfade offsets account for trimmed durations and zero-overlap cuts", () => {
    // Three 10s clips; boundary 0 is a cut (no overlap) with 0.2s tail trim on
    // clip 0 and 1-frame head trim on clip 1; boundary 1 is a 0.4s fade.
    // Running stream at boundary 1 = eff(c0) + eff(c1)
    //   = (10 - 0.2) + (10 - 0.0333...) = 19.766..., ms-rounded per stage.
    const { command } = buildSeamlessCommand({
      inputs: [
        clip({ trimEndSec: 0.2 }),
        clip({ trimStartSec: 1 / 30 }),
        clip(),
      ],
      transitionDuration: 0.4,
      transitionType: "fade",
      perBoundaryTransitions: [
        { kind: "cut", durationSec: 0 },
        { kind: "fade", durationSec: 0.4 },
      ],
    });
    const m = command.match(/xfade=transition=fade:duration=0\.4:offset=([\d.]+)/);
    expect(m).not.toBeNull();
    const offset = Number(m![1]);
    const expected = (10 - 0.2) + (10 - 1 / 30) - 0.4;
    expect(offset).toBeCloseTo(expected, 1);
  });
});
