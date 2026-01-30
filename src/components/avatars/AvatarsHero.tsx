import { memo } from 'react';
import { motion } from 'framer-motion';
import { User, Sparkles } from 'lucide-react';

const heroLetterVariants = {
  hidden: (isFirst: boolean) => ({ 
    y: 80, 
    opacity: 0, 
    rotateX: -45,
    rotateY: isFirst ? 10 : -10
  }),
  visible: { 
    y: 0, 
    opacity: 1, 
    rotateX: 0,
    rotateY: 0
  }
};

export const AvatarsHero = memo(function AvatarsHero() {
  return (
    <section className="relative pt-24 pb-8 md:pt-32 md:pb-12 px-4 md:px-6 text-center">
      <div className="max-w-5xl mx-auto" style={{ perspective: '1000px' }}>
        {/* Floating badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm mb-8"
        >
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-white/60">AI-Powered Presenters</span>
        </motion.div>

        {/* Main title with 3D animation */}
        <div className="relative mb-6">
          {/* Glow effect */}
          <div 
            className="absolute inset-0 blur-[100px] pointer-events-none animate-pulse"
            style={{
              background: 'radial-gradient(ellipse 60% 40% at center, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)',
              animationDuration: '4s'
            }}
          />
          
          <motion.div
            initial={{ rotateX: 15, scale: 0.95 }}
            animate={{ rotateX: 0, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          >
            <h1 className="relative text-[clamp(2.5rem,10vw,7rem)] font-black leading-[0.9] tracking-[-0.03em]">
              <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
                {'CHOOSE'.split('').map((letter, i) => (
                  <motion.span
                    key={`choose-${i}`}
                    className="inline-block text-white"
                    custom={true}
                    variants={heroLetterVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    style={{ 
                      transformOrigin: 'bottom center',
                      textShadow: '0 4px 30px rgba(0,0,0,0.4)',
                      willChange: 'transform, opacity'
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
              
              <motion.span
                className="inline-block mx-2 md:mx-4 text-white/15"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                –
              </motion.span>
              
              <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
                {'AVATAR'.split('').map((letter, i) => (
                  <motion.span
                    key={`avatar-${i}`}
                    className="inline-block text-white/25"
                    custom={false}
                    variants={heroLetterVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    style={{ 
                      transformOrigin: 'bottom center',
                      textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                      willChange: 'transform, opacity'
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            </h1>
          </motion.div>

          {/* Underline */}
          <motion.div
            className="absolute -bottom-4 left-1/2 h-[2px]"
            initial={{ width: 0, x: '-50%', opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            transition={{ duration: 1.2, delay: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 50%, transparent 100%)',
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
            }}
          />
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-base md:text-lg text-white/40 max-w-md mx-auto tracking-wide"
        >
          Select a photorealistic or animated presenter for your next video
        </motion.p>
      </div>
    </section>
  );
});

export default AvatarsHero;
