import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HeroTitle } from './HeroTitle';

interface HeroSectionProps {
  onEnterStudio: () => void;
}

export const HeroSection = memo(forwardRef<HTMLElement, HeroSectionProps>(
  function HeroSection({ onEnterStudio }, ref) {
    return (
      <section ref={ref} className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Floating holographic particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                top: `${15 + i * 10}%`,
                left: `${8 + i * 12}%`,
                background: i % 2 === 0 ? 'hsl(263 70% 58%)' : 'hsl(195 90% 50%)',
                boxShadow: i % 2 === 0 
                  ? '0 0 6px hsl(263 70% 58% / 0.4)' 
                  : '0 0 6px hsl(195 90% 50% / 0.4)',
                animation: `particle-drift ${4 + i * 0.7}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
                ['--drift-x' as string]: `${(i % 3 - 1) * 30}px`,
                ['--drift-y' as string]: `${-20 - i * 8}px`,
              }}
            />
          ))}
        </div>

        <div className="max-w-6xl mx-auto text-center" style={{ perspective: '1000px' }}>
          <HeroTitle />

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="text-base md:text-lg text-white/30 tracking-[0.3em] uppercase mb-16"
          >
            One Prompt. Minutes of Cinema.
          </motion.p>

          {/* CTA with holographic ring */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6 }}
            className="relative inline-block"
          >
            {/* Outer holographic ring */}
            <div className="absolute -inset-4 rounded-full animate-orbital-ring opacity-30 pointer-events-none" style={{ animationDuration: '6s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(263_70%_58%/0.6)]" />
            </div>

            <Button
              onClick={onEnterStudio}
              size="lg"
              className="group h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.15)] transition-all duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.25)]"
            >
              Enter Studio
              <ArrowRight className="w-5 h-5 ml-3 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-5 h-9 rounded-full border border-white/20 flex items-start justify-center p-1.5 animate-bounce" style={{ animationDuration: '2s' }}>
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </div>
        </motion.div>
      </section>
    );
  }
));

HeroSection.displayName = 'HeroSection';
