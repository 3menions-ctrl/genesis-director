/**
 * Quality surcharge wiring — every engine with a non-zero
 * upscale4kCredits or fps60Credits MUST route its surcharge through
 * to the actual rendering edge function. The most common way that
 * silently breaks: the spec declares "+5 credits for 60fps", the UI
 * lets the user toggle it on, the cost preview shows the surcharge
 * — but the edge function that runs the render never reads
 * qualityOptions from its request body and bills only the base.
 *
 * This test reads each engine's `pipelineFunction` source file
 * directly. If the file doesn't contain "qualityOptions" anywhere,
 * the surcharge is dead code on the bake side and the test fails.
 *
 * Grep-style assertions over edge-function source are blunt by
 * design — they don't prove the field is HONORED, only that it's
 * READ. Honoring it is the implementation's job; this test catches
 * the case where it isn't read at all.
 *
 * ─── CURRENT KNOWN-RED STATE ─────────────────────────────────────
 * As of this file's introduction (Week 6 of TEST_PLAN.md), the
 * surcharge is wired ONLY in editor-generate-clip. Every project-
 * mode pipeline (wan-pipeline, hollywood-pipeline, seedance-pipeline,
 * generate-video for veo/runway/sora) drops the qualityOptions
 * field on the floor — the user pays the surcharge in the UI
 * preview and the bake runs at base.
 *
 * The test stays red intentionally until that wiring lands. A
 * follow-up issue tracks the fix; this test is the contract that
 * fails CI the moment a regression re-introduces the gap.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ENGINES, type EngineId, type EngineSpec } from "@/lib/video/engines";

const REPO_ROOT = resolve(__dirname, "../../..");

function pipelineSource(spec: EngineSpec): { path: string; src: string } | null {
  const path = resolve(REPO_ROOT, "supabase/functions", spec.pipelineFunction, "index.ts");
  if (!existsSync(path)) return null;
  return { path, src: readFileSync(path, "utf-8") };
}

describe("Quality surcharge wiring — every billed surcharge reaches its edge function", () => {
  it("every engine's pipelineFunction file exists on disk", () => {
    const missing: string[] = [];
    for (const id of Object.keys(ENGINES) as EngineId[]) {
      const spec = ENGINES[id];
      const found = pipelineSource(spec);
      if (!found) missing.push(`${id} → ${spec.pipelineFunction}`);
    }
    expect(
      missing,
      `Engine routes to a missing edge function (404 risk): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  for (const id of Object.keys(ENGINES) as EngineId[]) {
    const spec = ENGINES[id];
    const billable =
      spec.upscale4kCredits > 0 ||
      spec.fps60Credits > 0;
    if (!billable) continue;

    it(`${id} → ${spec.pipelineFunction} reads qualityOptions from request body`, () => {
      const found = pipelineSource(spec);
      // If the file is missing, the earlier test will have failed; bail
      // gracefully here to avoid masking that with a confusing error.
      if (!found) return;
      const reads = found.src.includes("qualityOptions");
      expect(
        reads,
        `${spec.pipelineFunction} declares ${spec.upscale4kCredits}c upscale4k + ` +
        `${spec.fps60Credits}c fps60 in the engine spec but never reads qualityOptions ` +
        `from the request body — the user pays the surcharge in the UI preview and the ` +
        `render runs at the base spec. Fix: thread qualityOptions through the request ` +
        `parser in ${found.path}`,
      ).toBe(true);
    });
  }
});

describe("Single-clip billing path mirrors engine surcharge contract", () => {
  it("editor-generate-clip reads qualityOptions for the +5/+5 surcharge", () => {
    const path = resolve(REPO_ROOT, "supabase/functions/editor-generate-clip/index.ts");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    // Must define the QualityOptions type AND extract it from the body.
    expect(src).toMatch(/QualityOptions/);
    expect(src).toMatch(/qualityOptions/);
  });
});
