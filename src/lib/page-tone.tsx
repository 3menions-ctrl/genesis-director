/**
 * Page tone — a tiny color-palette signal that lets each page declare
 * its own 3-hue tonal identity so the LeftRail (and any other chrome)
 * can adapt and feel like it belongs to the surface it's overlaid on.
 *
 * IMPORTANT — no React state.
 *   Earlier iterations stored the tone in a useState/Context and got
 *   themselves into trouble: every `usePageTone` call on every route
 *   change kicked the provider into re-rendering the whole app tree,
 *   which re-mounted the LeftRail's AnimatePresence subtree mid-click
 *   and ate navigations. This file deliberately keeps the tone OUT of
 *   React state. The CSS variables on :root are the source of truth.
 *   Consumers (LeftRail, headers) read those variables via
 *   `color-mix(in oklab, var(--page-tone-primary), …)` — no re-renders
 *   needed when the tone changes, just a CSS transition.
 *
 * Usage from a page:
 *
 *   import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";
 *
 *   function MyPage() {
 *     usePageTone(TONE_PRESETS.templates);
 *     return ...
 *   }
 */
import { useEffect, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// The tone shape
// ─────────────────────────────────────────────────────────────────────────────
export interface PageTone {
  primary: string;
  secondary: string;
  accent: string;
  label?: string;
}

export const DEFAULT_PAGE_TONE: PageTone = {
  primary:   "hsl(220 60% 9%)",
  secondary: "hsl(212 92% 50%)",
  accent:    "hsl(195 95% 55%)",
  label:     "default",
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider — pass-through. Kept as a component so callsites don't break
// if we ever NEED to add real state, but for now it does nothing.
// ─────────────────────────────────────────────────────────────────────────────
export function PageToneProvider({ children }: { children: ReactNode }) {
  // Set the default tone once on mount so consumers always have a value.
  useEffect(() => {
    applyToneToRoot(DEFAULT_PAGE_TONE);
  }, []);
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal — write the tone to the document root.
// ─────────────────────────────────────────────────────────────────────────────
function applyToneToRoot(tone: PageTone) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--page-tone-primary",   tone.primary);
  root.style.setProperty("--page-tone-secondary", tone.secondary);
  root.style.setProperty("--page-tone-accent",    tone.accent);
  if (tone.label) root.style.setProperty("--page-tone-label", `"${tone.label}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// usePageTone — sets the tone on mount, restores default on unmount.
// Triggers ZERO React re-renders. The :root CSS variables update,
// CSS transitions handle the visual crossfade.
// ─────────────────────────────────────────────────────────────────────────────
export function usePageTone(tone: PageTone | null | undefined) {
  // Stable string fingerprint so the effect only re-runs when the tone
  // actually changes (lets callers pass inline objects freely).
  const fingerprint = tone
    ? `${tone.primary}|${tone.secondary}|${tone.accent}|${tone.label ?? ""}`
    : "";

  useEffect(() => {
    applyToneToRoot(tone ?? DEFAULT_PAGE_TONE);
    return () => {
      applyToneToRoot(DEFAULT_PAGE_TONE);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useCurrentPageTone — reads back the live tone from the DOM. Rarely
// needed; most consumers should read the CSS variables directly.
// ─────────────────────────────────────────────────────────────────────────────
export function useCurrentPageTone(): PageTone {
  if (typeof document === "undefined") return DEFAULT_PAGE_TONE;
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return {
    primary:   style.getPropertyValue("--page-tone-primary").trim()   || DEFAULT_PAGE_TONE.primary,
    secondary: style.getPropertyValue("--page-tone-secondary").trim() || DEFAULT_PAGE_TONE.secondary,
    accent:    style.getPropertyValue("--page-tone-accent").trim()    || DEFAULT_PAGE_TONE.accent,
    label:     style.getPropertyValue("--page-tone-label").trim().replace(/^"|"$/g, ""),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset tones — used by each major page so we keep palettes consistent
// ─────────────────────────────────────────────────────────────────────────────
export const TONE_PRESETS = {
  templates: {
    label: "templates",
    primary:   "hsl(38 75% 14%)",
    secondary: "hsl(45 95% 60%)",
    accent:    "hsl(28 80% 55%)",
  } satisfies PageTone,

  environments: {
    label: "environments",
    primary:   "hsl(195 70% 9%)",
    secondary: "hsl(48 90% 70%)",
    accent:    "hsl(28 85% 70%)",
  } satisfies PageTone,

  crossover: {
    label: "crossover",
    primary:   "hsl(280 55% 12%)",
    secondary: "hsl(330 85% 65%)",
    accent:    "hsl(195 90% 60%)",
  } satisfies PageTone,

  training: {
    label: "training",
    primary:   "hsl(220 45% 12%)",
    secondary: "hsl(48 95% 68%)",
    accent:    "hsl(160 70% 65%)",
  } satisfies PageTone,

  lobby: {
    label: "lobby",
    primary:   "hsl(225 60% 10%)",
    secondary: "hsl(215 100% 65%)",
    accent:    "hsl(195 95% 55%)",
  } satisfies PageTone,

  studio: {
    label: "studio",
    primary:   "hsl(220 50% 8%)",
    secondary: "hsl(195 85% 60%)",
    accent:    "hsl(280 70% 65%)",
  } satisfies PageTone,

  editor: {
    label: "editor",
    primary:   "hsl(220 30% 5%)",
    secondary: "hsl(195 80% 60%)",
    accent:    "hsl(48 90% 65%)",
  } satisfies PageTone,
} as const;

/**
 * Build a PageTone from a user's deterministic hue (matches the
 * ProfileDashboard's `useUserHue` shape).
 */
export function pageToneFromUserHue(hue: { primary: number; secondary: number; tertiary: number }, userId: string): PageTone {
  return {
    label:     `user:${userId.slice(0, 6)}`,
    primary:   `hsl(${hue.primary} 60% 10%)`,
    secondary: `hsl(${hue.secondary} 70% 60%)`,
    accent:    `hsl(${hue.tertiary} 80% 65%)`,
  };
}
