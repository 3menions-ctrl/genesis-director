import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Camera, Layers, Eye, Shield, Brain, Music, Zap } from 'lucide-react';

const LAYERS = [
  { icon: <Lock className="w-4 h-4" />, title: 'Identity Lock', desc: '3-point character bible prevents morphing' },
  { icon: <Camera className="w-4 h-4" />, title: 'Cinematography', desc: '12 movements, 14 angles, 9 lighting styles' },
  { icon: <Layers className="w-4 h-4" />, title: 'Frame Chaining', desc: 'Sequential continuity across every cut' },
  { icon: <Eye className="w-4 h-4" />, title: 'Cinematic Auditor', desc: 'Pre-gen review catches physics violations' },
  { icon: <Shield className="w-4 h-4" />, title: 'Hallucination Filter', desc: '25 negative prompts remove AI artifacts' },
  { icon: <Brain className="w-4 h-4" />, title: 'Smart Script', desc: 'Concept → shot list → timeline' },
  { icon: <Music className="w-4 h-4" />, title: 'Audio Intelligence', desc: 'TTS, scoring, dialogue ducking' },
  { icon: <Zap className="w-4 h-4" />, title: 'Multi-Model', desc: 'Kling & Veo, unified pipeline' },
] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: 0.15 + i * 0.06, ease: [0.16, 1, 0.3, 1] as const }
  })
};

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    return (
      <section ref={ref} id="features" className="relative z-10 py-28 md:py-36 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-6"
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              8 layers of intelligence
            </h2>
            <p className="text-lg text-white/35 max-w-lg mx-auto mb-2">
              Between your idea and the final video.
            </p>
            <p className="text-sm text-white/20">
              Powered by <span className="text-white/40 font-medium">Kling</span> & <span className="text-white/40 font-medium">Veo</span> — orchestrated by Apex
            </p>
          </motion.div>

          {/* Layer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-16">
            {LAYERS.map((layer, i) => (
              <motion.div
                key={layer.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={cardVariants}
                className="group relative"
              >
                <div className="relative p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500 h-full">
                  {/* Layer number */}
                  <span className="absolute top-4 right-4 text-[10px] font-mono text-white/10 tracking-wider">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 group-hover:bg-white/[0.08] group-hover:border-white/[0.15] transition-all">
                    <div className="text-white/50 group-hover:text-white/80 transition-colors">
                      {layer.icon}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-white/90 mb-1.5 group-hover:text-white transition-colors">
                    {layer.title}
                  </h3>
                  <p className="text-xs text-white/30 leading-relaxed group-hover:text-white/45 transition-colors">
                    {layer.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA to full page */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <Link
              to="/how-it-works"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-white/60 bg-white/[0.03] border border-white/[0.08] hover:text-white hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300"
            >
              See the full pipeline
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
