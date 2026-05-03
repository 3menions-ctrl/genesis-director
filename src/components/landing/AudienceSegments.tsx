import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  ImageIcon,
  Wand2,
  Layers,
  Film,
  Mic2,
  Music2,
  ScanFace,
  Activity,
  Sparkles,
} from 'lucide-react';

export interface AudienceSegmentsProps {
  onStart: () => void;
}

/* ─────────────────────────────────────────────────────────────────────
 * Feature Catalog — each is a circular animated "orb"
 * ──────────────────────────────────────────────────────────────────── */
type FeatureId =
  | 't2v' | 'i2v' | 'script' | 'continuity' | 'stitch'
  | 'dialogue' | 'score' | 'facelock' | 'sceneDna' | 'pipeline';

interface Feature {
  id: FeatureId;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  blurb: string;
  hue: number; // base HSL hue for orb tint (we keep blue dominant though)
}

const FEATURES: Feature[] = [
  { id: 't2v',        icon: Type,      eyebrow: 'Generate',  title: 'Text-to-Video',          blurb: 'Type the scene. Get the shot — cinematic, in seconds.', hue: 212 },
  { id: 'i2v',        icon: ImageIcon, eyebrow: 'Animate',   title: 'Image-to-Video',         blurb: 'Drop a still. Direct it into a living, moving frame.',  hue: 200 },
  { id: 'script',     icon: Wand2,     eyebrow: 'Write',     title: 'AI Screenwriter',        blurb: 'Idea to shot-ready screenplay — beats, dialogue, blocking.', hue: 218 },
  { id: 'continuity', icon: Layers,    eyebrow: 'Lock-in',   title: 'Frame-Chained Continuity', blurb: 'Same character, every shot. Zero drift across the cut.', hue: 210 },
  { id: 'stitch',     icon: Film,      eyebrow: 'Long-form', title: 'Cinematic Stitching',    blurb: 'Chain clips into 30s, 60s, multi-minute story arcs.',   hue: 205 },
  { id: 'dialogue',   icon: Mic2,      eyebrow: 'Performance', title: 'Multi-Character Dialogue', blurb: 'Synced lip-sync and director-grade camera switches.',  hue: 215 },
  { id: 'score',      icon: Music2,    eyebrow: 'Sound',     title: 'Native Score & Mix',     blurb: 'Original music with auto dialogue-ducking on export.', hue: 222 },
  { id: 'facelock',   icon: ScanFace,  eyebrow: 'Identity',  title: 'Face-Lock Engine',       blurb: 'Feature-extraction lock keeps faces pristine, every frame.', hue: 208 },
  { id: 'sceneDna',   icon: Sparkles,  eyebrow: 'Vision',    title: 'Scene-DNA Extraction',   blurb: 'Read any image, extend it into a directed sequence.',  hue: 220 },
  { id: 'pipeline',   icon: Activity,  eyebrow: 'Engine',    title: 'Resilient Pipeline',     blurb: 'Watchdog recovery, frame-perfect joins, never lose a render.', hue: 212 },
];

/* ─────────────────────────────────────────────────────────────────────
 * Single circular feature card
 * ──────────────────────────────────────────────────────────────────── */
function CircularCard({ f, focused }: { f: Feature; focused: boolean }) {
  const Icon = f.icon;
  return (
    <motion.div
      className="relative shrink-0 w-[300px] sm:w-[340px] md:w-[380px] aspect-square"
      animate={{
        scale: focused ? 1 : 0.86,
        opacity: focused ? 1 : 0.55,
      }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, hsla(${f.hue},100%,60%,0.0), hsla(${f.hue},100%,62%,0.55), hsla(${f.hue},100%,55%,0.0) 60%, hsla(${f.hue},100%,62%,0.45))`,
          filter: 'blur(22px)',
          opacity: focused ? 0.8 : 0.25,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />

      {/* Card body */}
      <div
        className="absolute inset-2 rounded-full overflow-hidden"
        style={{
          background:
            'radial-gradient(120% 120% at 30% 20%, hsla(220,18%,12%,1) 0%, hsla(220,16%,5%,1) 60%, hsla(220,20%,2%,1) 100%)',
          boxShadow:
            '0 60px 120px -40px rgba(10,132,255,0.45), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px hsla(212,100%,60%,0.18)',
        }}
      >
        {/* Hairline ring */}
        <div className="absolute inset-3 rounded-full border border-white/[0.06]" />
        <div className="absolute inset-6 rounded-full border border-white/[0.04]" />

        {/* Animated film-grain noise */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
          }}
        />

        {/* Orbiting particles */}
        {focused &&
          Array.from({ length: 14 }).map((_, i) => {
            const delay = (i / 14) * 6;
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full"
                style={{
                  background: '#0A84FF',
                  boxShadow: '0 0 10px #0A84FF, 0 0 20px rgba(10,132,255,0.5)',
                }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{
                  x: [Math.cos((i / 14) * Math.PI * 2) * 140, Math.cos((i / 14) * Math.PI * 2 + Math.PI * 2) * 140],
                  y: [Math.sin((i / 14) * Math.PI * 2) * 140, Math.sin((i / 14) * Math.PI * 2 + Math.PI * 2) * 140],
                  opacity: [0, 0.9, 0],
                }}
                transition={{ duration: 6, repeat: Infinity, delay, ease: 'linear' }}
              />
            );
          })}

        {/* Inner spinning hairline ring */}
        <motion.div
          className="absolute inset-10 rounded-full border border-dashed border-white/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />

        {/* Pulsing core glow behind icon */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
          style={{
            background: `radial-gradient(circle, hsla(${f.hue},100%,60%,0.35), transparent 70%)`,
            filter: 'blur(8px)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.04] border border-white/[0.10] backdrop-blur-md">
              <Icon className="w-7 h-7 text-[#0A84FF]" />
            </div>
            <motion.div
              className="absolute -inset-2 rounded-3xl border border-[#0A84FF]/30"
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] tracking-[0.28em] uppercase text-[#0A84FF]/80 mb-2">{f.eyebrow}</p>
          <h3 className="font-display text-[22px] sm:text-[26px] md:text-[28px] font-semibold text-white tracking-[-0.01em] leading-[1.05] mb-3">
            {f.title}
          </h3>
          <p className="text-[12.5px] sm:text-[13.5px] text-white/55 leading-relaxed max-w-[78%]">
            {f.blurb}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Feature carousel — 3 visible, slides right→left continuously
 * ──────────────────────────────────────────────────────────────────── */
export function AudienceSegments({ onStart: _onStart }: AudienceSegmentsProps) {
  void _onStart; // CTA preserved on landing elsewhere
  const [centerIdx, setCenterIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 3.5s
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setCenterIdx((i) => (i + 1) % FEATURES.length);
    }, 3500);
    return () => clearInterval(t);
  }, [paused]);

  // We render a windowed list of [prev, center, next] to keep the DOM tight.
  const wrap = useCallback((i: number) => (i + FEATURES.length) % FEATURES.length, []);
  const visible = [
    FEATURES[wrap(centerIdx - 1)],
    FEATURES[wrap(centerIdx)],
    FEATURES[wrap(centerIdx + 1)],
  ];

  return (
    <section
      id="audiences"
      className="relative py-28 md:py-36 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Atmospheric background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 600px at 50% 0%, hsla(212,100%,50%,0.10), transparent 60%), radial-gradient(700px 500px at 50% 100%, hsla(212,100%,45%,0.06), transparent 60%)',
        }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16 md:mb-24"
        >
          <p className="text-[11px] font-medium tracking-[0.32em] uppercase text-[#0A84FF] mb-4">
            The Studio Engine
          </p>
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.025em] text-white leading-[1.02]">
            Every feature.<br className="md:hidden" /> One cinematic loop.
          </h2>
          <p className="mt-5 text-white/55 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            From a single typed line to a stitched, scored, multi-character cut — Apex-Studio handles the entire pipeline.
          </p>
        </motion.div>

        {/* Carousel viewport */}
        <div className="relative">
          {/* Edge fade masks */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-32 md:w-48 z-20"
            style={{ background: 'linear-gradient(to right, hsl(220,14%,2%) 0%, transparent 100%)' }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-32 md:w-48 z-20"
            style={{ background: 'linear-gradient(to left, hsl(220,14%,2%) 0%, transparent 100%)' }} />

          <div className="flex items-center justify-center gap-6 md:gap-10 min-h-[420px] md:min-h-[480px]">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((f, i) => (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ x: 280, opacity: 0, scale: 0.7 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -280, opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CircularCard f={f} focused={i === 1} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="mt-12 flex items-center justify-center gap-2">
            {FEATURES.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCenterIdx(i)}
                className="group/dot relative h-1.5 transition-all duration-500"
                style={{ width: i === centerIdx ? 32 : 8 }}
                aria-label={`Go to ${f.title}`}
              >
                <span
                  className="absolute inset-0 rounded-full transition-all duration-500"
                  style={{
                    background: i === centerIdx ? '#0A84FF' : 'rgba(255,255,255,0.18)',
                    boxShadow: i === centerIdx ? '0 0 16px rgba(10,132,255,0.65)' : undefined,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AudienceSegments;
