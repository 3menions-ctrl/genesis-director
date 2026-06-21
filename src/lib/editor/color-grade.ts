/**
 * Color grading — the typed model + math for cinematic color work.
 *
 * Design:
 *   - We DON'T ship 3D LUTs as binary data (32 MB per LUT). Instead each
 *     LUT is a "look recipe" — a compact parameter set that computes the
 *     same result. Tweakable in real-time, composable with user
 *     adjustments, tiny payload.
 *
 *   - A ColorGrade is a stack of contributions:
 *       1. A LUT (the named look)
 *       2. Per-channel Lift/Gamma/Gain wheels
 *       3. Per-channel curves (RGB + master)
 *       4. HSL adjustments by hue range
 *       5. Saturation / Contrast / Vibrance globals
 *       6. Optional film grain + halation
 *
 *   - The same model serves BOTH:
 *       • Real-time preview in the editor (compiled to CSS filters)
 *       • Final render export (compiled to FFmpeg `eq`+`curves`+
 *         `colorbalance`+`hue` filter graphs)
 *
 *   - When we add WebGPU preview, the same model compiles to a fragment
 *     shader (UV → RGB → graded RGB).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────
export interface RgbTriplet {
  r: number;
  g: number;
  b: number;
}

/** Lift / Gamma / Gain wheels — colorist's bread and butter.
 *  Values: r/g/b offsets in [-1, 1]. 0 = identity. */
export interface ColorWheel {
  /** Shadows (toe). Affects darks more than lights. */
  lift: RgbTriplet;
  /** Midtones (gamma). Center of the tonal range. */
  gamma: RgbTriplet;
  /** Highlights (gain). Affects lights more than darks. */
  gain: RgbTriplet;
  /** Overall offset added at the end. */
  offset?: RgbTriplet;
}

export const IDENTITY_WHEEL: ColorWheel = {
  lift:   { r: 0, g: 0, b: 0 },
  gamma:  { r: 0, g: 0, b: 0 },
  gain:   { r: 0, g: 0, b: 0 },
  offset: { r: 0, g: 0, b: 0 },
};

/** Single curve described by control points in [0,1] x [0,1].
 *  Linear if just [{x:0,y:0},{x:1,y:1}]. */
export interface ToneCurve {
  /** 2..8 control points. Sorted by x. */
  points: { x: number; y: number }[];
  /** Cubic spline or linear interpolation between points. */
  interpolation: "linear" | "spline";
}

export const IDENTITY_CURVE: ToneCurve = {
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  interpolation: "spline",
};

/** Per-channel curves — master + R + G + B. */
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

/** HSL adjustment per color range. */
export interface HslAdjustment {
  /** Hue shift in degrees, -180..180. */
  h: number;
  /** Saturation multiplier, -100..100. */
  s: number;
  /** Lightness offset, -100..100. */
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
// The look recipe — what a "LUT" is in our system
// ─────────────────────────────────────────────────────────────────────────────
export type LutCategory =
  | "film-stock"
  | "era"
  | "mood"
  | "director"
  | "utility";

export const LUT_CATEGORY_LABELS: Record<LutCategory, string> = {
  "film-stock": "Film Stocks",
  "era":        "Eras",
  "mood":       "Moods",
  "director":   "Directors & Films",
  "utility":    "Utility & Technical",
};

export interface LutLook {
  id: string;
  name: string;
  description: string;
  category: LutCategory;

  /** Three-color swatch used to render the LUT thumbnail (no image needed). */
  swatch: { primary: string; secondary: string; accent: string };

  // ── The look (computable parameter set) ────────────────────
  wheel: ColorWheel;
  curves?: RgbCurves;
  hsl?: HslByRange;

  /** Global saturation modifier, -100..100. */
  saturation: number;
  /** Global contrast modifier, -100..100. */
  contrast: number;
  /** Global vibrance modifier, -100..100. Boosts saturation of less-saturated colors only. */
  vibrance: number;
  /** Global temperature modifier, -100..100 (warm/cool). */
  temperature: number;
  /** Global tint modifier, -100..100 (magenta/green). */
  tint: number;

  // ── Optional film traits ───────────────────────────────────
  /** Film grain intensity, 0..100. */
  grain?: number;
  /** Halation / red bleed around highlights, 0..100. */
  halation?: number;
  /** Vignette amount, 0..100. */
  vignette?: number;
  /** Print-through / softness, 0..100. */
  softness?: number;

  // ── Reference notes ────────────────────────────────────────
  /** Short editorial note for the look — "what this evokes". */
  notes?: string;
  /** Year of reference (film stock release, era). */
  year?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// The full per-clip ColorGrade — stored on ClipProperties
// ─────────────────────────────────────────────────────────────────────────────
export interface ColorGrade {
  /** Selected LUT id, or null for "no LUT". */
  lutId: string | null;
  /** LUT mix, 0..1. 1 = full LUT, 0 = no LUT contribution. */
  lutMix: number;

  /** User's additional wheel adjustments on top of the LUT. */
  wheel: ColorWheel;
  /** User's additional curves on top of the LUT. */
  curves: RgbCurves;
  /** User's additional HSL on top of the LUT. */
  hsl: HslByRange;

  /** Global modifiers. */
  saturation: number;
  contrast: number;
  vibrance: number;
  temperature: number;
  tint: number;
  /** Exposure stops, -3..+3. 1 stop = ×2 brightness. Multiplicative
   *  on the RGB linear-space signal, distinct from brightness which
   *  is a constant additive offset. */
  exposure?: number;

  /** Sharpness, -100..100. 0 = identity. */
  sharpness: number;
  /** Highlights recovery, -100..100. */
  highlights: number;
  /** Shadows recovery, -100..100. */
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
  exposure: 0,
  sharpness: 0,
  highlights: 0,
  shadows: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Curve evaluation — used by both preview + export
// ─────────────────────────────────────────────────────────────────────────────

/** Evaluate a tone curve at x ∈ [0,1] and return y ∈ [0,1]. */
export function evalCurve(curve: ToneCurve, x: number): number {
  const pts = curve.points;
  if (pts.length === 0) return x;
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

  // Find the segment containing x.
  let i = 0;
  while (i < pts.length - 1 && pts[i + 1].x < x) i++;
  const a = pts[i];
  const b = pts[i + 1];

  if (curve.interpolation === "linear" || pts.length < 3) {
    const t = (x - a.x) / (b.x - a.x);
    return a.y + t * (b.y - a.y);
  }

  // Catmull-Rom spline through the points
  const aPrev = i > 0 ? pts[i - 1] : a;
  const bNext = i < pts.length - 2 ? pts[i + 2] : b;
  const t = (x - a.x) / (b.x - a.x);
  return catmullRom(aPrev.y, a.y, b.y, bNext.y, t);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose: LUT + user grade → effective grade
//
// Used when serializing to CSS / FFmpeg / WebGPU. The LUT is multiplied by
// lutMix and then summed with the user's overrides.
// ─────────────────────────────────────────────────────────────────────────────
export function composeGrade(grade: ColorGrade, lut: LutLook | null): ColorGrade {
  if (!lut) return grade;
  const mix = Math.max(0, Math.min(1, grade.lutMix));

  // For wheels, sum the contributions weighted by mix.
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
    // Combine the global modifiers.
    saturation:  grade.saturation  + lut.saturation  * mix,
    contrast:    grade.contrast    + lut.contrast    * mix,
    vibrance:    grade.vibrance    + lut.vibrance    * mix,
    temperature: grade.temperature + lut.temperature * mix,
    tint:        grade.tint        + lut.tint        * mix,
  };
}
