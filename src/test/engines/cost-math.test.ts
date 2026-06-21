/**
 * Engine cost math — exhaustive coverage of creditsFor.
 *
 * For every engine in the registry, asserts:
 *   • Every documented duration returns a positive base cost (or the
 *     intentional 0 for the free tier).
 *   • Each Quality surcharge add-on (upscale4k, fps60) increments the
 *     total by exactly the spec's declared surcharge.
 *   • Both surcharges stack to the sum.
 *   • An undocumented duration throws (catches off-by-one in the
 *     table edits).
 *   • Cost is monotonic in duration — longer can never be cheaper.
 *
 * This is the test that catches the "5 credits declared, never billed"
 * class of bug surfaced in TEST_PLAN.md as a Week 6 goal: a surcharge
 * field can't be silently ignored when every combo of opts is asserted.
 */

import { describe, it, expect } from "vitest";
import { ENGINES, creditsFor, type EngineId, type EngineSpec } from "@/lib/video/engines";

const engineIds = Object.keys(ENGINES) as EngineId[];

describe("creditsFor — base cost per documented duration", () => {
  for (const id of engineIds) {
    const spec = ENGINES[id];
    it(`${id}: every documented duration returns a non-negative integer`, () => {
      for (const d of spec.durations) {
        const cost = creditsFor(spec, d);
        expect(cost).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(cost)).toBe(true);
      }
    });
  }
});

describe("creditsFor — Quality surcharges add exactly the declared amount", () => {
  for (const id of engineIds) {
    const spec = ENGINES[id];
    const dRef = spec.durations[0];
    const base = creditsFor(spec, dRef);

    it(`${id}: +upscale4k adds exactly upscale4kCredits`, () => {
      expect(creditsFor(spec, dRef, { upscale4k: true })).toBe(base + spec.upscale4kCredits);
    });

    it(`${id}: +fps60 adds exactly fps60Credits`, () => {
      expect(creditsFor(spec, dRef, { fps60: true })).toBe(base + spec.fps60Credits);
    });

    it(`${id}: +upscale4k +fps60 adds both`, () => {
      expect(creditsFor(spec, dRef, { upscale4k: true, fps60: true })).toBe(
        base + spec.upscale4kCredits + spec.fps60Credits,
      );
    });

    it(`${id}: autoRetake is metadata only — no cost impact`, () => {
      // autoRetake belongs to the failure-recovery side, not billing.
      // If a future refactor makes it billable, this test forces an
      // explicit decision rather than a silent regression.
      expect(creditsFor(spec, dRef, { autoRetake: true })).toBe(base);
    });
  }
});

describe("creditsFor — duration validation", () => {
  for (const id of engineIds) {
    const spec = ENGINES[id];
    it(`${id}: throws on an undocumented duration`, () => {
      // Pick a duration well outside the spec's table.
      const bad = spec.maxDuration + 99;
      expect(() => creditsFor(spec, bad)).toThrowError(/Unsupported duration/);
    });

    it(`${id}: throws on zero / negative duration`, () => {
      expect(() => creditsFor(spec, 0)).toThrowError(/Unsupported duration/);
      expect(() => creditsFor(spec, -1)).toThrowError(/Unsupported duration/);
    });
  }
});

describe("creditsFor — monotonicity over documented durations", () => {
  for (const id of engineIds) {
    const spec = ENGINES[id];
    it(`${id}: longer duration is never cheaper than shorter`, () => {
      const sorted = [...spec.durations].sort((a, b) => a - b);
      let prev = -Infinity;
      for (const d of sorted) {
        const cost = creditsFor(spec, d);
        expect(cost).toBeGreaterThanOrEqual(prev);
        prev = cost;
      }
    });
  }
});

describe("creditsFor — registry shape sanity", () => {
  for (const id of engineIds) {
    const spec: EngineSpec = ENGINES[id];
    it(`${id}: id field matches its registry key`, () => {
      expect(spec.id).toBe(id);
    });
    it(`${id}: durations is non-empty and contains maxDuration`, () => {
      expect(spec.durations.length).toBeGreaterThan(0);
      expect(spec.durations).toContain(spec.maxDuration);
    });
    it(`${id}: defaultDuration is one of the documented durations`, () => {
      expect(spec.durations).toContain(spec.defaultDuration);
    });
    it(`${id}: every qualityProfile.options.upscale4k=true reaches a +upscale4kCredits engine`, () => {
      const profilesWith4k = spec.qualityProfiles.filter((p) => p.options.upscale4k);
      if (profilesWith4k.length > 0) {
        // If a profile USES the upscale option, the engine must
        // actually charge for it — otherwise the user picks the 4K
        // preset and gets a free upgrade.
        expect(spec.upscale4kCredits).toBeGreaterThan(0);
      }
    });
    it(`${id}: every qualityProfile.options.fps60=true reaches a +fps60Credits engine`, () => {
      const profilesWith60 = spec.qualityProfiles.filter((p) => p.options.fps60);
      if (profilesWith60.length > 0) {
        expect(spec.fps60Credits).toBeGreaterThan(0);
      }
    });
  }
});
