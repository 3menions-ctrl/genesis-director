/**
 * Color grade types + composer — Deno mirror of src/lib/editor/color-grade.ts.
 *
 * Front-end and edge functions MUST stay in sync. Any change to the
 * model (new field, new global modifier, new LUT category) must land
 * on both sides in the same commit.
 *
 * This file holds ONLY the types + composer math. The FFmpeg compiler
 * lives in ./color-grade-filters.ts and the LUT library in ./lut-library.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────
export interface RgbTriplet {
  r: number;
  g: number;
  b: number;
}

export interface ColorWheel {
  lift: RgbTriplet;
  gamma: RgbTriplet;
  gain: RgbTriplet;
  offset?: RgbTriplet;
}

export const IDENTITY_WHEEL: ColorWheel = {
  lift:   { r: 0, g: 0, b: 0 },
  gamma:  { r: 0, g: 0, b: 0 },
  gain:   { r: 0, g: 0, b: 0 },
  offset: { r: 0, g: 0, b: 0 },
};

export interface ToneCurve {
  points: { x: number; y: number }[];
  interpolation: "linear" | "spline";
}

export const IDENTITY_CURVE: ToneCurve = {
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  interpolation: "spline",
};

export interface RgbCurves {
  master: ToneCurve;
  r: ToneCurve;
  g: ToneCurve;
  b: ToneCurve;
}

export const IDENTITY_CURVES: RgbCurves = {
  master: IDENTITY_CURVE,
  r: IDENTITY_CURVE,
  g: IDENTITY_CURVE,
  b: IDENTITY_CURVE,
};

export interface HslAdjustment {
  h: number;
  s: number;
  l: number;
}

export const IDENTITY_HSL: HslAdjustment = { h: 0, s: 0, l: 0 };

export interface HslByRange {
  reds:     HslAdjustment;
  oranges:  HslAdjustment;
  yellows:  HslAdjustment;
  greens:   HslAdjustment;
  aquas:    HslAdjustment;
  blues:    HslAdjustment;
  purples:  HslAdjustment;
  magentas: HslAdjustment;
}

export const IDENTITY_HSL_BY_RANGE: HslByRange = {
  reds:     IDENTITY_HSL,
  oranges:  IDENTITY_HSL,
  yellows:  IDENTITY_HSL,
  greens:   IDENTITY_HSL,
  aquas:    IDENTITY_HSL,
  blues:    IDENTITY_HSL,
  purples:  IDENTITY_HSL,
  magentas: IDENTITY_HSL,
};

// ─────────────────────────────────────────────────────────────────────────────
// LUT look recipe
// ─────────────────────────────────────────────────────────────────────────────
export type LutCategory =
  | "film-stock"
  | "era"
  | "mood"
  | "director"
  | "utility";

export interface LutLook {
  id: string;
  name: string;
  description: string;
  category: LutCategory;
  swatch: { primary: string; secondary: string; accent: string };
  wheel: ColorWheel;
  curves?: RgbCurves;
  hsl?: HslByRange;
  saturation: number;
  contrast: number;
  vibrance: number;
  temperature: number;
  tint: number;
  grain?: number;
  halation?: number;
  vignette?: number;
  softness?: number;
  notes?: string;
  year?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ColorGrade — what gets stored on a clip
// ─────────────────────────────────────────────────────────────────────────────
export interface ColorGrade {
  lutId: string | null;
  lutMix: number;
  wheel: ColorWheel;
  curves: RgbCurves;
  hsl: HslByRange;
  saturation: number;
  contrast: number;
  vibrance: number;
  temperature: number;
  tint: number;
  sharpness: number;
  highlights: number;
  shadows: number;
}

export const IDENTITY_GRADE: ColorGrade = {
  lutId: null,
  lutMix: 1,
  wheel: IDENTITY_WHEEL,
  curves: IDENTITY_CURVES,
  hsl: IDENTITY_HSL_BY_RANGE,
  saturation: 0,
  contrast: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  highlights: 0,
  shadows: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Composer — LUT contribution + user grade → effective grade
// ─────────────────────────────────────────────────────────────────────────────
export function composeGrade(grade: ColorGrade, lut: LutLook | null): ColorGrade {
  if (!lut) return grade;
  const mix = Math.max(0, Math.min(1, grade.lutMix));

  const blend = (a: RgbTriplet, b: RgbTriplet, m: number): RgbTriplet => ({
    r: a.r + b.r * m,
    g: a.g + b.g * m,
    b: a.b + b.b * m,
  });

  return {
    ...grade,
    wheel: {
      lift:   blend(grade.wheel.lift,   lut.wheel.lift,   mix),
      gamma:  blend(grade.wheel.gamma,  lut.wheel.gamma,  mix),
      gain:   blend(grade.wheel.gain,   lut.wheel.gain,   mix),
      offset: blend(grade.wheel.offset ?? IDENTITY_WHEEL.offset!, lut.wheel.offset ?? IDENTITY_WHEEL.offset!, mix),
    },
    saturation:  grade.saturation  + lut.saturation  * mix,
    contrast:    grade.contrast    + lut.contrast    * mix,
    vibrance:    grade.vibrance    + lut.vibrance    * mix,
    temperature: grade.temperature + lut.temperature * mix,
    tint:        grade.tint        + lut.tint        * mix,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when the grade is identity (no work). */
export function isIdentityGrade(g: ColorGrade | null | undefined): boolean {
  if (!g) return true;
  if (g.lutId) return false;
  if (g.saturation || g.contrast || g.vibrance || g.temperature || g.tint) return false;
  if (g.sharpness || g.highlights || g.shadows) return false;
  const w = g.wheel;
  if (w.lift.r || w.lift.g || w.lift.b)    return false;
  if (w.gamma.r || w.gamma.g || w.gamma.b) return false;
  if (w.gain.r || w.gain.g || w.gain.b)    return false;
  return true;
}
