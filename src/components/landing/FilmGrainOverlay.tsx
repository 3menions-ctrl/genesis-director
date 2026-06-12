/**
 * FilmGrainOverlay — full-viewport animated grain.
 *
 * The single subtle texture that makes the entire landing page read as
 * "film" instead of "web". Sits at z-[55] above the immersive video
 * background but below the navigation chrome. Pointer-events disabled so
 * it never intercepts clicks.
 *
 * Renders an inline SVG noise tile then animates a tiny translate jitter
 * via the `app-grain` keyframes that already live in `src/index.css`.
 * Opacity is intentionally low (4%) — the user shouldn't *see* it; the
 * page just feels textured.
 */

import { memo } from 'react';

const GRAIN_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.2 0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" opacity="0.55"/>
</svg>`)}`;

export const FilmGrainOverlay = memo(function FilmGrainOverlay() {
  return (
    <div
      aria-hidden
      className="film-grain pointer-events-none fixed inset-0 z-[55] mix-blend-overlay"
      style={{
        backgroundImage: `url("${GRAIN_SVG}")`,
        backgroundSize: '220px 220px',
        opacity: 0.07,
        animation: 'app-grain 1.4s steps(3) infinite',
      }}
    />
  );
});

export default FilmGrainOverlay;
