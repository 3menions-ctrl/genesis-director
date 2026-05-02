import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Play } from 'lucide-react';
import { HOPPY_INTRO_EVENT } from './HoppyImmersiveIntro';

interface Props {
  onPrimary: () => void;
  onSecondary: () => void;
}

const ROTATING_WORDS = ['ads', 'launch films', 'social cuts', 'product reels'];

export const B2BHero = memo(function B2BHero({ onPrimary, onSecondary }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [wordIndex, setWordIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWordIndex((i) => (i + 1) % ROTATING_WORDS.length), 2800);
    return () => clearInterval(id);
  }, []);

  const openHoppy = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(HOPPY_INTRO_EVENT));
    }
  };
  return (
    <section ref={sectionRef} className="relative z-10 min-h-[100vh] flex flex-col items-center justify-center px-6 pt-36 pb-20 overflow-hidden">
      {/* Floating ambient orbs — cinematic key + fill */}
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-40 left-1/4 -translate-x-1/2 w-[700px] h-[700px] opacity-70"
        style={{
          background:
            'radial-gradient(circle, hsla(212, 100%, 50%, 0.22), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
      <motion.div
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 40, -20, 0],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="pointer-events-none absolute top-20 right-1/4 translate-x-1/2 w-[500px] h-[500px] opacity-60"
        style={{
          background:
            'radial-gradient(circle, hsla(200, 100%, 60%, 0.14), transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Editorial eyebrow chip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl mb-10 shadow-[0_8px_32px_-8px_rgba(10,132,255,0.25)]"
      >
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-[#0A84FF] animate-ping opacity-75" />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-[#0A84FF]" />
        </span>
        <span className="text-[10.5px] font-medium text-white/65 tracking-[0.28em] uppercase">
          Apex-Studio · AI Video, Made Cinematic
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="text-white text-center max-w-6xl"
        style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
      >
        <motion.span
          initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="block text-[2.5rem] sm:text-6xl md:text-7xl lg:text-[6.75rem] font-bold tracking-[-0.04em] leading-[0.95]"
        >
          A month of
        </motion.span>
        {/* Rotating editorial word */}
        <motion.span
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative block text-[3.25rem] sm:text-7xl md:text-8xl lg:text-[8.5rem] font-light tracking-[-0.045em] leading-[0.92] my-1 h-[1.05em] overflow-hidden"
          style={{
            fontFamily: "'Fraunces', 'Sora', serif",
            fontStyle: 'italic',
            fontVariationSettings: "'opsz' 144, 'SOFT' 50",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={wordIndex}
              initial={{ y: '100%', opacity: 0, filter: 'blur(8px)' }}
              animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: '-100%', opacity: 0, filter: 'blur(8px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent whitespace-nowrap"
            >
              {ROTATING_WORDS[wordIndex]}
            </motion.span>
          </AnimatePresence>
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="block text-[2.5rem] sm:text-6xl md:text-7xl lg:text-[6.75rem] font-bold tracking-[-0.04em] leading-[0.95]"
        >
          shipped this afternoon.
        </motion.span>
      </motion.h1>

      {/* Premium subhead — narrower, refined */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="mt-12 max-w-xl text-center text-[17px] md:text-[19px] text-white/60 font-light leading-[1.65] tracking-[-0.005em]"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
        Type a prompt. Get{' '}
        <span
          className="text-white/85 italic"
          style={{ fontFamily: "'Fraunces', serif", fontVariationSettings: "'opsz' 32" }}
        >
          on-brand cinema
        </span>{' '}
        in minutes — no crew, no edit suite, no contracts.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="relative mt-12 flex flex-col sm:flex-row items-center gap-3"
      >
        <Button
          onClick={onPrimary}
          size="lg"
          className="group h-14 px-8 text-[15px] font-medium rounded-full bg-white text-black hover:bg-white/95 shadow-[0_20px_60px_-15px_rgba(255,255,255,0.4),0_0_80px_-20px_rgba(10,132,255,0.5)] transition-all duration-300 hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Create your first video
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
        <Button
          onClick={onSecondary}
          variant="ghost"
          size="lg"
          className="h-14 px-7 text-[15px] font-medium rounded-full text-white/55 hover:text-white hover:bg-white/[0.04]"
        >
          Talk to sales
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="relative mt-8 flex flex-wrap items-center justify-center gap-5 text-[11px] text-white/35 tracking-[0.15em] uppercase"
      >
        <span>Free to start</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>No credit card</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>$0.10 per credit</span>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.4 }}
        className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-white/30"
      >
        <span className="text-[9px] tracking-[0.4em] uppercase">Scroll</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent"
        />
      </motion.div>
    </section>
  );
});

B2BHero.displayName = 'B2BHero';