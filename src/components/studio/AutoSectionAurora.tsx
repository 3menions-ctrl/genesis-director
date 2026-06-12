/**
 * AutoSectionAurora — StudioAurora wrapped so it reads the section theme
 * from the route + the local time-of-day. Pages don't pass a hue; they
 * get the right one for free.
 *
 * Drop-in: `<AutoSectionAurora intensity="subtle" />` anywhere you'd
 * have rendered `<StudioAurora />`. If a page needs to override (e.g.
 * a featured premiere), pass `hue` explicitly — that always wins.
 */
import { useLocation } from "react-router-dom";
import { useMemo } from "react";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { themeForPath, timeOfDayModifier } from "@/lib/sectionTheme";

interface Props {
  // StudioAurora currently accepts `subtle | default`. "vivid" gets
  // normalised to default at the render boundary; the section theme map
  // still uses vivid as a hint that we'll honor once StudioAurora gains
  // a third tier.
  intensity?: "subtle" | "default" | "vivid";
  hue?: number;
  hueAccent?: number;
}

export function AutoSectionAurora({ intensity, hue, hueAccent }: Props) {
  const { pathname } = useLocation();

  const theme = useMemo(() => themeForPath(pathname), [pathname]);
  const tod = useMemo(() => timeOfDayModifier(), []);

  const finalHue = hue ?? (theme.hue + tod.hueShift + 360) % 360;
  const finalAccent = hueAccent ?? (theme.hueAccent + tod.hueShift + 360) % 360;
  const resolvedIntensity = intensity
    ?? (tod.intensityShift === 1 ? "vivid" : tod.intensityShift === -1 ? "subtle" : theme.intensity);
  // Down-cast vivid → default until StudioAurora supports a third tier.
  const auroraIntensity: "subtle" | "default" = resolvedIntensity === "subtle" ? "subtle" : "default";

  return (
    <StudioAurora
      hue={finalHue}
      hueAccent={finalAccent}
      intensity={auroraIntensity}
    />
  );
}
