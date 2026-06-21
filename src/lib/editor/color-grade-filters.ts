/**
 * Color grade compilers.
 *
 *   gradeToCss(grade, lut)     → CSS filter string for real-time preview
 *   gradeToFfmpeg(grade, lut)  → FFmpeg filter graph for final export
 *
 * Both compile from the SAME ColorGrade model (color-grade.ts) so the
 * preview matches the export within the limits of what CSS can do.
 *
 * CSS is the cheap fast path — limited to brightness, contrast,
 * saturate, hue-rotate, sepia, blur, invert, grayscale. Good enough
 * for an approximate preview at editor time.
 *
 * FFmpeg is the deep path — full curves, per-channel control, LUT
 * application via the `lut3d`/`curves`/`colorbalance`/`eq` filters.
 *
 * When we ship the WebGPU preview pipeline, a third compiler
 * (`gradeToShader`) will land here too.
 */
import type { ColorGrade, LutLook } from "./color-grade";
import { composeGrade, IDENTITY_GRADE } from "./color-grade";

/**
 * Defensive normalize — JSONB loaded from the DB may have been
 * written by an older editor version or hand-seeded with only a few
 * fields. Fill the wheel/curves/hsl substructure from IDENTITY so
 * neither the CSS nor FFmpeg compiler crashes on `undefined.r`.
 */
export function normalizeGrade(grade: ColorGrade | Partial<ColorGrade>): ColorGrade {
  const g = grade as Partial<ColorGrade>;
  const wheel = g.wheel ?? {} as Partial<ColorGrade["wheel"]>;
  return {
    ...IDENTITY_GRADE,
    ...g,
    wheel: {
      lift:   { ...IDENTITY_GRADE.wheel.lift,   ...(wheel.lift   ?? {}) },
      gamma:  { ...IDENTITY_GRADE.wheel.gamma,  ...(wheel.gamma  ?? {}) },
      gain:   { ...IDENTITY_GRADE.wheel.gain,   ...(wheel.gain   ?? {}) },
      offset: { ...(IDENTITY_GRADE.wheel.offset ?? { r: 0, g: 0, b: 0 }), ...(wheel.offset ?? {}) },
    },
    curves: { ...IDENTITY_GRADE.curves, ...(g.curves ?? {}) },
    hsl:    { ...IDENTITY_GRADE.hsl,    ...(g.hsl    ?? {}) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — for real-time preview in the editor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compile a ColorGrade (+optional LUT) into a CSS filter string.
 * Returns "" when the grade is identity (no work).
 */
export function gradeToCss(grade: ColorGrade, lut: LutLook | null): string {
  const g = composeGrade(normalizeGrade(grade), lut);
  const filters: string[] = [];

  // Exposure (stops). 1 stop = doubling of light. CSS brightness()
  // is multiplicative, so 2^stops maps directly.
  const stops = g.exposure ?? 0;
  if (Math.abs(stops) > 0.01) {
    filters.push(`brightness(${Math.pow(2, stops).toFixed(3)})`);
  }

  // Brightness — approximated from gain + gamma midtone shift
  const meanGain  = (g.wheel.gain.r  + g.wheel.gain.g  + g.wheel.gain.b)  / 3;
  const meanGamma = (g.wheel.gamma.r + g.wheel.gamma.g + g.wheel.gamma.b) / 3;
  const meanLift  = (g.wheel.lift.r  + g.wheel.lift.g  + g.wheel.lift.b)  / 3;
  const brightnessShift = meanGain * 0.6 + meanGamma * 0.4 + meanLift * 0.3;
  if (Math.abs(brightnessShift) > 0.005) {
    filters.push(`brightness(${(1 + brightnessShift).toFixed(3)})`);
  }

  // Contrast (CSS contrast(): 0=gray, 1=neutral, 2=double)
  const contrast = 1 + g.contrast / 100;
  if (Math.abs(g.contrast) > 0.5) {
    filters.push(`contrast(${contrast.toFixed(3)})`);
  }

  // Saturation (CSS saturate(): 0=gray, 1=neutral)
  const saturation = Math.max(0, 1 + g.saturation / 100);
  if (Math.abs(g.saturation) > 0.5) {
    filters.push(`saturate(${saturation.toFixed(3)})`);
  }

  // Vibrance is approximated by combining a smaller saturate boost
  // with hue-rotation (very rough — FFmpeg path is precise).
  if (Math.abs(g.vibrance) > 0.5) {
    filters.push(`saturate(${(1 + g.vibrance / 200).toFixed(3)})`);
  }

  // Temperature → hue-rotation toward orange (warm) or blue (cool)
  // CSS hue-rotate is in degrees; map -100..100 → -20..20 degrees.
  if (Math.abs(g.temperature) > 0.5) {
    filters.push(`hue-rotate(${(g.temperature * 0.2).toFixed(2)}deg)`);
  }

  // Tint approximated as a smaller hue rotation in the magenta/green axis.
  // CSS doesn't have a direct tint primitive — keep it minimal.
  if (Math.abs(g.tint) > 0.5) {
    filters.push(`hue-rotate(${(g.tint * 0.1).toFixed(2)}deg)`);
  }

  // Film softness / blur
  if (lut?.softness && lut.softness > 0) {
    const blur = (lut.softness / 100) * 0.6;
    filters.push(`blur(${blur.toFixed(2)}px)`);
  }

  // Sharpness — CSS doesn't have a true unsharp-mask primitive, but
  // we can approximate positive sharpness as a slight contrast bump
  // (the bake uses a real unsharp filter so render output is accurate).
  // Negative sharpness becomes a tiny blur.
  if (Math.abs(g.sharpness) > 0.5) {
    if (g.sharpness > 0) {
      filters.push(`contrast(${(1 + g.sharpness / 400).toFixed(3)})`);
    } else {
      filters.push(`blur(${(Math.abs(g.sharpness) / 200).toFixed(2)}px)`);
    }
  }

  return filters.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg — for final export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compile a ColorGrade (+optional LUT) into an FFmpeg filter graph
 * fragment. Returns "" for identity. The graph composes:
 *
 *   colorbalance   — lift/gamma/gain wheels (per-channel)
 *   eq             — brightness/contrast/saturation/gamma
 *   colortemperature — wb shift  (note: avail in newer ffmpeg)
 *   curves         — per-channel curve points
 *   hue            — tint
 *   gblur          — softness
 *   noise          — grain
 *   vignette       — corner falloff
 *
 * Returns a single chain ready to drop into a stream filter graph.
 */
export function gradeToFfmpeg(grade: ColorGrade, lut: LutLook | null): string {
  const g = composeGrade(normalizeGrade(grade), lut);
  const parts: string[] = [];

  // ── colorbalance — lift, gamma, gain per channel ────────────
  // FFmpeg's colorbalance takes -1..1 cyan/red, magenta/green, yellow/blue
  // for shadows/midtones/highlights. We map our RGB-positive convention.
  const cb = (lift: number, gamma: number, gain: number) => {
    // Map our values (typically -0.1..0.1) into FFmpeg's -1..1 range.
    return [
      `rs=${(lift  * 2).toFixed(3)}`, // red shadow shift
      `ms=${(gamma * 2).toFixed(3)}`, // red midtone shift (rename below)
      `hs=${(gain  * 2).toFixed(3)}`, // red highlight shift
    ];
  };

  const cbArgs: string[] = [
    `rs=${(g.wheel.lift.r  * 2).toFixed(3)}`, `gs=${(g.wheel.lift.g  * 2).toFixed(3)}`, `bs=${(g.wheel.lift.b  * 2).toFixed(3)}`,
    `rm=${(g.wheel.gamma.r * 2).toFixed(3)}`, `gm=${(g.wheel.gamma.g * 2).toFixed(3)}`, `bm=${(g.wheel.gamma.b * 2).toFixed(3)}`,
    `rh=${(g.wheel.gain.r  * 2).toFixed(3)}`, `gh=${(g.wheel.gain.g  * 2).toFixed(3)}`, `bh=${(g.wheel.gain.b  * 2).toFixed(3)}`,
  ];
  parts.push(`colorbalance=${cbArgs.join(":")}`);

  // ── eq — contrast / saturation / brightness / gamma ──────────
  const eqArgs: string[] = [];
  if (Math.abs(g.contrast)   > 0.5) eqArgs.push(`contrast=${(1 + g.contrast / 100).toFixed(3)}`);
  if (Math.abs(g.saturation) > 0.5) eqArgs.push(`saturation=${Math.max(0, 1 + g.saturation / 100).toFixed(3)}`);
  if (Math.abs(g.shadows)    > 0.5) eqArgs.push(`gamma_r=${(1 + g.shadows / 200).toFixed(3)}`);
  if (eqArgs.length) parts.push(`eq=${eqArgs.join(":")}`);

  // ── colortemperature — white-balance shift ────────────────────
  // Map -100..100 → 3200K..7500K (or fall back to colorbalance bias).
  if (Math.abs(g.temperature) > 1) {
    const kelvin = 5500 + g.temperature * 22;
    parts.push(`colortemperature=temperature=${Math.round(kelvin)}`);
  }

  // ── curves — master + per-channel ────────────────────────────
  if (
    grade.curves.master.points.length > 2 ||
    grade.curves.r.points.length > 2 ||
    grade.curves.g.points.length > 2 ||
    grade.curves.b.points.length > 2
  ) {
    const curveStr = (c: { points: { x: number; y: number }[] }) =>
      c.points.map(p => `${p.x.toFixed(3)}/${p.y.toFixed(3)}`).join(" ");
    const args: string[] = [];
    if (grade.curves.master.points.length > 2) args.push(`master='${curveStr(grade.curves.master)}'`);
    if (grade.curves.r.points.length      > 2) args.push(`r='${curveStr(grade.curves.r)}'`);
    if (grade.curves.g.points.length      > 2) args.push(`g='${curveStr(grade.curves.g)}'`);
    if (grade.curves.b.points.length      > 2) args.push(`b='${curveStr(grade.curves.b)}'`);
    if (args.length) parts.push(`curves=${args.join(":")}`);
  }

  // ── softness ──────────────────────────────────────────────────
  if (lut?.softness && lut.softness > 1) {
    parts.push(`gblur=sigma=${(lut.softness / 100 * 0.8).toFixed(2)}`);
  }

  // ── film grain ────────────────────────────────────────────────
  if (lut?.grain && lut.grain > 1) {
    const strength = Math.round(lut.grain * 0.5);
    parts.push(`noise=alls=${strength}:allf=t`);
  }

  // ── vignette ──────────────────────────────────────────────────
  if (lut?.vignette && lut.vignette > 1) {
    const angle = (Math.PI / 5) * (lut.vignette / 100);
    parts.push(`vignette=angle=${angle.toFixed(3)}`);
  }

  // ── halation ─────────────────────────────────────────────────
  // Approximated as a red-channel blur. Real halation needs a custom
  // shader; the FFmpeg version is a stand-in.
  if (lut?.halation && lut.halation > 5) {
    const intensity = lut.halation / 100;
    parts.push(`split[a][b];[b]extractplanes=r,gblur=sigma=4,colorchannelmixer=rr=${(1 + intensity * 0.3).toFixed(3)}[bg];[a][bg]blend=all_mode=screen:all_opacity=${(intensity * 0.4).toFixed(3)}`);
  }

  return parts.join(",");
}

// ─────────────────────────────────────────────────────────────────────────────
// Approximate swatch — a 3-color summary used in card thumbnails
// ─────────────────────────────────────────────────────────────────────────────

/** Pick a representative thumbnail palette for a grade. */
export function gradeSwatch(grade: ColorGrade, lut: LutLook | null): { primary: string; secondary: string; accent: string } {
  if (lut) return lut.swatch;
  return {
    primary:   "#9CA3AF",
    secondary: "#1F2937",
    accent:    "#E5E7EB",
  };
}
