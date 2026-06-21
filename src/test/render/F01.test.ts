/**
 * F01 — two-clip fade transition + a title card on the second clip.
 *
 * The first render-harness fixture: proves the pattern, catches the
 * `runningDuration` ReferenceError that lived in the original
 * `buildSeamlessCommand`, and asserts the invariants every fixture
 * from F02+ will inherit.
 */

import { describe, it, expect } from "vitest";
import F01 from "../render-fixtures/F01-title-clip.json";
import { compile, hasChunk, hasUniqueLabels, type Fixture } from "./harness";

describe("render fixture F01 — two clips, fade transition, single title card", () => {
  const compiled = compile(F01 as Fixture);

  it("compiles without throwing", () => {
    expect(compiled.command.length).toBeGreaterThan(100);
  });

  it("declares no duplicate output labels", () => {
    const result = hasUniqueLabels(compiled);
    expect(result.ok).toBe(true);
  });

  it("uses 1920x1080 for 16:9 1080p", () => {
    expect(compiled.outputW).toBe(1920);
    expect(compiled.outputH).toBe(1080);
  });

  it("emits a per-input normalize chain for every input", () => {
    expect(hasChunk(compiled, /\[0:v\].*scale=1920:1080/)).toBe(true);
    expect(hasChunk(compiled, /\[1:v\].*scale=1920:1080/)).toBe(true);
    expect(hasChunk(compiled, /\[0:a\].*aresample=48000/)).toBe(true);
    expect(hasChunk(compiled, /\[1:a\].*aresample=48000/)).toBe(true);
  });

  it("emits an xfade join with the correct duration and offset", () => {
    // Two 4-second clips with a 0.4s fade:
    //   offset = duration[0] - duration[0] - 0.4 = ... wait, the
    //   actual formula is: cumulative(0) - sumXPrev - X = 4 - 0 - 0.4 = 3.6.
    expect(hasChunk(compiled, /xfade=transition=fade:duration=0\.4:offset=3\.6/)).toBe(true);
  });

  it("emits an acrossfade join with matching duration", () => {
    expect(hasChunk(compiled, /acrossfade=d=0\.4/)).toBe(true);
  });

  it("emits drawtext for the title clip with the right text and window", () => {
    // start=4.5, dur=2 → enable between 4.5 and 6.5.
    expect(hasChunk(compiled, /drawtext=text='HELLO WORLD'/)).toBe(true);
    expect(hasChunk(compiled, /enable='between\(t,4\.5,6\.5\)'/)).toBe(true);
  });

  it("maps a video and audio label into the encoder", () => {
    expect(compiled.finalVideoLabel.length).toBeGreaterThan(0);
    expect(compiled.finalAudioLabel.length).toBeGreaterThan(0);
  });

  it("uses libx264 for the mp4 format with -movflags +faststart", () => {
    expect(compiled.command).toContain("libx264");
    expect(compiled.command).toContain("-movflags +faststart");
    expect(compiled.command).toContain("-pix_fmt yuv420p");
  });

  it("matches the StitchInput count with the -i file args", () => {
    expect(compiled.command).toContain("-i file1");
    expect(compiled.command).toContain("-i file2");
    expect(compiled.command).not.toContain("-i file3");
  });
});
