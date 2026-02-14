import { memo, forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: '#fbbf24', stat: '99.2%', statLabel: 'Consistency' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', color: '#38bdf8', stat: '42', statLabel: 'Combos' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every cut', color: '#34d399', stat: '0ms', statLabel: 'Visual gap' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics & continuity errors', color: '#a78bfa', stat: '14', statLabel: 'Checks' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts remove AI artifacts & extra limbs', color: '#fb7185', stat: '25', statLabel: 'Filters' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', color: '#22d3ee', stat: '3s', statLabel: 'To timeline' },
  { icon: Music, title: 'Audio Intelligence', desc: '50+ AI voices, cinematic scoring & dialogue ducking', color: '#e879f9', stat: '50+', statLabel: 'Voices' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated — best model per shot', color: '#facc15', stat: '2+', statLabel: 'AI models' },
] as const;

const AUTO_CYCLE_MS = 4500;

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    const [activeLayer, setActiveLayer] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [direction, setDirection] = useState(1); // 1 = forward (right-to-left entry), -1 = backward
    const cycleRef = useRef<ReturnType<typeof setInterval>>();
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (isPaused) return;
      cycleRef.current = setInterval(() => {
        setDirection(1);
        setActiveLayer(prev => (prev + 1) % LAYERS.length);
      }, AUTO_CYCLE_MS);
      return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
    }, [isPaused]);

    const goTo = useCallback((index: number) => {
      setDirection(index > activeLayer ? 1 : -1);
      setActiveLayer(index);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), AUTO_CYCLE_MS * 2);
    }, [activeLayer]);

    const goNext = useCallback(() => {
      setDirection(1);
      setActiveLayer(prev => (prev + 1) % LAYERS.length);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), AUTO_CYCLE_MS * 2);
    }, []);

    const goPrev = useCallback(() => {
      setDirection(-1);
      setActiveLayer(prev => (prev - 1 + LAYERS.length) % LAYERS.length);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), AUTO_CYCLE_MS * 2);
    }, []);

    const layer = LAYERS[activeLayer];
    const Icon = layer.icon;

    const slideVariants = {
      enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0, scale: 0.8 }),
      center: { x: 0, opacity: 1, scale: 1 },
      exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0, scale: 0.8 }),
    };

    return (
      <section ref={(el) => {
        (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} id="features" className="relative z-10 py-24 md:py-32 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto relative">
          {/* Ambient glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[180px] opacity-20 pointer-events-none transition-all duration-1000"
            style={{ background: `radial-gradient(circle, ${layer.color}25, transparent 70%)` }}
          />

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16 md:mb-20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/50 tracking-wide uppercase">Production Pipeline</span>
            </motion.div>

            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-5">
              <span className="block">8 layers of</span>
              <span className="block bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                intelligence
              </span>
            </h2>
            <p className="text-base md:text-lg text-white/30 max-w-lg mx-auto leading-relaxed">
              Between your idea and the final frame — every shot passes through our cinematic AI stack.
            </p>
          </motion.div>

          {/* Gallery — single card at a time */}
          <div className="relative flex flex-col items-center">
            {/* Main circle card */}
            <div className="relative w-[260px] h-[260px] md:w-[320px] md:h-[320px] flex items-center justify-center">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeLayer}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {/* Outer rotating ring */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 320">
                    <defs>
                      <linearGradient id={`ring-grad-${activeLayer}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={layer.color} stopOpacity="0.6" />
                        <stop offset="50%" stopColor={layer.color} stopOpacity="0.1" />
                        <stop offset="100%" stopColor={layer.color} stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="160" cy="160" r="155"
                      fill="none"
                      stroke={`url(#ring-grad-${activeLayer})`}
                      strokeWidth="1.5"
                      strokeDasharray="12 8"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 160 160"
                        to="360 160 160"
                        dur="20s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </svg>

                  {/* The circle card itself */}
                  <div
                    className="relative w-[220px] h-[220px] md:w-[280px] md:h-[280px] rounded-full border-2 flex flex-col items-center justify-center gap-4 backdrop-blur-sm"
                    style={{
                      borderColor: `${layer.color}40`,
                      background: `radial-gradient(circle at 40% 35%, ${layer.color}12, ${layer.color}04 60%, transparent 80%)`,
                      boxShadow: `0 0 60px ${layer.color}15, inset 0 0 40px ${layer.color}06, 0 0 120px ${layer.color}08`,
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-16 h-16 md:w-20 md:h-20 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: `${layer.color}30`,
                        background: `${layer.color}10`,
                        boxShadow: `0 0 30px ${layer.color}15`,
                      }}
                    >
                      <Icon
                        className="w-8 h-8 md:w-10 md:h-10"
                        style={{ color: layer.color, filter: `drop-shadow(0 0 10px ${layer.color}50)` }}
                      />
                    </div>

                    {/* Title */}
                    <h3 className="text-lg md:text-xl font-bold text-white text-center px-6 leading-tight">
                      {layer.title}
                    </h3>

                    {/* Stat badge */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: layer.color }}>
                        {layer.stat}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">
                        {layer.statLabel}
                      </span>
                    </div>

                    {/* Step indicator */}
                    <span
                      className="absolute top-4 md:top-6 right-4 md:right-8 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
                      style={{
                        color: '#000',
                        background: layer.color,
                        boxShadow: `0 0 15px ${layer.color}50`,
                      }}
                    >
                      {activeLayer + 1}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Description below */}
            <AnimatePresence mode="wait">
              <motion.p
                key={activeLayer}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="text-sm md:text-base text-white/40 text-center max-w-md mt-8 leading-relaxed"
              >
                {layer.desc}
              </motion.p>
            </AnimatePresence>

            {/* Navigation arrows */}
            <button
              onClick={goPrev}
              className="absolute left-0 md:-left-8 top-[130px] md:top-[160px] w-10 h-10 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.2] flex items-center justify-center text-white/40 hover:text-white transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-0 md:-right-8 top-[130px] md:top-[160px] w-10 h-10 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.2] flex items-center justify-center text-white/40 hover:text-white transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {LAYERS.map((l, i) => (
              <button
                key={l.title}
                onClick={() => goTo(i)}
                className="relative group p-1"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                    i === activeLayer ? 'scale-125' : 'scale-100 opacity-40 hover:opacity-60'
                  }`}
                  style={{
                    background: i === activeLayer ? l.color : `${l.color}60`,
                    boxShadow: i === activeLayer ? `0 0 10px ${l.color}50` : 'none',
                  }}
                />
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-[2px] rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${LAYERS[0].color}, ${layer.color})` }}
              animate={{ width: `${((activeLayer + 1) / LAYERS.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-5 border-t border-white/[0.05]">
            <p className="text-xs text-white/20 tracking-wide">
              Powered by <span className="text-white/40 font-medium">Kling</span> & <span className="text-white/40 font-medium">Veo</span> — orchestrated by Apex
            </p>
            <Link
              to="/how-it-works"
              className="group/cta inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
            >
              Explore the full pipeline
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
