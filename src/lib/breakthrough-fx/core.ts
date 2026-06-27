/**
 * Breakthrough FX — engine core: deterministic RNG, easing, keyframe sampling,
 * and the per-frame context every simulator + chrome painter receives.
 *
 * Everything is seed-stable: the same (def, seed, time) always produces the
 * same frame. That is the whole point — diffusion can't give you that.
 */

import type { AnimatableProperty } from "@/lib/editor/types";
import type {
  KeyframeBlueprint,
  TemplateColorGrade,
} from "@/lib/templates/blueprint";
import type { NormRect } from "@/lib/templates/breakthrough";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic RNG — mulberry32. Tiny, fast, fully reproducible from a seed.
// ─────────────────────────────────────────────────────────────────────────────
export interface Rng {
  next(): number; // [0,1)
  range(a: number, b: number): number;
  sign(): number; // -1 or 1
  pick<T>(arr: readonly T[]): T;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Easing + math
// ─────────────────────────────────────────────────────────────────────────────
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => {
  const c = clamp01(t);
  return c * c * c;
};

// ─────────────────────────────────────────────────────────────────────────────
// Keyframe sampling — interpolate a KeyframeBlueprint[] (at ∈ 0..1) for one
// property at phase t01. Matches the compositor's destination-motion tracks.
// ─────────────────────────────────────────────────────────────────────────────
export function sampleTrack(
  kfs: KeyframeBlueprint[] | undefined,
  property: AnimatableProperty,
  t01: number,
  fallback: number,
): number {
  if (!kfs?.length) return fallback;
  const pts = kfs
    .filter((k) => k.property === property)
    .sort((a, b) => a.at - b.at);
  if (!pts.length) return fallback;
  if (t01 <= pts[0].at) return pts[0].value;
  if (t01 >= pts[pts.length - 1].at) return pts[pts.length - 1].value;
  for (let i = 1; i < pts.length; i++) {
    if (t01 <= pts[i].at) {
      const a = pts[i - 1];
      const b = pts[i];
      const seg = (t01 - a.at) / Math.max(1e-6, b.at - a.at);
      return lerp(a.value, b.value, smoothstep(seg));
    }
  }
  return pts[pts.length - 1].value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-frame context handed to every simulator + chrome painter.
// All geometry is NORMALISED (0..1); the engine scales to the canvas. So the
// whole thing is resolution-independent — render at any size.
// ─────────────────────────────────────────────────────────────────────────────
export interface DestinationMotion {
  x: number; // normalised offset
  y: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
}

export interface FrameCtx {
  timeSec: number;
  durationSec: number;
  breakSec: number;
  /** 0 before the break beat → 1 at scene end (drives the sim). */
  breakProgress: number;
  /** 0 until ~1 transition before break → 1 at break (tension build). */
  tension: number;
  /** 0 closed → 1 fully open boundary mask. */
  maskReveal: number;
  /** Resolved destination motion at this time. */
  motion: DestinationMotion;
  palette: TemplateColorGrade;
  mediaWindow: NormRect;
  /** User intensity multiplier (0.3..2). */
  intensity: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
