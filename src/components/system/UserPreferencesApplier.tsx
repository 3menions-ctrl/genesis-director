/**
 * UserPreferencesApplier — turns the persisted UserPrefs into real,
 * visible behavior:
 *   • theme        → toggles `.dark` / `.light` on `documentElement`
 *                    (and listens to system changes when set to "system")
 *   • compactMode  → adds `data-compact="true"` so CSS can tighten spacing
 *   • showTutorialHints → toggles `data-hints` so onboarding tooltips
 *                    can opt-out via CSS selector
 *   • reducedMotion → adds `data-reduce-motion="true"` so Framer-Motion
 *                    consumers (useReducedMotion) honor the user's pref
 *                    even when the OS doesn't request it
 *   • language     → sets `html lang="…"` and persists for i18n
 *   • timezone     → exposed via the hook for date formatters
 *
 * No UI — just side-effects.
 */
import { useEffect } from "react";
import { useUserPrefs } from "@/contexts/UserPreferencesContext";

export function UserPreferencesApplier() {
  const prefs = useUserPrefs();

  // Theme
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const apply = (mode: "dark" | "light") => {
      root.classList.toggle("dark", mode === "dark");
      root.classList.toggle("light", mode === "light");
      root.style.colorScheme = mode;
    };
    if (prefs.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const listener = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    apply(prefs.theme);
  }, [prefs.theme]);

  // Compact mode
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.compact = prefs.compactMode ? "true" : "false";
  }, [prefs.compactMode]);

  // Tutorial hints
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.hints = prefs.showTutorialHints ? "on" : "off";
  }, [prefs.showTutorialHints]);

  // Reduced motion — defense-in-depth: we set the data-attr so any CSS
  // that watches it can disable transitions, AND we mirror the value
  // into a media query helper class so Framer's useReducedMotion sees
  // the intent even when the OS itself is not requesting it.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (prefs.reducedMotion === "reduce") {
      root.dataset.reduceMotion = "true";
      root.classList.add("reduce-motion");
    } else if (prefs.reducedMotion === "no-preference") {
      root.dataset.reduceMotion = "false";
      root.classList.remove("reduce-motion");
    } else {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      root.dataset.reduceMotion = mq.matches ? "true" : "false";
      root.classList.toggle("reduce-motion", mq.matches);
      const listener = (e: MediaQueryListEvent) => {
        root.dataset.reduceMotion = e.matches ? "true" : "false";
        root.classList.toggle("reduce-motion", e.matches);
      };
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [prefs.reducedMotion]);

  // Language
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = prefs.language ?? "en";
  }, [prefs.language]);

  return null;
}
