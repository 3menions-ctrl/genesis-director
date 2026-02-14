import { memo, forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: '#fbbf24', stat: '99.2%', statLabel: 'Consistency' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', color: '#38bdf8', stat: '42', statLabel: 'Presets' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every cut', color: '#34d399', stat: '0ms', statLabel: 'Visual gap' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics & continuity errors', color: '#a78bfa', stat: '14', statLabel: 'Checks' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts remove AI artifacts & extra limbs', color: '#fb7185', stat: '25', statLabel: 'Filters' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', color: '#22d3ee', stat: '3s', statLabel: 'To timeline' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', color: '#e879f9', stat: '8', statLabel: 'Voices' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated — best model per shot', color: '#facc15', stat: '2+', statLabel: 'AI models' },
] as const;

const AUTO_CYCLE_MS = 4500;

// Round orbital card component
const OrbitalCard = memo(function OrbitalCard({ 
  layer, 
  index, 
  isActive, 
  isPast, 
  onClick 
}: { 
  layer: typeof LAYERS[number]; 
  index: number; 
  isActive: boolean; 
  isPast: boolean; 
  onClick: () => void;
}) {
  const Icon = layer.icon;
  
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: (LAYERS.length - 1 - index) * 0.06 }}
      className="group relative flex flex-col items-center gap-3 outline-none shrink-0"
    >
      {/* Outer glow ring */}
      {isActive && (
        <motion.div
          layoutId="orbital-glow"
          className="absolute -inset-3 rounded-full opacity-40 blur-2xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${layer.color}30, transparent 70%)` }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Circle card */}
      <div className="relative">
        {/* Animated ring */}
        <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)]" viewBox="0 0 88 88">
          <circle
            cx="44" cy="44" r="42"
            fill="none"
            stroke={isActive ? layer.color : `${layer.color}15`}
            strokeWidth={isActive ? 1.5 : 0.5}
            strokeDasharray={isActive ? "8 4" : "2 6"}
            className="transition-all duration-700"
            style={{ filter: isActive ? `drop-shadow(0 0 4px ${layer.color}40)` : 'none' }}
          >
            {isActive && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 44 44"
                to="360 44 44"
                dur="12s"
                repeatCount="indefinite"
              />
            )}
          </circle>
        </svg>

        <div
          className={`relative w-[72px] h-[72px] md:w-20 md:h-20 rounded-full border-2 flex items-center justify-center transition-all duration-500 cursor-pointer ${
            isActive
              ? 'scale-110 bg-white/[0.08]'
              : isPast
                ? 'bg-white/[0.03] hover:bg-white/[0.05]'
                : 'bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
          style={{
            borderColor: isActive ? `${layer.color}60` : isPast ? `${layer.color}20` : `${layer.color}10`,
            boxShadow: isActive
              ? `0 0 30px ${layer.color}20, inset 0 0 20px ${layer.color}08`
              : 'none',
          }}
        >
          {/* Inner glow */}
          {isActive && (
            <div
              className="absolute inset-0 rounded-full opacity-20"
              style={{ background: `radial-gradient(circle at 30% 30%, ${layer.color}40, transparent 70%)` }}
            />
          )}

          <Icon
            className="w-6 h-6 md:w-7 md:h-7 transition-all duration-500 relative z-10"
            style={{
              color: isActive ? layer.color : isPast ? `${layer.color}66` : `${layer.color}33`,
              filter: isActive ? `drop-shadow(0 0 8px ${layer.color}50)` : 'none',
            }}
          />

          {/* Step number */}
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center border transition-all duration-300"
            style={{
              color: isActive ? '#000' : layer.color,
              background: isActive ? layer.color : `${layer.color}15`,
              borderColor: isActive ? layer.color : `${layer.color}20`,
              boxShadow: isActive ? `0 0 10px ${layer.color}40` : 'none',
            }}
          >
            {index + 1}
          </span>
        </div>
      </div>

      {/* Label */}
      <span className={`text-[11px] md:text-xs font-medium text-center leading-tight max-w-[80px] transition-colors duration-300 ${
        isActive ? 'text-white' : isPast ? 'text-white/35' : 'text-white/20 group-hover:text-white/35'
      }`}>
        {layer.title}
      </span>
    </motion.button>
  );
});

// Connector line between cards
const Connector = memo(function Connector({ fromColor, toColor, isActive }: { fromColor: string; toColor: string; isActive: boolean }) {
  return (
    <div className="flex items-center shrink-0 -mx-1 self-start mt-[36px] md:mt-10">
      <div className="relative w-8 md:w-12 h-[2px]">
        <div
          className="absolute inset-0 rounded-full transition-all duration-500"
          style={{
            background: isActive
              ? `linear-gradient(90deg, ${fromColor}80, ${toColor}80)`
              : `linear-gradient(90deg, ${fromColor}15, ${toColor}15)`,
            boxShadow: isActive ? `0 0 8px ${fromColor}30` : 'none',
          }}
        />
        {isActive && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{ background: toColor, boxShadow: `0 0 6px ${toColor}60` }}
            animate={{ left: ['-4px', 'calc(100% + 4px)'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  );
});

// Detail panel for active layer
const DetailPanel = memo(function DetailPanel({ layer }: { layer: typeof LAYERS[number] }) {
  return (
    <motion.div
      key={layer.title}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <span
          className="text-2xl md:text-3xl font-bold tabular-nums"
          style={{ color: layer.color }}
        >
          {layer.stat}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">
          {layer.statLabel}
        </span>
      </div>
      <div className="hidden sm:block w-px h-8 bg-white/[0.08]" />
      <p className="text-sm text-white/40 text-center sm:text-left leading-relaxed flex-1">
        {layer.desc}
      </p>
    </motion.div>
  );
});

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    const [activeLayer, setActiveLayer] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const cycleRef = useRef<ReturnType<typeof setInterval>>();
    const sectionRef = useRef<HTMLElement>(null);
    const isInView = useInView(sectionRef, { once: false, margin: '-100px' });
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (isPaused || !isInView) return;
      cycleRef.current = setInterval(() => {
        setActiveLayer(prev => (prev + 1) % LAYERS.length);
      }, AUTO_CYCLE_MS);
      return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
    }, [isPaused, isInView]);

    // Auto-scroll to active card on mobile
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const card = container.children[activeLayer * 2] as HTMLElement | undefined; // *2 because connectors
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, [activeLayer]);

    const handleNodeClick = useCallback((index: number) => {
      setActiveLayer(index);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), AUTO_CYCLE_MS * 2);
    }, []);

    const currentLayer = LAYERS[activeLayer];
    // Reverse order: right to left (Output → Input)
    const reversedLayers = [...LAYERS].reverse();

    return (
      <section ref={(el) => {
        (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} id="features" className="relative z-10 py-24 md:py-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto relative">
          {/* Ambient glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[150px] opacity-25 pointer-events-none transition-all duration-1000"
            style={{ background: `radial-gradient(ellipse, ${currentLayer.color}18, transparent 70%)` }}
          />

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12 md:mb-16"
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

          {/* Flow direction labels */}
          <div className="hidden md:flex items-center justify-between mb-3 px-4">
            <span className="text-[11px] font-mono text-white/20 tracking-[0.15em] uppercase">Output • Cinema</span>
            <span className="text-[11px] font-mono text-white/20 tracking-[0.15em] uppercase">Input • Your Idea</span>
          </div>

          {/* Horizontal orbital card strip — right to left */}
          <div className="relative">
            <div
              ref={scrollContainerRef}
              className="flex items-start justify-center gap-0 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide px-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {reversedLayers.map((layer, visualIndex) => {
                const realIndex = LAYERS.length - 1 - visualIndex;
                const isActive = activeLayer === realIndex;
                const isPast = realIndex < activeLayer;

                return (
                  <div key={layer.title} className="flex items-start snap-center">
                    <OrbitalCard
                      layer={layer}
                      index={realIndex}
                      isActive={isActive}
                      isPast={isPast}
                      onClick={() => handleNodeClick(realIndex)}
                    />
                    {visualIndex < LAYERS.length - 1 && (
                      <Connector
                        fromColor={layer.color}
                        toColor={reversedLayers[visualIndex + 1].color}
                        isActive={realIndex === activeLayer || realIndex - 1 === activeLayer}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fade edges */}
            <div className="absolute top-0 left-0 bottom-4 w-12 bg-gradient-to-r from-black to-transparent pointer-events-none md:hidden" />
            <div className="absolute top-0 right-0 bottom-4 w-12 bg-gradient-to-l from-black to-transparent pointer-events-none md:hidden" />
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-[2px] rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${LAYERS[0].color}, ${currentLayer.color})` }}
              animate={{ width: `${((activeLayer + 1) / LAYERS.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Active layer detail panel */}
          <div className="mt-6">
            <AnimatePresence mode="wait">
              <DetailPanel layer={currentLayer} />
            </AnimatePresence>
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
