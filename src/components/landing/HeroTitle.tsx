import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';

export const HeroTitle = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function HeroTitle(_, ref) {
    return (
      <div ref={ref} className="relative mb-12">
        {/* Ambient glow behind text */}
        <div 
          className="absolute inset-0 blur-[120px] pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at center, rgba(249,115,22,0.35) 0%, rgba(251,191,36,0.15) 40%, transparent 70%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* APEX - bold, gradient, dominant */}
          <h1 className="relative text-center">
            <motion.span
              className="block text-[clamp(4rem,18vw,14rem)] font-black leading-[0.85] tracking-[-0.05em]"
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #f9a825 40%, #f97316 80%, #c2410c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 4px 40px rgba(249,115,22,0.3)) drop-shadow(0 0 80px rgba(251,191,36,0.15))',
              }}
            >
              APEX
            </motion.span>

            {/* Decorative line */}
            <motion.div
              className="mx-auto my-3 h-[1px]"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '40%', opacity: 1 }}
              transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.6), rgba(251,191,36,0.8), rgba(249,115,22,0.6), transparent)',
                boxShadow: '0 0 12px rgba(249,115,22,0.4)',
              }}
            />

            {/* STUDIO - refined, spaced, ethereal */}
            <motion.span
              className="block text-[clamp(1.2rem,5vw,3.5rem)] font-light tracking-[0.4em] uppercase text-white/40"
              initial={{ opacity: 0, y: 20, letterSpacing: '0.8em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0.4em' }}
              transition={{ duration: 1.2, delay: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                textShadow: '0 0 30px rgba(255,255,255,0.08)',
              }}
            >
              STUDIO
            </motion.span>
          </h1>
        </motion.div>
      </div>
    );
  }
));

HeroTitle.displayName = 'HeroTitle';
