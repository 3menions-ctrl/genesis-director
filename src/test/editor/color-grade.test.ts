/**
 * Color grade compile — CSS preview path (gradeToCss) and FFmpeg
 * bake path (gradeToFfmpeg).
 *
 * Both live in src/lib/editor/color-grade-filters.ts so the editor
 * preview and the export bake call the SAME source of truth.
 *
 * Strategy: start from IDENTITY_GRADE, turn one knob at a time, and
 * assert the corresponding filter substring appears in the output.
 * This catches the kind of regression where a refactor renames a
 * grade field but forgets to update one of the two compile paths
 * (the preview keeps working but the bake silently drops the look).
 */

import { describe, it, expect } from "vitest";
import { gradeToCss, gradeToFfmpeg } from "@/lib/editor/color-grade-filters";
import { IDENTITY_GRADE, type ColorGrade } from "@/lib/editor/color-grade";

function withKnob<K extends keyof ColorGrade>(key: K, value: ColorGrade[K]): ColorGrade {
  return { ...IDENTITY_GRADE, [key]: value };
}

describe("gradeToCss — preview compile", () => {
  it("identity grade with no LUT returns empty string", () => {
    expect(gradeToCss(IDENTITY_GRADE, null)).toBe("");
  });

  it("contrast turns into a CSS contrast() filter", () => {
    const out = gradeToCss(withKnob("contrast", 25), null);
    expect(out).toContain("contrast(");
    expect(out).toMatch(/contrast\(1\.25/);
  });

  it("saturation turns into a CSS saturate() filter", () => {
    const out = gradeToCss(withKnob("saturation", 50), null);
    expect(out).toContain("saturate(");
    expect(out).toMatch(/saturate\(1\.5/);
  });

  it("saturation cannot go below zero (CSS clamp)", () => {
    const out = gradeToCss(withKnob("saturation", -200), null);
    // CSS saturate(0) = pure grayscale; never emits a negative value.
    expect(out).not.toMatch(/saturate\(-/);
  });

  it("temperature shifts hue toward warm/cool", () => {
    const out = gradeToCss(withKnob("temperature", 50), null);
    expect(out).toContain("hue-rotate(");
  });

  it("exposure stops translate to a brightness() power-of-2", () => {
    const out = gradeToCss(withKnob("exposure", 1), null);
    // 1 stop = 2× brightness.
    expect(out).toMatch(/brightness\(2/);
  });

  it("ignores knobs below the deadband to avoid jitter on sliders", () => {
    // The CSS path uses |val| > 0.5 as the threshold for contrast/saturation.
    expect(gradeToCss(withKnob("contrast", 0.1), null)).toBe("");
    expect(gradeToCss(withKnob("saturation", 0.1), null)).toBe("");
  });

  it("combines multiple knobs in a single space-separated chain", () => {
    const grade: ColorGrade = {
      ...IDENTITY_GRADE,
      contrast: 10,
      saturation: 20,
      temperature: 30,
    };
    const out = gradeToCss(grade, null);
    expect(out).toContain("contrast(");
    expect(out).toContain("saturate(");
    expect(out).toContain("hue-rotate(");
    // Each filter separated by a space — the order matters for CSS.
    expect(out.split(" ").length).toBeGreaterThanOrEqual(3);
  });
});

describe("gradeToFfmpeg — bake compile", () => {
  it("identity grade with no LUT emits only the colorbalance neutral stage", () => {
    // colorbalance is always present (the wheel knobs default to 0 →
    // all-zero args). This is a deliberate cost: less branching, and
    // the cost on identity is a no-op filter.
    const out = gradeToFfmpeg(IDENTITY_GRADE, null);
    expect(out).toContain("colorbalance=");
    // No other stages should appear at identity.
    expect(out).not.toContain("eq=");
    expect(out).not.toContain("colortemperature");
    expect(out).not.toContain("curves=");
  });

  it("contrast generates eq=contrast=...", () => {
    const out = gradeToFfmpeg(withKnob("contrast", 25), null);
    expect(out).toContain("eq=");
    expect(out).toMatch(/contrast=1\.250/);
  });

  it("saturation generates eq=saturation=... and clamps at zero", () => {
    const pos = gradeToFfmpeg(withKnob("saturation", 50), null);
    expect(pos).toMatch(/saturation=1\.500/);
    const neg = gradeToFfmpeg(withKnob("saturation", -200), null);
    expect(neg).toMatch(/saturation=0\.000/); // clamped
  });

  it("temperature compiles to a colortemperature filter in Kelvin", () => {
    const out = gradeToFfmpeg(withKnob("temperature", 50), null);
    expect(out).toContain("colortemperature=temperature=");
    // 5500 + 50 * 22 = 6600
    expect(out).toContain("temperature=6600");
  });

  it("ignores knobs below the deadband", () => {
    const out = gradeToFfmpeg(withKnob("contrast", 0.1), null);
    expect(out).not.toContain("eq=");
  });

  it("emits no curves stage when curve has <=2 points (default)", () => {
    const out = gradeToFfmpeg(IDENTITY_GRADE, null);
    expect(out).not.toContain("curves=");
  });
});
