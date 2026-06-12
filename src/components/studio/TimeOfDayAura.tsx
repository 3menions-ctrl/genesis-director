/**
 * TimeOfDayAura — a thin atmospheric overlay that shifts brightness +
 * tint with the local time. Mounted globally below all UI; combines
 * with AutoSectionAurora to give every page a coherent "the studio
 * breathes with the day" feel.
 *
 * Pure CSS, no JS render loop. The hue + lightness vars are written to
 * the documentElement so any other CSS surface can read them via
 * `var(--sb-tod-tint)`.
 */
import { useEffect } from "react";
import { timeOfDayModifier } from "@/lib/sectionTheme";

interface ToD {
  /** 0-360 hue used by the aura overlay. */
  hue: number;
  /** Soft overlay opacity 0..1. */
  opacity: number;
  /** Label for debug — also written to the data attribute. */
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
    // Re-evaluate every 5 minutes so a long-open tab tracks the
    // transition through dawn/day/dusk/night.
    const id = setInterval(apply, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-20"
      style={{
        background:
          "radial-gradient(120vmax 80vmax at 80% 0%, "
          + "hsla(var(--sb-tod-hue), 100%, 55%, calc(var(--sb-tod-opacity, 0.05) * 1.4)) 0%, "
          + "transparent 60%)",
        mixBlendMode: "screen",
      }}
    />
  );
}
