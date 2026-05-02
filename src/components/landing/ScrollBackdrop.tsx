import { memo, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import bg1 from '@/assets/landing/scroll-bg-1.jpg';
import bg2 from '@/assets/landing/scroll-bg-2.jpg';
import bg3 from '@/assets/landing/scroll-bg-3.jpg';
import bg4 from '@/assets/landing/scroll-bg-4.jpg';

const FRAMES = [bg1, bg2, bg3, bg4];

/**
 * Scroll-driven cinematic backdrop.
 * Sits AFTER the gallery and crossfades through 4 premium frames as
 * the user scrolls past it. Each frame also gets a slow Ken-Burns drift
 * + subtle parallax for a high-end editorial feel.
 */
export const ScrollBackdrop = memo(function ScrollBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Parallax + scale for the entire stack
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.06, 1.0, 1.08]);

  // Build crossfade ranges: each frame fades in/out over a 1/N window
  const N = FRAMES.length;
  const window = 1 / N;
  const opacities = FRAMES.map((_, i) => {
    const start = Math.max(0, i * window - window * 0.4);
    const peakA = i * window + window * 0.1;
    const peakB = (i + 1) * window - window * 0.1;
    const end = Math.min(1, (i + 1) * window + window * 0.4);
    return useTransform(
      scrollYProgress,
      [start, peakA, peakB, end],
      i === 0 ? [1, 1, 1, 0] : i === N - 1 ? [0, 1, 1, 1] : [0, 1, 1, 0],
    );
  });

  return (
    <div ref={ref} className="relative w-full" style={{ height: '300vh' }}>
      {/* Pinned cinematic stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <motion.div style={{ y, scale }} className="absolute inset-0">
          {FRAMES.map((src, i) => (
            <motion.div
              key={i}
              style={{ opacity: opacities[i] }}
              className="absolute inset-0"
            >
              <img
                src={src}
                alt=""
                aria-hidden
                loading="lazy"
                width={1920}
                height={1080}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Top + bottom fade for seamless blend with surrounding sections */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #000 0%, transparent 18%, transparent 82%, #000 100%)',
          }}
        />
        {/* Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {/* Film grain hairline */}
        <div className="pointer-events-none absolute inset-x-16 top-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="pointer-events-none absolute inset-x-16 bottom-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Editorial chapter marker */}
        <ChapterMarker progress={scrollYProgress} count={N} />
      </div>
    </div>
  );
});

function ChapterMarker({
  progress,
  count,
}: {
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  count: number;
}) {
  const idx = useTransform(progress, (v) =>
    String(Math.min(count, Math.max(1, Math.ceil(v * count)))).padStart(2, '0'),
  );
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/45 pointer-events-none">
      <span className="w-10 h-px bg-white/20" />
      <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>
        Chapter
      </span>
      <motion.span
        className="tabular-nums text-white/85"
        style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
      >
        {idx}
      </motion.span>
      <span> / {String(count).padStart(2, '0')}</span>
      <span className="w-10 h-px bg-white/20" />
    </div>
  );
}

ScrollBackdrop.displayName = 'ScrollBackdrop';