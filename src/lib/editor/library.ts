/**
 * library — the Small Bridges Studio Library.
 *
 * Curated, not exhaustive. Every entry has to earn its place. We
 * picked these because real cinematographers reach for them — the
 * looks that defined a decade of cinema, the transitions that read
 * as intentional rather than stock, the templates that map to the
 * kind of film an indie director actually makes.
 *
 * If you find yourself reaching to add an effect because "more is
 * better," resist. The whole value of this list is that *every*
 * choice is good.
 *
 * Data shapes:
 *   - CinematicEffect: a single shot-level look. Applies as the
 *     <video>'s CSS filter via setClipProperty.
 *   - ProjectTemplate: a whole-film recipe. Grades every clip,
 *     applies a transition kind+duration at every boundary, and
 *     optionally sets master playback speed.
 *
 * Authoring conventions:
 *   - `swatch` is a CSS background string that previews the look on a
 *     16:9 chip without needing real footage.
 *   - `tier` is purely visual differentiation in the panel — no
 *     gating or paywall in v1.
 */
import type { TransitionKind } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CinematicEffect — shot-level look
// ─────────────────────────────────────────────────────────────────────────────
export type EffectCategory = "color" | "film" | "atmosphere";
export type EffectTier = "studio" | "signature" | "cult";

export interface CinematicEffect {
  id: string;
  name: string;
  /** Short cinematic context — what film/director made it famous. */
  attribution: string;
  category: EffectCategory;
  tier: EffectTier;
  /** Applied to the <video>'s CSS filter via clip.properties.filter. */
  cssFilter: string;
  /** CSS background preview for the panel chip. */
  swatch: string;
}

export const PREMIUM_EFFECTS: CinematicEffect[] = [
  // ── COLOR GRADES — the 8 looks that defined modern cinema ──────────
  {
    id: "teal-orange",
    name: "Teal & Orange",
    attribution: "Modern Hollywood blockbuster",
    category: "color",
    tier: "studio",
    cssFilter: "saturate(1.18) contrast(1.14) hue-rotate(-8deg) brightness(0.97)",
    swatch:
      "linear-gradient(135deg, hsl(195 75% 42%) 0%, hsl(195 60% 30%) 35%, hsl(22 85% 52%) 70%, hsl(28 90% 60%) 100%)",
  },
  {
    id: "bleach-bypass",
    name: "Bleach Bypass",
    attribution: "Saving Private Ryan · Children of Men",
    category: "color",
    tier: "signature",
    cssFilter: "saturate(0.45) contrast(1.32) brightness(1.04)",
    swatch:
      "linear-gradient(135deg, hsl(40 8% 78%) 0%, hsl(200 15% 55%) 50%, hsl(220 10% 28%) 100%)",
  },
  {
    id: "kodak-2383",
    name: "Kodak 2383",
    attribution: "Film print emulation",
    category: "color",
    tier: "signature",
    cssFilter:
      "saturate(1.08) contrast(1.10) sepia(0.10) brightness(0.99) hue-rotate(-3deg)",
    swatch:
      "linear-gradient(135deg, hsl(28 65% 60%) 0%, hsl(35 50% 45%) 40%, hsl(22 45% 28%) 100%)",
  },
  {
    id: "wes-anderson",
    name: "Wes Anderson",
    attribution: "Grand Budapest · Asteroid City",
    category: "color",
    tier: "cult",
    cssFilter:
      "saturate(1.25) brightness(1.06) contrast(0.94) hue-rotate(8deg)",
    swatch:
      "linear-gradient(135deg, hsl(355 65% 76%) 0%, hsl(40 75% 80%) 45%, hsl(160 35% 75%) 80%, hsl(220 45% 70%) 100%)",
  },
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon",
    attribution: "Blade Runner 2049 · John Wick",
    category: "color",
    tier: "signature",
    cssFilter:
      "saturate(1.45) contrast(1.22) hue-rotate(-12deg) brightness(0.92)",
    swatch:
      "linear-gradient(135deg, hsl(285 80% 45%) 0%, hsl(220 90% 40%) 35%, hsl(195 95% 50%) 70%, hsl(20 95% 55%) 100%)",
  },
  {
    id: "fincher-cyan",
    name: "Fincher Cyan",
    attribution: "Gone Girl · Mindhunter",
    category: "color",
    tier: "cult",
    cssFilter: "saturate(0.85) contrast(1.18) hue-rotate(8deg) brightness(0.94)",
    swatch:
      "linear-gradient(135deg, hsl(180 35% 22%) 0%, hsl(190 30% 35%) 50%, hsl(180 25% 18%) 100%)",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    attribution: "Terrence Malick · Days of Heaven",
    category: "color",
    tier: "studio",
    cssFilter: "saturate(1.22) brightness(1.10) hue-rotate(-12deg) contrast(1.06)",
    swatch:
      "linear-gradient(135deg, hsl(35 95% 68%) 0%, hsl(22 88% 55%) 50%, hsl(8 78% 38%) 100%)",
  },
  {
    id: "nordic-noir",
    name: "Nordic Noir",
    attribution: "The Bridge · Trapped",
    category: "color",
    tier: "cult",
    cssFilter: "saturate(0.55) contrast(1.20) brightness(0.88) hue-rotate(6deg)",
    swatch:
      "linear-gradient(135deg, hsl(210 25% 32%) 0%, hsl(215 18% 18%) 50%, hsl(220 15% 12%) 100%)",
  },

  // ── FILM TEXTURES — the 3 most-reached-for stocks ──────────────────
  {
    id: "16mm-grain",
    name: "16mm Grain",
    attribution: "Indie cinematic texture",
    category: "film",
    tier: "studio",
    cssFilter:
      "saturate(1.05) contrast(1.08) brightness(1.02) blur(0.18px)",
    swatch:
      "linear-gradient(135deg, hsl(40 30% 65%) 0%, hsl(30 25% 45%) 50%, hsl(20 20% 25%) 100%)",
  },
  {
    id: "35mm-print",
    name: "35mm Print",
    attribution: "Theatrical release stock",
    category: "film",
    tier: "signature",
    cssFilter:
      "saturate(1.12) contrast(1.14) brightness(0.98) sepia(0.06)",
    swatch:
      "linear-gradient(135deg, hsl(30 65% 50%) 0%, hsl(15 45% 32%) 50%, hsl(220 25% 12%) 100%)",
  },
  {
    id: "vhs-chroma",
    name: "VHS Chroma",
    attribution: "Lo-fi · home video",
    category: "film",
    tier: "cult",
    cssFilter:
      "saturate(0.85) contrast(0.92) hue-rotate(-6deg) brightness(1.06)",
    swatch:
      "linear-gradient(135deg, hsl(330 70% 55%) 0%, hsl(190 65% 50%) 50%, hsl(60 75% 55%) 100%)",
  },

  // ── ATMOSPHERE — soft cinematic moods ──────────────────────────────
  {
    id: "dream-bloom",
    name: "Dream Bloom",
    attribution: "Sofia Coppola · Lost in Translation",
    category: "atmosphere",
    tier: "signature",
    cssFilter:
      "saturate(0.90) brightness(1.12) contrast(0.92) blur(0.4px)",
    swatch:
      "linear-gradient(135deg, hsl(45 50% 88%) 0%, hsl(20 55% 78%) 50%, hsl(340 45% 70%) 100%)",
  },
];

/** Restore the clip to neutral — the explicit "no look" entry that
 *  always reads as the first action in the panel. */
export const NEUTRAL_EFFECT: CinematicEffect = {
  id: "neutral",
  name: "Neutral",
  attribution: "Camera original · no grade",
  category: "color",
  tier: "studio",
  cssFilter: "",
  swatch:
    "linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 55%) 50%, hsl(0 0% 25%) 100%)",
};

// ─────────────────────────────────────────────────────────────────────────────
// ProjectTemplate — whole-film recipe
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectTemplate {
  id: string;
  name: string;
  /** One-line directorial intent. */
  tagline: string;
  /** Slightly longer explanation surfaced on hover. */
  description: string;
  /** Default look applied to every V1 clip on apply. Empty = no
   *  change to existing filters. */
  effectId?: string;
  /** Transition kind dropped at every V1 boundary. */
  transition: { kind: TransitionKind; durationSec: number };
  /** Master playback speed (0.95 for "languid," 1.05 for "punchy"). */
  playbackSpeed: number;
  /** Per-clip fadeInSec / fadeOutSec (0 = leave alone). */
  clipFades: { fadeInSec: number; fadeOutSec: number };
  /** CSS gradient that renders as the template card backdrop. */
  hero: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "the-trailer",
    name: "The Trailer",
    tagline: "Punchy, dramatic, music-driven cuts.",
    description:
      "Tight 0.25s dissolves between every shot. Bleach Bypass grade for that desaturated cinematic punch. 1.05× to feel just slightly urgent.",
    effectId: "bleach-bypass",
    transition: { kind: "dissolve", durationSec: 0.25 },
    playbackSpeed: 1.05,
    clipFades: { fadeInSec: 0, fadeOutSec: 0 },
    hero:
      "linear-gradient(135deg, hsl(220 25% 14%) 0%, hsl(0 65% 32%) 50%, hsl(40 75% 50%) 100%)",
  },
  {
    id: "music-video",
    name: "Music Video",
    tagline: "Beat-synced, saturated, teal-orange.",
    description:
      "Fast 0.18s fades on every cut for natural rhythm. Teal & Orange grade — the look every music video has worn since 2008. Real-time playback.",
    effectId: "teal-orange",
    transition: { kind: "fade", durationSec: 0.18 },
    playbackSpeed: 1.0,
    clipFades: { fadeInSec: 0, fadeOutSec: 0 },
    hero:
      "linear-gradient(135deg, hsl(195 80% 40%) 0%, hsl(28 90% 55%) 100%)",
  },
  {
    id: "documentary",
    name: "Documentary",
    tagline: "Long dissolves, neutral grade, contemplative.",
    description:
      "Slow 0.9s dissolves so the eye breathes between observations. No grade — let the camera's truth speak. 0.95× to let the room settle.",
    transition: { kind: "dissolve", durationSec: 0.9 },
    playbackSpeed: 0.95,
    clipFades: { fadeInSec: 0.4, fadeOutSec: 0.4 },
    hero:
      "linear-gradient(135deg, hsl(40 30% 45%) 0%, hsl(20 25% 25%) 50%, hsl(220 15% 12%) 100%)",
  },
  {
    id: "wedding-cinematic",
    name: "Wedding Cinematic",
    tagline: "Warm, dreamy, soft.",
    description:
      "Generous 1.2s soft fades. Golden Hour grade for that magic-light feel. Dream Bloom blurs the edges. 0.95× for the romance.",
    effectId: "golden-hour",
    transition: { kind: "fade", durationSec: 1.2 },
    playbackSpeed: 0.95,
    clipFades: { fadeInSec: 0.5, fadeOutSec: 0.5 },
    hero:
      "linear-gradient(135deg, hsl(28 88% 65%) 0%, hsl(355 65% 76%) 50%, hsl(35 80% 78%) 100%)",
  },
  {
    id: "tiktok-reel",
    name: "TikTok · Reel",
    tagline: "Hard cuts. Cyberpunk neon. Vertical native.",
    description:
      "Hard cuts with 0.08s safety fades so nothing reads as a glitch. Cyberpunk Neon grade for the algorithmic moment. 1.10× to keep eyes locked.",
    effectId: "cyberpunk-neon",
    transition: { kind: "fade", durationSec: 0.08 },
    playbackSpeed: 1.1,
    clipFades: { fadeInSec: 0, fadeOutSec: 0 },
    hero:
      "linear-gradient(135deg, hsl(285 85% 45%) 0%, hsl(195 95% 50%) 100%)",
  },
  {
    id: "brand-promo",
    name: "Brand Promo",
    tagline: "Clean, confident, brand-coloured.",
    description:
      "0.35s fades. Neutral grade so your brand colour palette reads true. Real-time playback. Lets your product breathe.",
    transition: { kind: "fade", durationSec: 0.35 },
    playbackSpeed: 1.0,
    clipFades: { fadeInSec: 0.2, fadeOutSec: 0.2 },
    hero:
      "linear-gradient(135deg, hsl(0 0% 96%) 0%, hsl(0 0% 75%) 50%, hsl(220 15% 22%) 100%)",
  },
  {
    id: "festival-indie",
    name: "Festival Indie",
    tagline: "Soft 16mm. Natural light. Sundance-ready.",
    description:
      "0.5s dissolves with subtle 0.3s clip fades. 16mm Grain texture for that festival-circuit look. 0.97× to let scenes breathe.",
    effectId: "16mm-grain",
    transition: { kind: "dissolve", durationSec: 0.5 },
    playbackSpeed: 0.97,
    clipFades: { fadeInSec: 0.3, fadeOutSec: 0.3 },
    hero:
      "linear-gradient(135deg, hsl(38 45% 60%) 0%, hsl(28 35% 38%) 50%, hsl(20 25% 20%) 100%)",
  },
  {
    id: "brutalist-drop",
    name: "Brutalist Drop",
    tagline: "Hard cuts. Nordic noir. No mercy.",
    description:
      "Pure hard cuts at every boundary. Nordic Noir grade. 1.0× — let the silence work. For when you want it to feel surveilled and inevitable.",
    effectId: "nordic-noir",
    transition: { kind: "fade", durationSec: 0.05 },
    playbackSpeed: 1.0,
    clipFades: { fadeInSec: 0, fadeOutSec: 0 },
    hero:
      "linear-gradient(135deg, hsl(220 20% 12%) 0%, hsl(210 22% 22%) 50%, hsl(220 15% 8%) 100%)",
  },
];
