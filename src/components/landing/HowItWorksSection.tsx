import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', shadowColor: 'shadow-amber-500/20' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20', shadowColor: 'shadow-sky-500/20' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every single cut', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', shadowColor: 'shadow-emerald-500/20' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics and continuity violations', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20', shadowColor: 'shadow-violet-500/20' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20', shadowColor: 'shadow-rose-500/20' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20', shadowColor: 'shadow-cyan-500/20' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/20', shadowColor: 'shadow-fuchsia-500/20' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated in a unified pipeline', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', shadowColor: 'shadow-yellow-500/20' },
] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.15 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }
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
              <span className="block bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                intelligence
              </span>
            </h2>
            <p className="text-base md:text-lg text-white/30 max-w-md mx-auto leading-relaxed">
              Between your idea and the final video — every frame passes through our cinematic AI stack.
            </p>
          </motion.div>

          {/* ===== CONTAINER ===== */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Outer gradient border glow */}
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-white/[0.12] via-white/[0.04] to-white/[0.08]" />
            
            {/* Main container body */}
            <div className="relative rounded-3xl bg-[#08080c] p-8 md:p-10 lg:p-12">
              
              {/* Background effects */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                {/* Top-left warm glow */}
                <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-violet-600/[0.06] rounded-full blur-[100px]" />
                {/* Bottom-right cool glow */}
                <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-sky-600/[0.05] rounded-full blur-[100px]" />
                {/* Center subtle warm */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-amber-500/[0.02] rounded-full blur-[80px]" />
              </div>

              {/* Layer Grid */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                {LAYERS.map((layer, i) => {
                  const Icon = layer.icon;
                  return (
                    <motion.div
                      key={layer.title}
                      variants={cardVariants}
                      className="group relative"
                    >
                      <div className={`relative h-full p-5 rounded-2xl border ${layer.border} ${layer.bg} hover:shadow-lg ${layer.shadowColor} transition-all duration-500`}>
                        
                        {/* Layer number */}
                        <span className="absolute top-4 right-4 text-[10px] font-mono text-white/[0.1] group-hover:text-white/20 transition-colors tracking-widest">
                          {String(i + 1).padStart(2, '0')}
                        </span>

                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl ${layer.bg} border ${layer.border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className={`w-[18px] h-[18px] ${layer.color} transition-all duration-300`} />
                        </div>

                        <h3 className={`text-sm font-semibold text-white/90 mb-1.5 group-hover:${layer.color} transition-colors`}>
                          {layer.title}
                        </h3>
                        <p className="text-[13px] text-white/30 leading-relaxed group-hover:text-white/50 transition-colors duration-500">
                          {layer.desc}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Footer */}
              <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 pt-8 border-t border-white/[0.06]">
                <p className="text-xs text-white/20 tracking-wide">
                  Powered by <span className="text-white/40 font-medium">Kling</span> & <span className="text-white/40 font-medium">Veo</span> — orchestrated by Apex
                </p>
                <Link
                  to="/how-it-works"
                  className="group/cta inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white/70 bg-white/[0.05] border border-white/[0.1] hover:text-white hover:bg-white/[0.1] hover:border-white/[0.2] transition-all duration-300"
                >
                  Explore the full pipeline
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
