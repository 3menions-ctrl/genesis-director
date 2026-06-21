/**
 * TemplateBlueprint — the unified rich template schema.
 *
 * Replaces three older formats:
 *   • BREAKOUT_TEMPLATES (10 hardcoded 4th-wall configs in breakout-templates.ts)
 *   • BUILT_IN_TEMPLATES (50 metadata-only objects in pages/Templates.tsx)
 *   • vfx_templates row  (50 single-prompt VFX rows in DB)
 *
 * One blueprint declares EVERYTHING the Studio needs to spin up a project
 * from a template click: engine, quality, aspect, the storyboard of clips
 * (each with prompt + duration + VFX + properties), transitions between
 * clips, color grade, pacing, music, and chaining hints.
 *
 * The Templates page reads this. The Detail Drawer reads this. Phase 2's
 * `/create?template=` consumer will read this. The Project Template
 * post-processor in `library.ts` can read the `colorGrade` + `transitions`
 * subset and stay compatible with existing post-processing flows.
 */

import type { AspectRatio, TransitionKind, AnimatableProperty } from "@/lib/editor/types";
import type { EngineId } from "@/lib/video/engines";

// ─────────────────────────────────────────────────────────────────────────────
// VFX preset taxonomy
//
// A controlled vocabulary for per-clip VFX hints. Generators (Wan, Veo,
// Sora, etc.) parse these as prompt-tail tokens; the editor surfaces them
// as chips on the clip card; render pipelines may apply matching filters.
// ─────────────────────────────────────────────────────────────────────────────
export type VfxPreset =
  // Motion VFX
  | "dolly-push-in"
  | "dolly-back"
  | "tracking-shot"
  | "crane-up"
  | "crane-down"
  | "whip-pan"
  | "orbit-360"
  | "low-angle-hero"
  | "dutch-angle"
  | "handheld"
  // Speed VFX
  | "slow-mo-50"
  | "slow-mo-25"
  | "speed-ramp"
  | "freeze-frame"
  // Optical VFX
  | "volumetric-shatter"
  | "glass-break"
  | "particle-burst"
  | "lens-flare"
  | "god-rays"
  | "smoke-trail"
  | "ink-bloom"
  | "energy-crackle"
  | "neon-rim"
  | "scanline-glitch"
  | "chromatic-aberration"
  | "depth-blur"
  | "bokeh"
  // Color VFX
  | "warm-grade"
  | "cool-grade"
  | "noir-grade"
  | "teal-orange"
  | "neon-cyberpunk"
  | "vintage-fade"
  | "high-contrast"
  | "desaturate-isolate"
  // Format VFX
  | "aspect-shift"
  | "split-screen"
  | "picture-in-picture"
  | "ui-overlay"
  | "scanline-crt";

export const VFX_PRESET_LABELS: Record<VfxPreset, string> = {
  "dolly-push-in":       "Dolly push-in",
  "dolly-back":          "Dolly back",
  "tracking-shot":       "Tracking shot",
  "crane-up":            "Crane up",
  "crane-down":          "Crane down",
  "whip-pan":            "Whip pan",
  "orbit-360":           "Orbit 360°",
  "low-angle-hero":      "Low angle hero",
  "dutch-angle":         "Dutch angle",
  "handheld":            "Handheld",
  "slow-mo-50":          "Slow-mo 50%",
  "slow-mo-25":          "Slow-mo 25%",
  "speed-ramp":          "Speed ramp",
  "freeze-frame":        "Freeze frame",
  "volumetric-shatter":  "Volumetric shatter",
  "glass-break":         "Glass break",
  "particle-burst":      "Particle burst",
  "lens-flare":          "Lens flare",
  "god-rays":            "God rays",
  "smoke-trail":         "Smoke trail",
  "ink-bloom":           "Ink bloom",
  "energy-crackle":      "Energy crackle",
  "neon-rim":            "Neon rim",
  "scanline-glitch":     "Scanline glitch",
  "chromatic-aberration":"Chromatic aberration",
  "depth-blur":          "Depth blur",
  "bokeh":               "Bokeh",
  "warm-grade":          "Warm grade",
  "cool-grade":          "Cool grade",
  "noir-grade":          "Noir grade",
  "teal-orange":         "Teal & orange",
  "neon-cyberpunk":      "Neon cyberpunk",
  "vintage-fade":        "Vintage fade",
  "high-contrast":       "High contrast",
  "desaturate-isolate":  "Desaturate + isolate",
  "aspect-shift":        "Aspect shift",
  "split-screen":        "Split screen",
  "picture-in-picture":  "Picture-in-picture",
  "ui-overlay":          "UI overlay",
  "scanline-crt":        "CRT scanlines",
};

export type VfxCategory = "motion" | "speed" | "optical" | "color" | "format";

export const VFX_CATEGORY_OF: Record<VfxPreset, VfxCategory> = {
  "dolly-push-in":"motion","dolly-back":"motion","tracking-shot":"motion","crane-up":"motion","crane-down":"motion","whip-pan":"motion","orbit-360":"motion","low-angle-hero":"motion","dutch-angle":"motion","handheld":"motion",
  "slow-mo-50":"speed","slow-mo-25":"speed","speed-ramp":"speed","freeze-frame":"speed",
  "volumetric-shatter":"optical","glass-break":"optical","particle-burst":"optical","lens-flare":"optical","god-rays":"optical","smoke-trail":"optical","ink-bloom":"optical","energy-crackle":"optical","neon-rim":"optical","scanline-glitch":"optical","chromatic-aberration":"optical","depth-blur":"optical","bokeh":"optical",
  "warm-grade":"color","cool-grade":"color","noir-grade":"color","teal-orange":"color","neon-cyberpunk":"color","vintage-fade":"color","high-contrast":"color","desaturate-isolate":"color",
  "aspect-shift":"format","split-screen":"format","picture-in-picture":"format","ui-overlay":"format","scanline-crt":"format",
};

// ─────────────────────────────────────────────────────────────────────────────
// Quality + pacing + music
// ─────────────────────────────────────────────────────────────────────────────
export type QualityTier = "hd-1080" | "hd-1080-60" | "4k-cinema" | "4k-cinema-60";

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  "hd-1080":       "HD 1080p",
  "hd-1080-60":    "HD · 60 fps",
  "4k-cinema":     "4K Cinema",
  "4k-cinema-60":  "4K Cinema · 60",
};

export type PacingStyle = "slow" | "medium" | "fast" | "manic";

export const PACING_LABELS: Record<PacingStyle, string> = {
  slow:   "Slow / contemplative",
  medium: "Medium / balanced",
  fast:   "Fast / punchy",
  manic:  "Manic / hyper-cut",
};

export type MusicMood =
  | "epic-cinematic"
  | "tense-thriller"
  | "warm-uplifting"
  | "lofi-chill"
  | "neon-synthwave"
  | "trap-banger"
  | "orchestral-emotional"
  | "ambient-textural"
  | "vintage-vinyl"
  | "noir-jazz"
  | "edm-drop"
  | "documentary-piano"
  | "none";

export const MUSIC_MOOD_LABELS: Record<MusicMood, string> = {
  "epic-cinematic":       "Epic cinematic",
  "tense-thriller":       "Tense thriller",
  "warm-uplifting":       "Warm uplifting",
  "lofi-chill":           "Lo-fi chill",
  "neon-synthwave":       "Neon synthwave",
  "trap-banger":          "Trap banger",
  "orchestral-emotional": "Orchestral",
  "ambient-textural":     "Ambient",
  "vintage-vinyl":        "Vintage vinyl",
  "noir-jazz":            "Noir jazz",
  "edm-drop":             "EDM drop",
  "documentary-piano":    "Documentary piano",
  "none":                 "Silent",
};

// ─────────────────────────────────────────────────────────────────────────────
// Color grade
// ─────────────────────────────────────────────────────────────────────────────
export interface TemplateColorGrade {
  /** Three signature hex values (primary, secondary, accent). */
  primary:   string;
  secondary: string;
  accent:    string;
  /** Optional CSS filter string applied to clips that don't override. */
  filter?: string;
  /** Optional display label (e.g. "Bladerunner neon", "Roma warmth"). */
  label?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-clip blueprint
// ─────────────────────────────────────────────────────────────────────────────
export interface KeyframeBlueprint {
  property: AnimatableProperty;
  /** 0..1 = relative to clip start (0) and clip end (1). */
  at: number;
  value: number;
}

export interface ClipBlueprintProperties {
  opacity?:    number;
  scale?:      number;
  speed?:      number;
  fadeInSec?:  number;
  fadeOutSec?: number;
  /** CSS filter string applied to the video. */
  filter?:     string;
  /** Horizontal flip. */
  mirror?:     boolean;
  /** Force-mute even when volume > 0. */
  muted?:      boolean;
  /** 0.0 – 1.5 gain. */
  volume?:     number;
}

export interface ClipBlueprint {
  /** Stable slug — used as React key and consumer reference. */
  id: string;
  /** Human label (e.g. "The Trap", "Hook", "Reveal"). */
  label: string;
  /** Full generation prompt for this clip. */
  prompt: string;
  /** Recommended duration in seconds. Pipeline will clamp to engine support. */
  durationSec: number;
  /** Optional per-clip engine override (e.g. shoot the reveal on Veo 3). */
  engine?: EngineId;
  /** Optional per-clip aspect override (e.g. aspect-escape templates). */
  aspectRatio?: AspectRatio;
  /** VFX preset chips applied to this clip. */
  vfxPresets?: VfxPreset[];
  /** Clip-level property overrides (opacity, speed, etc.). */
  properties?: ClipBlueprintProperties;
  /** Time-varying property keyframes. */
  keyframes?: KeyframeBlueprint[];
  /** Editorial notes ("Slow-burn tension","Volumetric debris"). */
  visualElements?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Template category
// ─────────────────────────────────────────────────────────────────────────────
export type TemplateCategory =
  | "trending"
  | "cinematic"
  | "commercial"
  | "educational"
  | "entertainment"
  | "corporate"
  | "vfx";

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  trending:      "Trending",
  cinematic:     "Cinematic",
  commercial:    "Commercial",
  educational:   "Educational",
  entertainment: "Entertainment",
  corporate:     "Corporate",
  vfx:           "VFX & Breakouts",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE BLUEPRINT
// ─────────────────────────────────────────────────────────────────────────────
export interface TemplateBlueprint {
  // ── Identity ─────────────────────────────────────────────
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;

  // ── Categorization ───────────────────────────────────────
  category: TemplateCategory;
  mood: string;
  genre: string;
  tags?: string[];

  // ── Discovery ────────────────────────────────────────────
  isFeatured?: boolean;
  isTrending?: boolean;
  isBreakout?: boolean;
  isNew?: boolean;
  /** Requires `studio_cinema` entitlement (Veo/Runway/Sora). */
  isPro?: boolean;
  useCount: number;

  // ── Engine + quality ─────────────────────────────────────
  engine: EngineId;
  qualityTier: QualityTier;

  // ── Framing ──────────────────────────────────────────────
  aspectRatio: AspectRatio;

  // ── Storyboard ───────────────────────────────────────────
  clips: ClipBlueprint[];
  /** Transitions between consecutive clips. Length = clips.length - 1.
   *  Empty / undefined => hard cuts. */
  transitions?: TransitionKind[];
  /** Transition duration in seconds (single global value). */
  transitionDurationSec?: number;

  // ── Style ────────────────────────────────────────────────
  colorGrade: TemplateColorGrade;
  pacing: PacingStyle;
  /** Master playback speed multiplier (1.0 = native). */
  playbackSpeed?: number;

  // ── Audio ────────────────────────────────────────────────
  musicMood: MusicMood;
  includeSfx: boolean;
  voiceId?: string | null;

  // ── Chaining (Phase 3 — declared now for forward compat) ──
  companionTemplates?: string[];
  prerequisites?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers — used by the cards + detail drawer
// ─────────────────────────────────────────────────────────────────────────────

/** Total duration in seconds across all clips. */
export function totalClipDuration(bp: TemplateBlueprint): number {
  return bp.clips.reduce((sum, c) => sum + c.durationSec, 0);
}

/** Total VFX preset count across all clips. */
export function totalVfxPresetCount(bp: TemplateBlueprint): number {
  return bp.clips.reduce((sum, c) => sum + (c.vfxPresets?.length ?? 0), 0);
}

/** Distinct VFX presets used anywhere in the template. */
export function distinctVfxPresets(bp: TemplateBlueprint): VfxPreset[] {
  const set = new Set<VfxPreset>();
  for (const c of bp.clips) for (const p of c.vfxPresets ?? []) set.add(p);
  return Array.from(set);
}

/** Transition count (defaulting to hard cuts between clips). */
export function transitionCount(bp: TemplateBlueprint): number {
  return bp.transitions?.length ?? 0;
}
