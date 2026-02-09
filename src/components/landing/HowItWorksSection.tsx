import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  { step: '01', title: 'Describe', desc: 'Write what you want to see. Be as detailed or simple as you like.' },
  { step: '02', title: 'Generate', desc: 'AI creates your video scene by scene with cinematic quality.' },
  { step: '03', title: 'Export', desc: 'Download in HD or 4K. Share anywhere instantly.' },
] as const;

const StepCard = memo(forwardRef<HTMLDivElement, { item: typeof STEPS[number]; index: number }>(
  function StepCard({ item, index }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 + index * 0.15 }}
        className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]"
      >
        <span className="text-6xl font-bold text-white/[0.06] absolute top-6 right-6">
          {item.step}
        </span>
        <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
        <p className="text-white/40 leading-relaxed">{item.desc}</p>
      </motion.div>
    );
  }
));
StepCard.displayName = 'StepCard';

export const HowItWorksSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function HowItWorksSection(_, ref) {
    return (
      <section ref={ref} id="features" className="relative z-10 py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              Three simple steps
            </h2>
            <p className="text-lg text-white/40 max-w-md mx-auto">
              From idea to video in minutes, not hours.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-4">
            {STEPS.map((item, i) => (
              <StepCard key={item.step} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }
));

HowItWorksSection.displayName = 'HowItWorksSection';
