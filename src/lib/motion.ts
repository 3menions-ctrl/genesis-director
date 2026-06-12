/**
 * Motion config — the single source of truth for framer-motion timings.
 *
 * The audit found 423 inline `transition={{ duration: 0.45, ease: [...] }}`
 * declarations across the codebase, with 19 distinct durations and 8
 * competing easings. This file consolidates them. New code should import
 * `m.fast`, `m.base`, `m.slow`, or one of the named presets below.
 *
 * The CSS-var equivalents live in `src/index.css` under `--ease-*` /
 * `--dur-*`. Keep them aligned with the values here.
 */

import type { Transition, Variants } from "framer-motion";

// ── Easing curves ────────────────────────────────────────────────────
export const ease = {
  // Used for confident, cinematic motion (entrances, large reveals).
  out:     [0.22, 1, 0.36, 1] as [number, number, number, number],
  // Snappy in/out for interactive feedback (hover, press).
  inOut:   [0.65, 0, 0.35, 1] as [number, number, number, number],
  // Soft settle — for things landing into place.
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  // Linear for sweeps / progress bars.
  linear:  [0, 0, 1, 1] as [number, number, number, number],
} as const;

// ── Durations (seconds) ──────────────────────────────────────────────
export const dur = {
  micro: 0.12,   // hover, toggle, tap feedback
  fast:  0.2,    // small UI flips, popovers
  base:  0.32,   // default page-section reveal
  slow:  0.5,    // big hero reveals, premium feel
  langu: 0.8,    // intro splash, long swooshes
} as const;

// ── Reusable transitions ─────────────────────────────────────────────
export const m = {
  // Snappy interactions
  micro: { duration: dur.micro, ease: ease.inOut } satisfies Transition,
  // Default UI motion
  fast:  { duration: dur.fast,  ease: ease.out }   satisfies Transition,
  base:  { duration: dur.base,  ease: ease.out }   satisfies Transition,
  slow:  { duration: dur.slow,  ease: ease.outExpo } satisfies Transition,
  // Cinematic
  langu: { duration: dur.langu, ease: ease.outExpo } satisfies Transition,

  // Common springs (small, medium, soft)
  springSmall:  { type: "spring", stiffness: 600, damping: 35 } satisfies Transition,
  springMedium: { type: "spring", stiffness: 380, damping: 28 } satisfies Transition,
  springSoft:   { type: "spring", stiffness: 200, damping: 22 } satisfies Transition,
} as const;

// ── Variants — drop-in for `<motion.div variants={...} initial animate exit>` ──
export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: m.base },
  exit:    { opacity: 0, transition: m.fast },
};

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: m.base },
  exit:    { opacity: 0, y: -8, transition: m.fast },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: m.base },
  exit:    { opacity: 0, scale: 0.98, transition: m.fast },
};

// Staggered children — pair with `<motion.div variants={staggerParent}>`
// containing children that use `staggerChild`.
export const staggerParent: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerChild: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: m.fast },
};
