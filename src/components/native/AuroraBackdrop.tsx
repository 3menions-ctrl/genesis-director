/**
 * AuroraBackdrop — the living, borderless canvas the mobile screens float on.
 *
 * Matches the chosen "Aurora" design language: a near-black base with large,
 * soft blue/violet blooms and a vignette. Surfaces above it have NO hairline
 * borders — separation comes from spacing and these blooms, not card edges.
 *
 * Render as the first child of a `relative`/`fixed` screen root; content sits
 * above it with its own stacking.
 */
export function AuroraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at top, hsl(220 14% 6.5%) 0%, hsl(220 16% 2.5%) 60%)' }}
      />
      {/* top blue bloom */}
      <div
        className="absolute -top-1/4 left-1/2 h-[72vmax] w-[72vmax] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(215 100% 52% / 0.26) 0%, transparent 60%)' }}
      />
      {/* lower violet bloom */}
      <div
        className="absolute -bottom-1/4 -right-1/4 h-[62vmax] w-[62vmax] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(265 90% 58% / 0.22) 0%, transparent 65%)' }}
      />
      {/* vignette to settle the edges */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 52%, hsl(220 16% 1%) 100%)' }}
      />
    </div>
  );
}
