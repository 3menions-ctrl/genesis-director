/**
 * Render fixtures F07-F12 — invariant assertions for the remaining
 * branches of buildSeamlessCommand.
 *
 * Each describe block targets one feature surface. Failures pinpoint
 * which editor feature regressed.
 */

import { describe, it, expect } from "vitest";
import F07 from "../render-fixtures/F07-aux-only.json";
import F08 from "../render-fixtures/F08-speed.json";
import F09 from "../render-fixtures/F09-multi-titles.json";
import F10 from "../render-fixtures/F10-color-grade.json";
import F11 from "../render-fixtures/F11-vfx-chain.json";
import F12 from "../render-fixtures/F12-autoduck.json";
import {
  compile,
  hasChunk,
  chunksMatching,
  type Fixture,
} from "./harness";

describe("F07 — single V1 + A2 aux audio (no muting, no ducking)", () => {
  const c = compile(F07 as Fixture);

  it("aux audio is delayed to its timeline start (3s = 3000ms)", () => {
    expect(hasChunk(c, /adelay=delays=3000:all=1/)).toBe(true);
  });

  it("aux audio is normalized through aresample + aformat", () => {
    expect(hasChunk(c, /\[1:a\].*aresample=48000.*aformat=sample_fmts=fltp/)).toBe(true);
  });

  it("amix joins the main + aux audio with duration=longest", () => {
    expect(hasChunk(c, /amix=inputs=2:duration=longest:dropout_transition=0:normalize=0/)).toBe(true);
  });

  it("final audio label is the post-amix aWithAux (no master loudnorm)", () => {
    expect(c.finalAudioLabel).toBe("aWithAux");
  });

  it("aux audio input occupies slot file2 (after the single V1 input)", () => {
    expect(c.command).toContain("-i file2");
    expect(c.command).not.toContain("-i file3");
  });
});

describe("F08 — per-clip speed (slow-mo, normal, fast)", () => {
  const c = compile(F08 as Fixture);

  it("clip 0 (0.5x slow-mo) gets setpts=PTS/0.5000 on video", () => {
    expect(hasChunk(c, /\[0:v\]setpts=PTS\/0\.5000/)).toBe(true);
  });

  it("clip 1 (1.0x normal) emits NO setpts on the fast path", () => {
    // Normal-speed input still scales/normalizes, but skips setpts.
    const norm = chunksMatching(c, /\[1:v\]/)[0];
    expect(norm).not.toContain("setpts=PTS");
  });

  it("clip 2 (2.5x fast) gets setpts=PTS/2.5000", () => {
    expect(hasChunk(c, /\[2:v\]setpts=PTS\/2\.5000/)).toBe(true);
  });

  it("audio atempo chain decomposes >2.0 speeds into ≤2.0 stages", () => {
    // 2.5x = atempo=2 then atempo=1.25 (since 2.5/2 = 1.25)
    const audio2 = chunksMatching(c, /\[2:a\]/)[0];
    expect(audio2).toContain("atempo=2");
    expect(audio2).toMatch(/atempo=1\.25/);
  });

  it("audio at 0.5x stays in a single atempo=0.5 stage", () => {
    const audio0 = chunksMatching(c, /\[0:a\]/)[0];
    expect(audio0).toMatch(/atempo=0\.5000/);
  });

  it("normal-speed audio emits NO atempo chain", () => {
    const audio1 = chunksMatching(c, /\[1:a\]/)[0];
    expect(audio1).not.toContain("atempo=");
  });
});

describe("F09 — three stacked title overlays", () => {
  const c = compile(F09 as Fixture);

  it("emits 6 drawtext stages (shadow + main per title × 3 titles)", () => {
    const drawtextChunks = chunksMatching(c, /drawtext=text='/);
    expect(drawtextChunks.length).toBe(6);
  });

  it("namespaces title shadow labels vts0, vts1, vts2", () => {
    expect(hasChunk(c, /\[vts0\]/)).toBe(true);
    expect(hasChunk(c, /\[vts1\]/)).toBe(true);
    expect(hasChunk(c, /\[vts2\]/)).toBe(true);
  });

  it("namespaces title final labels vt0, vt1, vt2", () => {
    expect(hasChunk(c, /\[vt0\]/)).toBe(true);
    expect(hasChunk(c, /\[vt1\]/)).toBe(true);
    expect(hasChunk(c, /\[vt2\]/)).toBe(true);
  });

  it("chains each title onto the previous title's output (vt0 → vt1 → vt2)", () => {
    // Title 1's shadow reads from title 0's main output [vt0].
    expect(hasChunk(c, /\[vt0\]drawtext.*\[vts1\]/)).toBe(true);
    expect(hasChunk(c, /\[vt1\]drawtext.*\[vts2\]/)).toBe(true);
  });

  it("title 2 (Fin., bold=true) includes bordercolor=", () => {
    expect(hasChunk(c, /text='Fin\.'.*bordercolor=/)).toBe(true);
  });

  it("final video label points at the last title's main pass (vt2)", () => {
    expect(c.finalVideoLabel).toBe("vt2");
  });
});

describe("F10 — color grade pre-compiled chain", () => {
  const c = compile(F10 as Fixture);

  it("splices the colorbalance stage into the per-input normalize chain", () => {
    expect(hasChunk(c, /\[0:v\].*colorbalance=rs=0\.100/)).toBe(true);
  });

  it("includes the eq=contrast+saturation stage", () => {
    expect(hasChunk(c, /eq=contrast=1\.150:saturation=1\.080/)).toBe(true);
  });

  it("includes the colortemperature stage at the right Kelvin", () => {
    expect(hasChunk(c, /colortemperature=temperature=5950/)).toBe(true);
  });

  it("the grade lands BEFORE the final format=yuv420p stage", () => {
    const norm = chunksMatching(c, /\[0:v\]/)[0];
    const gradeIdx = norm.indexOf("colorbalance=");
    const formatIdx = norm.indexOf("format=yuv420p");
    expect(gradeIdx).toBeGreaterThan(0);
    expect(formatIdx).toBeGreaterThan(gradeIdx);
  });

  it("the grade lands AFTER the scale+pad+setsar+fps preamble", () => {
    const norm = chunksMatching(c, /\[0:v\]/)[0];
    const scaleIdx = norm.indexOf("scale=");
    const gradeIdx = norm.indexOf("colorbalance=");
    expect(scaleIdx).toBeGreaterThanOrEqual(0);
    expect(scaleIdx).toBeLessThan(gradeIdx);
  });
});

describe("F11 — VFX effect chain with {vIn}/{vOut} templating", () => {
  const c = compile(F11 as Fixture);

  it("rewrites {vIn} → vG0 and {vOut} → vE0 for the first clip", () => {
    // The original effectChain references [{vIn}] and [{vOut}].
    // After splicing, those become [vG0] and [vE0].
    expect(c.filterComplex).toContain("[vG0]");
    expect(c.filterComplex).toContain("[vE0]");
    // The placeholder must be GONE — any leftover {vIn} or {vOut}
    // would crash FFmpeg with "Filter '{vIn}' not found".
    expect(c.filterComplex).not.toContain("{vIn}");
    expect(c.filterComplex).not.toContain("{vOut}");
  });

  it("declares vG0 as the upstream graded label", () => {
    // The grade-stage chunk for clip 0 ends with [vG0] when an
    // effect bake is present (instead of going straight to [v0]).
    // F11's colorFilter is `eq=contrast=1.05` — match on the grade
    // stage's trailing format=rgba[vG0] which is universal across
    // grade shapes.
    expect(hasChunk(c, /\[0:v\].*format=rgba\[vG0\]/)).toBe(true);
  });

  it("declares vE0 as an intermediate the post-effect format stage reads", () => {
    expect(hasChunk(c, /\[vE0\].*format=yuv420p/)).toBe(true);
  });

  it("preserves the user-defined scratch label fxFB1 (effect-internal)", () => {
    expect(c.filterComplex).toContain("[fxFB1]");
  });

  it("final v0 label is the post-effect format stage", () => {
    expect(hasChunk(c, /\[vE0\].*\[v0\]/)).toBe(true);
  });
});

describe("F12 — auto-ducking with sidechaincompress", () => {
  const c = compile(F12 as Fixture);

  it("emits asplit to fan the master audio into keep + sidechain copies", () => {
    expect(hasChunk(c, /asplit=2\[aMainKeep\]\[aSc0\]/)).toBe(true);
  });

  it("each aux track runs through sidechaincompress fed by its sidechain copy", () => {
    expect(
      hasChunk(c, /\[auxN0\]\[aSc0\]sidechaincompress=threshold=0\.05:ratio=8:attack=20:release=300/),
    ).toBe(true);
  });

  it("the ducked aux is amix'd back with the kept main audio", () => {
    expect(hasChunk(c, /\[aMainKeep\]\[auxD0\]amix=inputs=2/)).toBe(true);
  });

  it("final audio label is the post-mix aWithAux", () => {
    expect(c.finalAudioLabel).toBe("aWithAux");
  });

  it("WITHOUT autoDuck the same fixture would NOT emit sidechaincompress", () => {
    // Inverse — quick sanity check that the autoDuck flag actually
    // gates the sidechain path. Toggle it off and re-compile.
    const noDuck = compile({ ...(F12 as Fixture), autoDuck: false });
    expect(noDuck.filterComplex).not.toContain("sidechaincompress");
  });
});
