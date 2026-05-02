import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
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
  kenBurns?: 'in' | 'out' | 'left' | 'right';
};

const POSTERS = [poster1, poster2, poster3, poster4, poster5];

// ── Featured spotlight reel — auto-rotates every 6s ──────────────────────────
const SPOTLIGHT: { src: string; poster: string }[] = [
  { src: corporateVideo.url, poster: poster1 },
  { src: avatarWave.url, poster: poster3 },
  { src: GALLERY.beautifulDay, poster: poster2 },
  { src: GALLERY.sunsetDreams, poster: poster5 },
  { src: GALLERY.enchanted, poster: poster4 },
];

// ── Marquee strip — endless horizontal scroller ──────────────────────────────
const MARQUEE: { src: string; poster: string }[] = [
  { src: GALLERY.fiery, poster: poster1 },
  { src: GALLERY.chocolate, poster: poster2 },
  { src: GALLERY.silentVigil, poster: poster3 },
  { src: GALLERY.legacy, poster: poster4 },
  { src: GALLERY.zombie, poster: poster5 },
  { src: GALLERY.editing, poster: poster1 },
];

// ── Editorial mosaic — magazine-grade asymmetric layout, NO labels ───────────
const TILES: Tile[] = [
  { src: GALLERY.snowy, poster: poster1, className: 'col-span-12 md:col-span-8 row-span-2 aspect-[16/10]', delay: 0, parallax: -28, kenBurns: 'in' },
  { src: hoppyVideo.url, poster: poster4, className: 'col-span-6 md:col-span-4 aspect-[4/5]', delay: 0.08, parallax: 22, kenBurns: 'left' },
  { src: GALLERY.beautifulDay, poster: poster2, className: 'col-span-6 md:col-span-4 aspect-[4/5]', delay: 0.16, parallax: -16, kenBurns: 'right' },
  { src: seedanceVideo.url, poster: poster3, className: 'col-span-6 md:col-span-3 aspect-square', delay: 0.20, parallax: 14, kenBurns: 'out' },
  { src: GALLERY.sunsetDreams, poster: poster5, className: 'col-span-6 md:col-span-5 aspect-[16/10]', delay: 0.26, parallax: -22, kenBurns: 'in' },
  { src: GALLERY.fiery, poster: poster2, className: 'col-span-6 md:col-span-4 aspect-[3/4]', delay: 0.32, parallax: 20, kenBurns: 'left' },
  { src: seedanceClip.url, poster: poster4, className: 'col-span-6 md:col-span-4 aspect-[9/16]', delay: 0.38, parallax: -24, kenBurns: 'in' },
  { src: GALLERY.chocolate, poster: poster5, className: 'col-span-12 md:col-span-4 aspect-[16/10]', delay: 0.44, parallax: 18, kenBurns: 'right' },
  { src: GALLERY.silentVigil, poster: poster1, className: 'col-span-6 md:col-span-3 aspect-square', delay: 0.50, parallax: -12, kenBurns: 'out' },
  { src: GALLERY.legacy, poster: poster3, className: 'col-span-6 md:col-span-5 aspect-[4/3]', delay: 0.56, parallax: 16, kenBurns: 'in' },
  { src: GALLERY.editing, poster: poster1, className: 'col-span-12 md:col-span-4 aspect-[4/5]', delay: 0.62, parallax: -20, kenBurns: 'left' },
];

const KEN_BURNS: Record<NonNullable<Tile['kenBurns']>, string> = {
  in: 'kenburns-in',
  out: 'kenburns-out',
  left: 'kenburns-left',
  right: 'kenburns-right',
};

// ── Single intelligent video tile ────────────────────────────────────────────
const VideoTile = memo(function VideoTile({ tile, index }: { tile: Tile; index: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [tile.parallax ? -tile.parallax : 0, tile.parallax || 0]);

  // Magnetic cursor sheen
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 120, damping: 18 });
  const sy = useSpring(my, { stiffness: 120, damping: 18 });
  const sheenX = useTransform(sx, (v) => `${v * 100}%`);
  const sheenY = useTransform(sy, (v) => `${v * 100}%`);

  const onMove = useCallback((e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }, [mx, my]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.play().catch(() => undefined); else el.pause(); },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <motion.div
      ref={wrapRef}
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 60, scale: 0.94, filter: 'blur(12px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 1.1, delay: tile.delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.015 }}
      className={`relative group rounded-[20px] md:rounded-[28px] overflow-hidden ${tile.className}`}
      style={{
        border: '1px solid hsla(0,0%,100%,0.08)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.10) inset, 0 40px 100px -30px rgba(0,0,0,0.9), 0 0 80px -30px hsla(212,100%,50%,0.25)',
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
          className={`absolute inset-0 w-full h-full object-cover ${tile.kenBurns ? KEN_BURNS[tile.kenBurns] : ''} group-hover:scale-[1.12] transition-transform duration-[1400ms] ease-out`}
        />
      </motion.div>

      {/* Magnetic cursor sheen */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"
        style={{
          background: useTransform([sheenX, sheenY], ([x, y]) =>
            `radial-gradient(380px circle at ${x} ${y}, hsla(0,0%,100%,0.22), transparent 55%)`),
        }}
      />

      {/* Index marker — Vol. 0X */}
      <div className="pointer-events-none absolute top-3 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <span
          className="text-[10px] tracking-[0.4em] uppercase text-white/55 tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
        >
          № {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Top hairline */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
      />
    </motion.div>
  );
});

// ── Featured spotlight — auto-cycling primary stage ──────────────────────────
const SpotlightStage = memo(function SpotlightStage() {
  const [active, setActive] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setActive((i) => (i + 1) % SPOTLIGHT.length);
    }, 6500);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative col-span-12 aspect-[21/9] md:aspect-[21/8] rounded-[24px] md:rounded-[32px] overflow-hidden"
      style={{
        border: '1px solid hsla(0,0%,100%,0.10)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.12) inset, 0 60px 140px -40px rgba(0,0,0,0.95), 0 0 120px -40px hsla(212,100%,50%,0.30)',
      }}
    >
      <AnimatePresence mode="popLayout">
        <motion.video
          key={active}
          src={SPOTLIGHT[active].src}
          poster={SPOTLIGHT[active].poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1.02 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      {/* Cinematic letterbox + gradient grade */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.65) 100%)',
      }} />

      {/* Top metadata bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 py-5">
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"
          />
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/70">Now Playing</span>
        </div>
        <span
          className="text-[10px] tracking-[0.4em] uppercase text-white/50 tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
        >
          {String(active + 1).padStart(2, '0')} / {String(SPOTLIGHT.length).padStart(2, '0')}
        </span>
      </div>

      {/* Bottom progress bar (per-clip timer) */}
      <div className="absolute bottom-0 inset-x-0 px-6 md:px-10 pb-6">
        <div className="flex gap-1.5">
          {SPOTLIGHT.map((_, i) => (
            <div key={i} className="flex-1 h-px bg-white/15 overflow-hidden">
              <motion.div
                key={`${i}-${active}`}
                className="h-full bg-white/85"
                initial={{ width: i < active ? '100%' : '0%' }}
                animate={{ width: i === active ? '100%' : i < active ? '100%' : '0%' }}
                transition={{ duration: i === active ? 6.5 : 0, ease: 'linear' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Edge hairlines */}
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </motion.div>
  );
});

// ── Endless horizontal marquee strip ─────────────────────────────────────────
const MarqueeStrip = memo(function MarqueeStrip() {
  const items = [...MARQUEE, ...MARQUEE]; // duplicate for seamless loop
  return (
    <div className="relative overflow-hidden py-2" style={{
      maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
    }}>
      <motion.div
        className="flex gap-4"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
      >
        {items.map((m, i) => (
          <div
            key={i}
            className="relative flex-shrink-0 w-[280px] md:w-[360px] aspect-[16/10] rounded-[16px] overflow-hidden"
            style={{
              border: '1px solid hsla(0,0%,100%,0.08)',
              boxShadow: '0 20px 60px -20px rgba(0,0,0,0.85)',
            }}
          >
            <video
              src={m.src}
              poster={m.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover scale-[1.05]"
            />
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
            }} />
          </div>
        ))}
      </motion.div>
    </div>
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

        {/* ── Featured spotlight stage ── */}
        <div className="grid grid-cols-12 gap-3 md:gap-4 mb-6 md:mb-8">
          <SpotlightStage />
        </div>

        {/* ── Endless marquee strip ── */}
        <div className="mb-8 md:mb-12">
          <MarqueeStrip />
        </div>

        {/* ── Editorial mosaic — magazine-grade asymmetry ── */}
        <div className="grid grid-cols-12 gap-3 md:gap-4 auto-rows-[minmax(120px,auto)]">
          {TILES.map((tile, i) => (
            <VideoTile key={i} tile={tile} index={i} />
          ))}
        </div>

        {/* Ken Burns keyframes (scoped via global tag) */}
        <style>{`
          @keyframes kb-in    { 0% { transform: scale(1.04) translate(0,0); } 100% { transform: scale(1.18) translate(-1.5%, -1.5%); } }
          @keyframes kb-out   { 0% { transform: scale(1.18) translate(-1%, -1%); } 100% { transform: scale(1.04) translate(0,0); } }
          @keyframes kb-left  { 0% { transform: scale(1.14) translate(2%, 0); }  100% { transform: scale(1.14) translate(-2%, 0); } }
          @keyframes kb-right { 0% { transform: scale(1.14) translate(-2%, 0); } 100% { transform: scale(1.14) translate(2%, 0); } }
          .kenburns-in    { animation: kb-in    24s ease-in-out infinite alternate; }
          .kenburns-out   { animation: kb-out   24s ease-in-out infinite alternate; }
          .kenburns-left  { animation: kb-left  28s ease-in-out infinite alternate; }
          .kenburns-right { animation: kb-right 28s ease-in-out infinite alternate; }
        `}</style>

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
