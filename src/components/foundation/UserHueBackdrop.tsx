/**
 * UserHueBackdrop — the profile page's signature atmosphere as a reusable
 * backdrop: a deterministic per-user hue wash + a soft accent halo + grain.
 * Used so sibling pages (e.g. Music) share the EXACT same gradient identity
 * as the user's profile.
 *
 * Fixed, full-viewport, behind content (z-0).
 */
import { useMemo } from "react";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// Same hash the ProfileDashboard uses so the colour matches exactly.
function hashHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const primary = h % 360;
  const secondary = (primary + 60 + ((h >> 8) % 80)) % 360;
  const tertiary = (primary + 180 + ((h >> 16) % 60)) % 360;
  return { primary, secondary, tertiary };
}

export function UserHueBackdrop({ userId }: { userId: string | null | undefined }) {
  const hue = useMemo(() => hashHue(userId || "small-bridges"), [userId]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Hue-tinted base wash — matches ProfileBackdrop exactly. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, hsl(${hue.primary} 38% 7%) 0%, hsl(${hue.primary} 28% 5%) 38%, hsl(${hue.secondary} 24% 4%) 72%, hsl(220 30% 3%) 100%)`,
          opacity: 0.78,
        }}
      />
      {/* Accent halo. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "48vh",
          width: "140vw",
          height: "90vw",
          background: `radial-gradient(closest-side, hsla(${hue.tertiary},70%,55%,0.16), transparent 70%)`,
          filter: "blur(120px)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(125% 105% at 50% 42%, transparent 55%, rgba(4,5,8,0.7) 100%)" }} />
    </div>
  );
}
