import { memo, forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap, ChevronRight } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: '#fbbf24', gradient: 'from-amber-500/20 to-amber-600/5', stat: '99.2%', statLabel: 'Face consistency' },
  { icon: Camera, title: 'Cinematography Engine', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles — Hollywood-grade shot composition', color: '#38bdf8', gradient: 'from-sky-500/20 to-sky-600/5', stat: '42', statLabel: 'Camera presets' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every cut using last-frame anchoring', color: '#34d399', gradient: 'from-emerald-500/20 to-emerald-600/5', stat: '0ms', statLabel: 'Visual gap' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-generation review catches physics violations & continuity errors before render', color: '#a78bfa', gradient: 'from-violet-500/20 to-violet-600/5', stat: '14', statLabel: 'Check layers' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts, extra limbs & production gear', color: '#fb7185', gradient: 'from-rose-500/20 to-rose-600/5', stat: '25', statLabel: 'Negative prompts' },
  { icon: Brain, title: 'Smart Script Engine', desc: 'Concept → shot list → timeline with narrative pacing & emotional arc mapping', color: '#22d3ee', gradient: 'from-cyan-500/20 to-cyan-600/5', stat: '3s', statLabel: 'Script to timeline' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS character voices, Hans Zimmer-style scoring & automatic dialogue ducking', color: '#e879f9', gradient: 'from-fuchsia-500/20 to-fuchsia-600/5', stat: '8', statLabel: 'Voice engines' },
  { icon: Zap, title: 'Multi-Model Orchestration', desc: 'Kling & Veo orchestrated in a unified pipeline — best model per shot, automatically', color: '#facc15', gradient: 'from-yellow-500/20 to-yellow-600/5', stat: '2+', statLabel: 'AI models' },
] as const;

const AUTO_CYCLE_MS = 4500;

/** Animated vertical connector between cards */
const VerticalConnector = memo(function VerticalConnector({ isActive, color, index }: { isActive: boolean; color: string; index: number }) {
  return (
    <div className="flex justify-center py-0">
      <div className="relative w-px h-12 md:h-16">
        {/* Base line */}
        <div className="absolute inset-0 bg-white/[0.06]" />
        {/* Active glow */}
        <motion.div
          className="absolute inset-0 w-px"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: isActive ? 1 : 0 }}
          transition={{ duration: 0.6, delay: index * 0.05 }}
          style={{ background: `linear-gradient(180deg, ${color}, transparent)`, transformOrigin: 'top' }}
        />
        {/* Pulse dot */}
        {isActive && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            initial={{ top: '0%' }}
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  );
});

/** Individual pipeline layer card */
const LayerCard = memo(function LayerCard({ 
  layer, index, isActive, isPast, onClick 
}: { 
  layer: typeof LAYERS[number]; index: number; isActive: boolean; isPast: boolean; onClick: () => void;
}) {
  const Icon = layer.icon;
  const cardRef = useRef<HTMLButtonElement>(null);
  const isInView = useInView(cardRef, { once: true, margin: '-50px' });

  return (
    <motion.button
      ref={cardRef}
      onClick={onClick}
      initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl transition-all duration-500 ${
        isActive ? 'z-10' : 'z-0'
      }`}
    >
      {/* Outer glow */}
      {isActive && (
        <div
          className="absolute -inset-3 rounded-3xl opacity-60 blur-2xl pointer-events-none transition-all duration-700"
          style={{ background: `radial-gradient(ellipse at center, ${layer.color}20, transparent 70%)` }}
        />
      )}

      <div className={`relative rounded-2xl border overflow-hidden transition-all duration-500 ${
        isActive
          ? 'border-white/[0.15] bg-white/[0.04]'
          : isPast
            ? 'border-white/[0.08] bg-white/[0.02]'
            : 'border-white/[0.05] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.03]'
      }`}
        style={isActive ? { boxShadow: `0 4px 40px ${layer.color}12, inset 0 1px 0 rgba(255,255,255,0.06)` } : undefined}
      >
        {/* Gradient accent stripe at top */}
        <div
          className="h-[2px] w-full transition-opacity duration-500"
          style={{
            background: `linear-gradient(90deg, transparent, ${layer.color}${isActive ? '80' : '20'}, transparent)`,
          }}
        />

        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4 md:gap-5">
            {/* Icon container */}
            <div
              className={`relative shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-xl border flex items-center justify-center transition-all duration-500 ${
                isActive ? 'scale-105' : 'scale-100'
              }`}
              style={{
                borderColor: `${layer.color}${isActive ? '40' : '15'}`,
                background: `${layer.color}${isActive ? '12' : '06'}`,
                boxShadow: isActive ? `0 0 30px ${layer.color}20` : 'none',
              }}
            >
              <Icon
                className="w-6 h-6 md:w-7 md:h-7 transition-all duration-300"
                style={{ color: isActive ? layer.color : isPast ? `${layer.color}99` : `${layer.color}44` }}
              />
              {/* Pulse ring */}
              {isActive && (
                <div className="absolute -inset-1 rounded-xl animate-ping-slow"
                  style={{ border: `1px solid ${layer.color}25` }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <span
                  className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full transition-all duration-300"
                  style={{
                    color: isActive ? layer.color : `${layer.color}66`,
                    background: `${layer.color}${isActive ? '18' : '08'}`,
                    border: `1px solid ${layer.color}${isActive ? '25' : '10'}`,
                  }}
                >
                  Layer {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className={`text-base md:text-lg font-semibold mb-1 transition-colors duration-300 ${
                isActive ? 'text-white' : isPast ? 'text-white/60' : 'text-white/40 group-hover:text-white/60'
              }`}>
                {layer.title}
              </h3>
              <p className={`text-sm leading-relaxed transition-colors duration-300 ${
                isActive ? 'text-white/50' : isPast ? 'text-white/25' : 'text-white/15 group-hover:text-white/25'
              }`}>
                {layer.desc}
              </p>
            </div>

            {/* Stat badge */}
            <div className={`hidden sm:flex shrink-0 flex-col items-end text-right transition-all duration-300 ${
              isActive ? 'opacity-100' : 'opacity-30'
            }`}>
              <span className="text-xl md:text-2xl font-bold tabular-nums" style={{ color: isActive ? layer.color : `${layer.color}66` }}>
                {layer.stat}
              </span>
              <span className="text-[10px] text-white/30 tracking-wide uppercase mt-0.5">
                {layer.statLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
});

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    const [activeLayer, setActiveLayer] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const cycleRef = useRef<ReturnType<typeof setInterval>>();
    const sectionRef = useRef<HTMLElement>(null);
    const isInView = useInView(sectionRef, { once: false, margin: '-100px' });

    // Auto-cycle when in view
    useEffect(() => {
      if (isPaused || !isInView) return;
      cycleRef.current = setInterval(() => {
        setActiveLayer(prev => (prev + 1) % LAYERS.length);
      }, AUTO_CYCLE_MS);
      return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
    }, [isPaused, isInView]);

    const handleNodeClick = useCallback((index: number) => {
      setActiveLayer(index);
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), AUTO_CYCLE_MS * 2);
    }, []);

    const currentLayer = LAYERS[activeLayer];

    return (
      <section ref={(el) => {
        // Merge refs
        (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} id="features" className="relative z-10 py-28 md:py-40 px-6 overflow-hidden">
        <div className="max-w-3xl mx-auto relative">
          {/* Large ambient glow behind section */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[800px] rounded-full blur-[150px] opacity-30 pointer-events-none transition-all duration-1000"
            style={{ background: `radial-gradient(ellipse, ${currentLayer.color}15, transparent 70%)` }}
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

          {/* Input label */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[11px] font-mono text-white/25 tracking-[0.2em] uppercase">Your idea enters</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
          </motion.div>

          {/* ===== VERTICAL PIPELINE CARDS ===== */}
          <div className="space-y-0">
            {LAYERS.map((layer, i) => {
              const isActive = activeLayer === i;
              const isPast = i < activeLayer;
              return (
                <div key={layer.title}>
                  <LayerCard
                    layer={layer}
                    index={i}
                    isActive={isActive}
                    isPast={isPast}
                    onClick={() => handleNodeClick(i)}
                  />
                  {i < LAYERS.length - 1 && (
                    <VerticalConnector
                      isActive={isPast || isActive}
                      color={layer.color}
                      index={i}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Output label */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-center gap-3 mt-6 mb-10"
          >
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[11px] font-mono text-white/25 tracking-[0.2em] uppercase">Cinema-grade output</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
          </motion.div>

          {/* Progress indicator */}
          <div className="mt-6 h-[2px] rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${LAYERS[0].color}, ${currentLayer.color})` }}
              animate={{ width: `${((activeLayer + 1) / LAYERS.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Footer CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-white/[0.05]">
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

        <style>{`
          .animate-ping-slow {
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          @keyframes ping {
            0% { transform: scale(1); opacity: 0.6; }
            75%, 100% { transform: scale(1.3); opacity: 0; }
          }
        `}</style>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
