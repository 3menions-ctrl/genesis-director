import { memo, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import hoppyVideo from '@/assets/landing-hoppy-intro.mp4.asset.json';
import corporateVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import seedanceVideo from '@/assets/seedance-avatar-test.mp4.asset.json';
import seedanceClip from '@/assets/test-seedance-clip.mp4.asset.json';
import poster1 from '@/assets/hero/hero-poster-1.jpg';
import poster3 from '@/assets/hero/hero-poster-3.jpg';
import poster5 from '@/assets/hero/hero-poster-5.jpg';

type Tile = {
  src: string;
  poster: string;
  label: string;
  meta: string;
  className: string;
  delay: number;
};

const TILES: Tile[] = [
  {
    src: corporateVideo.url,
    poster: poster1,
    label: 'Brand Spot',
    meta: '00:32 · 4K · Auto-graded',
    className: 'col-span-12 md:col-span-7 row-span-2 aspect-[16/10]',
    delay: 0,
  },
  {
    src: hoppyVideo.url,
    poster: poster3,
    label: 'Hero Talent',
    meta: 'Lip-sync · Native audio',
    className: 'col-span-12 md:col-span-5 aspect-[4/5] md:aspect-[3/4]',
    delay: 0.1,
  },
  {
    src: seedanceVideo.url,
    poster: poster5,
    label: 'Motion Study',
    meta: 'Kling V3 · Cinematic',
    className: 'col-span-6 md:col-span-3 aspect-square',
    delay: 0.2,
  },
  {
    src: seedanceClip.url,
    poster: poster3,
    label: 'Variant',
    meta: '9:16 · Social cut',
    className: 'col-span-6 md:col-span-2 aspect-[9/16]',
    delay: 0.3,
  },
];

const VideoTile = memo(function VideoTile({ tile, index }: { tile: Tile; index: number }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay: tile.delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.015, transition: { duration: 0.4 } }}
      className={`relative group rounded-[20px] md:rounded-[28px] overflow-hidden ${tile.className}`}
      style={{
        border: '1px solid hsla(0,0%,100%,0.08)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.10) inset, 0 40px 100px -30px rgba(0,0,0,0.85), 0 0 80px -30px hsla(212,100%,50%,0.25)',
      }}
    >
      <video
        ref={ref}
        src={tile.src}
        poster={tile.poster}
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* gradient veil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
      {/* hover sheen */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, transparent 30%, hsla(0,0%,100%,0.08) 50%, transparent 70%)',
        }}
      />
      {/* top hairline */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* glass label */}
      <div className="absolute left-4 bottom-4 right-4 flex items-end justify-between gap-3">
        <div className="px-3 py-2 rounded-xl bg-black/45 backdrop-blur-2xl border border-white/[0.08]">
          <p className="text-[9px] tracking-[0.32em] uppercase text-white/45 leading-none mb-1">
            {String(index + 1).padStart(2, '0')} · Reel
          </p>
          <p className="text-[13px] font-medium text-white tracking-tight leading-none">
            {tile.label}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/45 backdrop-blur-2xl border border-white/[0.08]">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9.5px] font-mono tracking-wider text-white/55">
            {tile.meta}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

export const CinematicMosaic = memo(function CinematicMosaic() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headlineY = useTransform(scrollYProgress, [0, 1], [80, -80]);

  return (
    <section ref={sectionRef} className="relative z-10 py-32 md:py-40 px-6 overflow-hidden">
      {/* Ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 50%, hsla(212,100%,50%,0.07), transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] opacity-40"
        style={{
          background: 'radial-gradient(circle, hsla(212,100%,50%,0.18), transparent 60%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Editorial header */}
        <motion.div
          style={{ y: headlineY }}
          className="grid grid-cols-12 gap-6 mb-16 md:mb-20"
        >
          <div className="col-span-12 md:col-span-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-6"
            >
              <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
              <p className="text-[10px] font-medium text-white/55 tracking-[0.32em] uppercase">
                The Reel · Vol. 01
              </p>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-white tracking-[-0.035em] leading-[0.92]"
            >
              <span
                className="block text-5xl md:text-7xl font-bold"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Made in
              </span>
              <span
                className="block text-6xl md:text-8xl font-light italic mt-1"
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                }}
              >
                <span className="bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent">
                  minutes.
                </span>
              </span>
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="col-span-12 md:col-span-6 md:col-start-7 self-end"
          >
            <p className="text-white/50 text-[17px] md:text-lg font-light leading-[1.7] max-w-md">
              Hero spots, talent reads, social cuts — every format rendered
              from a single brief, locked to your brand from the first frame.
            </p>
            <div className="mt-6 flex items-center gap-6 text-[10.5px] tracking-[0.28em] uppercase text-white/35">
              <span>4K HDR</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Native audio</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Brand-locked</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Mosaic grid */}
        <div className="grid grid-cols-12 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)]">
          {TILES.map((tile, i) => (
            <VideoTile key={i} tile={tile} index={i} />
          ))}
        </div>

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/30"
        >
          <span className="w-12 h-px bg-white/15" />
          <span>Generated by Apex Studio · Unedited</span>
          <span className="w-12 h-px bg-white/15" />
        </motion.div>
      </div>
    </section>
  );
});

CinematicMosaic.displayName = 'CinematicMosaic';
