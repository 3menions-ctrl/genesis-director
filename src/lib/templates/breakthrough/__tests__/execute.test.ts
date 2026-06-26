import { describe, it, expect, vi } from "vitest";
import { executeBreakthroughRender, type InvokeFn } from "../execute";
import { getBreakthroughTemplate } from "../registry";
import type { TemplateDefinition } from "../schema";

const social = () => getBreakthroughTemplate("bt-social-feed-breakout") as TemplateDefinition;

/** A mock invoke that returns a deterministic URL per edge function call,
 *  and records the seamless-stitcher breakthrough payload. */
function mockInvoke() {
  const calls: { fn: string; body: any }[] = [];
  let n = 0;
  const invoke: InvokeFn = async (fn, opts) => {
    calls.push({ fn, body: opts.body });
    if (fn === "seamless-stitcher") {
      return { data: { video_url: "https://out/final.mp4" }, error: null };
    }
    n += 1;
    return { data: { url: `https://gen/${fn}-${n}.bin` }, error: null };
  };
  return { invoke, calls };
}

describe("executeBreakthroughRender", () => {
  it("drives the plan against the real edge function names and returns the final URL", async () => {
    const { invoke, calls } = mockInvoke();
    const res = await executeBreakthroughRender(social(), { invoke });
    expect(res.videoUrl).toBe("https://out/final.mp4");
    const fns = calls.map((c) => c.fn);
    expect(fns).toContain("generate-scene-images");
    expect(fns).toContain("generate-video");
    expect(fns.at(-1)).toBe("seamless-stitcher"); // composite last
  });

  it("resolves @handles: the stitcher receives concrete layer URLs", async () => {
    const { invoke, calls } = mockInvoke();
    await executeBreakthroughRender(social(), { invoke });
    const stitch = calls.find((c) => c.fn === "seamless-stitcher")!;
    const bt = stitch.body.breakthrough;
    expect(bt.chromeUrl).toMatch(/^https:\/\/gen\//);
    expect(bt.innerUrl).toMatch(/^https:\/\/gen\//);
    expect(bt.subjectUrl).toMatch(/^https:\/\/gen\//);
    expect(bt.aftermathUrl).toMatch(/^https:\/\/gen\//);
    // no unresolved @handles leak through
    expect(JSON.stringify(bt)).not.toMatch(/@[a-zA-Z]/);
  });

  it("passes chromakey opts (and skips a matte invoke) when matting=chromakey", async () => {
    const { invoke, calls } = mockInvoke();
    await executeBreakthroughRender(social(), { invoke }); // social uses chromakey
    const stitch = calls.find((c) => c.fn === "seamless-stitcher")!;
    expect(stitch.body.breakthrough.chromakey?.color).toBe("#00B140");
    // chromakey passthrough → no composite-character / video-matte invoke
    expect(calls.some((c) => c.fn === "composite-character" || c.fn === "video-matte")).toBe(false);
  });

  it("invokes a real matte function when matting != chromakey", async () => {
    const { invoke, calls } = mockInvoke();
    const cctv = getBreakthroughTemplate("bt-cctv-grid-walk-across") as TemplateDefinition; // birefnet-frames
    await executeBreakthroughRender(cctv, { invoke });
    expect(calls.some((c) => c.fn === "composite-character")).toBe(true);
  });

  it("carries the audio-cue-aligned break beat into the stitch payload", async () => {
    const { invoke, calls } = mockInvoke();
    await executeBreakthroughRender(social(), { invoke, audioCue: { atSec: 8 } });
    const bt = calls.find((c) => c.fn === "seamless-stitcher")!.body.breakthrough;
    expect(bt.subjectActiveFromSec).toBe(8);
    expect(bt.mask.openStartSec).toBeCloseTo(7.5);
    expect(bt.sfx?.atSec).toBe(8); // SFX delayed to the cue
  });

  it("reports progress for every step", async () => {
    const { invoke } = mockInvoke();
    const onProgress = vi.fn();
    await executeBreakthroughRender(social(), { invoke, onProgress });
    const total = onProgress.mock.calls[0][0].total;
    expect(onProgress).toHaveBeenCalledTimes(total);
  });

  it("throws with step context when an edge function errors", async () => {
    const invoke: InvokeFn = async (fn) =>
      fn === "generate-scene-images"
        ? { data: null, error: { message: "FLUX quota exceeded" } }
        : { data: { url: "x" }, error: null };
    await expect(executeBreakthroughRender(social(), { invoke })).rejects.toThrow(/FLUX quota exceeded/);
  });
});
