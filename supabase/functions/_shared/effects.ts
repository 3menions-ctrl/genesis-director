/**
 * Effects model — Deno mirror of src/lib/editor/effects.ts.
 *
 * Only the types + the time-window helpers are mirrored here. The
 * default-blend-mode logic doesn't apply server-side because every
 * `EffectInstance` arriving here was authored client-side and
 * already has its blendMode resolved.
 *
 * The runtime renderers (SVG/HTML) DO NOT mirror — server-side bakes
 * compile to FFmpeg filter graphs instead. See ./effects-bake.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Recipe taxonomy — re-uses the Crossover canonical list
// ─────────────────────────────────────────────────────────────────────────────
export type RecipeSlug =
  | "glass_shatter" | "paint_pour" | "neon_zap" | "smoke_burst"
  | "pixel_dissolve" | "ink_bloom" | "particle_burst" | "energy_crackle"
  | "ribbon_unfurl" | "fabric_tear" | "static_fizz" | "light_beam"
  | "frame_break" | "lens_distort" | "color_pop" | "ghost_pulse"
  | "magnet_pull" | "data_stream" | "fire_lick" | "water_splash"
  | "none";

export type EffectMode = "stinger" | "transition" | "sustained";

export type BlendMode =
  | "normal" | "screen" | "multiply" | "overlay"
  | "color-dodge" | "color-burn" | "lighten" | "darken"
  | "soft-light" | "hard-light";

export interface EffectInstance {
  id: string;
  recipe: RecipeSlug;
  mode: EffectMode;
  startSec: number;
  durationSec: number;
  intensity: number;     // 0..100
  scale: number;         // 0.25..2.5
  rotation: number;      // degrees
  positionX: number;     // 0..1
  positionY: number;     // 0..1
  primaryColor: string;  // hex
  accentColor: string;
  blendMode: BlendMode;
  opacity: number;       // 0..1
  seed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg blend mode name mapping. FFmpeg's `blend` filter uses different
// names than CSS for some modes.
// ─────────────────────────────────────────────────────────────────────────────
export const FFMPEG_BLEND_MODES: Record<BlendMode, string> = {
  normal:       "normal",
  screen:       "screen",
  multiply:     "multiply",
  overlay:      "overlay",
  "color-dodge":"dodge",
  "color-burn": "burn",
  lighten:      "lighten",
  darken:       "darken",
  "soft-light": "softlight",
  "hard-light": "hardlight",
};

/**
 * Convert a hex color to FFmpeg's `0xRRGGBB` literal. Falls back to
 * white when the input is unusable.
 */
export function hexToFfmpegColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "0xFFFFFF";
  return `0x${m[1].toUpperCase()}`;
}

/** FFmpeg `between()` expression for the effect's active window. */
export function effectEnableExpr(fx: EffectInstance, clipStartSec = 0): string {
  // The effect's startSec is clip-relative; add clipStartSec when the
  // upstream stream uses timeline-absolute timestamps.
  const a = (fx.startSec + clipStartSec).toFixed(3);
  const b = (fx.startSec + fx.durationSec + clipStartSec).toFixed(3);
  return `between(t,${a},${b})`;
}

/** Normalized progress 0..1 inside the effect window (for keyframed expressions). */
export function effectProgressExpr(fx: EffectInstance, clipStartSec = 0): string {
  const a = (fx.startSec + clipStartSec).toFixed(3);
  const dur = Math.max(0.001, fx.durationSec).toFixed(3);
  return `clip((t-${a})/${dur},0,1)`;
}
