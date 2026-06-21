/**
 * Filter graph integrity — applied to every render fixture (F01-F12).
 *
 * One test per fixture asserts: label uniqueness, referential integrity
 * (no orphan inputs), every `-map` target exists, balanced brackets +
 * parens, output dimensions match aspect × resolution.
 *
 * This is the universal contract — any fixture that violates it
 * produces an invalid FFmpeg filter graph that would either fail at
 * Replicate or render garbage. Catches the class of bug we fixed in
 * Week 1 (missing `...audioChain` spread → ax{N-2} orphan label).
 */

import { describe, it, expect } from "vitest";
import F01 from "../render-fixtures/F01-title-clip.json";
import F02 from "../render-fixtures/F02-two-clip-fade.json";
import F03 from "../render-fixtures/F03-title-styled.json";
import F04 from "../render-fixtures/F04-keyframed.json";
import F05 from "../render-fixtures/F05-muted-with-aux.json";
import F06 from "../render-fixtures/F06-v2-overlay.json";
import F07 from "../render-fixtures/F07-aux-only.json";
import F08 from "../render-fixtures/F08-speed.json";
import F09 from "../render-fixtures/F09-multi-titles.json";
import F10 from "../render-fixtures/F10-color-grade.json";
import F11 from "../render-fixtures/F11-vfx-chain.json";
import F12 from "../render-fixtures/F12-autoduck.json";
import {
  compile,
  validateFilterGraph,
  type Fixture,
} from "./harness";
import { dimensionsForAspect } from "../../../supabase/functions/_shared/seamless-command.ts";

const fixtures: Array<{ name: string; fx: Fixture }> = [
  { name: "F01", fx: F01 as Fixture },
  { name: "F02", fx: F02 as Fixture },
  { name: "F03", fx: F03 as Fixture },
  { name: "F04", fx: F04 as Fixture },
  { name: "F05", fx: F05 as Fixture },
  { name: "F06", fx: F06 as Fixture },
  { name: "F07", fx: F07 as Fixture },
  { name: "F08", fx: F08 as Fixture },
  { name: "F09", fx: F09 as Fixture },
  { name: "F10", fx: F10 as Fixture },
  { name: "F11", fx: F11 as Fixture },
  { name: "F12", fx: F12 as Fixture },
];

describe("graph integrity — applies to every fixture", () => {
  for (const { name, fx } of fixtures) {
    describe(name, () => {
      const c = compile(fx);
      const report = validateFilterGraph(c);

      it("compiles a filter graph that passes the integrity validator", () => {
        if (!report.ok) {
          // Print the actual issues so a failure is debuggable without
          // a second run.
          // eslint-disable-next-line no-console
          console.error(`[${name}] integrity issues:`, report.issues);
        }
        expect(report.ok).toBe(true);
      });

      it("output dimensions match the requested aspect × resolution", () => {
        const expected = dimensionsForAspect(fx.aspectRatio, fx.resolution);
        expect(c.outputW).toBe(expected.w);
        expect(c.outputH).toBe(expected.h);
      });

      it("declares a final video map label", () => {
        expect(c.finalVideoLabel.length).toBeGreaterThan(0);
      });

      it("declares a final audio map label (except GIF, which has -an)", () => {
        if (fx.format === "gif") return; // GIF strips audio
        expect(c.finalAudioLabel.length).toBeGreaterThan(0);
      });
    });
  }
});
