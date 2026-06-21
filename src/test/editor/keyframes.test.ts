/**
 * applyEasing + getClipPropertyAt — pure functions in types.ts.
 *
 * These power the in-app preview (Stage scrub) for animated clip
 * properties (opacity / scale / volume / positionX / positionY /
 * rotation). The same curves are mirrored in the FFmpeg bake at
 * _shared/keyframe-bake.ts — preview/bake parity for these is
 * covered in Week 3.
 */

import { describe, it, expect } from "vitest";
import {
  applyEasing,
  getClipPropertyAt,
  type Keyframe,
} from "@/lib/editor/types";
import type { EditorClip } from "@/lib/editor/types";

function clipWith(keyframes: Keyframe[], staticProps?: Partial<EditorClip["properties"]>): EditorClip {
  return {
    id: "c1",
    kind: "video",
    index: 0,
    timelineStartSec: 0,
    durationSec: 10,
    videoUrl: "file://c1.mp4",
    thumbnailUrl: null,
    prompt: "",
    takes: [],
    properties: staticProps,
    keyframes,
  };
}

describe("applyEasing", () => {
  it("linear is the identity", () => {
    expect(applyEasing(0, "linear")).toBe(0);
    expect(applyEasing(0.25, "linear")).toBe(0.25);
    expect(applyEasing(0.5, "linear")).toBe(0.5);
    expect(applyEasing(1, "linear")).toBe(1);
  });

  it("ease-in is x squared (slow start, fast end)", () => {
    expect(applyEasing(0, "ease-in")).toBe(0);
    expect(applyEasing(0.5, "ease-in")).toBe(0.25);
    expect(applyEasing(1, "ease-in")).toBe(1);
  });

  it("ease-out is 1 - (1-x)² (fast start, slow end)", () => {
    expect(applyEasing(0, "ease-out")).toBe(0);
    expect(applyEasing(0.5, "ease-out")).toBe(0.75);
    expect(applyEasing(1, "ease-out")).toBe(1);
  });

  it("ease-in-out is smoothstep-like (slow on both ends)", () => {
    expect(applyEasing(0, "ease-in-out")).toBe(0);
    expect(applyEasing(0.5, "ease-in-out")).toBe(0.5);
    expect(applyEasing(1, "ease-in-out")).toBe(1);
    // First half is slower than linear, second half faster
    expect(applyEasing(0.25, "ease-in-out")).toBeLessThan(0.25);
    expect(applyEasing(0.75, "ease-in-out")).toBeGreaterThan(0.75);
  });

  it("step holds previous value (always returns 0)", () => {
    expect(applyEasing(0, "step")).toBe(0);
    expect(applyEasing(0.5, "step")).toBe(0);
    expect(applyEasing(0.99, "step")).toBe(0);
  });

  it("clamps t to [0, 1]", () => {
    expect(applyEasing(-5, "linear")).toBe(0);
    expect(applyEasing(5, "linear")).toBe(1);
    expect(applyEasing(-1, "ease-in")).toBe(0);
    expect(applyEasing(2, "ease-out")).toBe(1);
  });
});

describe("getClipPropertyAt", () => {
  it("returns the static property when no keyframes exist", () => {
    const clip = clipWith([], { opacity: 0.5 });
    expect(getClipPropertyAt(clip, "opacity", 3)).toBe(0.5);
  });

  it("falls back to CLIP_PROPERTY_DEFAULTS when no static + no kfs", () => {
    const clip = clipWith([]);
    // opacity default is 1.0
    expect(getClipPropertyAt(clip, "opacity", 3)).toBe(1.0);
    // scale default is 1.0
    expect(getClipPropertyAt(clip, "scale", 3)).toBe(1.0);
  });

  it("returns the keyframe value when t === kf.time", () => {
    const clip = clipWith([
      { id: "k1", property: "opacity", time: 2, value: 0.3 },
    ]);
    expect(getClipPropertyAt(clip, "opacity", 2)).toBe(0.3);
  });

  it("linearly interpolates between two keyframes (linear easing)", () => {
    const clip = clipWith([
      { id: "k1", property: "opacity", time: 0, value: 0 },
      { id: "k2", property: "opacity", time: 4, value: 1, easing: "linear" },
    ]);
    expect(getClipPropertyAt(clip, "opacity", 2)).toBe(0.5);
    expect(getClipPropertyAt(clip, "opacity", 1)).toBe(0.25);
    expect(getClipPropertyAt(clip, "opacity", 3)).toBe(0.75);
  });

  it("applies ease-in curve between kfs (after kf's easing controls the in)", () => {
    const clip = clipWith([
      { id: "k1", property: "opacity", time: 0, value: 0 },
      { id: "k2", property: "opacity", time: 4, value: 1, easing: "ease-in" },
    ]);
    // ease-in halfway: t=0.5, eased=0.25 → value=0 + (1-0)*0.25 = 0.25
    expect(getClipPropertyAt(clip, "opacity", 2)).toBe(0.25);
  });

  it("clamps to the first keyframe value before the first kf", () => {
    const clip = clipWith([
      { id: "k1", property: "opacity", time: 2, value: 0.4 },
      { id: "k2", property: "opacity", time: 6, value: 0.8 },
    ]);
    expect(getClipPropertyAt(clip, "opacity", 0)).toBe(0.4);
    expect(getClipPropertyAt(clip, "opacity", 1)).toBe(0.4);
  });

  it("clamps to the last keyframe value after the last kf", () => {
    const clip = clipWith([
      { id: "k1", property: "opacity", time: 2, value: 0.4 },
      { id: "k2", property: "opacity", time: 6, value: 0.8 },
    ]);
    expect(getClipPropertyAt(clip, "opacity", 10)).toBe(0.8);
  });

  it("only considers keyframes matching the requested property", () => {
    const clip = clipWith(
      [
        { id: "k1", property: "scale", time: 0, value: 1 },
        { id: "k2", property: "scale", time: 4, value: 2 },
        { id: "k3", property: "opacity", time: 2, value: 0.7 },
      ],
      { opacity: 0.1 },
    );
    expect(getClipPropertyAt(clip, "opacity", 2)).toBe(0.7);
    // Scale at t=2 should interpolate linearly between (0,1) and (4,2) → 1.5
    expect(getClipPropertyAt(clip, "scale", 2)).toBe(1.5);
  });

  it("returns the LATER value when two kfs share the same time", () => {
    const clip = clipWith([
      { id: "k1", property: "opacity", time: 2, value: 0.2 },
      { id: "k2", property: "opacity", time: 2, value: 0.9 },
    ]);
    // With two kfs at the same time both pass the `k.time <= t` check,
    // so `before` ends up as the LAST assignment in the loop.
    // Last-writer-wins is the documented contract — see the comment
    // in types.ts on the kf scan loop.
    expect(getClipPropertyAt(clip, "opacity", 2)).toBe(0.9);
  });
});
