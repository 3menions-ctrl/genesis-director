/**
 * Cross-engine duration clamp — regression guard for the studio crash:
 *
 *   "Unsupported duration 10s (allowed: 4, 6, 8s)" → error boundary
 *
 * Repro: select a 10s-capable engine (Kling/Seedance/Runway/Wan), pick 10s,
 * then switch to Veo (4/6/8s). The studio kept the stale `duration` (10) for
 * the render on which the engine changed, then computed `veo.baseCreditsFor(10)`
 * during render (cost is computed in render; the clamp lived in a post-render
 * useEffect). `tableCost` threw mid-render and React unmounted the module.
 *
 * The fix derives `safeDuration = clampDurationForEngine(engineId, duration)`
 * in render and feeds cost/runtime/submission from it. This test locks the
 * invariant the fix depends on: clamping ANY duration supported by ANY engine
 * to ANY target engine yields a value that engine can actually price — so the
 * render-time cost call can never throw on an engine switch.
 */

import { describe, it, expect } from "vitest";
import { ENGINES, listEngines, clampDurationForEngine } from "@/lib/video/engines";

const ALL_ENGINES = listEngines();

describe("clampDurationForEngine — cross-engine switch never throws", () => {
  it("clamps to a duration the target engine supports, for every engine pair", () => {
    for (const target of ALL_ENGINES) {
      for (const source of ALL_ENGINES) {
        for (const sourceDuration of source.durations) {
          const clamped = clampDurationForEngine(target.id, sourceDuration);
          expect(
            target.durations.includes(clamped),
            `${source.id}'s ${sourceDuration}s clamped to ${target.id} → ${clamped}s (not in ${target.durations.join("/")})`,
          ).toBe(true);
        }
      }
    }
  });

  it("baseCreditsFor never throws after a clamp, across every engine pair", () => {
    for (const target of ALL_ENGINES) {
      for (const source of ALL_ENGINES) {
        for (const sourceDuration of source.durations) {
          const clamped = clampDurationForEngine(target.id, sourceDuration);
          expect(() => target.baseCreditsFor(clamped)).not.toThrow();
        }
      }
    }
  });

  it("the exact field repro — 10s carried onto Veo — clamps to 8s and prices cleanly", () => {
    const veo = ENGINES["veo-3"];
    expect(veo.durations).not.toContain(10); // precondition: 10s is invalid for Veo
    const clamped = clampDurationForEngine("veo-3", 10);
    expect(clamped).toBe(8); // closest supported value
    expect(() => veo.baseCreditsFor(clamped)).not.toThrow();
    // and the unclamped raw value is exactly what used to crash:
    expect(() => veo.baseCreditsFor(10)).toThrow(/Unsupported duration/);
  });
});
