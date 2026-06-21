/**
 * StudioAurora — the cinematic backdrop that lives behind every Small Bridges page.
 *
 * Extracted from the Create page so every consumer surface (Lobby, Watch,
 * Market, Music, Search…) carries the same visual signature: deep
 * radial base, slow-rotating conic aurora sweep, primary blue glow, cool
 * cyan counter-glow, edge vignette, film grain.
 *
 * Fixed-position, -z-10, GPU-light, motion-friendly (60s loop). Use as a
 * sibling at the top of any page that needs the Small Bridges stage.
 */
import { memo } from "react";

interface Props {
  /** Optional override accent hue (0-360). Default = brand blue (215). */
  hue?: number;
  /** Optional secondary hue used for counter-glow / conic mid-tone. */
  hueAccent?: number;
  /** Strength of the aurora — `subtle` for content-heavy pages,
   *  `default` matches the Create page exactly. */
  intensity?: "subtle" | "default";
}

export const StudioAurora = memo(function StudioAurora({
  hue = 215,
  hueAccent = 190,
  intensity = "default",
}: Props) {
  const auroraOpacity = intensity === "subtle" ? 0.12 : 0.18;
  const primaryOpacity = intensity === "subtle" ? 0.22 : 0.35;
  const counterOpacity = intensity === "subtle" ? 0.15 : 0.25;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Deep base — same as Create page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(220_14%_6%)_0%,hsl(220_14%_2%)_60%)]" />

      {/* Conic aurora sweep — Small Bridges signature */}
      <style>{`
        @keyframes studioAurora { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes studioTick { 0%,100%{opacity:.35} 50%{opacity:1} }
      `}</style>
      <div
        className="absolute -inset-[20%]"
        style={{
          opacity: auroraOpacity,
          background:
            `conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(${hue},100%,60%,0.32) 60deg, transparent 130deg, hsla(${hue - 5},100%,55%,0.2) 220deg, transparent 300deg, hsla(${hue},100%,60%,0.26) 360deg)`,
          filter: "blur(80px)",
          animation: "studioAurora 60s linear infinite",
        }}
      />
      {/* Primary aurora */}
      <div
        className="absolute -top-1/3 left-1/2 h-[60vmax] w-[60vmax] -translate-x-1/2 rounded-full blur-3xl animate-[pulse_12s_ease-in-out_infinite]"
        style={{
          opacity: primaryOpacity,
          background: `radial-gradient(circle, hsl(${hue + (intensity === "subtle" ? 0 : -3)} 100% 50% / 0.55) 0%, transparent 60%)`,
        }}
      />
      {/* Cool counter-glow */}
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[55vmax] w-[55vmax] rounded-full blur-3xl"
        style={{
          opacity: counterOpacity,
          background: `radial-gradient(circle, hsl(${hueAccent} 100% 55% / 0.35) 0%, transparent 65%)`,
        }}
      />
      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, hsl(220 14% 1%) 100%)" }}
      />
      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Top hairline highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
});

export default StudioAurora;
