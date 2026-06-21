/**
 * Render fixtures F02-F06 — invariant assertions for the major
 * branches of the seamless-stitcher graph.
 *
 * F01 (in F01.test.ts) proved the pattern with two clips + a single
 * title. F02-F06 each isolate one branch the bake takes and assert
 * the structural invariants that branch is responsible for.
 *
 * If any fixture starts failing, the failure pinpoints exactly which
 * editor feature regressed — the test names map 1:1 to the fixture
 * description and the failing branch in `buildSeamlessCommand`.
 */

import { describe, it, expect } from "vitest";
import F02 from "../render-fixtures/F02-two-clip-fade.json";
import F03 from "../render-fixtures/F03-title-styled.json";
import F04 from "../render-fixtures/F04-keyframed.json";
import F05 from "../render-fixtures/F05-muted-with-aux.json";
import F06 from "../render-fixtures/F06-v2-overlay.json";
import {
  compile,
  hasChunk,
  hasUniqueLabels,
  chunksMatching,
  type Fixture,
} from "./harness";

describe("F02 — two-clip dissolve at custom duration", () => {
  const c = compile(F02 as Fixture);

  it("compiles cleanly with unique output labels", () => {
    expect(hasUniqueLabels(c).ok).toBe(true);
  });

  it("uses the requested transition kind, not the default", () => {
    expect(hasChunk(c, /xfade=transition=dissolve/)).toBe(true);
    expect(hasChunk(c, /xfade=transition=fade/)).toBe(false);
  });

  it("clamps requested duration to half the shortest adjacent clip", () => {
    // Clip a = 5s, clip b = 3s; requested X = 0.6.
    // The clamp formula is X' = min(X, min(adj) - 0.05) = min(0.6, 2.95) = 0.6.
    expect(hasChunk(c, /xfade=transition=dissolve:duration=0\.6/)).toBe(true);
  });

  it("offset = (first clip duration) - X = 5 - 0.6 = 4.4", () => {
    expect(hasChunk(c, /xfade=transition=dissolve:duration=0\.6:offset=4\.4/)).toBe(
      true,
    );
  });

  it("emits a matching acrossfade with the same clamped duration", () => {
    expect(hasChunk(c, /acrossfade=d=0\.6/)).toBe(true);
  });
});

describe("F03 — styled title overlay", () => {
  const c = compile(F03 as Fixture);

  it("compiles cleanly with unique output labels", () => {
    expect(hasUniqueLabels(c).ok).toBe(true);
  });

  it("emits the user's text inside drawtext", () => {
    expect(hasChunk(c, /drawtext=text='Lower-Third Title'/)).toBe(true);
  });

  it("renders the requested HEX color via drawtext fontcolor=0xRRGGBB", () => {
    expect(hasChunk(c, /fontcolor=0xff6b00/)).toBe(true);
  });

  it("emits enable=between(t, start, start+dur)", () => {
    // start=1, dur=3 → [1, 4]
    expect(hasChunk(c, /enable='between\(t,1,4\)'/)).toBe(true);
  });

  it("emits a font size scaled by sizePct% of the canvas height", () => {
    // sizePct=5 at 1080 = 54px
    expect(hasChunk(c, /fontsize=54/)).toBe(true);
  });

  it("emits a shadow pass (drawtext at 55% black) for legibility", () => {
    expect(hasChunk(c, /fontcolor=black@0\.55/)).toBe(true);
  });

  it("bold flag adds bordercolor to the main pass", () => {
    expect(hasChunk(c, /bordercolor=0xff6b00/)).toBe(true);
  });

  it("custom x/y are translated into pixel-anchored expressions", () => {
    // x=0.1 * 1920 = 192; y=0.85 * 1080 = 918
    // Main drawtext uses `x=192-text_w/2:y=918-text_h/2`; shadow adds the offset.
    expect(hasChunk(c, /x=192-text_w\/2:y=918-text_h\/2/)).toBe(true);
  });
});

describe("F04 — pre-compiled keyframe chains", () => {
  const c = compile(F04 as Fixture);

  it("compiles cleanly with unique output labels", () => {
    expect(hasUniqueLabels(c).ok).toBe(true);
  });

  it("splices the video keyframe chain into the per-input normalize stage", () => {
    // The normalize chunk for input 0 should contain the keyframe
    // chain's scale+crop+colorchannelmixer sequence verbatim.
    const normChunks = chunksMatching(c, /\[0:v\].*colorchannelmixer=aa=/);
    expect(normChunks.length).toBeGreaterThan(0);
    expect(normChunks[0]).toContain("scale=w=");
    expect(normChunks[0]).toContain("eval=frame");
  });

  it("splices the audio keyframe chain into the audio normalize stage", () => {
    expect(hasChunk(c, /\[0:a\].*volume='/)).toBe(true);
  });

  it("audio chain still contains the standard aresample + aformat prelude", () => {
    expect(hasChunk(c, /\[0:a\]aresample=48000/)).toBe(true);
    expect(hasChunk(c, /aformat=sample_fmts=fltp/)).toBe(true);
  });
});

describe("F05 — muted voice clip with A2 aux music", () => {
  const c = compile(F05 as Fixture);

  it("compiles cleanly with unique output labels", () => {
    expect(hasUniqueLabels(c).ok).toBe(true);
  });

  it("voice clip's audio chain forces volume=0 (muted)", () => {
    expect(hasChunk(c, /\[0:a\].*volume=0/)).toBe(true);
  });

  it("aux audio is delayed via adelay to its timeline start", () => {
    // timelineStartSec = 0 → adelay=delays=0
    expect(hasChunk(c, /adelay=delays=0:all=1/)).toBe(true);
  });

  it("aux audio normalizes through the canonical pipeline", () => {
    expect(hasChunk(c, /\[1:a\].*aresample=48000/)).toBe(true);
  });

  it("master audio amixes the voice + aux tracks", () => {
    expect(hasChunk(c, /amix=inputs=2/)).toBe(true);
  });

  it("the final encoder map targets the post-amix label", () => {
    expect(c.finalAudioLabel).toBe("aWithAux");
  });

  it("the aux input slot lives AFTER all video inputs (-i file2)", () => {
    expect(c.command).toContain("-i file2");
  });
});

describe("F06 — V2 video overlay clip", () => {
  const c = compile(F06 as Fixture);

  it("compiles cleanly with unique output labels", () => {
    expect(hasUniqueLabels(c).ok).toBe(true);
  });

  it("normalizes the overlay clip into canvas dimensions", () => {
    expect(hasChunk(c, /\[1:v\].*scale=1920:1080/)).toBe(true);
  });

  it("uses yuva420p (alpha) for the overlay so transparency carries", () => {
    expect(hasChunk(c, /\[1:v\].*format=yuva420p/)).toBe(true);
  });

  it("shifts the overlay PTS so it lands at its timelineStartSec=2", () => {
    expect(hasChunk(c, /setpts=PTS-STARTPTS\+2\/TB/)).toBe(true);
  });

  it("composites with overlay=enable=between(t, start, end) and eof_action=pass", () => {
    // timelineStartSec=2, dur=4 → [2, 6]
    expect(
      hasChunk(c, /overlay=enable='between\(t,2,6\)':eof_action=pass/),
    ).toBe(true);
  });

  it("the final video label points at the overlay output, not the main video", () => {
    // After F06's single overlay, finalVideoLabel = ovX0.
    expect(c.finalVideoLabel).toBe("ovX0");
  });

  it("the overlay input is in slot file2 (after the single V1 input)", () => {
    expect(c.command).toContain("-i file2");
  });
});
