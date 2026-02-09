import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';

// Optimized animation variants - static objects
const heroLetterVariants = {
  hidden: (isApex: boolean) => ({ 
    y: 150, 
    opacity: 0, 
    rotateX: -90,
    rotateY: isApex ? 15 : -15
  }),
  visible: { 
    y: 0, 
    opacity: 1, 
    rotateX: 0,
    rotateY: 0
  }
};

export const HeroTitle = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function HeroTitle(_, ref) {
    return (
      <div ref={ref} className="relative mb-8">
        {/* Optimized glow - static gradient, no animation for stability */}
        <div 
          className="absolute inset-0 blur-[80px] pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at center, rgba(255,255,255,0.2) 0%, rgba(100,100,255,0.08) 40%, transparent 70%)',
          }}
        />
        
        <motion.div
          initial={{ rotateX: 25, rotateY: -5, scale: 0.9 }}
          animate={{ rotateX: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <h1 className="relative text-[clamp(3rem,15vw,12rem)] font-black leading-[0.85] tracking-[-0.04em]">
            <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
              {'APEX'.split('').map((letter, i) => (
                <motion.span
                  key={`apex-${i}`}
                  className="inline-block text-white"
                  custom={true}
                  variants={heroLetterVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 1.2, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ 
                    transformOrigin: 'bottom center',
                    transformStyle: 'preserve-3d',
                    textShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 60px rgba(255,255,255,0.1)',
                    willChange: 'transform, opacity'
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
            
            <motion.span
              className="inline-block mx-2 md:mx-6 text-white/20"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              –
            </motion.span>
            
            <span className="inline-block" style={{ transformStyle: 'preserve-3d' }}>
              {'STUDIO'.split('').map((letter, i) => (
                <motion.span
                  key={`studio-${i}`}
                  className="inline-block text-white/30"
                  custom={false}
                  variants={heroLetterVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 1.2, delay: 0.6 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  style={{ 
                    transformOrigin: 'bottom center',
                    transformStyle: 'preserve-3d',
                    textShadow: '0 4px 30px rgba(0,0,0,0.3)',
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
          className="absolute -bottom-6 left-1/2 h-[2px]"
          initial={{ width: 0, x: '-50%', opacity: 0 }}
          animate={{ width: '70%', opacity: 1 }}
          transition={{ duration: 1.5, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            boxShadow: '0 0 20px rgba(255,255,255,0.3)',
          }}
        />
      </div>
    );
  }
));

HeroTitle.displayName = 'HeroTitle';
