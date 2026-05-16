import { memo, useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import bg1 from '@/assets/landing/scroll-bg-1.jpg';
import bg2 from '@/assets/landing/scroll-bg-2.jpg';
import bg3 from '@/assets/landing/scroll-bg-3.jpg';
import bg4 from '@/assets/landing/scroll-bg-4.jpg';

type Chapter = {
  src: string;
  eyebrow: string;
  headline: string;       // first line (Sora bold)
  italic: string;         // second line (Fraunces italic, gradient)
  sub: string;            // descriptive sub-copy
  meta: [string, string, string];
};

const CHAPTERS: Chapter[] = [
  {
    src: bg1,
    eyebrow: 'Chapter I · Day to Night',
    headline: 'One brief.',
    italic: 'Every hour.',
    sub: 'Render the same scene at golden hour, blue hour, and midnight — all locked to your brand, all in a single pass.',
    meta: ['4K HDR', 'Continuity-locked', '90s avg.'],
  },
  {
    src: bg2,
    eyebrow: 'Chapter II · Beyond the Frame',
    headline: 'Worlds that',
    italic: 'never existed.',
    sub: 'From product spots to sci-fi epics, our pipeline composes worlds Hollywood would budget in seven figures — for the price of a coffee.',
    meta: ['Cinematic prompts', 'Native audio', 'Multi-shot'],
  },
  {
    src: bg3,
    eyebrow: 'Chapter III · Cinematic Scale',
    headline: 'A galaxy of',
    italic: 'possibility.',
    sub: 'Limitless aspect ratios, durations, and styles. Generate the hero spot, the social cut, and the keynote loop from one source of truth.',
    meta: ['Any aspect', 'Any length', 'On-brand'],
  },
  {
    src: bg4,
    eyebrow: 'Chapter IV · The New Studio',
    headline: 'Your studio.',
    italic: 'Reimagined.',
    sub: 'No crews, no rentals, no waiting. Just a brief, a brand, and the most powerful generative engine in the room.',
    meta: ['Solo to enterprise', 'Brand-locked', 'Ship today'],
  },
];

const N = CHAPTERS.length;

/**
 * Scroll-driven cinematic backdrop with synchronized marketing copy.
 * 4 chapters crossfade as the user scrolls. Each chapter's text rises, holds,
 * and drifts away in perfect sync with the imagery.
 */
export const ScrollBackdrop = memo(function ScrollBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Parallax + scale for the entire image stack
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.06, 1.0, 1.08]);

  // Per-frame opacity + per-chapter text opacity / y motion
  const win = 1 / N;
  const imageOpacities = CHAPTERS.map((_, i) => {
    const start = Math.max(0, i * win - win * 0.4);
    const peakA = i * win + win * 0.1;
    const peakB = (i + 1) * win - win * 0.1;
    const end = Math.min(1, (i + 1) * win + win * 0.4);
    return useTransform(
      scrollYProgress,
      [start, peakA, peakB, end],
      i === 0 ? [1, 1, 1, 0] : i === N - 1 ? [0, 1, 1, 1] : [0, 1, 1, 0],
    );
  });

  // Text appears slightly later than the image and exits slightly earlier — feels intentional
  const textOpacities = CHAPTERS.map((_, i) => {
    const a = i * win + win * 0.05;
    const b = i * win + win * 0.25;
    const c = (i + 1) * win - win * 0.25;
    const d = (i + 1) * win - win * 0.05;
    return useTransform(scrollYProgress, [a, b, c, d], [0, 1, 1, 0]);
  });

  const textYs = CHAPTERS.map((_, i) => {
    const a = i * win;
    const d = (i + 1) * win;
    return useTransform(scrollYProgress, [a, d], [40, -40]);
  });

  return (
    <div ref={ref} className="relative w-full" style={{ height: '220vh' }}>
      {/* Pinned cinematic stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        {/* Image stack */}
        <motion.div style={{ y, scale }} className="absolute inset-0">
          {CHAPTERS.map((c, i) => (
            <motion.div
              key={i}
              style={{ opacity: imageOpacities[i] }}
              className="absolute inset-0"
            >
              <img
                src={c.src}
                alt=""
                aria-hidden
                loading="lazy"
                width={1920}
                height={1080}
                className="absolute inset-0 w-full h-full object-cover kenburns-slow"
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Generous top/bottom fade so it blends seamlessly into adjacent sections */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.55) 12%, rgba(0,0,0,0.25) 28%, rgba(0,0,0,0.40) 70%, rgba(0,0,0,0.70) 88%, #000 100%)',
          }}
        />
        {/* Cinematic vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.70) 100%)',
          }}
        />
        {/* Blue ambient wash */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 40% at 50% 50%, hsla(212,100%,50%,0.06), transparent 70%)',
          }}
        />

        {/* Drifting ambient orbs for extra motion */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 80, -40, 0], y: [0, -60, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full opacity-50 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, hsla(212,100%,55%,0.22), transparent 60%)',
            filter: 'blur(70px)',
          }}
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -90, 50, 0], y: [0, 50, -30, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -bottom-40 -right-40 w-[720px] h-[720px] rounded-full opacity-40 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, hsla(28,90%,60%,0.18), transparent 60%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Slow scanning light sweep */}
        <motion.div
          aria-hidden
          animate={{ x: ['-30%', '130%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          className="pointer-events-none absolute inset-y-0 w-[40%] opacity-[0.06] mix-blend-screen"
          style={{
            background:
              'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.0) 35%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.0) 65%, transparent 100%)',
            filter: 'blur(2px)',
          }}
        />

        {/* Hairlines */}
        <div className="pointer-events-none absolute inset-x-16 top-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="pointer-events-none absolute inset-x-16 bottom-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ─── Chapter copy ─── */}
        <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
          {CHAPTERS.map((c, i) => (
            <ChapterCopy
              key={i}
              chapter={c}
              opacity={textOpacities[i]}
              y={textYs[i]}
            />
          ))}
        </div>

        {/* Editorial chapter marker */}
        <ChapterMarker progress={scrollYProgress} count={N} />

        {/* Scoped Ken Burns */}
        <style>{`
          @keyframes kb-slow {
            0%   { transform: scale(1.05) translate(0, 0); }
            50%  { transform: scale(1.12) translate(-1.2%, -0.8%); }
            100% { transform: scale(1.05) translate(0, 0); }
          }
          .kenburns-slow { animation: kb-slow 28s ease-in-out infinite; transform-origin: center; }
        `}</style>
      </div>
    </div>
  );
});

function ChapterCopy({
  chapter,
  opacity,
  y,
}: {
  chapter: Chapter;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}) {
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute max-w-4xl text-center"
    >
      {/* Eyebrow */}
      <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-xl mb-7">
        <motion.span
          animate={{ opacity: [1, 0.35, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]"
        />
        <span className="text-[10px] md:text-[11px] tracking-[0.4em] uppercase text-white/75">
          {chapter.eyebrow}
        </span>
      </div>

      {/* Headline */}
      <h2 className="text-white tracking-[-0.04em] leading-[0.92]">
        <span
          className="block text-5xl md:text-7xl lg:text-[5.5rem] font-bold"
          style={{ fontFamily: "'Sora', sans-serif", textShadow: '0 8px 40px rgba(0,0,0,0.7)' }}
        >
          {chapter.headline}
        </span>
        <span
          className="block text-6xl md:text-8xl lg:text-[7rem] font-light italic mt-1"
          style={{
            fontFamily: "'Fraunces', serif",
            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
            textShadow: '0 12px 60px rgba(0,0,0,0.7)',
          }}
        >
          <span className="bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent">
            {chapter.italic}
          </span>
        </span>
      </h2>

      {/* Sub */}
      <p
        className="mt-7 text-white/80 text-base md:text-lg lg:text-xl font-light leading-[1.6] max-w-2xl mx-auto"
        style={{
          fontFamily: "'Instrument Sans', sans-serif",
          textShadow: '0 4px 20px rgba(0,0,0,0.8)',
        }}
      >
        {chapter.sub}
      </p>

      {/* Meta strip */}
      <div className="mt-8 flex items-center justify-center gap-4 text-[10px] tracking-[0.32em] uppercase text-white/55">
        <span>{chapter.meta[0]}</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span>{chapter.meta[1]}</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span>{chapter.meta[2]}</span>
      </div>
    </motion.div>
  );
}

function ChapterMarker({
  progress,
  count,
}: {
  progress: MotionValue<number>;
  count: number;
}) {
  const idx = useTransform(progress, (v) =>
    String(Math.min(count, Math.max(1, Math.ceil(v * count)))).padStart(2, '0'),
  );
  // Animated progress bar
  const barWidth = useTransform(progress, [0, 1], ['0%', '100%']);

  return (
    <>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/55 pointer-events-none">
        <span className="w-10 h-px bg-white/20" />
        <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>
          Chapter
        </span>
        <motion.span
          className="tabular-nums text-white"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
        >
          {idx}
        </motion.span>
        <span> / {String(count).padStart(2, '0')}</span>
        <span className="w-10 h-px bg-white/20" />
      </div>
      {/* Live progress bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[260px] h-px bg-white/10 overflow-hidden pointer-events-none">
        <motion.div className="h-full bg-white/70" style={{ width: barWidth }} />
      </div>
    </>
  );
}

ScrollBackdrop.displayName = 'ScrollBackdrop';
