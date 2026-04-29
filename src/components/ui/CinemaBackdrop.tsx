/**
 * CinemaBackdrop — extracted from CinemaLoader's background stack.
 *
 * Mounts as a fixed, pointer-events-none layer behind app content.
 * Identical 4-layer cinematic background used by the global loading screen:
 *  1. Deep base wash + radial blue undertones
 *  2. Slow-rotating conic aurora sweep
 *  3. Edge vignette
 *  4. Film grain overlay
 *  + top/bottom luminous hairlines
 *
 * Used on all AUTHENTICATED app pages (mounted by AppShell + VideoEditor).
 * NOT used on landing, auth, OTP, onboarding, or marketing pages.
 */

import { memo } from 'react';

interface CinemaBackdropProps {
  /** z-index for the backdrop layer. Defaults to -10 so it sits behind content. */
  zIndex?: number;
}

export const CinemaBackdrop = memo(function CinemaBackdrop({ zIndex = -10 }: CinemaBackdropProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{
        zIndex,
        backgroundColor: 'hsl(220, 14%, 2%)',
      }}
    >
      {/* Layer 1 — Deep base wash with cool blue undertone */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 700px at 50% 38%, hsla(215, 95%, 26%, 0.18), transparent 62%),' +
            'radial-gradient(900px 540px at 100% 110%, hsla(210, 80%, 18%, 0.12), transparent 58%),' +
            'radial-gradient(700px 480px at 0% 100%, hsla(220, 70%, 12%, 0.14), transparent 60%),' +
            'linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
        }}
      />

      {/* Layer 2 — Slow conic aurora sweep */}
      <div
        className="absolute -inset-[20%] opacity-[0.16]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.28) 60deg, transparent 130deg, hsla(210,100%,55%,0.18) 220deg, transparent 300deg, hsla(215,100%,60%,0.22) 360deg)',
          filter: 'blur(80px)',
          animation: 'loaderAurora 50s linear infinite',
        }}
      />

      {/* Layer 3 — Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, hsla(220,30%,1%,0.7) 100%)',
        }}
      />

      {/* Layer 4 — Film grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
        }}
      />

      {/* Top + bottom luminous hairlines */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.5) 50%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.35) 50%, transparent 100%)',
        }}
      />
    </div>
  );
});

export default CinemaBackdrop;