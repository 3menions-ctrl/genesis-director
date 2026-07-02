/**
 * Quality surcharge wiring — every billed quality core (4K upscale / 60fps
 * interpolation) MUST reach a real bake, and we must never charge for a core
 * we don't deliver.
 *
 * ── Architecture (the real delivery chain) ───────────────────────────────────
 * 4K (Topaz) and 60fps (RIFE) are POST-PROCESSING on the FINAL stitched film,
 * not native per-clip params — the UI copy says as much ("Topaz Astra upscale",
 * "RIFE interpolation"). So honoring is centralized at the finalizer, not the
 * per-clip renderer:
 *
 *   1. The user's quality intent is captured in the Studio create flow and sent
 *      as `qualityOptions` → mode-router → the project ENTRY pipeline.
 *   2. Each entry pipeline (hollywood-pipeline, seedance-pipeline) READS
 *      qualityOptions and PERSISTS it (persistQualityIntent → editor_state).
 *   3. The finalizer (seamless-stitcher) reads the intent, runs the real
 *      Replicate post-processing (applyQualityPost), and charges ON DELIVERY —
 *      billing ONLY the cores actually applied (deliveredSurchargeCredits).
 *
 * This test pins that chain by reading the edge-function sources directly. It
 * is blunt by design (grep over source) but it fails CI the moment any link in
 * the chain is removed — which is exactly the regression we care about.
 *
 * NOTE on `generate-video`: it is an async per-clip SUBMIT worker (returns a
 * taskId; a separate poller sees the final URL) with no project/billing
 * context. It is never a project ENTRY pipeline — mode-router routes every
 * non-seedance engine through hollywood-pipeline. Quality cores are a
 * final-film concern, so generate-video is intentionally NOT a honoring locus.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../..");

function fnSource(fn: string): { path: string; src: string } | null {
  const path = resolve(REPO_ROOT, "supabase/functions", fn, "index.ts");
  if (!existsSync(path)) return null;
  return { path, src: readFileSync(path, "utf-8") };
}

const SHARED_QUALITY_POST = resolve(
  REPO_ROOT,
  "supabase/functions/_shared/quality-post.ts",
);

describe("Quality surcharge delivery chain", () => {
  it("the shared quality module exists and exposes honor + charge-on-delivery", () => {
    expect(existsSync(SHARED_QUALITY_POST)).toBe(true);
    const src = readFileSync(SHARED_QUALITY_POST, "utf-8");
    // Honors the cores (real Replicate post-processing)…
    expect(src).toMatch(/export async function applyQualityPost/);
    // …reports ONLY what was delivered, so the caller bills delivery, not intent.
    expect(src).toMatch(/export function deliveredSurchargeCredits/);
    // …and persists / reads the intent across the submit→finalize hop.
    expect(src).toMatch(/export async function persistQualityIntent/);
    expect(src).toMatch(/export function readQualityIntent/);
  });

  // Project ENTRY pipelines must READ + PERSIST the quality intent.
  // (seedance-pipeline was the legacy dedicated entry — deleted after the
  // orchestrator unification; seedance now enters via hollywood-pipeline.)
  for (const fn of ["hollywood-pipeline"]) {
    it(`${fn} reads qualityOptions and persists the intent`, () => {
      const found = fnSource(fn);
      expect(found, `${fn}/index.ts missing`).not.toBeNull();
      if (!found) return;
      expect(
        found.src.includes("qualityOptions"),
        `${fn} never reads qualityOptions from its request body — the user picks ` +
          `4K/60fps in the UI but the intent is dropped before the finalizer can ` +
          `honor it. Fix: thread qualityOptions through ${found.path}`,
      ).toBe(true);
      expect(
        found.src.includes("persistQualityIntent"),
        `${fn} reads qualityOptions but never persists it for the finalizer. ` +
          `Fix: call persistQualityIntent(...) once projectId is known.`,
      ).toBe(true);
    });
  }

  // mode-router must FORWARD the intent to the entry pipeline.
  it("mode-router forwards qualityOptions to the entry pipeline", () => {
    const found = fnSource("mode-router");
    expect(found).not.toBeNull();
    if (!found) return;
    expect(found.src.includes("qualityOptions")).toBe(true);
  });

  // The FINALIZER must honor + charge on delivery.
  it("seamless-stitcher honors quality on the final film and charges on delivery", () => {
    const found = fnSource("seamless-stitcher");
    expect(found).not.toBeNull();
    if (!found) return;
    expect(
      found.src.includes("applyQualityPost"),
      "seamless-stitcher never runs applyQualityPost — the final film is never " +
        "upscaled/interpolated even though the user was quoted for it.",
    ).toBe(true);
    expect(
      found.src.includes("deliveredSurchargeCredits") && found.src.includes("deduct_credits"),
      "seamless-stitcher must charge ONLY for delivered cores (deliveredSurchargeCredits " +
        "→ deduct_credits). Otherwise we charge for quality we didn't deliver, or deliver " +
        "for free.",
    ).toBe(true);
  });
});

describe("Single-clip billing path mirrors engine surcharge contract", () => {
  it("editor-generate-clip reads qualityOptions for the +5/+5 surcharge", () => {
    const path = resolve(REPO_ROOT, "supabase/functions/editor-generate-clip/index.ts");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    expect(src).toMatch(/QualityOptions/);
    expect(src).toMatch(/qualityOptions/);
  });
});
