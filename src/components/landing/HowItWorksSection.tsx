import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: Lock, title: 'Identity Lock', desc: '3-point character bible prevents morphing across scenes', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  { icon: Camera, title: 'Cinematography', desc: '12 movements, 14 angles, 7 sizes, 9 lighting styles', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20' },
  { icon: Layers, title: 'Frame Chaining', desc: 'Sequential visual continuity across every single cut', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  { icon: Eye, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics and continuity violations', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20' },
  { icon: Shield, title: 'Hallucination Filter', desc: '25 negative prompts systematically remove AI artifacts', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20' },
  { icon: Brain, title: 'Smart Script', desc: 'Concept → shot list → timeline with narrative pacing', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
  { icon: Music, title: 'Audio Intelligence', desc: 'TTS voices, cinematic scoring & dialogue ducking', color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/20' },
  { icon: Zap, title: 'Multi-Model', desc: 'Kling & Veo orchestrated in a unified pipeline', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
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

          {/* ===== EPIC CONTAINER ===== */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative group/container"
          >
            {/* Outer glow layer — large colored blur behind the container */}
            <div className="absolute -inset-6 rounded-[3rem] opacity-50 blur-3xl pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.15), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(56,189,248,0.12), transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.06), transparent 60%)',
              }}
            />

            {/* Gradient border wrapper */}
            <div className="relative rounded-[2rem] p-px overflow-hidden">
              {/* Animated gradient border */}
              <div
                className="absolute inset-0 rounded-[2rem]"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(56,189,248,0.3) 25%, rgba(16,185,129,0.3) 50%, rgba(251,191,36,0.3) 75%, rgba(139,92,246,0.5) 100%)',
                }}
              />
              {/* Shimmer sweep */}
              <div
                className="absolute inset-0 rounded-[2rem]"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-sweep 6s ease-in-out infinite',
                }}
              />

              {/* Main container body */}
              <div className="relative rounded-[calc(2rem-1px)] bg-[#07070b] overflow-hidden">
                
                {/* Internal atmosphere */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Radial spotlight from top */}
                  <div className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-500/[0.05] rounded-full blur-[100px]" />
                  {/* Bottom edge glow */}
                  <div className="absolute -bottom-[100px] left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-sky-500/[0.04] rounded-full blur-[80px]" />
                  {/* Noise texture overlay */}
                  <div className="absolute inset-0 opacity-[0.015]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    }}
                  />
                  {/* Top edge highlight line */}
                  <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
                </div>

                {/* Content padding */}
                <div className="relative px-6 py-8 md:px-10 md:py-10 lg:px-12 lg:py-12">
                  
                  {/* Layer Grid */}
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                  >
                    {LAYERS.map((layer, i) => {
                      const Icon = layer.icon;
                      return (
                        <motion.div
                          key={layer.title}
                          variants={cardVariants}
                          className="group relative"
                        >
                          <div className="relative h-full p-5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-500 overflow-hidden">
                            
                            {/* Card inner glow on hover */}
                            <div className={`absolute inset-0 ${layer.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                            
                            {/* Layer number */}
                            <span className="relative z-10 absolute top-4 right-4 text-[10px] font-mono text-white/[0.06] group-hover:text-white/15 transition-colors tracking-widest">
                              {String(i + 1).padStart(2, '0')}
                            </span>

                            {/* Icon */}
                            <div className={`relative z-10 w-10 h-10 rounded-lg ${layer.bg} border ${layer.border} flex items-center justify-center mb-4 group-hover:scale-105 transition-all duration-300`}>
                              <Icon className={`w-[18px] h-[18px] ${layer.color}`} />
                            </div>

                            <h3 className="relative z-10 text-sm font-semibold text-white/90 mb-1.5 group-hover:text-white transition-colors">
                              {layer.title}
                            </h3>
                            <p className="relative z-10 text-[13px] text-white/25 leading-relaxed group-hover:text-white/50 transition-colors duration-500">
                              {layer.desc}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>

                  {/* Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 pt-8 border-t border-white/[0.05]">
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

        {/* Shimmer animation */}
        <style>{`
          @keyframes shimmer-sweep {
            0%, 100% { background-position: 200% 0; }
            50% { background-position: -200% 0; }
          }
        `}</style>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
