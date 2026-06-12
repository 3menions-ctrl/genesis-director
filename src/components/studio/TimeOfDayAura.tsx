/**
 * TimeOfDayAura — publishes the active time-of-day hue + intensity to
 * the documentElement so SpineBackdrop's halo (and any other surface
 * that reads --sb-tod-hue / --sb-tod-opacity / [data-tod]) can shift
 * dawn → day → dusk → night without stacking a second aurora layer.
 *
 * Previously this component painted its own fixed-overlay aurora; now
 * SpineBackdrop carries the visible breath, and this component is the
 * pure clock that drives the CSS vars. Keeping the data attributes
 * lets section themes and other consumers reason about the time of day
 * without recomputing it.
 */
import { useEffect } from "react";
import { timeOfDayModifier } from "@/lib/sectionTheme";

interface ToD {
  hue: number;
  opacity: number;
  label: "dawn" | "day" | "dusk" | "night";
}

function todFromHour(hour: number): ToD {
  if (hour >= 5 && hour < 8)   return { hue: 28,  opacity: 0.10, label: "dawn" };
  if (hour >= 8 && hour < 17)  return { hue: 200, opacity: 0.04, label: "day" };
  if (hour >= 17 && hour < 20) return { hue: 18,  opacity: 0.10, label: "dusk" };
  return { hue: 240, opacity: 0.16, label: "night" };
}

export function TimeOfDayAura() {
  useEffect(() => {
    const apply = () => {
      const now = new Date();
      const tod = todFromHour(now.getHours());
      const mod = timeOfDayModifier(now);
      const root = document.documentElement;
      root.style.setProperty("--sb-tod-hue", String(tod.hue));
      root.style.setProperty("--sb-tod-opacity", String(tod.opacity));
      root.dataset.tod = tod.label;
      root.dataset.todIntensity = String(mod.intensityShift);
    };
    apply();
    const id = setInterval(apply, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
