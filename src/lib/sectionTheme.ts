/**
 * Section theme — derives a hue and a tonal accent from the current route.
 *
 * The StudioAurora component accepts a `hue` prop, but the prior audit
 * found only 5 callsites overrode it — most pages rode the default blue
 * so the implicit "section color" system was invisible. This module
 * maps every route family to its color so the implicit system becomes
 * the default. Pages don't need to know their hue; they just call
 * `useSectionTheme()`.
 *
 * The color palette is editorial — borrowed from the original audit's
 * "time-of-day" + "Lobby / Market" intentions. New routes get a
 * sensible default; explicitly map ones with strong identity here.
 */

export interface SectionTheme {
  /** HSL hue 0-360 for the StudioAurora primary color. */
  hue: number;
  /** Secondary accent hue (used for crossfades and gradient stops). */
  hueAccent: number;
  /** Aurora intensity preset. */
  intensity: "subtle" | "default" | "vivid";
  /** Human label for debug / aria. */
  label: string;
}

const DEFAULT_THEME: SectionTheme = {
  hue: 215,
  hueAccent: 250,
  intensity: "default",
  label: "Studio",
};

/**
 * Map keyed by the first non-empty path segment. Order doesn't matter;
 * lookup is O(1). Routes not listed inherit DEFAULT_THEME.
 */
const ROUTE_THEMES: Record<string, SectionTheme> = {
  // ── Watch / social ─────────────────────────────────────────────
  lobby:        { hue: 215, hueAccent: 270, intensity: "default", label: "Lobby" },
  watch:        { hue: 235, hueAccent: 280, intensity: "vivid",   label: "Theater" },
  music:        { hue: 280, hueAccent: 320, intensity: "vivid",   label: "Music" },
  market:       { hue: 38,  hueAccent: 18,  intensity: "default", label: "Market" },
  creators:     { hue: 195, hueAccent: 215, intensity: "subtle",  label: "Creators" },
  world:        { hue: 145, hueAccent: 180, intensity: "default", label: "World" },
  c:            { hue: 195, hueAccent: 215, intensity: "subtle",  label: "Profile" },
  profile:      { hue: 195, hueAccent: 215, intensity: "subtle",  label: "Profile" },

  // ── Create ────────────────────────────────────────────────────
  create:       { hue: 215, hueAccent: 260, intensity: "vivid",   label: "Studio" },
  studio:       { hue: 215, hueAccent: 260, intensity: "vivid",   label: "Studio" },
  director:     { hue: 215, hueAccent: 260, intensity: "vivid",   label: "Director" },
  editor:       { hue: 200, hueAccent: 250, intensity: "default", label: "Editor" },
  templates:    { hue: 25,  hueAccent: 8,   intensity: "default", label: "Templates" },
  production:   { hue: 215, hueAccent: 260, intensity: "vivid",   label: "Production" },
  crossover:    { hue: 305, hueAccent: 340, intensity: "vivid",   label: "Crossover" },

  // ── Library / cast ────────────────────────────────────────────
  projects:     { hue: 200, hueAccent: 240, intensity: "subtle",  label: "Projects" },
  media:        { hue: 200, hueAccent: 240, intensity: "subtle",  label: "Library" },
  avatars:      { hue: 280, hueAccent: 320, intensity: "default", label: "Avatars" },
  mascots:      { hue: 45,  hueAccent: 25,  intensity: "default", label: "Mascots" },
  environments: { hue: 110, hueAccent: 140, intensity: "subtle",  label: "Environments" },

  // ── Account ───────────────────────────────────────────────────
  settings:     { hue: 215, hueAccent: 260, intensity: "subtle",  label: "Settings" },
  credits:      { hue: 45,  hueAccent: 25,  intensity: "default", label: "Credits" },
  notifications:{ hue: 215, hueAccent: 240, intensity: "subtle",  label: "Notifications" },
  messages:     { hue: 195, hueAccent: 220, intensity: "subtle",  label: "Messages" },
  me:           { hue: 195, hueAccent: 215, intensity: "subtle",  label: "Your studio" },
  workspace:    { hue: 215, hueAccent: 240, intensity: "default", label: "Workspace" },

  // ── Public marketing ─────────────────────────────────────────
  "":           { hue: 215, hueAccent: 260, intensity: "vivid",   label: "Small Bridges" },
  pricing:      { hue: 45,  hueAccent: 25,  intensity: "default", label: "Pricing" },
  blog:         { hue: 195, hueAccent: 220, intensity: "subtle",  label: "Blog" },
  help:         { hue: 195, hueAccent: 220, intensity: "subtle",  label: "Help Center" },
  contact:      { hue: 215, hueAccent: 240, intensity: "subtle",  label: "Contact" },
};

/** Pure function: resolve a theme from a pathname. */
export function themeForPath(pathname: string): SectionTheme {
  if (typeof pathname !== "string") return DEFAULT_THEME;
  const head = pathname.split("/").filter(Boolean)[0] ?? "";
  return ROUTE_THEMES[head] ?? DEFAULT_THEME;
}

/**
 * Time-of-day modifier — shifts the hue slightly based on the local
 * hour so the studio "breathes" with the day. Subtle: ±15° max.
 */
export function timeOfDayModifier(date: Date = new Date()): {
  hueShift: number;
  intensityShift: -1 | 0 | 1;
} {
  const h = date.getHours();
  // Dawn (5-8): warmer (-)
  if (h >= 5 && h < 8)  return { hueShift: -15, intensityShift: -1 };
  // Day (8-17): neutral
  if (h >= 8 && h < 17) return { hueShift: 0,   intensityShift: 0 };
  // Dusk (17-20): warm amber (-)
  if (h >= 17 && h < 20) return { hueShift: -10, intensityShift: 0 };
  // Night (20-5): cooler, more vivid
  return { hueShift: 10, intensityShift: 1 };
}
