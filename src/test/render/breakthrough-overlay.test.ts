import { describe, it, expect } from "vitest";
import {
  buildBreakthroughOverlay,
  maskRevealExpr,
  maskShapeTest,
  type BreakthroughOverlayOpts,
} from "../../../supabase/functions/_shared/breakthrough-overlay.ts";

function opts(over: Partial<BreakthroughOverlayOpts> = {}): BreakthroughOverlayOpts {
  return {
    outW: 1080,
    outH: 1920,
    fps: 30,
    chrome: { label: "chrome", kind: "chrome" },
    inner: { label: "inner", kind: "media-window" },
    subject: { label: "subject", kind: "breakthrough" },
    aftermath: { label: "aftermath", kind: "aftermath" },
    mediaWindow: { x: 0.1, y: 0.2, width: 0.8, height: 0.46 },
    mask: {
      shape: "shatter",
      region: { x: 0.1, y: 0.2, width: 0.8, height: 0.46 },
      featherPx: 10,
      openStartSec: 5.5,
      openEndSec: 6.5,
    },
    subjectActiveFromSec: 6,
    subjectActiveToSec: 11,
    motion: [
      { property: "positionY", at: 0, value: 0 },
      { property: "positionY", at: 1, value: 0.12 },
      { property: "scale", at: 0, value: 1 },
      { property: "scale", at: 1, value: 1.6 },
    ],
    aftermathFromSec: 9,
    ...over,
  };
}

describe("maskRevealExpr", () => {
  it("ramps 0→1 across the open window in clip-local seconds", () => {
    const e = maskRevealExpr(opts().mask);
    expect(e).toContain("t-5.5");
    expect(e).toContain("6.500-5.500");
    expect(e).toMatch(/clip\(/);
  });
});

describe("maskShapeTest", () => {
  it("emits an elliptical envelope for shatter/ellipse shapes", () => {
    const e = maskShapeTest({ ...opts().mask, shape: "ellipse" }, 1080, 1920);
    expect(e).toMatch(/pow\(\(X-/);
    expect(e).toMatch(/lte/);
  });
  it("emits a rectangular test for window-rect/peel/torn/polygon", () => {
    const e = maskShapeTest({ ...opts().mask, shape: "window-rect" }, 1080, 1920);
    expect(e).toMatch(/gte\(X,/);
    expect(e).toMatch(/lte\(Y,/);
  });
});

describe("buildBreakthroughOverlay", () => {
  it("composites four layers in z-order chrome→inner→subject→aftermath", () => {
    const { segments, outLabel } = buildBreakthroughOverlay(opts());
    const joined = segments.join("\n");
    // base from chrome
    expect(joined).toMatch(/\[chrome\]scale=1080:1920.*\[bt_l0\]/);
    // inner placed into the media window via overlay x/y at window origin
    const innerX = Math.round(0.1 * 1080); // 108
    const innerY = Math.round(0.2 * 1920); // 384
    expect(joined).toContain(`overlay=x=${innerX}:y=${innerY}`);
    // subject overlay AFTER inner, aftermath last
    const l1 = joined.indexOf("bt_l1");
    const l2 = joined.indexOf("bt_l2");
    const after = joined.indexOf("bt_after");
    expect(l1).toBeGreaterThan(-1);
    expect(l2).toBeGreaterThan(l1);
    expect(after).toBeGreaterThan(l2);
    expect(outLabel).toBe("bt_out");
  });

  it("masks the subject: alpha gated by shape * reveal * activation time", () => {
    const joined = buildBreakthroughOverlay(opts()).segments.join("\n");
    // the geq alpha expression multiplies existing alpha by shape, reveal and a time gate
    expect(joined).toMatch(/a='alpha\(X,Y\)\*\(.*\)\*\(clip\(.*\)\)\*gte\(t,6\)'/);
  });

  it("positions the subject with the destination motion keyframes", () => {
    const joined = buildBreakthroughOverlay(opts()).segments.join("\n");
    // positionY animates → y overlay expression references t and the 0.12 target
    expect(joined).toMatch(/overlay=x='.*':y='.*'/);
    expect(joined).toMatch(/0\.1200/); // baked positionY end value
  });

  it("time-gates the subject and aftermath after their activation beats", () => {
    const joined = buildBreakthroughOverlay(opts()).segments.join("\n");
    expect(joined).toContain("enable='gte(t,6)'"); // subject from break beat
    expect(joined).toContain("enable='gte(t,9)'"); // aftermath from settle
  });

  it("omits the aftermath layer when none is supplied", () => {
    const { segments, outLabel } = buildBreakthroughOverlay(opts({ aftermath: undefined }));
    const joined = segments.join("\n");
    expect(joined).not.toContain("bt_after");
    expect(outLabel).toBe("bt_out");
  });

  it("applies feather only when featherPx > 0", () => {
    const withFeather = buildBreakthroughOverlay(opts()).segments.join("\n");
    expect(withFeather).toMatch(/boxblur/);
    const noFeather = buildBreakthroughOverlay(
      opts({ mask: { ...opts().mask, featherPx: 0 } }),
    ).segments.join("\n");
    expect(noFeather).not.toMatch(/boxblur/);
  });
});
