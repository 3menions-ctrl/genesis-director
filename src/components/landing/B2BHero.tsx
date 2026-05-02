import { memo, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Star, Play } from 'lucide-react';
import heroImage from '@/assets/landing-immersive-hero.jpg';
import corporateVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import { HOPPY_INTRO_EVENT, HOPPY_MP4_URL } from './HoppyImmersiveIntro';

interface Props {
  onPrimary: () => void;
  onSecondary: () => void;
}

const ROTATING_WORDS = ['ads', 'launch films', 'social cuts', 'product reels'];

export const B2BHero = memo(function B2BHero({ onPrimary, onSecondary }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const deviceY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const deviceScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const bgOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

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
      {/* Background corporate video loop with parallax */}
      <motion.div style={{ y: bgY, opacity: bgOpacity }} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <video
          src={corporateVideo.url}
          poster={heroImage}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.32] scale-[1.04]"
        />
        {/* Film grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.95) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
      </motion.div>

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
          onClick={openHoppy}
          variant="ghost"
          size="lg"
          className="group h-14 pl-3 pr-7 text-[15px] font-medium rounded-full text-white/90 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]"
        >
          <span className="flex items-center justify-center w-9 h-9 mr-2.5 rounded-full bg-gradient-to-br from-[#0A84FF] to-[#0651AA] text-white shadow-[0_4px_16px_rgba(10,132,255,0.5)] transition-transform group-hover:scale-110">
            <Play className="w-3.5 h-3.5 ml-0.5 fill-white" />
          </span>
          Watch 60-sec demo
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

      {/* Hero device — premium glass preview with the same 60-sec demo video */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{ y: deviceY, scale: deviceScale }}
        className="relative mt-24 w-full max-w-6xl"
      >
        <div
          className="pointer-events-none absolute -inset-12 rounded-[3rem] opacity-90"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 30%, hsla(212, 100%, 50%, 0.35), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div className="pointer-events-none absolute -top-px inset-x-20 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />
        <div
          className="relative rounded-[28px] overflow-hidden backdrop-blur-2xl"
          style={{
            border: '1px solid hsla(0,0%,100%,0.10)',
            boxShadow:
              '0 1px 0 hsla(0,0%,100%,0.12) inset, 0 80px 160px -40px rgba(0,0,0,0.95), 0 0 120px -30px hsla(212,100%,50%,0.3)',
          }}
        >
          <video
            src={HOPPY_MP4_URL}
            poster={heroImage}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Apex-Studio in motion — silent demo"
            className="w-full h-auto block"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="hidden md:flex absolute -bottom-6 left-1/2 -translate-x-1/2 items-center gap-3 px-6 py-3.5 rounded-full border border-white/[0.12] bg-black/60 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_60px_-20px_rgba(10,132,255,0.4)]"
        >
          <div className="flex -space-x-2">
            {['from-[#0A84FF] to-blue-700','from-white/80 to-white/30','from-[#7DD3FC] to-[#0A84FF]'].map((g, i) => (
              <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-black ring-1 ring-white/10`} />
            ))}
          </div>
          <span className="w-px h-5 bg-white/15" />
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-[#FFD60A] text-[#FFD60A]" />)}
          </div>
          <span className="text-[12px] text-white/80 font-medium tracking-tight">
            Loved by 1,000+ marketing teams
          </span>
        </motion.div>
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