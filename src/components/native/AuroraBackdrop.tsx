/**
 * AuroraBackdrop — the living, borderless canvas the mobile screens float on.
 *
 * Premium "Aurora" language: a near-black base with large, slowly drifting
 * blue / violet / cyan blooms, a vignette, and a fine film-grain texture that
 * gives the whole app a cinematic, expensive feel. Surfaces above it carry no
 * hairline borders — separation comes from spacing, these blooms, and a soft
 * lit top edge on each surface (see the `lit-surface` utility in index.css).
 *
 * Render as the first child of a `relative`/`fixed` screen root.
 */

// Fine fractal-noise grain, inlined so it costs no request and tiles seamlessly.
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Standalone film-grain layer for surfaces that aren't on the Aurora backdrop
 *  (e.g. over the video feed). Decorative, non-interactive. */
export function GrainOverlay({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 mix-blend-soft-light"
      style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px', opacity }}
    />
  );
}

export function AuroraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at top, hsl(222 16% 7%) 0%, hsl(224 18% 2.5%) 62%)' }}
      />
      {/* top blue→cyan bloom (drifts) */}
      <div
        className="absolute -top-1/4 left-1/2 h-[78vmax] w-[78vmax] -translate-x-1/2 rounded-full blur-3xl will-change-transform animate-[aurora-drift_22s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, hsl(212 100% 55% / 0.28) 0%, hsl(190 100% 55% / 0.10) 38%, transparent 62%)' }}
      />
      {/* lower violet bloom (counter-drifts) */}
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[66vmax] w-[66vmax] rounded-full blur-3xl will-change-transform animate-[aurora-drift2_26s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, hsl(268 92% 60% / 0.24) 0%, transparent 66%)' }}
      />
      {/* faint warm kicker, far left, for color depth */}
      <div
        className="absolute top-1/3 -left-1/4 h-[40vmax] w-[40vmax] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(330 90% 62% / 0.10) 0%, transparent 64%)' }}
      />
      {/* vignette to settle the edges */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, hsl(224 20% 1%) 100%)' }}
      />
      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
      />
    </div>
  );
}
