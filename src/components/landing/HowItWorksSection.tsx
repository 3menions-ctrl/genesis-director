import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', accent: 'from-amber-500 to-orange-600', glow: 'bg-amber-500' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', accent: 'from-sky-400 to-blue-600', glow: 'bg-sky-500' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every single cut', accent: 'from-emerald-400 to-teal-600', glow: 'bg-emerald-500' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics and continuity violations', accent: 'from-violet-400 to-purple-600', glow: 'bg-violet-500' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts', accent: 'from-rose-400 to-pink-600', glow: 'bg-rose-500' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', accent: 'from-cyan-400 to-blue-500', glow: 'bg-cyan-500' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', accent: 'from-fuchsia-400 to-purple-600', glow: 'bg-fuchsia-500' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated in a unified pipeline', accent: 'from-yellow-400 to-amber-600', glow: 'bg-yellow-500' },
] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }
  }
};

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
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
              <span className="block bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent">
                intelligence
              </span>
            </h2>
            <p className="text-base md:text-lg text-white/30 max-w-md mx-auto leading-relaxed">
              Between your idea and the final video — every frame passes through our cinematic AI stack.
            </p>
          </motion.div>

          {/* ===== EPIC CONTAINER ===== */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-[2rem] p-[1px] overflow-hidden"
          >
            {/* Animated gradient border */}
            <div 
              className="absolute inset-0 rounded-[2rem]"
              style={{
                background: 'conic-gradient(from 0deg at 50% 50%, #f59e0b, #3b82f6, #10b981, #8b5cf6, #f43f5e, #06b6d4, #d946ef, #eab308, #f59e0b)',
                opacity: 0.4,
              }}
            />
            {/* Spinning overlay for animation effect */}
            <div 
              className="absolute inset-0 rounded-[2rem] animate-spin"
              style={{
                background: 'conic-gradient(from 180deg at 50% 50%, transparent 0%, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%, transparent 100%)',
                animationDuration: '8s',
              }}
            />

            {/* Inner container */}
            <div className="relative rounded-[calc(2rem-1px)] bg-[#060608]/95 backdrop-blur-2xl p-6 md:p-10 lg:p-12 overflow-hidden">
              {/* Internal ambient glows */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[calc(2rem-1px)]">
                <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-violet-600/[0.07] rounded-full blur-[100px]" />
                <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-sky-500/[0.06] rounded-full blur-[100px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.03] rounded-full blur-[120px]" />
                {/* Subtle grid pattern */}
                <div 
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                  }}
                />
              </div>

              {/* Container header */}
              <div className="relative flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30" />
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30" />
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 shadow-lg shadow-rose-500/30" />
                  <span className="ml-3 text-xs font-mono text-white/20 tracking-wider">APEX_PIPELINE_v8</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-medium text-emerald-400/70 tracking-wide">ACTIVE</span>
                </div>
              </div>

              {/* Layer Grid */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
              >
                {LAYERS.map((layer, i) => {
                  const Icon = layer.icon;
                  return (
                    <motion.div
                      key={layer.title}
                      variants={cardVariants}
                      className="group relative"
                    >
                      {/* Hover glow */}
                      <div className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${layer.accent} opacity-0 group-hover:opacity-[0.12] blur-md transition-opacity duration-700`} />

                      <div className="relative h-full p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-500">
                        {/* Icon + number */}
                        <div className="flex items-center justify-between mb-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${layer.accent} p-[1px]`}>
                            <div className="w-full h-full rounded-[11px] bg-[#0a0a0c] flex items-center justify-center group-hover:bg-[#111114] transition-colors duration-500">
                              <Icon className="w-4 h-4 text-white/70 group-hover:text-white transition-colors duration-300" />
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-white/[0.08] group-hover:text-white/25 transition-colors tracking-widest">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-white/90 mb-1.5 group-hover:text-white transition-colors">
                          {layer.title}
                        </h3>
                        <p className="text-[13px] text-white/25 leading-relaxed group-hover:text-white/50 transition-colors duration-500">
                          {layer.desc}
                        </p>

                        {/* Bottom accent line */}
                        <div className={`absolute bottom-0 left-5 right-5 h-[1px] bg-gradient-to-r ${layer.accent} opacity-0 group-hover:opacity-40 transition-opacity duration-700`} />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Container footer */}
              <div className="relative flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/15 tracking-wide font-mono">
                  Powered by <span className="text-white/30">Kling</span> · <span className="text-white/30">Veo</span> — orchestrated by Apex
                </p>
                <Link
                  to="/how-it-works"
                  className="group/cta inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium text-white/60 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] hover:border-white/[0.18] transition-all duration-300"
                >
                  Explore pipeline
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
