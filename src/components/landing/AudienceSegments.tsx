import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  eyebrow: string;
  title: string;
  blurb: string;
  hue: number; // base HSL hue for orb tint (we keep blue dominant though)
}

const FEATURES: Feature[] = [
  { id: 't2v',        icon: Type,      eyebrow: 'Generate',    title: 'Text-to-Video',            blurb: 'Describe the shot in plain language. Small Bridges renders it — framing, motion and lighting included.', hue: 212 },
  { id: 'i2v',        icon: ImageIcon, eyebrow: 'Animate',     title: 'Image-to-Video',           blurb: 'Upload a frame. Small Bridges extracts its scene DNA and extends it into directed motion.', hue: 200 },
  { id: 'script',     icon: Wand2,     eyebrow: 'Write',       title: 'AI Screenwriter',          blurb: 'Turn a one-line idea into a shot list with beats, dialogue and camera blocking.', hue: 218 },
  { id: 'continuity', icon: Layers,    eyebrow: 'Lock-in',     title: 'Frame-Chained Continuity', blurb: 'The last frame of each shot becomes the first of the next — characters and lighting persist.', hue: 210 },
  { id: 'stitch',     icon: Film,      eyebrow: 'Long-form',   title: 'Cinematic Stitching',      blurb: 'Chain 5s clips into 30-second, 60-second and multi-minute cuts without seam artifacts.', hue: 205 },
  { id: 'dialogue',   icon: Mic2,      eyebrow: 'Performance', title: 'Multi-Character Dialogue', blurb: 'Two avatars, six-clip arcs, native lip-sync. Cuts and reverse-shots are scheduled, not guessed.', hue: 215 },
  { id: 'score',      icon: Music2,    eyebrow: 'Sound',       title: 'Score & Mix',              blurb: 'MusicGen scores the cut and ducks under dialogue automatically on export.', hue: 222 },
  { id: 'facelock',   icon: ScanFace,  eyebrow: 'Identity',    title: 'Face-Lock Engine',         blurb: 'Feature-extraction holds the same face across every shot — no drift between cuts.', hue: 208 },
  { id: 'sceneDna',   icon: Sparkles,  eyebrow: 'Vision',      title: 'Scene-DNA Extraction',     blurb: 'Read style, palette and composition from a reference image and apply it to every generated shot.', hue: 220 },
  { id: 'pipeline',   icon: Activity,  eyebrow: 'Engine',      title: 'Resilient Pipeline',       blurb: 'Watchdog recovery resumes from the last completed shot — long renders survive timeouts.', hue: 212 },
];

/* ─────────────────────────────────────────────────────────────────────
 * KineticTitle — character-by-character reveal
 * ──────────────────────────────────────────────────────────────────── */
function KineticTitle({ text }: { text: string }) {
  const chars = useMemo(() => Array.from(text), [text]);
  return (
    <h3
      className="font-display font-semibold text-white tracking-[-0.03em] leading-[0.95] text-[44px] sm:text-[60px] md:text-[78px] lg:text-[92px]"
      aria-label={text}
    >
      {chars.map((c, i) => (
        <motion.span
          key={`${text}-${i}`}
          initial={{ y: '110%', opacity: 0, rotateX: -55, filter: 'blur(8px)' }}
          animate={{ y: '0%', opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.18 + i * 0.028, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block whitespace-pre"
          style={{ transformOrigin: '50% 100%' }}
        >
          {c}
        </motion.span>
      ))}
    </h3>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * HoloCore — central animated holographic engine
 * ──────────────────────────────────────────────────────────────────── */
function HoloCore({ feature, parallaxX, parallaxY }: { feature: Feature; parallaxX: any; parallaxY: any }) {
  const Icon = feature.icon;
  const pxScale = useTransform(parallaxX, [-1, 1], [-22, 22]);
  const pyScale = useTransform(parallaxY, [-1, 1], [-22, 22]);
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ x: pxScale, y: pyScale, perspective: 1400 }}
    >
      <div className="relative w-[78%] aspect-square max-w-[640px]">
        {/* deep volumetric glow */}
        <motion.div
          className="absolute inset-[-25%] rounded-full"
          style={{
            background: `radial-gradient(circle, hsla(${feature.hue},100%,60%,0.35), hsla(${feature.hue},100%,55%,0.10) 35%, transparent 65%)`,
            filter: 'blur(60px)',
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* rotating conic aurora */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent, hsla(${feature.hue},100%,68%,0.55), transparent 30%, hsla(212,100%,70%,0.4) 55%, transparent 70%, hsla(${feature.hue},100%,72%,0.5))`,
            filter: 'blur(28px)',
            opacity: 0.9,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        />

        {/* tilted disc rings (3D feel) */}
        {[
          { size: 100, dur: 40, tilt: 62, hue: feature.hue },
          { size: 84,  dur: 30, tilt: 70, hue: 212 },
          { size: 68,  dur: 22, tilt: 55, hue: feature.hue },
        ].map((r, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: `${r.size}%`,
              height: `${r.size}%`,
              marginLeft: `-${r.size / 2}%`,
              marginTop: `-${r.size / 2}%`,
              transformStyle: 'preserve-3d',
              transform: `rotateX(${r.tilt}deg)`,
            }}
          >
            <motion.div
              className="absolute inset-0 rounded-full border"
              style={{
                borderColor: `hsla(${r.hue},100%,72%,0.55)`,
                boxShadow: `0 0 24px hsla(${r.hue},100%,60%,0.55), inset 0 0 30px hsla(${r.hue},100%,65%,0.25)`,
              }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: r.dur, repeat: Infinity, ease: 'linear' }}
            />
            {/* light node traveling on the ring */}
            <motion.div
              className="absolute left-1/2 top-0 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{
                background: '#fff',
                boxShadow: `0 0 14px #fff, 0 0 28px hsl(${r.hue},100%,68%)`,
              }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: r.dur * 0.9, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        ))}

        {/* dense star field */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <radialGradient id={`coreGrad-${feature.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={`hsla(${feature.hue},100%,80%,1)`} />
              <stop offset="40%" stopColor={`hsla(${feature.hue},100%,60%,0.55)`} />
              <stop offset="100%" stopColor={`hsla(${feature.hue},100%,50%,0)`} />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="22" fill={`url(#coreGrad-${feature.id})`} />

          {/* tick marks */}
          {Array.from({ length: 72 }).map((_, i) => {
            const ang = (i / 72) * Math.PI * 2;
            const major = i % 6 === 0;
            const r1 = 49.4;
            const r2 = major ? 46.5 : 48.2;
            return (
              <line
                key={i}
                x1={50 + Math.cos(ang) * r1}
                y1={50 + Math.sin(ang) * r1}
                x2={50 + Math.cos(ang) * r2}
                y2={50 + Math.sin(ang) * r2}
                stroke={major ? `hsla(${feature.hue},100%,80%,0.95)` : 'rgba(255,255,255,0.45)'}
                strokeWidth={major ? 0.35 : 0.15}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* sweeping radar arc */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 6.5, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '50% 50%' }}
          >
            <defs>
              <linearGradient id={`sweep-${feature.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={`hsla(${feature.hue},100%,75%,0)`} />
                <stop offset="100%" stopColor={`hsla(${feature.hue},100%,80%,0.75)`} />
              </linearGradient>
            </defs>
            <path
              d="M 50 50 L 50 4 A 46 46 0 0 1 86.5 24 Z"
              fill={`url(#sweep-${feature.id})`}
              opacity="0.55"
            />
          </motion.g>

          {/* corner brackets */}
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 50 50)`}>
              <path
                d="M 8 4 L 4 4 L 4 8"
                stroke={`hsl(${feature.hue},100%,75%)`}
                strokeWidth="0.5"
                fill="none"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 2px hsl(${feature.hue},100%,65%))` }}
              />
            </g>
          ))}
        </svg>

        {/* center icon disc */}
        <AnimatePresence mode="wait">
          <motion.div
            key={feature.id}
            initial={{ scale: 0.4, opacity: 0, rotateY: 90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0.4, opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 md:w-28 md:h-28 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, hsla(0,0%,100%,0.08), hsla(0,0%,100%,0.02))',
              border: `1px solid hsla(${feature.hue},100%,72%,0.45)`,
              boxShadow: `0 0 40px hsla(${feature.hue},100%,55%,0.7), inset 0 0 24px hsla(${feature.hue},100%,70%,0.25)`,
            }}
          >
            <Icon className="w-10 h-10 md:w-12 md:h-12 text-white" style={{ filter: 'drop-shadow(0 0 10px #0A84FF)' }} />
          </motion.div>
        </AnimatePresence>

        {/* orbiting micro-particles */}
        {Array.from({ length: 14 }).map((_, i) => {
          const radius = 44 + (i % 3) * 4;
          const dur = 14 + (i % 5);
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: 3,
                height: 3,
                marginLeft: -1.5,
                marginTop: -1.5,
                background: '#fff',
                boxShadow: `0 0 8px hsl(${feature.hue},100%,72%), 0 0 16px hsla(${feature.hue},100%,60%,0.6)`,
              }}
              animate={{
                x: Array.from({ length: 60 }).map((_, k) => Math.cos((k / 60) * Math.PI * 2 + i) * radius * 3),
                y: Array.from({ length: 60 }).map((_, k) => Math.sin((k / 60) * Math.PI * 2 + i) * radius * 1.4),
              }}
              transition={{ duration: dur, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Advanced cinematic feature stage
 * ──────────────────────────────────────────────────────────────────── */
export function AudienceSegments({ onStart: _onStart }: AudienceSegmentsProps) {
  void _onStart;
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // mouse parallax
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const sy = useSpring(my, { stiffness: 50, damping: 20 });

  const handleMove = useCallback((e: React.MouseEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    mx.set(x);
    my.set(y);
  }, [mx, my]);

  // auto-advance
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % FEATURES.length), 4200);
    return () => clearInterval(t);
  }, [paused]);

  const active = FEATURES[activeIdx];

  return (
    <section
      id="audiences"
      className="relative py-28 md:py-40 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* aurora wash */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 700px at 50% 0%, hsla(212,100%,50%,0.16), transparent 60%), radial-gradient(800px 600px at 20% 100%, hsla(218,100%,45%,0.10), transparent 60%), radial-gradient(700px 500px at 85% 80%, hsla(205,100%,55%,0.10), transparent 60%)',
        }}
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* fine grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      {/* film grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16 md:mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#0A84FF]/30 bg-[#0A84FF]/[0.06] mb-6 backdrop-blur-xl">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] font-mono tracking-[0.32em] uppercase text-white/70">
              The Studio Engine · Live
            </span>
          </div>
          <h2 className="font-display text-5xl md:text-7xl lg:text-[88px] font-semibold tracking-[-0.03em] text-white leading-[0.98]">
            One prompt.<br className="md:hidden" />{' '}
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, #ffffff 0%, #5BB0FF 40%, #0A84FF 60%, #ffffff 100%)',
                backgroundSize: '200% 100%',
              }}
            >
              <motion.span
                className="inline-block"
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{
                  backgroundImage: 'inherit',
                  backgroundSize: 'inherit',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                The whole pipeline.
              </motion.span>
            </span>
          </h2>
          <p className="mt-6 text-white/55 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Script, generation, character continuity, dialogue, scoring, stitching and export — every step
            lives in one workspace, not ten tabs.
          </p>
        </motion.div>

        {/* MAIN STAGE */}
        <div
          ref={stageRef}
          onMouseMove={handleMove}
          className="relative grid grid-cols-12 gap-6 lg:gap-10 min-h-[640px] md:min-h-[720px]"
        >
          {/* LEFT — feature index rail */}
          <div className="hidden lg:flex col-span-3 flex-col justify-center gap-1 relative z-10">
            <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/75 mb-4 pl-3">
              ◉ Feature Index
            </div>
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const isActive = i === activeIdx;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className="group relative text-left py-2.5 pl-4 pr-3 rounded-xl transition-colors duration-300 hover:bg-white/[0.03]"
                >
                  {isActive && (
                    <motion.span
                      layoutId="rail-active"
                      className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                      style={{ background: '#0A84FF', boxShadow: '0 0 12px #0A84FF' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <Icon
                      className="w-4 h-4 transition-colors"
                      style={{ color: isActive ? '#0A84FF' : 'rgba(255,255,255,0.35)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-medium truncate transition-colors"
                        style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.45)' }}
                      >
                        {f.title}
                      </div>
                      <div className="text-[9px] font-mono tracking-[0.22em] uppercase text-white/25">
                        {String(i + 1).padStart(2, '0')} / {f.eyebrow}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* CENTER — holo core stage */}
          <div className="relative col-span-12 lg:col-span-6 min-h-[420px] md:min-h-[560px]">
            <HoloCore feature={active} parallaxX={sx} parallaxY={sy} />

            {/* corner HUD readouts */}
            <div className="absolute top-3 left-3 text-[9px] font-mono tracking-[0.28em] uppercase text-white/45 z-20">
              <div>CH 0{activeIdx + 1} / {FEATURES.length.toString().padStart(2, '0')}</div>
              <div className="text-[#0A84FF]/80 mt-1">{active.eyebrow.toUpperCase()}</div>
            </div>
            <div className="absolute top-3 right-3 text-[9px] font-mono tracking-[0.28em] uppercase text-white/45 text-right z-20">
              <div className="flex items-center gap-1.5 justify-end">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span>Preview</span>
              </div>
              <div className="mt-1">24 fps</div>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[9px] font-mono tracking-[0.28em] uppercase text-white/75 z-20">
              <span>{active.eyebrow}</span>
              <span className="text-white/65">Small Bridges</span>
              <span>{String(activeIdx + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}</span>
            </div>
          </div>

          {/* RIGHT — kinetic copy panel */}
          <div className="col-span-12 lg:col-span-3 flex flex-col justify-center relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2 mb-5"
                >
                  <span className="w-8 h-px bg-[#0A84FF]" />
                  <span className="text-[10px] font-mono tracking-[0.34em] uppercase text-[#0A84FF]">
                    {active.eyebrow}
                  </span>
                </motion.div>

                <div className="overflow-hidden mb-5" style={{ perspective: 1200 }}>
                  <KineticTitle text={active.title} />
                </div>

                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[15px] md:text-base text-white/65 leading-relaxed max-w-md"
                >
                  {active.blurb}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="mt-8 flex items-center gap-3 text-[10px] font-mono tracking-[0.3em] uppercase text-white/35"
                >
                  <span className="text-[#0A84FF]">●</span>
                  <span>Sig {String(activeIdx + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}</span>
                  <span className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* TIMELINE — bottom progress reel */}
        <div className="mt-16 md:mt-20 relative">
          <div className="flex items-center gap-1.5 md:gap-2">
            {FEATURES.map((f, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className="group relative flex-1 h-8 flex items-end overflow-hidden"
                  aria-label={`Jump to ${f.title}`}
                >
                  <span
                    className="block w-full transition-all duration-500 rounded-sm"
                    style={{
                      height: isActive ? 28 : 6,
                      background: isActive
                        ? 'linear-gradient(180deg, #5BB0FF 0%, #0A84FF 100%)'
                        : 'rgba(255,255,255,0.10)',
                      boxShadow: isActive ? '0 0 18px rgba(10,132,255,0.7)' : undefined,
                    }}
                  />
                  {isActive && !paused && (
                    <motion.span
                      key={`fill-${i}-${activeIdx}`}
                      className="absolute left-0 bottom-0 h-[2px] bg-white"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 4.2, ease: 'linear' }}
                      style={{ boxShadow: '0 0 10px #fff' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-mono tracking-[0.3em] uppercase text-white/35">
            <span>00 · Studio Engine</span>
            <span className="text-[#0A84FF]/80">{paused ? '❚❚ HOLD' : '▶ AUTOPLAY'}</span>
            <span>{String(FEATURES.length).padStart(2, '0')} · Loop</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AudienceSegments;
