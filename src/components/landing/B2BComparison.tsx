import { memo } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const ROWS = [
  { label: 'Time from brief to first cut', old: '3–6 weeks', us: 'Under 6 minutes' },
  { label: 'Cost per ad variant', old: '$8k–$25k', us: '~$2 in credits' },
  { label: 'Brand consistency', old: 'Manual review per asset', us: 'Locked at workspace level' },
  { label: 'Localization', old: 'Re-shoot or dub agency', us: '40+ languages, one click' },
  { label: 'Approval audit trail', old: 'Email threads & decks', us: 'Versioned, role-gated, exportable' },
  { label: 'Team workflow', old: 'Hand-offs & file chaos', us: 'One workspace, one URL' },
];

export const B2BComparison = memo(function B2BComparison() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[11px] font-medium text-primary tracking-[0.22em] uppercase mb-4">
            The shift
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.05]">
            Stop renting a video team.<br className="hidden md:block" />
            <span className="text-white/75">Start owning a studio.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 14%, 7%, 0.6), hsla(220, 14%, 3%, 0.9))',
            border: '1px solid hsla(0,0%,100%,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow:
              '0 1px 0 hsla(0,0%,100%,0.05) inset, 0 40px 100px -30px rgba(0,0,0,0.7), 0 0 80px -30px hsla(212, 100%, 50%, 0.18)',
          }}
        >
          <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Header */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 px-6 md:px-10 py-5 border-b border-white/[0.06] text-[10px] uppercase tracking-[0.2em] text-white/35 font-medium">
            <div />
            <div className="text-center">The old way</div>
            <div className="text-center text-primary">With Small Bridges</div>
          </div>

          {ROWS.map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className={`grid grid-cols-[1.4fr_1fr_1fr] gap-3 items-center px-6 md:px-10 py-5 ${
                i !== ROWS.length - 1 ? 'border-b border-white/[0.04]' : ''
              }`}
            >
              <div className="text-sm text-white/85 font-medium tracking-tight">
                {row.label}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm text-white/75">
                <X className="w-3.5 h-3.5 text-rose-400/60 shrink-0" strokeWidth={2.5} />
                <span className="text-center line-through decoration-white/15">{row.old}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2.5} />
                <span className="text-center text-white font-medium">{row.us}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

B2BComparison.displayName = 'B2BComparison';
