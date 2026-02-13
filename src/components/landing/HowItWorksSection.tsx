import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', accent: 'from-amber-500 to-orange-600' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', accent: 'from-sky-400 to-blue-600' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every single cut', accent: 'from-emerald-400 to-teal-600' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics and continuity violations', accent: 'from-violet-400 to-purple-600' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts', accent: 'from-rose-400 to-pink-600' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', accent: 'from-cyan-400 to-blue-500' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', accent: 'from-fuchsia-400 to-purple-600' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated in a unified pipeline', accent: 'from-yellow-400 to-amber-600' },
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
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-purple-500/[0.04] rounded-full blur-[120px]" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-sky-500/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto relative">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-20"
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

          {/* Vertical flow line (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-[280px] bottom-[120px] w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

          {/* Layer Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
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
                  <div className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${layer.accent} opacity-0 group-hover:opacity-[0.08] blur-sm transition-opacity duration-700`} />

                  <div className="relative h-full p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500">
                    {/* Layer number */}
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${layer.accent} p-[1px]`}>
                        <div className="w-full h-full rounded-[11px] bg-[#0a0a0a] flex items-center justify-center group-hover:bg-[#111] transition-colors duration-500">
                          <Icon className="w-4 h-4 text-white/70 group-hover:text-white transition-colors duration-300" />
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-white/[0.08] group-hover:text-white/20 transition-colors tracking-widest">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white/90 mb-2 group-hover:text-white transition-colors">
                      {layer.title}
                    </h3>
                    <p className="text-[13px] text-white/25 leading-relaxed group-hover:text-white/45 transition-colors duration-500">
                      {layer.desc}
                    </p>

                    {/* Bottom accent line */}
                    <div className={`absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r ${layer.accent} opacity-0 group-hover:opacity-30 transition-opacity duration-700`} />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Bottom badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-center mt-14"
          >
            <p className="text-xs text-white/15 mb-6 tracking-wide">
              Powered by <span className="text-white/30 font-medium">Kling</span> & <span className="text-white/30 font-medium">Veo</span> — orchestrated by Apex
            </p>
            <Link
              to="/how-it-works"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-medium text-white/70 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
            >
              Explore the full pipeline
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
