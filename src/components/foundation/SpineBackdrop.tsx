/**
 * SpineBackdrop — the single, shared atmospheric layer painted behind
 * every Small Bridges surface. Used by both FoundationShell (spine
 * surfaces) and AppShell (workflow surfaces) so the app feels like one
 * continuous room.
 *
 * Anatomy:
 *   - Deep navy → near-black radial base
 *   - Cool-blue bloom upper-left
 *   - Violet-blue bloom lower-right
 *   - Cyan halo top-right
 *   - Sparse star/dust field
 *   - Soft vignette pulling focus to centre
 *   - Fractal grain to kill banding
 *
 * Fixed-position, full-viewport, z-0 so foreground content sits at z-10+.
 * Renders once and stays — does not repaint on scroll.
 */
export function SpineBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base — deep navy fading to near-black at the bottom. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 110% 80% at 50% 0%, hsl(218 60% 9%) 0%, hsl(220 50% 5%) 35%, hsl(220 40% 2.5%) 75%, hsl(222 50% 1.5%) 100%)",
        }}
      />
      {/* Cool blue bloom — upper-left, soft and large. */}
      <div
        className="absolute h-[55vw] w-[55vw] rounded-full"
        style={{
          top: "-12vw",
          left: "-12vw",
          background:
            "radial-gradient(circle, hsl(212 92% 50% / 0.22) 0%, hsl(212 92% 50% / 0.08) 35%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      {/* Violet-blue bloom — lower-right, deeper hue. */}
      <div
        className="absolute h-[60vw] w-[60vw] rounded-full"
        style={{
          bottom: "-18vw",
          right: "-14vw",
          background:
            "radial-gradient(circle, hsl(236 80% 45% / 0.20) 0%, hsl(236 80% 45% / 0.06) 35%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      {/* Time-of-day halo — top-right, tinted by TimeOfDayAura's hue
          var so the room breathes dawn → day → dusk → night without
          stacking a second aurora layer on top. Default hue mirrors
          the cyan that used to live here statically. */}
      <div
        className="absolute h-[28vw] w-[28vw] rounded-full"
        style={{
          top: "8vh",
          right: "10vw",
          background:
            "radial-gradient(circle, hsla(var(--sb-tod-hue, 195), 95%, 55%, calc(var(--sb-tod-opacity, 0.04) * 2.5)) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      {/* Star/dust field — extremely subtle pinpricks of light. */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 22%, hsl(0 0% 100% / 0.5) 0.5px, transparent 1px), radial-gradient(circle at 68% 41%, hsl(210 100% 90% / 0.45) 0.5px, transparent 1px), radial-gradient(circle at 31% 78%, hsl(0 0% 100% / 0.4) 0.5px, transparent 1px), radial-gradient(circle at 82% 88%, hsl(0 0% 100% / 0.35) 0.5px, transparent 1px), radial-gradient(circle at 50% 50%, hsl(195 100% 85% / 0.4) 0.5px, transparent 1px), radial-gradient(circle at 89% 14%, hsl(0 0% 100% / 0.45) 0.5px, transparent 1px), radial-gradient(circle at 4% 60%, hsl(220 100% 90% / 0.35) 0.5px, transparent 1px)",
          backgroundSize: "100% 100%",
        }}
      />
      {/* Soft vignette — pulls focus to centre, dims edges. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, transparent 0%, transparent 50%, hsl(222 50% 1.5% / 0.55) 100%)",
        }}
      />
      {/* Fractal grain — kills gradient banding, gives the surface texture. */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-[0.22]"
        style={{
          backgroundImage: GRAIN_SVG_URL,
        }}
      />
    </div>
  );
}

// Inline SVG grain — small repeating tile.
const GRAIN_SVG_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
