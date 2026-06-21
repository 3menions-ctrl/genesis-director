/**
 * CrossoverBlueprint — the unified rich crossover schema.
 *
 * Wraps every column in `vfx_templates` (core + the 20260616 VFX upgrade)
 * and adds derived fields:
 *   • world (sharper 7-way taxonomy from chrome_kind)
 *   • engine + qualityTier (mapped from preferred_model)
 *   • estimatedCreditCost + estimatedEtaSec (derived from engine + particle_density)
 *   • useCount, tags
 *   • mood (default per category)
 *
 * Consumers:
 *   - Crossover page card grid + editorial rails
 *   - CrossoverDetailDrawer
 *   - TemplateComposer (existing modal — receives blueprint or legacy CrossoverTemplate)
 */

import type { ChromeKind } from "@/components/crossover/ChromePreview";
import type { EngineId } from "@/lib/video/engines";
import type { AspectRatio } from "@/lib/editor/types";

// ─────────────────────────────────────────────────────────────────────────────
// DB-backed category (preserves vfx_templates.category enum)
// ─────────────────────────────────────────────────────────────────────────────
export type CrossoverCategory =
  | "vertical_ui" | "desktop_ui" | "social_feed" | "retro_holo" | "surreal";

export const CROSSOVER_CATEGORY_LABELS: Record<CrossoverCategory, string> = {
  vertical_ui: "Vertical UI Breaks",
  desktop_ui:  "Desktop & TV Breaks",
  social_feed: "Social Feed Breaks",
  retro_holo:  "Retro & Holo Breaks",
  surreal:     "Surreal Crossings",
};

export const CROSSOVER_CATEGORY_SHORT: Record<CrossoverCategory, string> = {
  vertical_ui: "Vertical UI",
  desktop_ui:  "Desktop / TV",
  social_feed: "Social Feed",
  retro_holo:  "Retro / Holo",
  surreal:     "Surreal",
};

// ─────────────────────────────────────────────────────────────────────────────
// Recipe taxonomy — the VFX recipe slugs that ship in the DB
// ─────────────────────────────────────────────────────────────────────────────
export type RecipeSlug =
  | "glass_shatter" | "paint_pour" | "neon_zap" | "smoke_burst"
  | "pixel_dissolve" | "ink_bloom" | "particle_burst" | "energy_crackle"
  | "ribbon_unfurl" | "fabric_tear" | "static_fizz" | "light_beam"
  | "frame_break" | "lens_distort" | "color_pop" | "ghost_pulse"
  | "magnet_pull" | "data_stream" | "fire_lick" | "water_splash"
  | "none";

export const RECIPE_LABELS: Record<RecipeSlug, string> = {
  glass_shatter:   "Glass shatter",
  paint_pour:      "Paint pour",
  neon_zap:        "Neon zap",
  smoke_burst:     "Smoke burst",
  pixel_dissolve:  "Pixel dissolve",
  ink_bloom:       "Ink bloom",
  particle_burst:  "Particle burst",
  energy_crackle:  "Energy crackle",
  ribbon_unfurl:   "Ribbon unfurl",
  fabric_tear:     "Fabric tear",
  static_fizz:     "Static fizz",
  light_beam:      "Light beam",
  frame_break:     "Frame break",
  lens_distort:    "Lens distort",
  color_pop:       "Color pop",
  ghost_pulse:     "Ghost pulse",
  magnet_pull:     "Magnet pull",
  data_stream:     "Data stream",
  fire_lick:       "Fire lick",
  water_splash:    "Water splash",
  none:            "No recipe",
};

// ─────────────────────────────────────────────────────────────────────────────
// Motion hint — choreography of the break itself
// ─────────────────────────────────────────────────────────────────────────────
export type MotionHint =
  | "leap_forward_anticipation" | "step_through_threshold" | "tear_through_plane"
  | "shatter_burst_outward" | "rise_through_field" | "spiral_emerge"
  | "slide_out_horizontal" | "fall_through_below" | "morph_solidify"
  | "drift_outward" | "burst_overhead" | "static";

export const MOTION_LABELS: Record<MotionHint, string> = {
  leap_forward_anticipation: "Leap forward · anticipation",
  step_through_threshold:    "Step through threshold",
  tear_through_plane:        "Tear through plane",
  shatter_burst_outward:     "Shatter burst outward",
  rise_through_field:        "Rise through field",
  spiral_emerge:             "Spiral emerge",
  slide_out_horizontal:      "Slide out horizontal",
  fall_through_below:        "Fall through below",
  morph_solidify:            "Morph solidify",
  drift_outward:             "Drift outward",
  burst_overhead:            "Burst overhead",
  static:                    "Static · subtle",
};

// ─────────────────────────────────────────────────────────────────────────────
// Subject ID method (how the user's subject photo gets injected)
// ─────────────────────────────────────────────────────────────────────────────
export type SubjectIdMethod = "pulid" | "instantid" | "ip-adapter" | "none";

export const SUBJECT_METHOD_LABELS: Record<SubjectIdMethod, string> = {
  pulid:        "PuLID · highest face fidelity",
  instantid:    "InstantID · fast, strong identity",
  "ip-adapter": "IP-Adapter · soft style transfer",
  none:         "Generic · no subject injection",
};

export const SUBJECT_METHOD_GUIDANCE: Record<SubjectIdMethod, string> = {
  pulid:        "Use a clean, well-lit, front-facing portrait. PuLID locks face geometry tightly — works best with consistent lighting and a neutral expression.",
  instantid:    "Provide a clear front-facing portrait. InstantID is fastest and tolerates a wider range of poses than PuLID, but identity drift can occur in extreme angles.",
  "ip-adapter": "Use any reference image — IP-Adapter transfers style softly rather than locking identity. Best for stylized characters where exact likeness is less critical.",
  none:         "This crossover doesn't accept a custom subject. The generated character is implied by the prompt itself.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Diffusion model — what the DB stores in preferred_model
// ─────────────────────────────────────────────────────────────────────────────
export type DiffusionModel =
  | "hunyuan-video" | "cogvideox-5b" | "wan-i2v" | "veo-3"
  | "runway-gen4" | "sora-2";

export const DIFFUSION_MODEL_LABELS: Record<DiffusionModel, string> = {
  "hunyuan-video": "Hunyuan Video",
  "cogvideox-5b":  "CogVideoX-5B",
  "wan-i2v":       "Wan 2.5 I2V",
  "veo-3":         "Veo 3 Fast",
  "runway-gen4":   "Runway Gen-4 Turbo",
  "sora-2":        "Sora 2",
};

// ─────────────────────────────────────────────────────────────────────────────
// Mood library — 10 cinematography preset tails (expanded from 7)
// ─────────────────────────────────────────────────────────────────────────────
export type CrossoverMood =
  | "default" | "neon" | "noir" | "warm" | "stark"
  | "horror" | "anime" | "vintage-vhs" | "dreampunk" | "chrome-glam";

export interface MoodPreset {
  key: CrossoverMood;
  label: string;
  /** Tail string appended to the pure_prompt when this mood is active. */
  promptTail: string;
  /** Quick visual hint colors (used to render swatches in the mood lab). */
  swatch: { primary: string; secondary: string; accent: string };
}

export const MOOD_PRESETS: MoodPreset[] = [
  {
    key: "default",
    label: "Default · Pure recipe",
    promptTail: "",
    swatch: { primary: "#1f2937", secondary: "#6b7280", accent: "#d1d5db" },
  },
  {
    key: "neon",
    label: "Neon · Cyberpunk",
    promptTail: " Neon cyberpunk grading, saturated magentas + cyans, wet reflective surfaces, halation bloom on light sources, anamorphic streaks.",
    swatch: { primary: "#ff2ea6", secondary: "#22d3ee", accent: "#0b0b14" },
  },
  {
    key: "noir",
    label: "Noir · Smoke",
    promptTail: " High-contrast noir grading, deep ink shadows, volumetric smoke through a single hard key light, rim accents, desaturated palette except blacks and skin tones.",
    swatch: { primary: "#0a0a0a", secondary: "#3a3a3a", accent: "#d4d4d4" },
  },
  {
    key: "warm",
    label: "Warm · Sunset",
    promptTail: " Warm sunset grading, golden-hour rim light spilling across the subject, soft amber highlights, gentle haze, peach-and-honey shadows.",
    swatch: { primary: "#ff8c42", secondary: "#ffd6a5", accent: "#7c2d12" },
  },
  {
    key: "stark",
    label: "Stark · Daylight",
    promptTail: " Stark daylight, cool blue ambient, harsh shadows, crisp focus, minimal atmospheric haze, high-contrast falloff.",
    swatch: { primary: "#e0f2fe", secondary: "#0c4a6e", accent: "#fef3c7" },
  },
  {
    key: "horror",
    label: "Horror · Crimson",
    promptTail: " Horror grading, desaturated palette except crimson accents, low-key directional lighting from below, long shadows climbing the walls, faint blood-orange flicker.",
    swatch: { primary: "#0a0a0a", secondary: "#7f1d1d", accent: "#fef2f2" },
  },
  {
    key: "anime",
    label: "Anime · Cell-shaded",
    promptTail: " Cell-shaded anime grading transitioning to photoreal at the break moment, hand-painted edges, saturated chroma blocks, dramatic speed lines, ink-rim silhouettes.",
    swatch: { primary: "#fde047", secondary: "#3b82f6", accent: "#ef4444" },
  },
  {
    key: "vintage-vhs",
    label: "Vintage · VHS",
    promptTail: " VHS-era grading, soft chromatic aberration on edges, scanlines and tape-distortion banding, subtly washed-out highlights, warm magenta crush in shadows, 480p texture overlay.",
    swatch: { primary: "#fbbf24", secondary: "#ec4899", accent: "#1e293b" },
  },
  {
    key: "dreampunk",
    label: "Dreampunk · Pastel haze",
    promptTail: " Dreampunk grading, pastel haze blooms washing through frame, soft prismatic light leaks, glittery particles drifting, lavender and mint shadows, hazy soft focus around the subject.",
    swatch: { primary: "#c4b5fd", secondary: "#fbcfe8", accent: "#a7f3d0" },
  },
  {
    key: "chrome-glam",
    label: "Chrome · Glam",
    promptTail: " Chrome glam grading, polished metallic reflections sliding across the subject, holographic iridescence on surfaces, hard rim lights, oil-slick highlights, fashion-cover sharpness.",
    swatch: { primary: "#e5e7eb", secondary: "#a78bfa", accent: "#fbbf24" },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// World taxonomy — sharper than the 5 DB categories, derived from chrome_kind
// ─────────────────────────────────────────────────────────────────────────────
export type CrossoverWorld =
  | "phone-vertical"   // tiktok, reels, instagram, phone
  | "desktop-tv"       // desktop, youtube, netflix, tv, tablet, projector
  | "social-grid"      // facebook + grid-y instagram
  | "retro-screen"     // crt, arcade
  | "instrument"       // radar, oscilloscope, thermal, xray, hologram
  | "hand-art"         // comic, painting
  | "metaphysical";    // mirror, generic

export const WORLD_LABELS: Record<CrossoverWorld, string> = {
  "phone-vertical": "Phone & Vertical UI",
  "desktop-tv":     "Desktop, TV & Cinema",
  "social-grid":    "Social Grids",
  "retro-screen":   "CRT, Arcade & Retro",
  "instrument":     "Holograms & Instruments",
  "hand-art":       "Hand-drawn & Painted",
  "metaphysical":   "Mirrors & Metaphysical",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE BLUEPRINT
// ─────────────────────────────────────────────────────────────────────────────
export interface CrossoverBlueprint {
  // ── Identity ───────────────────────────────────────────────
  id: string;
  slug: string;
  name: string;
  /** Single-line hook tagline. May be null in DB but we always coerce. */
  hook: string;
  /** Full cinematic prompt (vfx_templates.pure_prompt). */
  purePrompt: string;
  /** Negative prompt tail (vfx_templates.negative_prompt). */
  negativePrompt?: string;
  thumbnailUrl: string | null;
  sampleVideoUrl?: string;

  // ── Categorization ─────────────────────────────────────────
  category: CrossoverCategory;
  world: CrossoverWorld;
  mood: string;
  tags?: string[];

  // ── Discovery ──────────────────────────────────────────────
  isFeatured?: boolean;
  isLive?: boolean;
  isNew?: boolean;
  useCount?: number;
  sortOrder?: number;

  // ── Edition: which UI it breaks out of ─────────────────────
  chrome: { kind: ChromeKind };
  aspectRatio: AspectRatio;

  // ── Customization flags ────────────────────────────────────
  acceptsSubject: boolean;
  acceptsSourceVideo: boolean;
  subjectIdMethod: SubjectIdMethod;
  subjectTwistMaxChars: number;

  // ── Choreography ───────────────────────────────────────────
  motionHint?: MotionHint;
  recipeSlug?: RecipeSlug;
  particleDensity?: number;   // 0..1
  depthCompositing?: boolean;
  interpolate?: boolean;

  // ── Audio + style ──────────────────────────────────────────
  sfxTags?: string[];
  musicGenre?: string;
  colorLut?: string;

  // ── Render plan (derived) ──────────────────────────────────
  engine: EngineId;
  preferredModel?: DiffusionModel;
  qualityTier: "hd-1080" | "hd-1080-60" | "4k-cinema" | "4k-cinema-60";
  targetFps?: number;
  targetHeight?: number;
  upscaleFactor?: number;
  estimatedDurationSec: number;
  /** Approx credit cost, computed from engine + duration. */
  estimatedCreditCost: number;
  /** Approx wall-clock seconds, computed from engine ETA + particle_density. */
  estimatedEtaSec: number;

  // ── Mood library (always all 10 — composer picks which one) ─
  availableMoods: MoodPreset[];

  // ── Chaining (Phase 3) ─────────────────────────────────────
  companionCrossovers?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function composeCrossoverPrompt(
  bp: CrossoverBlueprint,
  twist: string,
  mood: CrossoverMood,
): string {
  const moodPreset = bp.availableMoods.find(m => m.key === mood) ?? bp.availableMoods[0];
  const twistTail = twist.trim() ? `\n\nUser direction: ${twist.trim()}` : "";
  return `${bp.purePrompt}${moodPreset.promptTail}${twistTail}`;
}

/** Sort: featured first, then by sortOrder asc, then by useCount desc. */
export function defaultCrossoverSort(a: CrossoverBlueprint, b: CrossoverBlueprint): number {
  if (a.isFeatured && !b.isFeatured) return -1;
  if (!a.isFeatured && b.isFeatured) return 1;
  const so = (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
  if (so !== 0) return so;
  return (b.useCount ?? 0) - (a.useCount ?? 0);
}
