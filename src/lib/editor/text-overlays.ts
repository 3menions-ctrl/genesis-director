/**
 * Text overlays — broadcast / cinema-grade text rendered over video.
 *
 * Design goals
 *   • Authored in the editor as data, never as raw FFmpeg drawtext
 *     (drawtext can't kern, can't shape complex scripts, can't drop
 *     shadows, can't gradient-fill — fails the "highest quality" bar).
 *   • Live preview is SVG layered on the StitchedPlayer. The same SVG
 *     model is what the bake rasterizes — preview = export.
 *   • Bake (phase 2): Resvg in a Deno edge function converts each
 *     overlay (per visible frame, or per keyframe pair) to high-DPI
 *     PNG, FFmpeg overlays the PNG at the right timecode. For animated
 *     overlays (typewriter, slide-in), the bake emits multiple PNGs
 *     across the time window and uses `overlay=enable='between(t,a,b)'`
 *     for each. This avoids drawtext entirely.
 *
 * One TextOverlay = one visible piece of text with one timed
 * appearance. Multiple overlays compose freely (chyron + caption +
 * lower-third simultaneously).
 *
 * Coordinates are in *project-canvas normalized space* (0..1 on both
 * axes). The renderer multiplies by the project's aspect-derived
 * canvas. Font sizes are expressed as percentages of canvas HEIGHT
 * so a 8% title looks like an 8% title at any aspect.
 */

import type { LucideIcon } from "lucide-react";
import {
  Type, Sparkles, MessageSquare, Newspaper, Terminal,
  Quote as QuoteIcon, Award, Mic2, Clock, Hash,
  Anchor, Layers, Film, Crown, Camera,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Geometry / typography primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Where the overlay's bounding box is anchored relative to (x, y). */
export type Anchor =
  | "top-left"   | "top-center"    | "top-right"
  | "middle-left"| "middle-center" | "middle-right"
  | "bottom-left"| "bottom-center" | "bottom-right";

export type TextAlign = "left" | "center" | "right";

export type FontFamily =
  | "fraunces"   // Display serif (cinematic title cards)
  | "inter"      // Modern sans (chyrons, lower thirds)
  | "space-mono" // Mono (tech terminal, code, timecodes)
  | "playfair"   // Editorial serif (quote callouts)
  | "bebas-neue" // Tall condensed display (news ticker, sports)
  | "ibm-plex-mono" // Engineering mono (broadcast captions)
  | "dm-serif";  // Heavy display serif (cold opens)

export type FontWeight = 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

// ─────────────────────────────────────────────────────────────────────────────
// Style — visual chrome around the text
// ─────────────────────────────────────────────────────────────────────────────

export interface TextFill {
  /** CSS color or gradient string. For gradient, use linear-gradient(...). */
  color: string;
  opacity: number; // 0..1
}

export interface GradientStop {
  /** Position 0..1 along the gradient axis. */
  at: number;
  color: string;
}

/** Pro gradient fill — overrides `fill.color` when present.
 *  Linear: angle in degrees (0 = left→right, 90 = bottom→top).
 *  Radial: centered, radius = bounding box half-diagonal.
 *  Conic: anchored at center, angle = starting sweep. */
export interface GradientFill {
  kind: "linear" | "radial" | "conic";
  angle: number;
  stops: GradientStop[];
}

/** Soft glow ring around the text — additive to shadow / fill, drawn
 *  using an SVG blur filter so it works correctly for any font shape. */
export interface TextGlow {
  color: string;
  /** Glow radius in % of font-size. */
  blurPct: number;
  /** Overall multiplier 0..1.5. */
  intensity: number;
}

/** Counter overlay — when present, the rendered text is a number
 *  interpolated between `from` and `to` driven by animation progress.
 *  `format` uses `{n}` as the placeholder, e.g. "${n}" → "$1,234,567".
 *  Decimals controls fractional digits; commas auto-applied. */
export interface CounterSpec {
  from: number;
  to: number;
  format: string;
  decimals: number;
  /** Optional commas-as-thousands-separator. */
  thousands: boolean;
}

export interface TextStroke {
  color: string;
  /** Width in % of font-size (so it scales with text). 0 = no stroke. */
  widthPct: number;
}

export interface TextShadow {
  color: string;
  /** All three offsets in % of font-size. */
  offsetXPct: number;
  offsetYPct: number;
  blurPct: number;
  opacity: number;
}

export interface TextBackground {
  /** "none" | "solid" | "gradient" | "blur" | "stripe" (Eurosport bar) */
  kind: "none" | "solid" | "gradient" | "blur" | "stripe";
  /** Solid color / gradient stops as a CSS string. */
  color?: string;
  /** Padding around the text in % of font-size. */
  paddingPct: number;
  /** Corner radius in % of font-size. */
  radiusPct: number;
  /** Stripe-mode: leading accent bar color (left edge). */
  stripeColor?: string;
  /** Stripe-mode: stripe width in % of font-size. */
  stripeWidthPct?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation — entrance + exit
// ─────────────────────────────────────────────────────────────────────────────

export type AnimationKind =
  // Basic
  | "none"
  | "fade"
  | "slide-up" | "slide-down" | "slide-left" | "slide-right"
  | "scale"
  // Pro kinetic typography — beyond what PPT can do
  | "typewriter"           // character-by-character reveal
  | "stagger-word"         // each word lands separately
  | "letter-drop"          // characters fall from above with bounce
  | "wipe-reveal"          // reveal behind a left-to-right mask
  | "split-flap"           // departure-board flip per character
  | "wave"                 // sinusoidal hover, characters rise + fall
  | "blur-in"              // 30px blur → focus + fade in
  | "glitch-in"            // chromatic-aberration jitter then settle
  | "shimmer"              // gradient sweep across the fill
  | "elastic-pop"          // overshoot scale-in with spring settle
  | "stencil-cut"          // appears as if cut from a metal stencil
  | "letterbox-iris"       // expand from a horizontal slit
  | "tracking-tighten"     // wide-tracked → tight as it lands
  | "uppercase-cycle"      // characters cycle through random letters then lock
  | "underline-draw";      // underline strokes in left-to-right

export interface Animation {
  kind: AnimationKind;
  /** Duration of the in-animation in seconds. */
  inSec: number;
  /** Duration of the out-animation in seconds. */
  outSec: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// The overlay itself
// ─────────────────────────────────────────────────────────────────────────────

export interface TextOverlay {
  /** Stable id. */
  id: string;
  /** Optional template the overlay was instantiated from — lets the
   *  user "re-roll" against a different template while keeping their
   *  text + timing. */
  templateId?: string | null;

  /** Multi-line text. \n is honored. */
  text: string;

  /** Time window on the project timeline (seconds). */
  startSec: number;
  durationSec: number;

  // ── Layout ───────────────────────────────────────────────────────
  /** Normalized x, y (0..1) of the overlay's anchor. */
  x: number;
  y: number;
  anchor: Anchor;
  /** Max box width as % of canvas width. Text wraps inside this. */
  maxWidthPct: number;
  align: TextAlign;

  // ── Type ─────────────────────────────────────────────────────────
  font: FontFamily;
  weight: FontWeight;
  italic: boolean;
  /** Font size as % of canvas HEIGHT (so titles scale with the player). */
  sizePct: number;
  /** Tracking — letter-spacing in em (negative tightens). */
  letterSpacingEm: number;
  /** Line height (em). */
  lineHeight: number;
  uppercase: boolean;

  // ── Chrome ───────────────────────────────────────────────────────
  fill: TextFill;
  /** Pro gradient fill — when present, overrides `fill.color`. SVG renders
   *  via `<linearGradient>` / `<radialGradient>` / conic-via-mask. */
  gradientFill?: GradientFill | null;
  stroke: TextStroke;
  shadow: TextShadow;
  /** Optional additional shadow layers (multi-shadow for depth: key +
   *  ambient + bounce). Renders in order, behind the primary shadow. */
  extraShadows?: TextShadow[];
  /** Inset shadow — punched-out look, sits inside the text fill via SVG
   *  feComposite arithmetic. */
  innerShadow?: TextShadow | null;
  /** Soft glow ring around the text — additive, no offset. */
  glow?: TextGlow | null;
  background: TextBackground;

  // ── Behavior ─────────────────────────────────────────────────────
  /** When true, the renderer measures the text and shrinks the font
   *  size until it fits within `maxWidthPct`. Useful for stat cards
   *  that take arbitrary user values. */
  autoFit?: boolean;
  /** Counter / number animation — when present, replaces the text
   *  content with an interpolated number driven by animation
   *  progress + the format string. */
  counter?: CounterSpec | null;

  // ── Animation ────────────────────────────────────────────────────
  animation: Animation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults — sane fallbacks the constructor uses when a field is omitted
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FILL:       TextFill       = { color: "#FFFFFF", opacity: 1 };
export const DEFAULT_STROKE:     TextStroke     = { color: "#000000", widthPct: 0 };
export const DEFAULT_SHADOW:     TextShadow     = { color: "#000000", offsetXPct: 0, offsetYPct: 4, blurPct: 12, opacity: 0.4 };
export const DEFAULT_BACKGROUND: TextBackground = { kind: "none", paddingPct: 0, radiusPct: 0 };
export const DEFAULT_ANIMATION:  Animation      = { kind: "fade", inSec: 0.5, outSec: 0.5 };

// ─────────────────────────────────────────────────────────────────────────────
// Template blueprints — the "PowerPoint library"
// ─────────────────────────────────────────────────────────────────────────────

export interface TextTemplateBlueprint {
  id: string;
  name: string;
  category: "title" | "lower-third" | "caption" | "quote" | "stat" | "broadcast" | "tech" | "cinematic";
  icon: LucideIcon;
  description: string;
  /** Function that builds a TextOverlay given a user-supplied text +
   *  start time. Templates can override any field of the overlay. */
  build: (text: string, startSec: number, durationSec?: number) => TextOverlay;
}

function id(): string {
  return `txt-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

/** Curated 15-blueprint library — every entry should look broadcast-ready
 *  with zero further configuration. Users can edit any field after
 *  instantiation. */
export const TEXT_TEMPLATES: TextTemplateBlueprint[] = [
  // ───── TITLE CARDS ─────────────────────────────────────────────
  {
    id: "cinematic-title",
    name: "Cinematic title",
    category: "cinematic",
    icon: Crown,
    description: "Centered serif title card — Fraunces italic, letter-spaced, slow fade.",
    build: (text, startSec, durationSec = 3.5) => ({
      id: id(),
      templateId: "cinematic-title",
      text,
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 70, align: "center",
      font: "fraunces", weight: 300, italic: true,
      sizePct: 8.5, letterSpacingEm: 0.02, lineHeight: 1.05, uppercase: false,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 6, blurPct: 20, opacity: 0.5 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 1.0, outSec: 1.0 },
    }),
  },
  {
    id: "cold-open",
    name: "Cold-open chapter",
    category: "cinematic",
    icon: Film,
    description: "Huge serif chapter title — fades up from the bottom third.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "cold-open",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.65, anchor: "middle-center",
      maxWidthPct: 80, align: "center",
      font: "dm-serif", weight: 400, italic: false,
      sizePct: 12, letterSpacingEm: 0.04, lineHeight: 0.98, uppercase: true,
      fill: { color: "#F4E9D8", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 8, blurPct: 28, opacity: 0.55 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "slide-up", inSec: 1.2, outSec: 0.6 },
    }),
  },

  // ───── LOWER THIRDS ─────────────────────────────────────────────
  {
    id: "broadcast-lower-third",
    name: "Broadcast lower-third",
    category: "lower-third",
    icon: Newspaper,
    description: "News-style chyron with leading accent stripe + bold sans.",
    build: (text, startSec, durationSec = 5) => ({
      id: id(),
      templateId: "broadcast-lower-third",
      text,
      startSec, durationSec,
      x: 0.06, y: 0.85, anchor: "middle-left",
      maxWidthPct: 50, align: "left",
      font: "inter", weight: 700, italic: false,
      sizePct: 3.8, letterSpacingEm: -0.01, lineHeight: 1.15, uppercase: false,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 2, blurPct: 6, opacity: 0.3 },
      background: {
        kind: "stripe",
        color: "hsl(220 30% 4% / 0.78)",
        paddingPct: 40,
        radiusPct: 0,
        stripeColor: "hsl(45 95% 60%)",
        stripeWidthPct: 14,
      },
      animation: { kind: "slide-left", inSec: 0.45, outSec: 0.4 },
    }),
  },
  {
    id: "speaker-name-plate",
    name: "Speaker name-plate",
    category: "lower-third",
    icon: Mic2,
    description: "Name + role two-liner with subtle blur background.",
    build: (text, startSec, durationSec = 5) => ({
      id: id(),
      templateId: "speaker-name-plate",
      text,
      startSec, durationSec,
      x: 0.05, y: 0.88, anchor: "bottom-left",
      maxWidthPct: 45, align: "left",
      font: "inter", weight: 600, italic: false,
      sizePct: 3.4, letterSpacingEm: -0.005, lineHeight: 1.3, uppercase: false,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 1, blurPct: 4, opacity: 0.4 },
      background: { kind: "blur", color: "hsl(220 30% 4% / 0.55)", paddingPct: 30, radiusPct: 12 },
      animation: { kind: "fade", inSec: 0.4, outSec: 0.4 },
    }),
  },

  // ───── CAPTIONS / SUBTITLES ─────────────────────────────────────
  {
    id: "subtitle",
    name: "Subtitle / caption",
    category: "caption",
    icon: MessageSquare,
    description: "Centered bottom subtitle with stroke for readability.",
    build: (text, startSec, durationSec = 3) => ({
      id: id(),
      templateId: "subtitle",
      text,
      startSec, durationSec,
      x: 0.5, y: 0.92, anchor: "bottom-center",
      maxWidthPct: 80, align: "center",
      font: "inter", weight: 500, italic: false,
      sizePct: 3.2, letterSpacingEm: 0, lineHeight: 1.2, uppercase: false,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 12 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 2, blurPct: 4, opacity: 0.5 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 0.15, outSec: 0.15 },
    }),
  },

  // ───── QUOTES ──────────────────────────────────────────────────
  {
    id: "pull-quote",
    name: "Pull quote",
    category: "quote",
    icon: QuoteIcon,
    description: "Editorial italic centered quote — leading & trailing marks baked into the layout.",
    build: (text, startSec, durationSec = 5) => ({
      id: id(),
      templateId: "pull-quote",
      text: `“${text}”`,
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 70, align: "center",
      font: "playfair", weight: 400, italic: true,
      sizePct: 6, letterSpacingEm: 0.01, lineHeight: 1.2, uppercase: false,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 4, blurPct: 14, opacity: 0.4 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 0.8, outSec: 0.8 },
    }),
  },

  // ───── STAT / NUMBER CARDS ──────────────────────────────────────
  {
    id: "stat-card",
    name: "Stat card",
    category: "stat",
    icon: Hash,
    description: "Giant headline number — perfect for $-figures, percentages, KPI reveals.",
    build: (text, startSec, durationSec = 3) => ({
      id: id(),
      templateId: "stat-card",
      text,
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 70, align: "center",
      font: "bebas-neue", weight: 700, italic: false,
      sizePct: 22, letterSpacingEm: 0.01, lineHeight: 0.92, uppercase: true,
      fill: { color: "hsl(45 95% 60%)", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(45 95% 50%)", offsetXPct: 0, offsetYPct: 0, blurPct: 30, opacity: 0.45 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "scale", inSec: 0.55, outSec: 0.4 },
    }),
  },

  // ───── BROADCAST / TICKER ───────────────────────────────────────
  {
    id: "breaking-banner",
    name: "Breaking banner",
    category: "broadcast",
    icon: Award,
    description: "High-contrast red ALL-CAPS slab — solid background.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "breaking-banner",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.9, anchor: "bottom-center",
      maxWidthPct: 90, align: "center",
      font: "inter", weight: 800, italic: false,
      sizePct: 3.5, letterSpacingEm: 0.04, lineHeight: 1.1, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 0, blurPct: 4, opacity: 0.3 },
      background: { kind: "solid", color: "hsl(0 85% 50%)", paddingPct: 65, radiusPct: 4 },
      animation: { kind: "slide-up", inSec: 0.3, outSec: 0.3 },
    }),
  },

  // ───── TECH / TERMINAL ──────────────────────────────────────────
  {
    id: "terminal",
    name: "Terminal",
    category: "tech",
    icon: Terminal,
    description: "Green-on-black mono — types out character-by-character.",
    build: (text, startSec, durationSec = 5) => ({
      id: id(),
      templateId: "terminal",
      text: `$ ${text}`,
      startSec, durationSec,
      x: 0.06, y: 0.88, anchor: "bottom-left",
      maxWidthPct: 60, align: "left",
      font: "space-mono", weight: 400, italic: false,
      sizePct: 2.8, letterSpacingEm: 0, lineHeight: 1.3, uppercase: false,
      fill: { color: "hsl(120 70% 65%)", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(120 70% 50%)", offsetXPct: 0, offsetYPct: 0, blurPct: 12, opacity: 0.5 },
      background: { kind: "solid", color: "hsl(220 30% 3% / 0.92)", paddingPct: 50, radiusPct: 8 },
      animation: { kind: "typewriter", inSec: 1.5, outSec: 0.2 },
    }),
  },
  {
    id: "engineering-caption",
    name: "Engineering caption",
    category: "tech",
    icon: Anchor,
    description: "Tiny mono caption — for timecodes, scene labels, technical chyrons.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "engineering-caption",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.05, y: 0.05, anchor: "top-left",
      maxWidthPct: 40, align: "left",
      font: "ibm-plex-mono", weight: 400, italic: false,
      sizePct: 1.6, letterSpacingEm: 0.18, lineHeight: 1.2, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 0.85 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 1, blurPct: 3, opacity: 0.6 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 0.2, outSec: 0.2 },
    }),
  },

  // ───── TIME / DATE ──────────────────────────────────────────────
  {
    id: "timestamp",
    name: "Timestamp",
    category: "tech",
    icon: Clock,
    description: "Top-right timestamp with subtle blur — date + time.",
    build: (text, startSec, durationSec = 99) => ({
      id: id(),
      templateId: "timestamp",
      text,
      startSec, durationSec,
      x: 0.95, y: 0.05, anchor: "top-right",
      maxWidthPct: 25, align: "right",
      font: "ibm-plex-mono", weight: 500, italic: false,
      sizePct: 1.8, letterSpacingEm: 0.06, lineHeight: 1.2, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 0.92 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 1, blurPct: 2, opacity: 0.5 },
      background: { kind: "blur", color: "hsl(220 30% 4% / 0.45)", paddingPct: 35, radiusPct: 8 },
      animation: { kind: "fade", inSec: 0.3, outSec: 0.3 },
    }),
  },

  // ───── EDITORIAL / SECTION DIVIDERS ────────────────────────────
  {
    id: "section-eyebrow",
    name: "Section eyebrow",
    category: "title",
    icon: Layers,
    description: "Small uppercase mono pre-title — pairs with a body headline.",
    build: (text, startSec, durationSec = 3) => ({
      id: id(),
      templateId: "section-eyebrow",
      text: `◆ ${text.toUpperCase()}`,
      startSec, durationSec,
      x: 0.5, y: 0.42, anchor: "middle-center",
      maxWidthPct: 70, align: "center",
      font: "ibm-plex-mono", weight: 500, italic: false,
      sizePct: 1.6, letterSpacingEm: 0.32, lineHeight: 1.2, uppercase: true,
      fill: { color: "hsl(45 95% 60%)", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(45 95% 60%)", offsetXPct: 0, offsetYPct: 0, blurPct: 14, opacity: 0.5 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 0.4, outSec: 0.4 },
    }),
  },

  // ───── CINEMATIC ────────────────────────────────────────────────
  {
    id: "letterbox-title",
    name: "Letterbox title",
    category: "cinematic",
    icon: Camera,
    description: "Director-style title — small, mono, centered in lower letterbox.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "letterbox-title",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.94, anchor: "bottom-center",
      maxWidthPct: 80, align: "center",
      font: "ibm-plex-mono", weight: 400, italic: false,
      sizePct: 1.4, letterSpacingEm: 0.42, lineHeight: 1.2, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 0.95 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 1, blurPct: 2, opacity: 0.4 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 0.6, outSec: 0.6 },
    }),
  },

  // ───── INTERACTIVE / CHANNEL BUG ───────────────────────────────
  {
    id: "channel-bug",
    name: "Channel bug",
    category: "broadcast",
    icon: Sparkles,
    description: "Always-on top-left brand bug — small, subtle, permanent.",
    build: (text, startSec, durationSec = 9999) => ({
      id: id(),
      templateId: "channel-bug",
      text,
      startSec, durationSec,
      x: 0.04, y: 0.05, anchor: "top-left",
      maxWidthPct: 20, align: "left",
      font: "inter", weight: 800, italic: false,
      sizePct: 2.2, letterSpacingEm: 0.08, lineHeight: 1, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 0.85 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 1, blurPct: 3, opacity: 0.6 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "fade", inSec: 0.3, outSec: 0.3 },
    }),
  },

  // ───── BLANK / FREE-FORM ────────────────────────────────────────
  {
    id: "blank",
    name: "Blank text",
    category: "title",
    icon: Type,
    description: "Default text — neutral typography, edit everything from scratch.",
    build: (text, startSec, durationSec = 3) => ({
      id: id(),
      templateId: "blank",
      text: text || "Your text here",
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 70, align: "center",
      font: "inter", weight: 500, italic: false,
      sizePct: 4, letterSpacingEm: 0, lineHeight: 1.2, uppercase: false,
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      shadow: DEFAULT_SHADOW,
      background: DEFAULT_BACKGROUND,
      animation: DEFAULT_ANIMATION,
    }),
  },

  // ───── PRO: GRADIENT / GLOW / KINETIC ─────────────────────────
  // These ten templates are the "highest-quality only" picks — each
  // exercises features no slide-deck tool ships with (multi-stop
  // gradient fills, glow, multi-shadow depth, counter animation,
  // kinetic typography preset). Every one is broadcast-ready.

  {
    id: "neon-aurora",
    name: "Neon aurora",
    category: "cinematic",
    icon: Sparkles,
    description: "Vivid violet→cyan gradient with electric glow — perfect for music + nightlife.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "neon-aurora",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 80, align: "center",
      font: "bebas-neue", weight: 700, italic: false,
      sizePct: 14, letterSpacingEm: 0.04, lineHeight: 0.95, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 1 },
      gradientFill: {
        kind: "linear", angle: 35,
        stops: [
          { at: 0,   color: "hsl(280 95% 70%)" },
          { at: 0.5, color: "hsl(220 100% 70%)" },
          { at: 1,   color: "hsl(180 95% 65%)" },
        ],
      },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(280 95% 60%)", offsetXPct: 0, offsetYPct: 0, blurPct: 25, opacity: 0.6 },
      glow: { color: "hsl(220 100% 70%)", blurPct: 30, intensity: 0.85 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "blur-in", inSec: 0.8, outSec: 0.6 },
    }),
  },

  {
    id: "gold-foil",
    name: "Gold foil",
    category: "cinematic",
    icon: Crown,
    description: "Champagne→bronze gradient with subtle inner shadow — luxury / awards.",
    build: (text, startSec, durationSec = 4.5) => ({
      id: id(),
      templateId: "gold-foil",
      text,
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 75, align: "center",
      font: "dm-serif", weight: 400, italic: true,
      sizePct: 11, letterSpacingEm: 0.02, lineHeight: 1, uppercase: false,
      fill: { color: "#FFE9A8", opacity: 1 },
      gradientFill: {
        kind: "linear", angle: 90,
        stops: [
          { at: 0,    color: "hsl(45 95% 80%)" },
          { at: 0.35, color: "hsl(38 90% 60%)" },
          { at: 0.5,  color: "hsl(35 75% 45%)" },
          { at: 0.65, color: "hsl(38 90% 60%)" },
          { at: 1,    color: "hsl(40 95% 78%)" },
        ],
      },
      stroke: { color: "hsl(28 60% 25%)", widthPct: 1 },
      shadow: { color: "hsl(28 80% 20%)", offsetXPct: 0, offsetYPct: 4, blurPct: 8, opacity: 0.5 },
      innerShadow: { color: "hsl(28 60% 20%)", offsetXPct: 0, offsetYPct: -2, blurPct: 3, opacity: 0.45 },
      glow: { color: "hsl(45 95% 60%)", blurPct: 18, intensity: 0.5 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "shimmer", inSec: 1.2, outSec: 0.8 },
    }),
  },

  {
    id: "kinetic-cold-open",
    name: "Kinetic cold open",
    category: "cinematic",
    icon: Film,
    description: "Tracking-tighten reveal — words start spread, snap into a tight headline.",
    build: (text, startSec, durationSec = 5) => ({
      id: id(),
      templateId: "kinetic-cold-open",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.55, anchor: "middle-center",
      maxWidthPct: 85, align: "center",
      font: "dm-serif", weight: 400, italic: false,
      sizePct: 13, letterSpacingEm: 0.01, lineHeight: 0.95, uppercase: true,
      fill: { color: "hsl(45 25% 92%)", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 8, blurPct: 28, opacity: 0.55 },
      extraShadows: [
        { color: "hsl(45 95% 60%)", offsetXPct: 0, offsetYPct: 0, blurPct: 40, opacity: 0.2 },
      ],
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "tracking-tighten", inSec: 1.4, outSec: 0.6 },
    }),
  },

  {
    id: "counter-revenue",
    name: "Revenue counter",
    category: "stat",
    icon: Hash,
    description: "Counts from $0 to your target — pure motion graphic for KPI reveals.",
    build: (text, startSec, durationSec = 3.5) => ({
      id: id(),
      templateId: "counter-revenue",
      text: "$0",
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 70, align: "center",
      font: "bebas-neue", weight: 700, italic: false,
      sizePct: 24, letterSpacingEm: 0, lineHeight: 0.9, uppercase: true,
      fill: { color: "hsl(140 75% 65%)", opacity: 1 },
      gradientFill: {
        kind: "linear", angle: 180,
        stops: [
          { at: 0, color: "hsl(140 85% 75%)" },
          { at: 1, color: "hsl(140 75% 50%)" },
        ],
      },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(140 85% 40%)", offsetXPct: 0, offsetYPct: 0, blurPct: 30, opacity: 0.55 },
      glow: { color: "hsl(140 95% 65%)", blurPct: 30, intensity: 0.7 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      counter: {
        from: 0,
        to: parseFloat(text.replace(/[^0-9.]/g, "")) || 100000,
        format: "${n}",
        decimals: 0,
        thousands: true,
      },
      autoFit: true,
      animation: { kind: "scale", inSec: 0.4, outSec: 0.3 },
    }),
  },

  {
    id: "counter-percent",
    name: "Percentage counter",
    category: "stat",
    icon: Hash,
    description: "0% → N% reveal with decimal precision.",
    build: (text, startSec, durationSec = 3) => ({
      id: id(),
      templateId: "counter-percent",
      text: "0%",
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 60, align: "center",
      font: "inter", weight: 800, italic: false,
      sizePct: 20, letterSpacingEm: -0.01, lineHeight: 1, uppercase: false,
      fill: { color: "hsl(45 95% 65%)", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(45 95% 50%)", offsetXPct: 0, offsetYPct: 0, blurPct: 28, opacity: 0.5 },
      glow: { color: "hsl(45 95% 65%)", blurPct: 24, intensity: 0.7 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      counter: {
        from: 0,
        to: parseFloat(text.replace(/[^0-9.]/g, "")) || 100,
        format: "{n}%",
        decimals: 1,
        thousands: false,
      },
      animation: { kind: "letter-drop", inSec: 0.6, outSec: 0.3 },
    }),
  },

  {
    id: "split-flap-board",
    name: "Split-flap board",
    category: "tech",
    icon: Terminal,
    description: "Departure-board character flip per letter — analog mechanical feel.",
    build: (text, startSec, durationSec = 4.5) => ({
      id: id(),
      templateId: "split-flap-board",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 80, align: "center",
      font: "ibm-plex-mono", weight: 700, italic: false,
      sizePct: 10, letterSpacingEm: 0.08, lineHeight: 1.1, uppercase: true,
      fill: { color: "hsl(45 95% 85%)", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 3, blurPct: 4, opacity: 0.7 },
      background: {
        kind: "solid",
        color: "hsl(220 30% 6%)",
        paddingPct: 28,
        radiusPct: 4,
      },
      animation: { kind: "split-flap", inSec: 1.4, outSec: 0.4 },
    }),
  },

  {
    id: "stencil-cut",
    name: "Stencil cut",
    category: "cinematic",
    icon: QuoteIcon,
    description: "Letters appear as if cut from metal — stroked + hollowed inner shadow.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "stencil-cut",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 75, align: "center",
      font: "bebas-neue", weight: 700, italic: false,
      sizePct: 16, letterSpacingEm: 0.08, lineHeight: 1, uppercase: true,
      fill: { color: "hsl(0 0% 8%)", opacity: 0.05 },
      stroke: { color: "hsl(0 0% 95%)", widthPct: 4 },
      shadow: { color: "#000000", offsetXPct: 0, offsetYPct: 0, blurPct: 8, opacity: 0.4 },
      innerShadow: { color: "hsl(220 30% 5%)", offsetXPct: 0, offsetYPct: 4, blurPct: 6, opacity: 0.7 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "stencil-cut", inSec: 0.8, outSec: 0.4 },
    }),
  },

  {
    id: "wave-headline",
    name: "Wave headline",
    category: "cinematic",
    icon: Layers,
    description: "Characters ripple in a sine wave — playful, music-video energy.",
    build: (text, startSec, durationSec = 4) => ({
      id: id(),
      templateId: "wave-headline",
      text,
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 80, align: "center",
      font: "fraunces", weight: 700, italic: false,
      sizePct: 10, letterSpacingEm: 0.04, lineHeight: 1, uppercase: false,
      fill: { color: "#FFFFFF", opacity: 1 },
      gradientFill: {
        kind: "linear", angle: 0,
        stops: [
          { at: 0, color: "hsl(340 90% 70%)" },
          { at: 1, color: "hsl(30 95% 65%)" },
        ],
      },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(340 80% 50%)", offsetXPct: 0, offsetYPct: 4, blurPct: 14, opacity: 0.4 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "wave", inSec: 1.0, outSec: 0.6 },
    }),
  },

  {
    id: "elastic-pop",
    name: "Elastic pop",
    category: "broadcast",
    icon: Award,
    description: "Spring-overshoot scale-in — perfect for ads + reveal moments.",
    build: (text, startSec, durationSec = 3.5) => ({
      id: id(),
      templateId: "elastic-pop",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 80, align: "center",
      font: "inter", weight: 900, italic: true,
      sizePct: 12, letterSpacingEm: -0.02, lineHeight: 1, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "hsl(220 30% 4%)", widthPct: 2 },
      shadow: { color: "hsl(0 90% 55%)", offsetXPct: 0, offsetYPct: 8, blurPct: 0, opacity: 1 },
      extraShadows: [
        { color: "hsl(220 30% 2%)", offsetXPct: 0, offsetYPct: 14, blurPct: 0, opacity: 1 },
      ],
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "elastic-pop", inSec: 0.7, outSec: 0.3 },
    }),
  },

  {
    id: "glitch-data",
    name: "Glitch data",
    category: "tech",
    icon: Terminal,
    description: "Chromatic-aberration jitter, settles into clean — cyberpunk title.",
    build: (text, startSec, durationSec = 4.5) => ({
      id: id(),
      templateId: "glitch-data",
      text: text.toUpperCase(),
      startSec, durationSec,
      x: 0.5, y: 0.5, anchor: "middle-center",
      maxWidthPct: 80, align: "center",
      font: "ibm-plex-mono", weight: 700, italic: false,
      sizePct: 8, letterSpacingEm: 0.06, lineHeight: 1, uppercase: true,
      fill: { color: "#FFFFFF", opacity: 1 },
      stroke: { color: "#000000", widthPct: 0 },
      shadow: { color: "hsl(180 95% 55%)", offsetXPct: 3, offsetYPct: 0, blurPct: 0, opacity: 0.85 },
      extraShadows: [
        { color: "hsl(340 95% 55%)", offsetXPct: -3, offsetYPct: 0, blurPct: 0, opacity: 0.85 },
      ],
      glow: { color: "#FFFFFF", blurPct: 14, intensity: 0.4 },
      background: { kind: "none", paddingPct: 0, radiusPct: 0 },
      animation: { kind: "glitch-in", inSec: 0.5, outSec: 0.3 },
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Group templates by category for the picker UI
// ─────────────────────────────────────────────────────────────────────────────
export function groupTemplatesByCategory(): Record<TextTemplateBlueprint["category"], TextTemplateBlueprint[]> {
  const groups: Record<string, TextTemplateBlueprint[]> = {};
  for (const t of TEXT_TEMPLATES) {
    (groups[t.category] ??= []).push(t);
  }
  return groups as Record<TextTemplateBlueprint["category"], TextTemplateBlueprint[]>;
}

export const TEMPLATE_CATEGORY_LABELS: Record<TextTemplateBlueprint["category"], string> = {
  title:        "Titles",
  "lower-third": "Lower thirds",
  caption:      "Captions",
  quote:        "Quotes",
  stat:         "Stats",
  broadcast:    "Broadcast",
  tech:         "Tech / mono",
  cinematic:    "Cinematic",
};

// ─────────────────────────────────────────────────────────────────────────────
// Font CSS mapping — what the live preview renders with. The bake side
// uses the same family names with embedded WOFF2 files in the Deno
// renderer environment.
// ─────────────────────────────────────────────────────────────────────────────
export const FONT_CSS: Record<FontFamily, string> = {
  "fraunces":      "'Fraunces', serif",
  "inter":         "'Inter', system-ui, sans-serif",
  "space-mono":    "'Space Mono', 'Menlo', monospace",
  "playfair":      "'Playfair Display', serif",
  "bebas-neue":    "'Bebas Neue', sans-serif",
  "ibm-plex-mono": "'IBM Plex Mono', monospace",
  "dm-serif":      "'DM Serif Display', serif",
};
