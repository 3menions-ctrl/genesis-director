import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Play, Sparkles } from 'lucide-react';
import poster1 from '@/assets/hero/hero-poster-1.jpg';
import poster2 from '@/assets/hero/hero-poster-2.jpg';
import poster3 from '@/assets/hero/hero-poster-3.jpg';
import poster4 from '@/assets/hero/hero-poster-4.jpg';
import poster5 from '@/assets/hero/hero-poster-5.jpg';
// Distinct environment plates — avoid reusing the scene previews that
// appear in the EnterStudioEpic frame-chain showcase.
import sceneA from '@/assets/environments/corporate-boardroom.jpg';
import sceneB from '@/assets/environments/golden-hour-studio.jpg';
import sceneC from '@/assets/environments/la-canyon-sunset.jpg';

/**
 * BeforeAfterGallery
 *
 * Editorial split-screen reveal — drag the divider to wipe between the
 * static brief / source image (BEFORE) and the AI-generated film (AFTER).
 * Auto-demos on mount, then becomes interactive on hover / pointer.
 */

const G = {
  beautifulDay:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/gallery/Beautiful_Day_Vibes-final.mp4',
  sunsetDreams:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4',
  snowy:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
  fiery:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
  silentVigil:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
  enchanted:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_0_1770518760774.mp4',
  studioTalk:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1bf24783-e03a-446a-bc65-2eca25644d1d_1768792154784.mp4',
  brandSpot:
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_9174320c-ede9-4d97-96b3-3f4f730622d8_1768476847502.mp4',
};

type Reel = {
  before: string;
  after: string;
  prompt: string;
  title: string;
  tag: string;
};

const REELS: Reel[] = [
  {
    title: 'Saturday, 7:42am',
    tag: 'Lifestyle reel · 11 sec',
    prompt:
      "Maya walks the trail behind her house with a coffee. Golden hour. Wind in her hair. Hold on her face for two beats, then she smiles at the camera.",
    before: poster2,
    after: G.beautifulDay,
  },
  {
    title: 'Campaign cover — Issue 04',
    tag: 'Editorial · 9 sec',
    prompt:
      "Cover shot for the fall issue. Subject against an orange sky just after sunset. Anamorphic lens, a little grain, slow push-in. No movement from her — let the light do the work.",
    before: poster5,
    after: G.sunsetDreams,
  },
  {
    title: 'Q3 update to the team',
    tag: 'Internal comms · 28 sec',
    prompt:
      "Our COO to camera, talking through the Q3 roadmap. Plain backdrop, soft key from camera-left. Read the script verbatim — don't paraphrase, don't add filler.",
    before: sceneA,
    after: G.studioTalk,
  },
  {
    title: 'Welcome screen — onboarding',
    tag: 'Product avatar · 6 sec',
    prompt:
      "Our brand avatar (locked from the bible) waves once, says 'hey — glad you're here.' Same face we used in last month's ad. Don't redesign her.",
    before: sceneB,
    after: G.brandSpot,
  },
  {
    title: 'Opener for the audiobook trailer',
    tag: 'Book trailer · 8 sec',
    prompt:
      "Forest at blue hour. Fireflies. Low fog around the roots. Tracking shot through the underbrush — like the reader is walking in. Hold the last frame so the title card lands.",
    before: poster4,
    after: G.enchanted,
  },
  {
    title: 'For the grief campaign',
    tag: 'Nonprofit spot · 10 sec',
    prompt:
      "One person at the edge of a still lake, before sunrise. Mist on the water. No music in the picture — we'll score it. Slow push-in. Let it breathe.",
    before: poster3,
    after: G.silentVigil,
  },
  {
    title: 'Holiday card to clients',
    tag: 'Seasonal · 7 sec',
    prompt:
      "Same cabin we shot last December. Snow falling, smoke from the chimney. 120fps so it feels quiet. Cold blue grade. Title plate lands at the end: 'Thank you. — The team.'",
    before: poster1,
    after: G.snowy,
  },
  {
    title: 'Launch teaser — :06',
    tag: 'Pre-roll · 6 sec',
    prompt:
      "Car drifts the corner of 6th & Spring at night. Wet asphalt, neon reflections. Handheld, real motion blur, a few sparks off the rear tire. Cut on the apex.",
    before: sceneC,
    after: G.fiery,
  },
];

const AUTO_INTRO_MS = 2400;

const Stage = memo(function Stage({ reel }: { reel: Reel }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState(50); // % from left — BEFORE area = 0..pos, AFTER area = pos..100
  const [dragging, setDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Cinematic intro sweep — wipe right→left then settle to centre
  useEffect(() => {
    if (hasInteracted) return;
    let start: number | null = null;
    let raf = 0;
    const tick = (t: number) => {
      if (start === null) start = t;
      const k = Math.min(1, (t - start) / AUTO_INTRO_MS);
      // ease-out cubic from 88 → 50
      const eased = 1 - Math.pow(1 - k, 3);
      setPos(88 - eased * 38);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasInteracted, reel.after]);

  // Restart video on reel change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [reel.after]);

  const updateFromClient = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(2, Math.min(98, next)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDragging(true);
      setHasInteracted(true);
      updateFromClient(e.clientX);
    },
    [updateFromClient],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      updateFromClient(e.clientX);
    },
    [dragging, updateFromClient],
  );
  const onPointerUp = useCallback(() => setDragging(false), []);

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative w-full aspect-[21/10] md:aspect-[21/9] rounded-[28px] md:rounded-[36px] overflow-hidden cursor-ew-resize select-none touch-none"
      style={{
        border: '1px solid hsla(0,0%,100%,0.10)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.14) inset, 0 80px 180px -50px rgba(0,0,0,0.95), 0 0 140px -40px hsla(212,100%,50%,0.32)',
      }}
    >
      {/* AFTER — the generated film (full layer, always playing) */}
      <video
        ref={videoRef}
        key={reel.after}
        src={reel.after}
        poster={reel.before}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* BEFORE — static brief / source image, clipped to slider */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={reel.before}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'grayscale(0.55) brightness(0.65) contrast(1.05)' }}
          draggable={false}
        />
        {/* desaturate veil */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.65))',
          }}
        />

        {/* Brief panel — only render text past a min reveal so it never overlaps the divider */}
        <div className="absolute inset-0 p-6 md:p-12 flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-full text-[10px] tracking-[0.32em] uppercase text-white/85 bg-white/10 border border-white/15 backdrop-blur-md">
              Before · Brief
            </span>
            <span
              className="text-[10px] tracking-[0.32em] uppercase text-white/45"
              style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
            >
              {reel.tag}
            </span>
          </div>

          <div
            className="max-w-[42ch] transition-opacity duration-300"
            style={{ opacity: pos > 22 ? 1 : 0 }}
          >
            <p
              className="text-white/55 text-[11px] tracking-[0.32em] uppercase mb-3"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Prompt
            </p>
            <p
              className="text-white/95 text-base md:text-xl leading-snug font-light"
              style={{
                fontFamily: "'Fraunces', serif",
                textShadow: '0 2px 24px rgba(0,0,0,0.6)',
              }}
            >
              “{reel.prompt}”
            </p>
          </div>
        </div>
      </div>

      {/* AFTER chrome — sits above video on the right side */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ opacity: pos < 78 ? 1 : 0 }}
      >
        <div className="absolute top-6 md:top-10 right-6 md:right-12 flex items-center gap-2.5">
          <span
            className="text-[10px] tracking-[0.32em] uppercase text-white/55"
            style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
          >
            {reel.title}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] tracking-[0.32em] uppercase text-white bg-[#0A84FF]/85 border border-white/15 shadow-[0_0_24px_hsla(212,100%,55%,0.5)]">
            After · Apex
          </span>
        </div>

        {/* recording dot */}
        <div className="absolute bottom-6 md:bottom-10 right-6 md:right-12 flex items-center gap-2">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"
          />
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/70">
            Native 4K · Audio
          </span>
        </div>
      </div>

      {/* Top + bottom cinematic grade */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 18%, transparent 75%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* DIVIDER */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        {/* glowing rail */}
        <div
          className="absolute inset-y-0 w-px"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            background:
              'linear-gradient(180deg, transparent, hsla(0,0%,100%,0.95) 18%, hsla(212,100%,75%,0.95) 50%, hsla(0,0%,100%,0.95) 82%, transparent)',
            boxShadow:
              '0 0 18px hsla(212,100%,55%,0.55), 0 0 60px hsla(212,100%,55%,0.25)',
          }}
        />
        {/* handle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            transition: dragging ? 'none' : 'transform 200ms ease-out',
            transform: `translate(-50%, -50%) scale(${dragging ? 1.08 : 1})`,
          }}
        >
          <div
            className="relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, hsla(0,0%,100%,0.95), hsla(0,0%,90%,0.78))',
              border: '1px solid hsla(0,0%,100%,0.6)',
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.55), 0 0 32px hsla(212,100%,55%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.9)',
            }}
          >
            <ArrowLeftRight className="w-4 h-4 md:w-5 md:h-5 text-black/80" strokeWidth={2.5} />
          </div>
          {/* Helper hint, fades out on first interaction */}
          {!hasInteracted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap"
            >
              <span className="px-2.5 py-1 rounded-full text-[9px] tracking-[0.32em] uppercase text-white/85 bg-black/60 border border-white/15 backdrop-blur-md">
                Drag to compare
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Edge hairlines */}
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
});

const Thumbs = memo(function Thumbs({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3 md:mb-4 px-1">
        <div className="flex items-center gap-3">
          <span className="w-8 h-px bg-white/20" />
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/45">
            Reel Index
          </span>
        </div>
        <span
          className="text-[10px] tracking-[0.4em] uppercase text-white/35 tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
        >
          {String(active + 1).padStart(2, '0')} / {String(REELS.length).padStart(2, '0')}
        </span>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-2.5 md:gap-3">
        {REELS.map((r, i) => {
          const isActive = i === active;
          return (
            <button
              key={r.after}
              onClick={() => onSelect(i)}
              className="group relative aspect-[16/10] rounded-xl md:rounded-2xl overflow-hidden focus:outline-none"
              style={{
                border: `1px solid ${isActive ? 'hsla(212,100%,65%,0.6)' : 'hsla(0,0%,100%,0.08)'}`,
                boxShadow: isActive
                  ? '0 0 0 1px hsla(212,100%,55%,0.35), 0 18px 50px -20px hsla(212,100%,55%,0.55)'
                  : '0 12px 30px -16px rgba(0,0,0,0.7)',
                transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
              }}
              aria-label={`Switch to ${r.title}`}
            >
              <img
                src={r.before}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                style={{ filter: isActive ? 'none' : 'grayscale(0.4) brightness(0.85)' }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75))',
                }}
              />
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
                <span className="text-[9px] tracking-[0.16em] uppercase text-white/85 truncate">
                  {r.title}
                </span>
                {isActive && (
                  <Play
                    className="w-2.5 h-2.5 text-[#9DCBFF] shrink-0"
                    fill="currentColor"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export const BeforeAfterGallery = memo(function BeforeAfterGallery() {
  const [active, setActive] = useState(0);
  const handleSelect = useCallback((i: number) => setActive(i), []);
  const reel = useMemo(() => REELS[active], [active]);

  // Auto-rotate every 9s if user hasn't taken control
  const lockRef = useRef(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (lockRef.current) return;
      setActive((i) => (i + 1) % REELS.length);
    }, 9000);
    return () => window.clearInterval(id);
  }, []);
  const handleSelectLock = useCallback((i: number) => {
    lockRef.current = true;
    setActive(i);
  }, []);

  return (
    <section className="relative z-10 py-32 md:py-40 px-6 overflow-hidden">
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
          background:
            'radial-gradient(circle, hsla(212,100%,50%,0.18), transparent 60%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-[1400px] mx-auto">
        {/* Editorial header */}
        <div className="grid grid-cols-12 gap-6 mb-12 md:mb-16">
          <div className="col-span-12 md:col-span-7">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8"
            >
              <Sparkles className="w-3 h-3 text-[#9DCBFF]" />
              <p className="text-[10px] font-medium text-white/55 tracking-[0.32em] uppercase">
                Before · After · Vol. 02
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
                Brief in.
              </span>
              <span
                className="block text-6xl md:text-8xl lg:text-[7.5rem] font-light italic mt-2"
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                }}
              >
                <span className="bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent">
                  Film out.
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
              Real briefs from real customers. Drag the divider to see what
              they typed on the left, and the exact clip we returned on the
              right. Nothing trimmed, nothing recut.
            </p>
            <div className="mt-8 flex items-center gap-5 text-[10px] tracking-[0.32em] uppercase text-white/35">
              <span>Drag to compare</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Tap a reel</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Unedited</span>
            </div>
          </motion.div>
        </div>

        {/* Stage */}
        <AnimatePresence mode="wait">
          <motion.div
            key={reel.after}
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 md:mb-10"
          >
            <Stage reel={reel} />
          </motion.div>
        </AnimatePresence>

        {/* Reel index */}
        <Thumbs active={active} onSelect={handleSelectLock} />

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/65"
        >
          <span className="w-12 h-px bg-white/15" />
            <span>Customer projects · Shown as delivered</span>
          <span className="w-12 h-px bg-white/15" />
        </motion.div>
      </div>
    </section>
  );
});

BeforeAfterGallery.displayName = 'BeforeAfterGallery';

export default BeforeAfterGallery;