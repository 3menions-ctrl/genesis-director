import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import hoppyVideo from '@/assets/landing-hoppy-intro.mp4.asset.json';
import corporateVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import seedanceVideo from '@/assets/seedance-avatar-test.mp4.asset.json';
import avatarWave from '@/assets/landing-avatar-wave-hello.mp4.asset.json';
import poster1 from '@/assets/hero/hero-poster-1.jpg';
import poster2 from '@/assets/hero/hero-poster-2.jpg';
import poster3 from '@/assets/hero/hero-poster-3.jpg';
import poster4 from '@/assets/hero/hero-poster-4.jpg';
import poster5 from '@/assets/hero/hero-poster-5.jpg';

// ── Curated reels (admin gallery) ─────────────────────────────────────────────
const G = {
  beautifulDay: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/gallery/Beautiful_Day_Vibes-final.mp4',
  sunsetDreams: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
  snowy: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
  fiery: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
  silentVigil: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
  enchanted: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_0_1770311441134.mp4',
};

// One curated, ordered playlist — 8 hand-picked reels. No dump.
type Reel = { src: string; poster: string };
const PLAYLIST: Reel[] = [
  { src: corporateVideo.url, poster: poster1 },
  { src: avatarWave.url, poster: poster3 },
  { src: G.beautifulDay, poster: poster2 },
  { src: G.sunsetDreams, poster: poster5 },
  { src: G.enchanted, poster: poster4 },
  { src: hoppyVideo.url, poster: poster4 },
  { src: G.snowy, poster: poster1 },
  { src: G.fiery, poster: poster2 },
];

const ROTATE_MS = 6000;

// ── Premium hero stage with cross-slide transition ───────────────────────────
const HeroStage = memo(function HeroStage({ index }: { index: number }) {
  const reel = PLAYLIST[index];
  const total = PLAYLIST.length;

  return (
    <div
      className="relative col-span-12 aspect-[21/9] md:aspect-[21/8.5] rounded-[28px] md:rounded-[36px] overflow-hidden"
      style={{
        border: '1px solid hsla(0,0%,100%,0.10)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.14) inset, 0 80px 180px -50px rgba(0,0,0,0.95), 0 0 140px -40px hsla(212,100%,50%,0.32)',
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.video
          key={index}
          src={reel.src}
          poster={reel.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          initial={{ opacity: 0, scale: 1.12, x: '6%', filter: 'blur(18px)' }}
          animate={{ opacity: 1, scale: 1.02, x: '0%', filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.06, x: '-6%', filter: 'blur(14px)' }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      {/* Cinematic grade */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 68%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* Top chrome */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 py-5">
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"
          />
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/70">On Reel</span>
        </div>
        <span
          className="text-[10px] tracking-[0.4em] uppercase text-white/55 tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
        >
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      {/* Live progress ticks */}
      <div className="absolute bottom-0 inset-x-0 px-6 md:px-10 pb-6">
        <div className="flex gap-1.5">
          {PLAYLIST.map((_, i) => (
            <div key={i} className="flex-1 h-px bg-white/15 overflow-hidden">
              <motion.div
                key={`${i}-${index}`}
                className="h-full bg-white/85"
                initial={{ width: i < index ? '100%' : '0%' }}
                animate={{ width: i === index ? '100%' : i < index ? '100%' : '0%' }}
                transition={{ duration: i === index ? ROTATE_MS / 1000 : 0, ease: 'linear' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Edge hairlines */}
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
});

// ── Ascending 3-up "next on deck" cards — slide in/out in formation ──────────
const NextOnDeck = memo(function NextOnDeck({ index }: { index: number }) {
  const upcoming = [1, 2, 3].map((o) => PLAYLIST[(index + o) % PLAYLIST.length]);

  // Magnetic hover sheen
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

  return (
    <div className="grid grid-cols-12 gap-3 md:gap-4">
      {/* Section label */}
      <div className="col-span-12 flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="w-8 h-px bg-white/20" />
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/45">On Deck</span>
        </div>
        <span
          className="text-[10px] tracking-[0.4em] uppercase text-white/35"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
        >
          Auto-cycling
        </span>
      </div>

      {upcoming.map((reel, i) => (
        <div
          key={`${index}-${i}`}
          onMouseMove={onMove}
          className="relative col-span-12 md:col-span-4 aspect-[16/10] rounded-[20px] md:rounded-[26px] overflow-hidden group"
          style={{
            border: '1px solid hsla(0,0%,100%,0.08)',
            boxShadow:
              '0 1px 0 hsla(0,0%,100%,0.10) inset, 0 40px 100px -30px rgba(0,0,0,0.9)',
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={reel.src}
              initial={{ opacity: 0, x: 80, scale: 1.06, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, scale: 1.02, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -60, scale: 1.04, filter: 'blur(8px)' }}
              transition={{
                duration: 1.1,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute inset-0"
            >
              <video
                src={reel.src}
                poster={reel.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover scale-[1.04] group-hover:scale-[1.10] transition-transform duration-[1400ms] ease-out"
              />
            </motion.div>
          </AnimatePresence>

          {/* Magnetic sheen */}
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"
            style={{
              background: useTransform([sheenX, sheenY], ([x, y]) =>
                `radial-gradient(360px circle at ${x} ${y}, hsla(0,0%,100%,0.22), transparent 55%)`),
            }}
          />

          {/* Position pip */}
          <div className="pointer-events-none absolute top-3 left-4">
            <span
              className="text-[10px] tracking-[0.4em] uppercase text-white/45 tabular-nums"
              style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
            >
              Up next · {String(i + 1).padStart(2, '0')}
            </span>
          </div>

          {/* Vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
          />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
      ))}
    </div>
  );
});

export const CinematicMosaic = memo(function CinematicMosaic() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const headlineY = useTransform(scrollYProgress, [0, 1], [80, -80]);

  const [active, setActive] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setActive((i) => (i + 1) % PLAYLIST.length);
    }, ROTATE_MS);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, []);

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
          className="grid grid-cols-12 gap-6 mb-14 md:mb-20"
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
              A curated reel of work generated end-to-end on Apex Studio.
              No edits, no retouching — every frame straight from the brief.
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

        {/* ── Hero stage ── */}
        <div className="grid grid-cols-12 gap-3 md:gap-4 mb-6 md:mb-8">
          <HeroStage index={active} />
        </div>

        {/* ── 3-up next-on-deck ── */}
        <NextOnDeck index={active} />

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/30"
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
