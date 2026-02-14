import { memo, forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
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
      const card = container.children[activeLayer] as HTMLElement | undefined;
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

          {/* Flow labels */}
          <div className="hidden md:flex items-center justify-between mb-4 px-1">
            <span className="text-[11px] font-mono text-white/20 tracking-[0.15em] uppercase">Input • Your Idea</span>
            <span className="text-[11px] font-mono text-white/20 tracking-[0.15em] uppercase">Output • Cinema</span>
          </div>

          {/* Horizontal scrolling card strip */}
          <div className="relative">
            <div
              ref={scrollContainerRef}
              className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {LAYERS.map((layer, i) => {
                const Icon = layer.icon;
                const isActive = activeLayer === i;
                const isPast = i < activeLayer;

                return (
                  <motion.button
                    key={layer.title}
                    onClick={() => handleNodeClick(i)}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className={`group relative snap-center shrink-0 w-[200px] md:w-[calc((100%-7*0.75rem)/8)] text-left outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl transition-all duration-500`}
                  >
                    {/* Glow */}
                    {isActive && (
                      <div
                        className="absolute -inset-2 rounded-3xl opacity-50 blur-xl pointer-events-none"
                        style={{ background: `radial-gradient(ellipse, ${layer.color}25, transparent 70%)` }}
                      />
                    )}

                    <div className={`relative h-full rounded-2xl border overflow-hidden transition-all duration-500 ${
                      isActive
                        ? 'border-white/[0.15] bg-white/[0.05]'
                        : isPast
                          ? 'border-white/[0.08] bg-white/[0.02]'
                          : 'border-white/[0.05] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.03]'
                    }`}
                      style={isActive ? { boxShadow: `0 4px 30px ${layer.color}15, inset 0 1px 0 rgba(255,255,255,0.06)` } : undefined}
                    >
                      {/* Top accent */}
                      <div
                        className="h-[2px] w-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${layer.color}${isActive ? '80' : '15'}, transparent)` }}
                      />

                      <div className="p-4 flex flex-col h-full">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-500 ${isActive ? 'scale-105' : ''}`}
                            style={{
                              borderColor: `${layer.color}${isActive ? '40' : '15'}`,
                              background: `${layer.color}${isActive ? '12' : '06'}`,
                              boxShadow: isActive ? `0 0 20px ${layer.color}20` : 'none',
                            }}
                          >
                            <Icon
                              className="w-4.5 h-4.5 transition-colors duration-300"
                              style={{ color: isActive ? layer.color : isPast ? `${layer.color}88` : `${layer.color}44` }}
                            />
                          </div>
                          <span
                            className="text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded-full transition-all"
                            style={{
                              color: isActive ? layer.color : `${layer.color}55`,
                              background: `${layer.color}${isActive ? '15' : '08'}`,
                              border: `1px solid ${layer.color}${isActive ? '20' : '08'}`,
                            }}
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className={`text-sm font-semibold mb-1.5 transition-colors duration-300 ${
                          isActive ? 'text-white' : isPast ? 'text-white/50' : 'text-white/35 group-hover:text-white/50'
                        }`}>
                          {layer.title}
                        </h3>

                        {/* Description */}
                        <p className={`text-[11px] leading-relaxed flex-1 transition-colors duration-300 ${
                          isActive ? 'text-white/45' : 'text-white/15 group-hover:text-white/25'
                        }`}>
                          {layer.desc}
                        </p>

                        {/* Stat */}
                        <div className={`mt-3 pt-3 border-t transition-all duration-300 ${
                          isActive ? 'border-white/[0.08]' : 'border-white/[0.04]'
                        }`}>
                          <span
                            className="text-lg font-bold tabular-nums"
                            style={{ color: isActive ? layer.color : `${layer.color}44` }}
                          >
                            {layer.stat}
                          </span>
                          <span className={`text-[9px] uppercase tracking-wider ml-1.5 ${isActive ? 'text-white/30' : 'text-white/10'}`}>
                            {layer.statLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Fade edges */}
            <div className="absolute top-0 left-0 bottom-4 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none md:hidden" />
            <div className="absolute top-0 right-0 bottom-4 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none md:hidden" />
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-[2px] rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${LAYERS[0].color}, ${currentLayer.color})` }}
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
