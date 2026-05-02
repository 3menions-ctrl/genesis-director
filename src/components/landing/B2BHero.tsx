import { memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Star, Play } from 'lucide-react';
import heroImage from '@/assets/landing-immersive-hero.jpg';
import corporateVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import { HOPPY_INTRO_EVENT } from './HoppyImmersiveIntro';

interface Props {
  onPrimary: () => void;
  onSecondary: () => void;
}

export const B2BHero = memo(function B2BHero({ onPrimary, onSecondary }: Props) {
  const openHoppy = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(HOPPY_INTRO_EVENT));
    }
  };
  return (
    <section className="relative z-10 min-h-[100vh] flex flex-col items-center justify-center px-6 pt-36 pb-20 overflow-hidden">
      {/* Background corporate video loop */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
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
      </div>

      {/* Dual ambient glow — cinematic key + fill */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 -translate-x-1/2 w-[700px] h-[700px] opacity-70"
        style={{
          background:
            'radial-gradient(circle, hsla(212, 100%, 50%, 0.22), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
      <div
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
          Apex Studio · AI Video for Brand Teams
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="font-display text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[7.25rem] font-bold text-white text-center tracking-[-0.035em] leading-[0.96] max-w-6xl"
      >
        Ship a month of
        <br />
        <span className="relative inline-block">
          <span className="bg-gradient-to-br from-white via-[#7DD3FC] to-[#0A84FF] bg-clip-text text-transparent italic font-light pr-2">
            ad&nbsp;creative
          </span>
        </span>
        <br />
        in an afternoon.
      </motion.h1>

      {/* Premium subhead — narrower, refined */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="mt-10 max-w-xl text-center text-[17px] md:text-lg text-white/55 font-light leading-[1.7] tracking-[0.005em]"
      >
        The AI video platform for marketing teams who refuse to compromise.
        On-brand cinema at the speed of a creative brief — with workspace
        controls, locked brand kits and approvals built in.
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
          Start free workspace
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
          Watch the film
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
        <span>No credit card</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>SSO available</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>Pay-as-you-go credits</span>
      </motion.div>

      {/* Hero device — premium glass preview */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
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
        {/* Top reflection line */}
        <div className="pointer-events-none absolute -top-px inset-x-20 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />
        <div
          className="relative rounded-[28px] overflow-hidden backdrop-blur-2xl"
          style={{
            border: '1px solid hsla(0,0%,100%,0.10)',
            boxShadow:
              '0 1px 0 hsla(0,0%,100%,0.12) inset, 0 80px 160px -40px rgba(0,0,0,0.95), 0 0 120px -30px hsla(212,100%,50%,0.3)',
          }}
        >
          <img
            src={heroImage}
            alt="Apex Studio workspace preview"
            width={1920}
            height={1080}
            className="w-full h-auto block"
          />
          {/* Bottom fade into page */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
        </div>

        {/* Float review chip */}
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