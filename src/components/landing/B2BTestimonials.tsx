import { memo } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import posterCmo from '@/assets/landing-poster-cmo.jpg';

const QUOTES = [
  {
    quote:
      "We replaced two video agencies and our entire stock-footage budget. Apex now ships 80% of our paid social — and the creative tests harder than what we paid $40k for.",
    name: 'Marcus Halden',
    role: 'VP Marketing, Northwind',
    avatar: posterCmo,
    metric: '14× variants / sprint',
  },
  {
    quote:
      "The brand kit lock is the killer feature. Every render comes back on-brand the first time. Our brand manager went from gatekeeper to enabler overnight.",
    name: 'Priya Anand',
    role: 'Head of Brand, Lattice',
    avatar: null,
    metric: '0 off-brand exports',
  },
  {
    quote:
      "We launched in 11 markets simultaneously. One brief, eleven languages, all rendered, reviewed and live in under 48 hours. That used to be a six-week project.",
    name: 'Jonas Weber',
    role: 'Global Growth Lead, Helios',
    avatar: null,
    metric: '11 markets · 48 hours',
  },
];

function Initial({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('');
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0A84FF]/40 to-[#0A84FF]/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-white">
      {initials}
    </div>
  );
}

export const B2BTestimonials = memo(function B2BTestimonials() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-4">
            From the desks of CMOs
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
            Built for teams that ship.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {QUOTES.map((q, i) => (
            <motion.div
              key={q.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl overflow-hidden p-7 lg:p-8 flex flex-col"
              style={{
                background:
                  'linear-gradient(180deg, hsla(220, 14%, 7%, 0.6), hsla(220, 14%, 3%, 0.9))',
                border: '1px solid hsla(0,0%,100%,0.06)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 30px 80px -30px rgba(0,0,0,0.6), 0 1px 0 hsla(0,0%,100%,0.05) inset',
              }}
            >
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <Quote className="w-7 h-7 text-[#0A84FF]/60 mb-4" strokeWidth={1.5} />

              <p className="text-[14.5px] text-white/75 leading-relaxed font-light flex-1">
                "{q.quote}"
              </p>

              <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center gap-3">
                {q.avatar ? (
                  <img
                    src={q.avatar}
                    alt={q.name}
                    loading="lazy"
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <Initial name={q.name} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{q.name}</p>
                  <p className="text-xs text-white/75 truncate">{q.role}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-widest text-white/65">Result</p>
                  <p className="text-xs text-[#0A84FF] font-medium tabular-nums">{q.metric}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

B2BTestimonials.displayName = 'B2BTestimonials';
