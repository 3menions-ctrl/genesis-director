/**
 * Small Bridges — Design System tokens.
 *
 * Single source of truth for motion, glass, glow, and type primitives
 * used across the foundation. Import named constants from here instead
 * of re-declaring shadow/easing strings inline. If a value should be
 * tweaked app-wide, this is the file that gets touched.
 *
 * Live CSS variables (--accent, --foreground, etc.) are owned by
 * src/index.css. This file references them by name where needed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Motion — easings + durations
// ─────────────────────────────────────────────────────────────────────────────
/** The primary cinematic curve — used for entrance + state transitions. */
export const EASE_PREMIUM: readonly [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];
/** Faster snap for micro-interactions (button press, focus). */
export const EASE_SNAP: readonly [number, number, number, number] = [
  0.4, 0, 0.2, 1,
];
/** Slow exhale for hero scenes, big reveals. */
export const EASE_EXHALE: readonly [number, number, number, number] = [
  0.16, 1, 0.3, 1,
];

export const DURATION = {
  /** Hover / focus / tiny shifts. */
  instant: 0.15,
  /** Button / chip / toggle. */
  quick: 0.25,
  /** Page entrance, modal open. */
  normal: 0.45,
  /** Big reveal, hero entrance. */
  scene: 0.85,
  /** Cinematic crossings. */
  story: 1.6,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Glass — backdrop-blur scale + canvas/composer surface tokens
// ─────────────────────────────────────────────────────────────────────────────
export const GLASS = {
  /** Subtle frosting, used for inline chips. */
  sm: "backdrop-blur-md",
  /** Cards and small overlays. */
  md: "backdrop-blur-xl",
  /** Composer cards / drawer panels. */
  lg: "backdrop-blur-2xl",
  /** Full-page hero canvases. */
  xl: "backdrop-blur-[40px]",
} as const;

/** Tinted glass body — gradient card fade, used by EditorialCanvas. */
export const CANVAS_FILL =
  "bg-gradient-to-b from-card/50 via-card/20 to-card/5";

/** Lighter glass body — used by composer cards inside a canvas. */
export const COMPOSER_FILL =
  "bg-gradient-to-b from-background/60 to-background/20";

// ─────────────────────────────────────────────────────────────────────────────
// Shadows — multi-layer glows used across the design language
// ─────────────────────────────────────────────────────────────────────────────
/** EditorialCanvas shadow: drop + accent blue glow + inner top hairline. */
export const SHADOW_CANVAS =
  "shadow-[0_80px_200px_-50px_hsl(0_0%_0%/0.7),0_30px_80px_-30px_hsl(215_100%_50%/0.18),inset_0_1px_0_0_hsl(var(--foreground)/0.06)]";

/** Composer card shadow at rest. */
export const SHADOW_COMPOSER_REST =
  "shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05),0_30px_80px_-40px_hsl(0_0%_0%/0.6)]";

/** Composer card shadow when focused — accent ring lights up. */
export const SHADOW_COMPOSER_FOCUS =
  "shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05),0_0_0_1px_hsl(var(--accent)/0.25),0_40px_120px_-30px_hsl(var(--accent)/0.35)]";

/** Lift shadow for card hover (Library grid, etc.) */
export const SHADOW_LIFT =
  "shadow-[0_8px_24px_-8px_hsl(0_0%_0%/0.5),0_24px_60px_-30px_hsl(215_100%_50%/0.25)]";

// ─────────────────────────────────────────────────────────────────────────────
// Hairlines + corners — editorial accent treatments
// ─────────────────────────────────────────────────────────────────────────────
/** Inner luminous 1px ring used by canvases and composer cards. */
export const RING_INNER =
  "ring-1 ring-inset ring-[hsl(var(--foreground)/0.04)]";

/** Top-only hairline accent — useful for divider rows. */
export const HAIRLINE_TOP = "border-t border-border/30";
export const HAIRLINE_BOTTOM = "border-b border-border/30";

// ─────────────────────────────────────────────────────────────────────────────
// Grain — the SVG fractalNoise overlay
// ─────────────────────────────────────────────────────────────────────────────
export const GRAIN_SVG_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")";

// ─────────────────────────────────────────────────────────────────────────────
// Typography — semantic ramp (Tailwind-friendly class strings)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Display headline — large serif italic in the EditorialHeadline primitive.
 * Use only one per page (usually inside an EditorialCanvas).
 */
export const TYPE_DISPLAY = {
  md: "text-[28px] md:text-[40px] xl:text-[48px]",
  lg: "text-[34px] md:text-[52px] xl:text-[60px]",
  xl: "text-[42px] md:text-[64px] xl:text-[76px]",
} as const;

/** Editorial mono eyebrow — "STEP 01 · BRIEF" style. */
export const TYPE_EYEBROW =
  "font-mono text-[10px] uppercase tracking-[0.32em]";

/** Editorial mono tag — slightly smaller and tighter, used in chrome. */
export const TYPE_META =
  "font-mono text-[9px] uppercase tracking-[0.36em]";

/** Body paragraph inside editorial canvases. */
export const TYPE_BODY = "font-light text-[14px] leading-relaxed";

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — the rhythm the foundation uses
// ─────────────────────────────────────────────────────────────────────────────
export const CANVAS_PAD = "px-6 py-8 md:px-12 md:py-12 xl:px-16 xl:py-14";
export const SECTION_GAP = "mt-10";
export const COMPOSER_PAD = "p-6";

// ─────────────────────────────────────────────────────────────────────────────
// Radii — large editorial corners
// ─────────────────────────────────────────────────────────────────────────────
export const RADIUS = {
  canvas: "rounded-[28px]",
  composer: "rounded-[20px]",
  chip: "rounded-full",
  control: "rounded-xl",
} as const;
