import { memo, forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: '#fbbf24', shortDesc: 'Character consistency' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', color: '#38bdf8', shortDesc: 'Camera & lighting' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every single cut', color: '#34d399', shortDesc: 'Scene continuity' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics and continuity violations', color: '#a78bfa', shortDesc: 'Physics review' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts', color: '#fb7185', shortDesc: 'Artifact removal' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', color: '#22d3ee', shortDesc: 'Narrative pacing' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', color: '#e879f9', shortDesc: 'Audio & voice' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated in a unified pipeline', color: '#facc15', shortDesc: 'Model orchestration' },
] as const;

const AUTO_CYCLE_MS = 4000;

/** Animated node icon with unique per-layer micro-animation */
const NodeAnimation = memo(function NodeAnimation({ index, isActive, color }: { index: number; isActive: boolean; color: string }) {
  const animations = [
    // Identity Lock — 3 orbiting dots (character points)
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <circle cx="24" cy="24" r="16" fill="none" stroke={color} strokeWidth="1" opacity={isActive ? 0.3 : 0.1}>
        <animate attributeName="r" values="14;18;14" dur="3s" repeatCount="indefinite" />
      </circle>
      {[0, 120, 240].map((angle, i) => (
        <circle key={i} cx="24" cy="24" r="3" fill={color} opacity={isActive ? 1 : 0.3}>
          <animateTransform attributeName="transform" type="rotate" from={`${angle} 24 24`} to={`${angle + 360} 24 24`} dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values="24;8;24" dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>,
    // Cinematography — rotating viewfinder
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <rect x="12" y="12" width="24" height="24" rx="2" fill="none" stroke={color} strokeWidth="1.5" opacity={isActive ? 0.6 : 0.15}>
        <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="12s" repeatCount="indefinite" />
      </rect>
      <line x1="24" y1="8" x2="24" y2="40" stroke={color} strokeWidth="0.5" opacity={isActive ? 0.3 : 0.08} />
      <line x1="8" y1="24" x2="40" y2="24" stroke={color} strokeWidth="0.5" opacity={isActive ? 0.3 : 0.08} />
      <circle cx="24" cy="24" r="6" fill="none" stroke={color} strokeWidth="1.5" opacity={isActive ? 0.8 : 0.2}>
        <animate attributeName="r" values="4;8;4" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>,
    // Frame Chaining — linked chain segments
    <svg viewBox="0 0 48 48" className="w-full h-full">
      {[0, 1, 2].map(i => (
        <rect key={i} x={8 + i * 12} y="18" width="10" height="12" rx="3" fill="none" stroke={color} strokeWidth="1.5" opacity={isActive ? 0.7 : 0.15}>
          <animate attributeName="y" values={`${18 - i * 2};${20 + i * 2};${18 - i * 2}`} dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
        </rect>
      ))}
      {[0, 1].map(i => (
        <line key={`l${i}`} x1={18 + i * 12} y1="24" x2={20 + i * 12} y2="24" stroke={color} strokeWidth="1" opacity={isActive ? 0.5 : 0.1}>
          <animate attributeName="opacity" values={isActive ? '0.5;1;0.5' : '0.1;0.2;0.1'} dur="1.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </line>
      ))}
    </svg>,
    // Cinematic Auditor — scanning eye
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <ellipse cx="24" cy="24" rx="16" ry="10" fill="none" stroke={color} strokeWidth="1.5" opacity={isActive ? 0.5 : 0.12} />
      <circle cx="24" cy="24" r="5" fill={color} opacity={isActive ? 0.6 : 0.1}>
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="24" cy="24" r="2" fill="white" opacity={isActive ? 0.9 : 0.2} />
      <line x1="6" y1="24" x2="42" y2="24" stroke={color} strokeWidth="0.5" opacity={isActive ? 0.15 : 0.05}>
        <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="8s" repeatCount="indefinite" />
      </line>
    </svg>,
    // Hallucination Filter — shield with pulse
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M24 6 L38 14 L38 28 Q38 38 24 44 Q10 38 10 28 L10 14 Z" fill="none" stroke={color} strokeWidth="1.5" opacity={isActive ? 0.5 : 0.12}>
        <animate attributeName="opacity" values={isActive ? '0.3;0.7;0.3' : '0.08;0.15;0.08'} dur="3s" repeatCount="indefinite" />
      </path>
      <line x1="18" y1="24" x2="22" y2="28" stroke={color} strokeWidth="2" opacity={isActive ? 0.8 : 0.15} />
      <line x1="22" y1="28" x2="30" y2="18" stroke={color} strokeWidth="2" opacity={isActive ? 0.8 : 0.15} />
    </svg>,
    // Smart Script — flowing text lines
    <svg viewBox="0 0 48 48" className="w-full h-full">
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x="10" y={12 + i * 7} width={28 - i * 4} height="2" rx="1" fill={color} opacity={isActive ? 0.5 : 0.1}>
          <animate attributeName="width" values={`${20 - i * 2};${32 - i * 4};${20 - i * 2}`} dur="2.5s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values={isActive ? '0.3;0.7;0.3' : '0.05;0.15;0.05'} dur="2.5s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>,
    // Audio Intelligence — sound waves
    <svg viewBox="0 0 48 48" className="w-full h-full">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} x={8 + i * 5} y="24" width="3" rx="1.5" fill={color} opacity={isActive ? 0.6 : 0.12}>
          <animate attributeName="height" values={`${4 + Math.random() * 8};${12 + Math.random() * 12};${4 + Math.random() * 8}`} dur={`${1 + i * 0.15}s`} repeatCount="indefinite" />
          <animate attributeName="y" values={`${24 - 2 - Math.random() * 4};${24 - 6 - Math.random() * 6};${24 - 2 - Math.random() * 4}`} dur={`${1 + i * 0.15}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>,
    // Multi-Model — converging arrows
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <circle cx="24" cy="24" r="8" fill={color} opacity={isActive ? 0.2 : 0.05}>
        <animate attributeName="r" values="6;10;6" dur="3s" repeatCount="indefinite" />
      </circle>
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <line key={i} x1="24" y1="24" x2="24" y2="4" stroke={color} strokeWidth="1.5" opacity={isActive ? 0.5 : 0.1}
          transform={`rotate(${angle} 24 24)`}>
          <animate attributeName="opacity" values={isActive ? '0.2;0.8;0.2' : '0.05;0.15;0.05'} dur="2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </line>
      ))}
      <circle cx="24" cy="24" r="3" fill={color} opacity={isActive ? 0.9 : 0.2} />
    </svg>,
  ];
  return <div className="w-full h-full">{animations[index]}</div>;
});

/** The connecting data-flow line between nodes */
const FlowConnector = memo(function FlowConnector({ isActive, color }: { isActive: boolean; color: string }) {
  return (
    <div className="hidden lg:flex items-center justify-center w-8 shrink-0">
      <div className="relative w-full h-[2px]">
        <div className="absolute inset-0 bg-white/[0.06] rounded-full" />
        {isActive && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="h-full w-8 rounded-full animate-flow-pulse"
              style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    const [activeLayer, setActiveLayer] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const cycleRef = useRef<ReturnType<typeof setInterval>>();

    // Auto-cycle
    useEffect(() => {
      if (isPaused) return;
      cycleRef.current = setInterval(() => {
        setActiveLayer(prev => (prev + 1) % LAYERS.length);
      }, AUTO_CYCLE_MS);
      return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
    }, [isPaused]);

    const handleNodeClick = useCallback((index: number) => {
      setActiveLayer(index);
      setIsPaused(true);
      // Resume after a longer pause
      setTimeout(() => setIsPaused(false), AUTO_CYCLE_MS * 2);
    }, []);

    const currentLayer = LAYERS[activeLayer];

    return (
      <section ref={ref} id="features" className="relative z-10 py-28 md:py-40 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
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
            <p className="text-base md:text-lg text-white/30 max-w-md mx-auto leading-relaxed">
              Between your idea and the final video — every frame passes through our cinematic AI stack.
            </p>
          </motion.div>

          {/* ===== PIPELINE VISUALIZER ===== */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Outer ambient glow */}
            <div
              className="absolute -inset-8 rounded-[3rem] opacity-40 blur-3xl pointer-events-none transition-all duration-1000"
              style={{
                background: `radial-gradient(ellipse at 50% 50%, ${currentLayer.color}22, transparent 70%)`,
              }}
            />

            {/* Gradient border */}
            <div className="relative rounded-[2rem] p-px overflow-hidden">
              <div
                className="absolute inset-0 rounded-[2rem]"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(56,189,248,0.25) 25%, rgba(16,185,129,0.25) 50%, rgba(251,191,36,0.25) 75%, rgba(139,92,246,0.4) 100%)',
                }}
              />
              <div
                className="absolute inset-0 rounded-[2rem]"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-sweep 6s ease-in-out infinite',
                }}
              />

              {/* Container body */}
              <div className="relative rounded-[calc(2rem-1px)] bg-[#07070b] overflow-hidden">
                {/* Atmosphere */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -top-[150px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[100px]"
                    style={{ background: `${currentLayer.color}08`, transition: 'background 1s ease' }}
                  />
                  <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
                </div>

                <div className="relative px-6 py-8 md:px-10 md:py-10">

                  {/* === FLOW: Input → 8 Nodes → Output === */}
                  {/* Desktop: horizontal flow */}
                  <div className="hidden lg:block">
                    {/* Flow labels */}
                    <div className="flex items-center justify-between mb-6 px-2">
                      <span className="text-[11px] font-mono text-white/20 tracking-widest uppercase">Input • Your Idea</span>
                      <span className="text-[11px] font-mono text-white/20 tracking-widest uppercase">Output • Cinema</span>
                    </div>

                    {/* Horizontal node strip */}
                    <div className="flex items-center justify-between gap-0">
                      {LAYERS.map((layer, i) => {
                        const Icon = layer.icon;
                        const isActive = activeLayer === i;
                        const isPast = i < activeLayer;
                        return (
                          <div key={layer.title} className="contents">
                            {/* Node */}
                            <button
                              onClick={() => handleNodeClick(i)}
                              className="group relative flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-xl"
                            >
                              {/* Animated SVG visualization */}
                              <div
                                className={`relative w-16 h-16 rounded-2xl border transition-all duration-500 ${
                                  isActive
                                    ? 'border-white/20 bg-white/[0.06] scale-110 shadow-lg'
                                    : isPast
                                      ? 'border-white/[0.08] bg-white/[0.03]'
                                      : 'border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.1]'
                                }`}
                                style={isActive ? { boxShadow: `0 0 30px ${layer.color}30, 0 0 60px ${layer.color}15` } : undefined}
                              >
                                <NodeAnimation index={i} isActive={isActive} color={layer.color} />

                                {/* Lucide icon overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Icon
                                    className="w-5 h-5 transition-all duration-300"
                                    style={{ color: isActive ? layer.color : isPast ? `${layer.color}88` : `${layer.color}33` }}
                                  />
                                </div>

                                {/* Pulse ring */}
                                {isActive && (
                                  <div
                                    className="absolute -inset-1 rounded-2xl animate-ping-slow"
                                    style={{ border: `1px solid ${layer.color}30` }}
                                  />
                                )}
                              </div>

                              {/* Label */}
                              <span className={`text-[10px] font-medium tracking-wide transition-colors text-center leading-tight w-16 ${
                                isActive ? 'text-white/80' : isPast ? 'text-white/30' : 'text-white/15 group-hover:text-white/30'
                              }`}>
                                {layer.shortDesc}
                              </span>

                              {/* Step number */}
                              <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-mono flex items-center justify-center transition-all ${
                                isActive
                                  ? 'bg-white/20 text-white/80'
                                  : isPast
                                    ? 'bg-white/[0.06] text-white/20'
                                    : 'bg-white/[0.03] text-white/10'
                              }`}>
                                {i + 1}
                              </span>
                            </button>

                            {/* Connector */}
                            {i < LAYERS.length - 1 && (
                              <FlowConnector isActive={isPast || isActive} color={layer.color} />
                            )}
                          </div>
                        );
                      })}
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
                  </div>

                  {/* Mobile: 2-column grid */}
                  <div className="lg:hidden grid grid-cols-2 gap-3">
                    {LAYERS.map((layer, i) => {
                      const Icon = layer.icon;
                      const isActive = activeLayer === i;
                      return (
                        <button
                          key={layer.title}
                          onClick={() => handleNodeClick(i)}
                          className={`relative p-4 rounded-xl border text-left transition-all duration-300 outline-none ${
                            isActive
                              ? 'bg-white/[0.06] border-white/[0.15]'
                              : 'bg-white/[0.02] border-white/[0.05]'
                          }`}
                          style={isActive ? { boxShadow: `0 0 20px ${layer.color}15` } : undefined}
                        >
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? layer.color : `${layer.color}55` }} />
                            <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-white/50'}`}>
                              {layer.title}
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isActive ? 'text-white/40' : 'text-white/15'}`}>
                            {layer.shortDesc}
                          </p>
                          {isActive && (
                            <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                              style={{ background: `linear-gradient(90deg, ${layer.color}, transparent)` }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ===== EXPANDED DETAIL PANEL ===== */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeLayer}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="mt-8 p-6 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="flex flex-col sm:flex-row items-start gap-5">
                        {/* Large animated icon */}
                        <div
                          className="w-20 h-20 shrink-0 rounded-2xl border flex items-center justify-center"
                          style={{
                            borderColor: `${currentLayer.color}30`,
                            background: `${currentLayer.color}08`,
                            boxShadow: `0 0 40px ${currentLayer.color}15`,
                          }}
                        >
                          <NodeAnimation index={activeLayer} isActive={true} color={currentLayer.color} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full"
                              style={{ color: currentLayer.color, background: `${currentLayer.color}15`, border: `1px solid ${currentLayer.color}20` }}
                            >
                              Layer {String(activeLayer + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1.5">{currentLayer.title}</h3>
                          <p className="text-sm text-white/40 leading-relaxed">{currentLayer.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Footer */}
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
              </div>
            </div>
          </motion.div>
        </div>

        <style>{`
          @keyframes shimmer-sweep {
            0%, 100% { background-position: 200% 0; }
            50% { background-position: -200% 0; }
          }
          @keyframes flow-pulse {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          .animate-flow-pulse {
            animation: flow-pulse 1.5s ease-in-out infinite;
          }
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
