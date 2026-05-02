import { memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  onPrimary: () => void;
  onSecondary: () => void;
}

export const B2BHero = memo(function B2BHero({ onPrimary, onSecondary }: Props) {
  return (
    <section className="relative z-10 min-h-[90vh] flex flex-col items-center justify-center px-6 pt-32 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8"
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
        className="mt-10 flex flex-col sm:flex-row items-center gap-3"
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

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-6 text-xs text-white/30 tracking-wide"
      >
        No credit card · SSO available · Pay-as-you-go credits
      </motion.p>
    </section>
  );
});

B2BHero.displayName = 'B2BHero';