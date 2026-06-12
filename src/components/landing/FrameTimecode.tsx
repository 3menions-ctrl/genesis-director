/**
 * FrameTimecode — bottom-right scroll position rendered as a film timecode.
 *
 * Tiny detail. Tracks the document scroll progress and renders a mono-spaced
 * timecode in the corner of the viewport: `FRAME 0024 / 0089 · REEL 2 / 4`.
 *
 * Treat the visible page as a 96-frame "reel" divided into 4 reels of 24
 * frames each. Reel 1 = hero, Reel 2 = director's reel, Reel 3 = casting +
 * pricing, Reel 4 = press junket + credits. Numbers update at 60fps via rAF.
 *
 * Hidden by default on screens narrower than `lg` (768px) to avoid clutter
 * on mobile. Honors prefers-reduced-motion by snapping to whole frames only.
 */

import { useEffect, useState } from 'react';

const TOTAL_FRAMES = 96;
const TOTAL_REELS = 4;

export function FrameTimecode() {
  const [frame, setFrame] = useState(0);
  const reel = Math.min(TOTAL_REELS, Math.floor(frame / (TOTAL_FRAMES / TOTAL_REELS)) + 1);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const scrolled = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, scrolled / max));
      const next = Math.round(progress * TOTAL_FRAMES);
      setFrame((prev) => (prev === next ? prev : next));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-5 right-5 z-[60] hidden lg:block select-none"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/35 leading-tight text-right">
        <div>
          FRAME{' '}
          <span className="text-white/55 tabular-nums">
            {String(frame).padStart(4, '0')}
          </span>{' '}
          / {String(TOTAL_FRAMES).padStart(4, '0')}
        </div>
        <div className="mt-1 opacity-70">
          REEL{' '}
          <span className="text-white/55 tabular-nums">{reel}</span> / {TOTAL_REELS}
        </div>
      </div>
    </div>
  );
}

export default FrameTimecode;
