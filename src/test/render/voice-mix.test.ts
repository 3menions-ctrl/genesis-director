/**
 * A1 voiceover + A2 music mixing — verifies the fix for the bug where
 * standalone A1 narration clips were silently DROPPED from the render.
 *
 * Voice (A1) must fold into the master at full level; music (A2+) ducks
 * under the voice-inclusive master when autoDuck is on. Untagged aux must
 * keep the old (music) behaviour so existing renders are unchanged.
 */
import { describe, it, expect } from "vitest";
import { compile, validateFilterGraph, hasChunk, chunksMatching, type Fixture } from "./harness";

const base: Fixture = {
  name: "voice-mix",
  inputs: [{ url: "file://main.mp4", duration: 12 }],
  transitionDuration: 0.4,
  transitionType: "fade",
  aspectRatio: "16:9",
  resolution: "1080p",
  format: "mp4",
};

describe("A1 voiceover + A2 music mixing", () => {
  it("folds A1 voice into the master at full level and ducks A2 music under it", () => {
    const c = compile({
      ...base,
      autoDuck: true,
      auxAudio: [
        { timelineStartSec: 0, durationSec: 12, kind: "voice" }, // auxN0
        { timelineStartSec: 3, durationSec: 9, kind: "music" },  // auxN1
      ],
    });
    // structurally valid — no dangling labels / input-index errors
    expect(validateFilterGraph(c)).toEqual({ ok: true });
    // voice (auxN0) amixed into the master → aWithVoice
    expect(chunksMatching(c, /\[auxN0\].*amix.*\[aWithVoice\]/).length).toBe(1);
    // voice is NEVER sidechain-compressed (it's the narration, full level)
    expect(hasChunk(c, /\[auxN0\][^;]*sidechaincompress/)).toBe(false);
    // music (auxN1) IS sidechain-ducked
    expect(hasChunk(c, /\[auxN1\][^;]*sidechaincompress/)).toBe(true);
    // final audio is the music-inclusive mix
    expect(c.finalAudioLabel).toBe("aWithAux");
  });

  it("voice-only: folds into master, no ducking, final = aWithVoice", () => {
    const c = compile({
      ...base,
      autoDuck: true,
      auxAudio: [{ timelineStartSec: 0, durationSec: 12, kind: "voice" }],
    });
    expect(validateFilterGraph(c)).toEqual({ ok: true });
    expect(hasChunk(c, /sidechaincompress/)).toBe(false);
    expect(c.finalAudioLabel).toBe("aWithVoice");
  });

  it("backward-compatible: untagged aux behaves as ducked music (unchanged)", () => {
    const c = compile({
      ...base,
      autoDuck: true,
      auxAudio: [{ timelineStartSec: 3, durationSec: 9 }], // no kind → music
    });
    expect(validateFilterGraph(c)).toEqual({ ok: true });
    expect(hasChunk(c, /aWithVoice/)).toBe(false);     // no voice fold
    expect(hasChunk(c, /sidechaincompress/)).toBe(true); // ducked
    expect(c.finalAudioLabel).toBe("aWithAux");
  });
});
