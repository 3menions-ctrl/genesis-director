import { memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Star } from 'lucide-react';
import heroImage from '@/assets/landing-immersive-hero.jpg';

interface Props {
  onPrimary: () => void;
  onSecondary: () => void;
}

export const B2BHero = memo(function B2BHero({ onPrimary, onSecondary }: Props) {
  return (
    <section className="relative z-10 min-h-[92vh] flex flex-col items-center justify-center px-6 pt-32 pb-12 overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 h-[600px] opacity-80"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 50%, hsla(212, 100%, 50%, 0.18), transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md mb-8"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] animate-pulse" />
        <span className="text-[11px] font-medium text-white/60 tracking-[0.18em] uppercase">
          AI Video for Marketing Teams
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-white text-center tracking-tight leading-[1.02] max-w-5xl"
      >
        Ship a month of{' '}
        <span className="bg-gradient-to-r from-white via-[#0A84FF] to-white bg-clip-text text-transparent">
          ad creative
        </span>
        <br />
        in an afternoon.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="mt-8 max-w-2xl text-center text-lg md:text-xl text-white/55 font-light leading-relaxed"
      >
        The AI video platform built for marketing & growth teams. Generate
        on-brand ads, social cuts and product launches at the speed of a
        creative brief — with workspace controls, brand kits, and team
        approvals.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="relative mt-10 flex flex-col sm:flex-row items-center gap-3"
      >
        <Button
          onClick={onPrimary}
          size="lg"
          className="group h-14 px-8 text-base font-medium rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_60px_rgba(255,255,255,0.12)] transition-all duration-300"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Start free workspace
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
        <Button
          onClick={onSecondary}
          variant="ghost"
          size="lg"
          className="h-14 px-8 text-base font-medium rounded-full text-white/70 hover:text-white hover:bg-white/[0.06]"
        >
          Talk to sales
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="relative mt-6 flex items-center gap-5 text-xs text-white/35 tracking-wide"
      >
        <span>No credit card</span>
        <span className="w-1 h-1 rounded-full bg-white/15" />
        <span>SSO available</span>
        <span className="w-1 h-1 rounded-full bg-white/15" />
        <span>Pay-as-you-go credits</span>
      </motion.div>

      {/* Hero device — premium glass preview */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-20 w-full max-w-5xl"
      >
        <div
          className="pointer-events-none absolute -inset-8 rounded-[2.5rem] opacity-90"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 30%, hsla(212, 100%, 50%, 0.3), transparent 70%)',
            filter: 'blur(28px)',
          }}
        />
        <div
          className="relative rounded-[24px] overflow-hidden"
          style={{
            border: '1px solid hsla(0,0%,100%,0.08)',
            boxShadow:
              '0 1px 0 hsla(0,0%,100%,0.08) inset, 0 60px 140px -40px rgba(0,0,0,0.85)',
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
          className="hidden md:flex absolute -bottom-4 left-1/2 -translate-x-1/2 items-center gap-3 px-5 py-3 rounded-full border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        >
          <div className="flex -space-x-2">
            {['from-[#0A84FF] to-blue-700','from-white/80 to-white/30','from-[#7DD3FC] to-[#0A84FF]'].map((g, i) => (
              <div key={i} className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} border-2 border-black`} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-white text-white" />)}
          </div>
          <span className="text-xs text-white/70 font-medium tracking-tight">
            Loved by 1,000+ marketing teams
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
});

B2BHero.displayName = 'B2BHero';