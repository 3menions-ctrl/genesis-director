import { memo, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import hoppyVideo from '@/assets/landing-hoppy-intro.mp4.asset.json';
import corporateVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import seedanceVideo from '@/assets/seedance-avatar-test.mp4.asset.json';
import seedanceClip from '@/assets/test-seedance-clip.mp4.asset.json';
import avatarWave from '@/assets/landing-avatar-wave-hello.mp4.asset.json';
import poster1 from '@/assets/hero/hero-poster-1.jpg';
import poster2 from '@/assets/hero/hero-poster-2.jpg';
import poster3 from '@/assets/hero/hero-poster-3.jpg';
import poster4 from '@/assets/hero/hero-poster-4.jpg';
import poster5 from '@/assets/hero/hero-poster-5.jpg';

// Admin gallery — curated cinematic reels (no titles overlay)
const GALLERY = {
  beautifulDay: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/gallery/Beautiful_Day_Vibes-final.mp4',
  sunsetDreams: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
  snowy: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
  chocolate: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
  fiery: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
  editing: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_171d8bf6-2911-4c6a-b715-6ed0e93ff226_1768118838934.mp4',
  silentVigil: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
  legacy: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/6c28668e-2067-4b92-9fac-8f6ba70cb3a8/avatar_6c28668e-2067-4b92-9fac-8f6ba70cb3a8_clip1_lipsync_1770183667726.mp4',
  zombie: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1a2a7b5c-aa1c-4535-894f-ecb28bcc2392/clip_1a2a7b5c-aa1c-4535-894f-ecb28bcc2392_0_1770348144429.mp4',
  enchanted: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_0_1770311441134.mp4',
};

type Tile = {
  src: string;
  poster: string;
  className: string;
  delay: number;
  parallax?: number;
};

// Asymmetric editorial mosaic — varied aspect ratios, NO labels
const TILES: Tile[] = [
  // Row 1
  { src: corporateVideo.url, poster: poster1, className: 'col-span-12 md:col-span-7 row-span-2 aspect-[16/10]', delay: 0, parallax: -30 },
  { src: avatarWave.url, poster: poster3, className: 'col-span-6 md:col-span-5 aspect-[4/5]', delay: 0.08, parallax: 20 },
  // Row 2 (right column under avatar wave)
  { src: GALLERY.beautifulDay, poster: poster2, className: 'col-span-6 md:col-span-5 aspect-[4/3]', delay: 0.16, parallax: -10 },
  // Row 3
  { src: hoppyVideo.url, poster: poster4, className: 'col-span-6 md:col-span-3 aspect-square', delay: 0.24, parallax: 15 },
  { src: GALLERY.sunsetDreams, poster: poster5, className: 'col-span-6 md:col-span-4 aspect-[4/3]', delay: 0.30, parallax: -20 },
  { src: GALLERY.snowy, poster: poster1, className: 'col-span-12 md:col-span-5 aspect-[16/10]', delay: 0.36, parallax: 25 },
  // Row 4
  { src: seedanceVideo.url, poster: poster3, className: 'col-span-6 md:col-span-4 aspect-[3/4]', delay: 0.42, parallax: -15 },
  { src: GALLERY.fiery, poster: poster2, className: 'col-span-6 md:col-span-4 aspect-[3/4]', delay: 0.48, parallax: 20 },
  { src: seedanceClip.url, poster: poster4, className: 'col-span-12 md:col-span-4 aspect-[9/16]', delay: 0.54, parallax: -25 },
  // Row 5
  { src: GALLERY.chocolate, poster: poster5, className: 'col-span-6 md:col-span-5 aspect-[16/10]', delay: 0.60, parallax: 15 },
  { src: GALLERY.editing, poster: poster1, className: 'col-span-6 md:col-span-3 aspect-square', delay: 0.66, parallax: -10 },
  { src: GALLERY.legacy, poster: poster3, className: 'col-span-12 md:col-span-4 aspect-[4/5]', delay: 0.72, parallax: 30 },
];

const VideoTile = memo(function VideoTile({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [tile.parallax ? -tile.parallax : 0, tile.parallax || 0]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <motion.div
      ref={wrapRef}
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 1, delay: tile.delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative group rounded-[18px] md:rounded-[24px] overflow-hidden ${tile.className}`}
      style={{
        border: '1px solid hsla(0,0%,100%,0.08)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.10) inset, 0 30px 80px -25px rgba(0,0,0,0.85), 0 0 60px -25px hsla(212,100%,50%,0.20)',
      }}
    >
      <motion.div style={{ y }} className="absolute inset-0">
        <video
          ref={ref}
          src={tile.src}
          poster={tile.poster}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover scale-[1.08] group-hover:scale-[1.12] transition-transform duration-[1200ms] ease-out"
        />
      </motion.div>
      {/* Subtle hover sheen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            'linear-gradient(135deg, transparent 35%, hsla(0,0%,100%,0.06) 50%, transparent 65%)',
        }}
      />
      {/* Top hairline */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {/* Subtle vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.35) 100%)',
        }}
      />
    </motion.div>
  );
});

export const CinematicMosaic = memo(function CinematicMosaic() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headlineY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const numberOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

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
      <motion.div
        animate={{ x: [0, 60, -40, 0], y: [0, -40, 30, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] opacity-30"
        style={{
          background: 'radial-gradient(circle, hsla(212,100%,50%,0.18), transparent 60%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-[1400px] mx-auto">
        {/* Editorial header */}
        <motion.div
          style={{ y: headlineY }}
          className="grid grid-cols-12 gap-6 mb-16 md:mb-20"
        >
          <div className="col-span-12 md:col-span-7">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8"
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
              className="text-white tracking-[-0.04em] leading-[0.9]"
            >
              <span
                className="block text-5xl md:text-7xl lg:text-[5.5rem] font-bold"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Made in
              </span>
              <span
                className="block text-6xl md:text-8xl lg:text-[7.5rem] font-light italic mt-2"
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
            className="col-span-12 md:col-span-4 md:col-start-9 self-end"
          >
            <p
              className="text-white/55 text-[17px] md:text-lg font-light leading-[1.7] max-w-md"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Hero spots, talent reads, social cuts, product reels — every
              format rendered from a single brief, locked to your brand from
              the first frame.
            </p>
            <div className="mt-8 flex items-center gap-5 text-[10px] tracking-[0.32em] uppercase text-white/35">
              <span>4K HDR</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Native audio</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Brand-locked</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Mosaic grid — clean, no labels */}
        <div className="grid grid-cols-12 gap-3 md:gap-4 auto-rows-[minmax(120px,auto)]">
          {TILES.map((tile, i) => (
            <VideoTile key={i} tile={tile} />
          ))}
        </div>

        {/* Floating frame counter */}
        <motion.div
          style={{ opacity: numberOpacity }}
          className="hidden lg:flex fixed top-1/2 -translate-y-1/2 right-8 z-20 flex-col items-end gap-1 pointer-events-none"
        >
          <span className="text-[9px] tracking-[0.4em] uppercase text-white/30">Reel</span>
          <span
            className="text-2xl font-light text-white/40 tabular-nums leading-none"
            style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
          >
            {String(TILES.length).padStart(2, '0')}
          </span>
        </motion.div>

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/30"
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
