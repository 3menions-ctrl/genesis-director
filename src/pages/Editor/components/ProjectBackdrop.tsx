/**
 * ProjectBackdrop — page-wide ambient layer behind the entire Editor.
 *
 * Same intent as ProfileBackdrop: tie the surface to its subject with
 * a single coherent atmosphere. For the editor the subject is the
 * project itself — its thumbnail (used as a heavily-blurred wash) plus
 * a deterministic hue derived from the project ID + mood.
 *
 * Sits behind everything in the Editor at z-0; the EditorShell content
 * is z-10 above it.
 */
import { useMemo } from "react";

interface Props {
  thumbnailUrl: string | null;
  projectId: string;
  mood: string | null;
}

const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function hashHue(seed: string): { primary: number; secondary: number; tertiary: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const primary = h % 360;
  const secondary = (primary + 60 + ((h >> 8) % 80)) % 360;
  const tertiary = (primary + 180 + ((h >> 16) % 60)) % 360;
  return { primary, secondary, tertiary };
}

export function ProjectBackdrop({ thumbnailUrl, projectId, mood }: Props) {
  // Hue derived from project ID + mood so the same project always has
  // the same atmosphere across sessions, but two projects from the
  // same director still look distinct.
  const hue = useMemo(
    () => hashHue(`${projectId}-${mood ?? ""}`),
    [projectId, mood],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Hue base wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, hsl(${hue.primary} 32% 5%) 0%, hsl(${hue.primary} 24% 4%) 45%, hsl(${hue.secondary} 18% 3%) 80%, hsl(220 28% 2.5%) 100%)`,
          opacity: 0.85,
        }}
      />

      {/* Thumbnail echo — extremely blurred, low opacity. The cover IS
          the project. */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(120px) saturate(1.35) brightness(0.55)",
          }}
        />
      )}

      {/* Top-center accent halo — where the chrome lives */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "-20vh",
          width: "120vw",
          height: "80vh",
          background: `radial-gradient(50% 60% at 50% 50%, hsl(${hue.primary} 70% 50% / 0.16) 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Side ambient blooms */}
      <div
        className="absolute"
        style={{
          top: "30vh",
          left: "-15vw",
          width: "55vw",
          height: "55vh",
          background: `radial-gradient(circle, hsl(${hue.secondary} 70% 50% / 0.12) 0%, transparent 60%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "-10vh",
          right: "-12vw",
          width: "55vw",
          height: "55vh",
          background: `radial-gradient(circle, hsl(${hue.tertiary} 65% 45% / 0.10) 0%, transparent 60%)`,
          filter: "blur(80px)",
        }}
      />

      {/* Grain across everything */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_URL }}
      />
    </div>
  );
}
