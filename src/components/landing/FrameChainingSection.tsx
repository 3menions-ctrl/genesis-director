import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * Frame Chaining — landing-page chapter explaining how Small Bridges stitches
 * 5-second clips into long-form films. Visual: a horizontal reel of
 * film frames slides in one by one, then the reel telescopes outward
 * to show the resulting long-form timeline scaling from 0:05 → 5:00.
 *
 * All motion is GPU-cheap (transform + opacity). No backdrop-filter on
 * scroll-driven layers. Honors prefers-reduced-motion.
 */

const FRAMES = [
  { hue: 212, label: 'CLIP 01' },
  { hue: 198, label: 'CLIP 02' },
  { hue: 222, label: 'CLIP 03' },
  { hue: 188, label: 'CLIP 04' },
  { hue: 232, label: 'CLIP 05' },
  { hue: 178, label: 'CLIP 06' },
] as const;

function FilmFrame({
  index,
  hue,
  label,
  reduceMotion,
}: {
  index: number;
  hue: number;
  label: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -40, scale: 0.92, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-20%' }}
      transition={{
        duration: 0.9,
        delay: reduceMotion ? 0 : 0.12 * index,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative shrink-0"
      style={{ width: 168, height: 100 }}
    >
      {/* film perforations top */}
      <div className="absolute -top-2.5 left-0 right-0 flex justify-between px-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="block w-2 h-1.5 rounded-[1px] bg-white/20" />
        ))}
      </div>
      <div className="absolute -bottom-2.5 left-0 right-0 flex justify-between px-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="block w-2 h-1.5 rounded-[1px] bg-white/20" />
        ))}
      </div>
      <div
        className="relative w-full h-full rounded-md overflow-hidden border border-white/[0.08]"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 80% 16% / 0.95), hsl(${hue + 18} 90% 8% / 0.95))`,
          boxShadow: `0 0 0 1px hsl(${hue} 100% 60% / 0.18) inset, 0 18px 40px -18px hsl(${hue} 100% 50% / 0.4)`,
        }}
      >
        {/* faux scene gradient orb */}
        <div
          className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-70"
          style={{
            background: `radial-gradient(circle at 30% 30%, hsl(${hue} 100% 70% / 0.6), transparent 70%)`,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(212_100%_60%_/0.35),transparent_60%)]" />
        <div className="absolute left-2 bottom-1.5 text-[8.5px] tracking-[0.28em] text-white/70 font-mono">
          {label}
        </div>
        <div className="absolute right-2 top-1.5 text-[8.5px] tracking-[0.28em] text-white/40 font-mono">
          5.0s
        </div>
      </div>

      {/* chain link to next frame (except last) */}
      {index < FRAMES.length - 1 && (
        <motion.div
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{
            duration: 0.55,
            delay: reduceMotion ? 0 : 0.12 * index + 0.55,
            ease: 'easeOut',
          }}
          className="absolute top-1/2 -right-[18px] -translate-y-1/2 origin-left h-px w-[18px] bg-gradient-to-r from-[#0A84FF] to-[#0A84FF]/0"
        >
          <span className="absolute -top-[3px] right-0 w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_10px_2px_hsl(212_100%_52%/0.7)]" />
        </motion.div>
      )}
    </motion.div>
  );
}

export function FrameChainingSection() {
  const reduceMotion = !!useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Telescoping timeline: 5s -> 5:00 driven by scroll position
  const seconds = useTransform(scrollYProgress, [0.15, 0.85], [5, 300]);
  const barWidth = useTransform(scrollYProgress, [0.15, 0.85], ['8%', '100%']);
  const reelShift = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [40, -40]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="frame-chaining-title"
      className="relative isolate overflow-hidden"
    >
      {/* atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(70% 60% at 50% 30%, hsla(212,100%,52%,0.08), transparent 70%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8">
            <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
            <span className="text-[10.5px] font-medium text-white/65 tracking-[0.32em] uppercase">
              Frame Chaining · Long-form
            </span>
          </div>
          <h2
            id="frame-chaining-title"
            className="font-display text-5xl md:text-7xl font-bold text-white tracking-[-0.035em] mb-7 leading-[1.02]"
          >
            Five-second clips,{' '}
            <span
              className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
            >
              chained into films.
            </span>
          </h2>
          <p className="text-white/55 text-lg md:text-xl font-light leading-relaxed mb-16 max-w-2xl mx-auto">
            Small Bridges carries the last frame of every shot forward as the first frame of the next —
            so characters, lighting and motion stay locked while the runtime grows. Build seconds.
            Watch them become minutes.
          </p>
        </motion.div>

        {/* Reel of chained frames */}
        <motion.div
          style={{ x: reelShift }}
          className="relative mx-auto mb-14 overflow-x-hidden"
        >
          <div className="flex items-center gap-[18px] justify-center min-w-max px-6 py-6">
            {FRAMES.map((f, i) => (
              <FilmFrame key={f.label} index={i} hue={f.hue} label={f.label} reduceMotion={reduceMotion} />
            ))}
          </div>
          {/* edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent" />
        </motion.div>

        {/* Telescoping timeline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-3xl mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8"
        >
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[10.5px] font-medium text-white/55 tracking-[0.32em] uppercase font-mono">
              Runtime
            </span>
            <RuntimeDisplay seconds={seconds} reduceMotion={reduceMotion} />
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              style={{ width: barWidth }}
              className="absolute inset-y-0 left-0 rounded-full"
            >
              <div className="h-full w-full rounded-full bg-gradient-to-r from-[#0A84FF] via-[#9DCBFF] to-white shadow-[0_0_24px_4px_hsl(212_100%_52%/0.45)]" />
            </motion.div>
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-mono tracking-[0.24em] text-white/35 uppercase">
            <span>0:05 · single clip</span>
            <span>5:00+ · feature-length</span>
          </div>
        </motion.div>

        {/* Three pillars */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              k: 'Identity locked',
              v: 'Face, wardrobe and palette persist across every cut.',
            },
            {
              k: 'Motion continuity',
              v: 'Camera arcs and subject momentum carry frame-to-frame.',
            },
            {
              k: 'No hard limit',
              v: 'Stack as many 5s clips as you need — minutes, not seconds.',
            },
          ].map((pill, i) => (
            <motion.div
              key={pill.k}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
                <span className="text-[10px] font-medium text-white/55 tracking-[0.28em] uppercase">
                  {pill.k}
                </span>
              </div>
              <p className="text-white/75 text-sm font-light leading-relaxed">{pill.v}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Live-counting runtime display fed by the section's scroll-linked motion value. */
function RuntimeDisplay({
  seconds,
  reduceMotion,
}: {
  seconds: import('framer-motion').MotionValue<number>;
  reduceMotion: boolean;
}) {
  // Subscribe to motion value via a transformed string
  const formatted = useTransform(seconds, (s) => {
    const total = Math.max(5, Math.round(s));
    const m = Math.floor(total / 60);
    const r = total % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  });
  return (
    <motion.span
      className="font-display text-3xl md:text-5xl font-light text-white tabular-nums tracking-tight"
    >
      {reduceMotion ? '5:00' : <motion.span>{formatted}</motion.span>}
    </motion.span>
  );
}

export default FrameChainingSection;