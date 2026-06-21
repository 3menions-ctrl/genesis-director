/**
 * Preview/bake parity — keyframe interpolation.
 *
 * The preview path (`getClipPropertyAt` in src/lib/editor/types.ts)
 * evaluates a clip's animated property at time t in JavaScript.
 *
 * The bake path (`buildKeyframeExpression` in supabase/functions/_shared/
 * keyframe-bake.ts) emits an FFmpeg time expression that FFmpeg
 * evaluates at every frame.
 *
 * These two paths MUST produce the same numeric value at the same t.
 * If they don't, what the user sees in the editor doesn't match what
 * ships in the rendered MP4 — and we just spent Week 1 catching the
 * audio version of that exact class of bug.
 *
 * Strategy: pick a set of representative keyframe shapes, compile the
 * bake's FFmpeg expression, evaluate it in JS at a series of sample
 * t values, and assert the result equals `getClipPropertyAt(clip, prop, t)`
 * to within a small floating-point tolerance.
 */

import { describe, it, expect } from "vitest";
import {
  buildKeyframeExpression,
  compileVideoKeyframeChain,
  compileAudioKeyframeChain,
  type BakeKeyframe,
} from "../../../supabase/functions/_shared/keyframe-bake.ts";
import {
  getClipPropertyAt,
  type Keyframe,
  type EditorClip,
} from "@/lib/editor/types";

/**
 * Translate an FFmpeg time expression into JS and evaluate at a given t.
 *
 * The compiler emits a controlled subset:
 *   • numeric literals
 *   • `t` (the variable)
 *   • `if(lt(a,b), c, d)`  → `(a < b ? c : d)`
 *   • `pow(a, b)`          → `Math.pow(a, b)`
 *   • standard arithmetic  → unchanged
 *
 * Anything outside that subset is a regression in the bake emitter
 * (or a typo in this evaluator) and the eval call will throw.
 */
function evalFfmpegExpr(expr: string, t: number): number {
  let js = expr;
  // `if(lt(a,b),c,d)` → `(a<b?c:d)`. Nested calls require iterative
  // replacement until no `if(lt(` remains.
  // The expression uses balanced parens; we scan and split on commas
  // at the top level of each call.
  while (js.includes("if(lt(")) {
    js = replaceOneIfLt(js);
  }
  js = js.replace(/\bpow\(/g, "Math.pow(");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("t", `return (${js});`) as (t: number) => number;
  return fn(t);
}

/** Replace the LEFTMOST `if(lt(a,b),c,d)` with `(a<b?c:d)`, where
 *  a/b/c/d may themselves contain parens. Returns the rewritten string. */
function replaceOneIfLt(s: string): string {
  const start = s.indexOf("if(lt(");
  if (start < 0) return s;
  // Position after `if(lt(`
  const aStart = start + "if(lt(".length;
  const aEnd = findMatchingComma(s, aStart);
  const bStart = aEnd + 1;
  // Close the `lt(...)` call — its matching `)` is at the end of `b`.
  const bEnd = findMatchingClose(s, aStart - 1); // close of lt(
  // After lt's close paren we expect `,` then c.
  const cStart = bEnd + 2; // skip `)` and `,`
  const cEnd = findMatchingComma(s, cStart);
  const dStart = cEnd + 1;
  // Close of the outer `if(...)`.
  const ifClose = findMatchingClose(s, start + "if".length);
  const a = s.slice(aStart, aEnd);
  const b = s.slice(bStart, bEnd);
  const c = s.slice(cStart, cEnd);
  const d = s.slice(dStart, ifClose);
  const replacement = `(${a}<${b}?${c}:${d})`;
  return s.slice(0, start) + replacement + s.slice(ifClose + 1);
}

/** Find the top-level comma starting from `i` (paren-depth tracking). */
function findMatchingComma(s: string, i: number): number {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) return k;
  }
  return -1;
}

/** Given the index of an opening `(`, find its matching `)`. */
function findMatchingClose(s: string, openIdx: number): number {
  let depth = 0;
  for (let k = openIdx; k < s.length; k++) {
    if (s[k] === "(") depth++;
    else if (s[k] === ")") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

function clipWithKfs(keyframes: Keyframe[]): EditorClip {
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
    keyframes,
  };
}

/** Sample times across [0, clipDur] including both edges and around
 *  every keyframe boundary. Hits the edge cases where the if-chain
 *  selects the next branch. */
function sampleTimes(kfs: Keyframe[], clipDur = 10): number[] {
  const set = new Set<number>([0, clipDur]);
  for (const k of kfs) {
    set.add(Math.max(0, k.time - 0.001));
    set.add(k.time);
    set.add(k.time + 0.001);
  }
  // A handful of evenly-spaced sample points.
  for (let i = 1; i < 10; i++) set.add(clipDur * (i / 10));
  return [...set].sort((a, b) => a - b);
}

function assertPreviewBakeAgree(
  property: "opacity" | "scale" | "volume",
  keyframes: Keyframe[],
): void {
  const clip = clipWithKfs(keyframes);
  const bakeKfs: BakeKeyframe[] = keyframes.map((k) => ({
    property: k.property,
    time: k.time,
    value: k.value,
    easing: k.easing,
  }));
  const expr = buildKeyframeExpression(bakeKfs, property === "opacity" ? 1 : 1);
  if (!expr) {
    // No keyframes — preview falls back to static value. The bake
    // skips emitting a chain in that case, so there's nothing to
    // assert against.
    return;
  }
  const times = sampleTimes(keyframes);
  for (const t of times) {
    const preview = getClipPropertyAt(clip, property, t);
    const bake = evalFfmpegExpr(expr, t);
    expect(
      Math.abs(bake - preview),
      `${property} mismatch at t=${t}: preview=${preview}, bake=${bake}, expr=${expr}`,
    ).toBeLessThan(0.001);
  }
}

describe("buildKeyframeExpression — bake mirrors preview", () => {
  it("single keyframe → constant value, agrees at every t", () => {
    assertPreviewBakeAgree("opacity", [
      { id: "k1", property: "opacity", time: 2, value: 0.7 },
    ]);
  });

  it("two linear keyframes — interpolates identically", () => {
    assertPreviewBakeAgree("opacity", [
      { id: "k1", property: "opacity", time: 0, value: 0 },
      { id: "k2", property: "opacity", time: 4, value: 1, easing: "linear" },
    ]);
  });

  it("ease-in matches preview's quadratic accel", () => {
    assertPreviewBakeAgree("opacity", [
      { id: "k1", property: "opacity", time: 0, value: 0 },
      { id: "k2", property: "opacity", time: 4, value: 1, easing: "ease-in" },
    ]);
  });

  it("ease-out matches preview's quadratic decel", () => {
    assertPreviewBakeAgree("scale", [
      { id: "k1", property: "scale", time: 1, value: 1 },
      { id: "k2", property: "scale", time: 5, value: 2, easing: "ease-out" },
    ]);
  });

  it("ease-in-out matches the smoothstep branch on both halves", () => {
    assertPreviewBakeAgree("opacity", [
      { id: "k1", property: "opacity", time: 0, value: 0.2 },
      { id: "k2", property: "opacity", time: 6, value: 0.9, easing: "ease-in-out" },
    ]);
  });

  it("three keyframes — preview and bake agree across all segments", () => {
    assertPreviewBakeAgree("opacity", [
      { id: "k1", property: "opacity", time: 0, value: 0 },
      { id: "k2", property: "opacity", time: 3, value: 1, easing: "ease-in" },
      { id: "k3", property: "opacity", time: 7, value: 0.3, easing: "ease-out" },
    ]);
  });

  it("clamps to first value before first kf and last value after last kf", () => {
    // First kf at t=2; sample at t=0 (before) and t=9 (after last at t=5)
    const clip = clipWithKfs([
      { id: "k1", property: "opacity", time: 2, value: 0.3 },
      { id: "k2", property: "opacity", time: 5, value: 0.8 },
    ]);
    const expr = buildKeyframeExpression(
      [
        { property: "opacity", time: 2, value: 0.3 },
        { property: "opacity", time: 5, value: 0.8 },
      ],
      1,
    );
    expect(expr).not.toBeNull();
    // Before first kf
    expect(evalFfmpegExpr(expr!, 0)).toBeCloseTo(0.3, 4);
    expect(getClipPropertyAt(clip, "opacity", 0)).toBeCloseTo(0.3, 4);
    // After last kf
    expect(evalFfmpegExpr(expr!, 9)).toBeCloseTo(0.8, 4);
    expect(getClipPropertyAt(clip, "opacity", 9)).toBeCloseTo(0.8, 4);
  });

  it("volume keyframes have the same parity contract", () => {
    assertPreviewBakeAgree("volume", [
      { id: "k1", property: "volume", time: 0, value: 0 },
      { id: "k2", property: "volume", time: 2, value: 1, easing: "linear" },
      { id: "k3", property: "volume", time: 8, value: 0.4, easing: "ease-out" },
    ]);
  });
});

describe("compileVideoKeyframeChain", () => {
  it("returns empty string when no keyframes", () => {
    expect(compileVideoKeyframeChain([])).toBe("");
  });

  it("emits a scale filter when scale keyframes are present", () => {
    const out = compileVideoKeyframeChain([
      { property: "scale", time: 0, value: 1 },
      { property: "scale", time: 3, value: 1.5 },
    ]);
    expect(out).toContain("scale=");
    expect(out).toContain("eval=frame");
  });

  it("emits colorchannelmixer for opacity keyframes", () => {
    const out = compileVideoKeyframeChain([
      { property: "opacity", time: 0, value: 0 },
      { property: "opacity", time: 4, value: 1 },
    ]);
    expect(out).toContain("colorchannelmixer=");
    expect(out).toContain("format=yuva420p");
  });

  it("emits a rotate filter for rotation keyframes (deg→rad)", () => {
    const out = compileVideoKeyframeChain([
      { property: "rotation", time: 0, value: 0 },
      { property: "rotation", time: 2, value: 45 },
    ]);
    expect(out).toContain("rotate=");
    expect(out).toContain("PI/180");
  });
});

describe("compileAudioKeyframeChain", () => {
  it("returns empty string when no volume keyframes", () => {
    expect(compileAudioKeyframeChain([])).toBe("");
  });

  it("emits volume=expr with eval=frame", () => {
    const out = compileAudioKeyframeChain([
      { property: "volume", time: 0, value: 0 },
      { property: "volume", time: 3, value: 1 },
    ]);
    expect(out).toMatch(/^volume=/);
    expect(out).toContain("eval=frame");
  });
});
