/**
 * In-editor effects model.
 *
 * Bridges the Crossover recipe taxonomy into the post-production
 * timeline as runtime overlays. Each `EffectInstance` is a parametric
 * placement of a recipe on a clip — point in time, duration, mode,
 * intensity, color, position.
 *
 * Three application modes:
 *
 *   • "stinger"    — short burst (0.3–1.5s) at a chosen point on a clip.
 *                    Example: glass_shatter at climax. Most recipes
 *                    work as stingers.
 *
 *   • "transition" — replaces the cut between two clips. Stored on
 *                    the boundary; rendered as a 0.3–1.5s morph that
 *                    overlaps both clips. Example: paint_pour from A→B.
 *
 *   • "sustained"  — runs across the whole clip as an alpha-blended
 *                    overlay. Example: light_beam, data_stream,
 *                    ghost_pulse. Atmosphere effects.
 *
 * Live preview is rendered as a React overlay component (one per
 * recipe) on top of the PlayerCanvas's video element. Final render
 * baking (FFmpeg overlay/blend) is a separate concern — left for the
 * follow-up "export bake" pass.
 */
import type { RecipeSlug } from "@/lib/crossovers/blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// Recipe taxonomy — re-exported from the Crossover blueprint so this
// module is the single source for editor consumers (UI / preview /
// export). Mirrors the canonical list in lib/crossovers/blueprint.ts.
// ─────────────────────────────────────────────────────────────────────────────
export type { RecipeSlug };

export type EffectMode = "stinger" | "transition" | "sustained";

export const EFFECT_MODE_LABELS: Record<EffectMode, string> = {
  stinger:    "Stinger · burst",
  transition: "Transition · between clips",
  sustained:  "Sustained · across clip",
};

// ─────────────────────────────────────────────────────────────────────────────
// Blend modes — match CSS mix-blend-mode for live preview. Server
// render compiles to the matching FFmpeg blend filter mode.
// ─────────────────────────────────────────────────────────────────────────────
export type BlendMode =
  | "normal" | "screen" | "multiply" | "overlay"
  | "color-dodge" | "color-burn" | "lighten" | "darken"
  | "soft-light" | "hard-light";

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  normal:       "Normal",
  screen:       "Screen",
  multiply:     "Multiply",
  overlay:      "Overlay",
  "color-dodge":"Color dodge",
  "color-burn": "Color burn",
  lighten:      "Lighten",
  darken:       "Darken",
  "soft-light": "Soft light",
  "hard-light": "Hard light",
};

// ─────────────────────────────────────────────────────────────────────────────
// EffectInstance — one parametric placement on a clip
// ─────────────────────────────────────────────────────────────────────────────
export interface EffectInstance {
  /** Stable id (uuid-ish). */
  id: string;
  /** Which Crossover recipe drives this effect. */
  recipe: RecipeSlug;
  /** How the effect is applied. */
  mode: EffectMode;

  // ── Timing ─────────────────────────────────────────────
  /** Seconds relative to the clip's start. For transitions, half the
   *  effect overlaps each side of the boundary (uses the from-clip's
   *  duration as the timeline reference). */
  startSec: number;
  /** How long the effect runs. */
  durationSec: number;

  // ── Strength ───────────────────────────────────────────
  /** 0..100 — master strength. Affects opacity, particle count,
   *  bloom intensity, etc. depending on the recipe. */
  intensity: number;
  /** 0.25..2.5 — size of the effect relative to the clip. */
  scale: number;
  /** Degrees of rotation applied to the overlay. */
  rotation: number;

  // ── Placement ──────────────────────────────────────────
  /** 0..1 normalized — where in the frame the effect originates. */
  positionX: number;
  positionY: number;

  // ── Color ──────────────────────────────────────────────
  /** Primary color (hex). Most recipes have a sensible default from
   *  their Crossover counterpart. */
  primaryColor: string;
  /** Accent / second color. */
  accentColor: string;
  /** How the overlay composites onto the clip. */
  blendMode: BlendMode;
  /** 0..1 — opacity after blend. */
  opacity: number;

  // ── Reproducibility ────────────────────────────────────
  /** Seed for any randomized animation so re-renders are bit-for-bit. */
  seed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults & helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPACITY = 0.85;

export function newEffectInstance(
  recipe: RecipeSlug,
  mode: EffectMode,
  patch: Partial<EffectInstance> = {},
): EffectInstance {
  return {
    id: `fx-${Math.floor(Math.random() * 1e9).toString(36)}-${Date.now().toString(36)}`,
    recipe,
    mode,
    startSec: 0,
    durationSec: defaultDurationFor(mode),
    intensity: 75,
    scale: 1,
    rotation: 0,
    positionX: 0.5,
    positionY: 0.5,
    primaryColor: "#FFFFFF",
    accentColor:  "#000000",
    blendMode: defaultBlendFor(recipe),
    opacity: DEFAULT_OPACITY,
    seed: Math.floor(Math.random() * 1e9),
    ...patch,
  };
}

function defaultDurationFor(mode: EffectMode): number {
  if (mode === "stinger")    return 0.7;
  if (mode === "transition") return 0.6;
  return 4; // sustained
}

/**
 * Sensible blend mode per recipe — these are aesthetic choices that
 * match each effect's intended look (glass shatter screens, ink bloom
 * multiplies, neon zap color-dodges, etc.).
 */
function defaultBlendFor(recipe: RecipeSlug): BlendMode {
  switch (recipe) {
    // Light-bearing recipes — additive blends look right
    case "neon_zap":
    case "light_beam":
    case "particle_burst":
    case "energy_crackle":
    case "ghost_pulse":
    case "data_stream":
      return "screen";

    // Dark / pigment recipes — multiplicative blends
    case "ink_bloom":
    case "smoke_burst":
    case "fire_lick":
      return "multiply";

    // Optical / mid-key recipes — overlay
    case "lens_distort":
    case "color_pop":
    case "magnet_pull":
    case "static_fizz":
      return "overlay";

    // Hard geometry — normal blend (the recipe controls its own alpha)
    case "glass_shatter":
    case "frame_break":
    case "pixel_dissolve":
    case "fabric_tear":
    case "ribbon_unfurl":
    case "paint_pour":
    case "water_splash":
    case "none":
    default:
      return "normal";
  }
}

/**
 * Time-window check — is this effect active at the given clip-relative time?
 */
export function isEffectActiveAt(fx: EffectInstance, clipRelativeSec: number): boolean {
  return clipRelativeSec >= fx.startSec && clipRelativeSec < fx.startSec + fx.durationSec;
}

/**
 * Normalized progress 0..1 within the effect's window. Returns -1 when
 * the effect isn't active.
 */
export function effectProgress(fx: EffectInstance, clipRelativeSec: number): number {
  if (!isEffectActiveAt(fx, clipRelativeSec)) return -1;
  return Math.max(0, Math.min(1, (clipRelativeSec - fx.startSec) / Math.max(0.0001, fx.durationSec)));
}
