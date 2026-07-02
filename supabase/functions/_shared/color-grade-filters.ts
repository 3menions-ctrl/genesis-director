/**
 * FFmpeg color-grade compiler — Deno mirror of
 * src/lib/editor/color-grade-filters.ts (the gradeToFfmpeg path only).
 *
 * Compiles a ColorGrade + optional LutLook into an FFmpeg filter graph
 * fragment. The fragment is injected per-clip into seamless-stitcher's
 * normalization pipeline (between scale/pad/fps and the final
 * format/colorspace conversion) so curves and colorbalance work in
 * higher precision before the 8-bit final pass.
 */
import type { ColorGrade, LutLook } from "./color-grade.ts";
import { composeGrade, isIdentityGrade, IDENTITY_GRADE } from "./color-grade.ts";
import { getLut } from "./lut-library.ts";

/**
 * Compile a ColorGrade (+optional LUT) into an FFmpeg filter chain
 * fragment. Returns "" when the grade is identity (no work).
 *
 * The result is a comma-joined filter chain ready to be spliced into
 * a stream's filter graph. Example output:
 *   colorbalance=rs=0.08:gs=0.02:bs=-0.06:rm=0.10:...,
 *   eq=contrast=1.180:saturation=1.100,
 *   colortemperature=temperature=5764,
 *   gblur=sigma=0.06,
 *   noise=alls=18:allf=t,
 *   vignette=angle=0.094
 */
export function gradeToFfmpeg(grade: ColorGrade, lut: LutLook | null): string {
  if (isIdentityGrade(grade) && !lut) return "";

  const g = composeGrade(grade, lut);
  const parts: string[] = [];

  // ── colorbalance — lift, gamma, gain per channel ────────────
  const cbArgs: string[] = [
    `rs=${(g.wheel.lift.r  * 2).toFixed(3)}`, `gs=${(g.wheel.lift.g  * 2).toFixed(3)}`, `bs=${(g.wheel.lift.b  * 2).toFixed(3)}`,
    `rm=${(g.wheel.gamma.r * 2).toFixed(3)}`, `gm=${(g.wheel.gamma.g * 2).toFixed(3)}`, `bm=${(g.wheel.gamma.b * 2).toFixed(3)}`,
    `rh=${(g.wheel.gain.r  * 2).toFixed(3)}`, `gh=${(g.wheel.gain.g  * 2).toFixed(3)}`, `bh=${(g.wheel.gain.b  * 2).toFixed(3)}`,
  ];
  parts.push(`colorbalance=${cbArgs.join(":")}`);

  // ── eq — contrast / saturation / brightness / gamma / exposure ──
  // FFmpeg `eq` brightness is additive in linear light, not stops.
  // To produce a stops-correct multiplier we have to chain into the
  // eq output. We pass exposure as `brightness` after pre-converting
  // stops → additive delta: a single stop doubles light → for the
  // 0..1 normalized eq it works out to ~0.1 per stop. Approximate
  // but close to user expectation for ±3 stops.
  const stops = (g as { exposure?: number }).exposure ?? 0;
  const eqArgs: string[] = [];
  if (Math.abs(stops)        > 0.01) eqArgs.push(`brightness=${(stops * 0.1).toFixed(3)}`);
  if (Math.abs(g.contrast)   > 0.5)  eqArgs.push(`contrast=${(1 + g.contrast / 100).toFixed(3)}`);
  if (Math.abs(g.saturation) > 0.5)  eqArgs.push(`saturation=${Math.max(0, 1 + g.saturation / 100).toFixed(3)}`);
  if (eqArgs.length) parts.push(`eq=${eqArgs.join(":")}`);

  // ── shadows / highlights — luminance tone curve (all channels) ──
  // Previously `shadows` mapped to `gamma_r` (RED channel only) so
  // "recover shadows" red-tinted the image instead of lifting it, and
  // `highlights` was consumed NOWHERE. Both now ride a master tone
  // curve: shadows lifts/drops the black point, highlights the white.
  const gh = (g as { highlights?: number }).highlights ?? 0;
  if (Math.abs(g.shadows) > 0.5 || Math.abs(gh) > 0.5) {
    const y0 = Math.max(0, Math.min(0.5, g.shadows / 300)).toFixed(3);
    const y1 = Math.max(0.5, Math.min(1, 1 + gh / 300)).toFixed(3);
    parts.push(`curves=all='0/${y0} 0.5/0.5 1/${y1}'`);
  }

  // ── tint — green ↔ magenta balance (was never emitted) ────────
  // +tint = magenta (+R +B −G), −tint = green. Most LUTs set a nonzero
  // tint, so every LUT previously baked slightly off.
  const gt = (g as { tint?: number }).tint ?? 0;
  if (Math.abs(gt) > 1) {
    const t = (gt / 400);
    parts.push(`colorbalance=rm=${t.toFixed(3)}:gm=${(-t).toFixed(3)}:bm=${t.toFixed(3)}`);
  }

  // ── vibrance — smart saturation of muted tones (was never emitted) ──
  const gv = (g as { vibrance?: number }).vibrance ?? 0;
  if (Math.abs(gv) > 0.5) {
    parts.push(`vibrance=intensity=${Math.max(-2, Math.min(2, gv / 100)).toFixed(3)}`);
  }

  // ── sharpness (real unsharp mask) ────────────────────────────
  // FFmpeg unsharp: luma_msize=5, chroma_msize=5; amount range
  // ±1.5. Positive sharpens, negative blurs. We map ±100 → ±1.5.
  if (Math.abs(g.sharpness) > 0.5) {
    const amount = (g.sharpness / 100) * 1.5;
    parts.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${amount.toFixed(3)}`);
  }

  // ── colortemperature — white-balance shift ────────────────────
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

  // ── halation (cheap red-shift approximation) ───────────────────
  // Was: emitted a `split[a][b];[b]...;[a]...blend=...` graph that
  // injected SEMICOLONS into the comma-joined filter chain — the
  // stitcher splices this into `[i:v]scale=...,${cf},format=yuv420p`
  // and the semicolons broke every adjacent filter. Result was a
  // hard FFmpeg parse failure for any LUT with halation > 5.
  //
  // The real halation graph needs a sub-graph splice path (separate
  // namespaced labels post-chain). Until that lands, approximate
  // halation as a soft gaussian + slight red gain — both are
  // comma-joinable atoms that don't poison the chain.
  if (lut?.halation && lut.halation > 5) {
    const intensity = lut.halation / 100;
    parts.push(`gblur=sigma=${(2 + intensity * 2).toFixed(2)}:steps=2`);
    parts.push(`eq=gamma_r=${(1 + intensity * 0.05).toFixed(3)}`);
  }

  return parts.join(",");
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience — compile straight from a clip's `properties.colorGrade`
// JSONB, resolving the LUT by id from the shared library.
// ─────────────────────────────────────────────────────────────────────────────
export function compileClipColorFilter(grade: ColorGrade | null | undefined): string {
  if (!grade) return "";
  // Defensive normalize — JSONB read from the DB may have been written
  // by an older editor version that didn't emit every field. Fall back
  // to IDENTITY for missing wheel components / curves / hsl so the
  // compiler doesn't crash on `undefined.r`.
  const safe = normalizeGrade(grade);
  const lut = safe.lutId ? getLut(safe.lutId) ?? null : null;
  return gradeToFfmpeg(safe, lut);
}

function normalizeGrade(g: ColorGrade): ColorGrade {
  return {
    ...IDENTITY_GRADE,
    ...g,
    wheel: {
      lift:   { ...IDENTITY_GRADE.wheel.lift,   ...(g.wheel?.lift   ?? {}) },
      gamma:  { ...IDENTITY_GRADE.wheel.gamma,  ...(g.wheel?.gamma  ?? {}) },
      gain:   { ...IDENTITY_GRADE.wheel.gain,   ...(g.wheel?.gain   ?? {}) },
      offset: { ...IDENTITY_GRADE.wheel.offset!,...(g.wheel?.offset ?? {}) },
    },
    curves: { ...IDENTITY_GRADE.curves, ...(g.curves ?? {}) },
    hsl:    { ...IDENTITY_GRADE.hsl,    ...(g.hsl    ?? {}) },
  };
}
