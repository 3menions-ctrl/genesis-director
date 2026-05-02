import { motion, AnimatePresence } from 'framer-motion';
import { User, Briefcase, Building2, ArrowRight, X } from 'lucide-react';

export type AudienceCategory = 'personal' | 'business' | 'enterprise';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (category: AudienceCategory) => void;
}

const OPTIONS: {
  id: AudienceCategory;
  title: string;
  tagline: string;
  desc: string;
  Icon: typeof User;
}[] = [
  {
    id: 'personal',
    title: 'Personal',
    tagline: 'Creators & individuals',
    desc: 'Make cinematic videos for yourself, your socials, or passion projects.',
    Icon: User,
  },
  {
    id: 'business',
    title: 'Business',
    tagline: 'Teams & growing brands',
    desc: 'Ship ads, product films and campaigns at the speed of your roadmap.',
    Icon: Briefcase,
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    tagline: 'Scale, security, contracts',
    desc: 'Volume credits, SSO, dedicated support and bespoke production pipelines.',
    Icon: Building2,
  },
];

export function CategoryChooserOverlay({ open, onClose, onSelect }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cat-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[90] flex items-center justify-center px-6"
          style={{
            background:
              'radial-gradient(60% 70% at 50% 50%, hsla(212,100%,50%,0.16), hsla(0,0%,0%,0.82) 70%)',
            backdropFilter: 'blur(28px) saturate(140%)',
            WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          }}
          onClick={onClose}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition"
          >
            <X className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl mb-6">
                <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
                <span className="text-[10.5px] font-medium text-white/65 tracking-[0.28em] uppercase">
                  Choose your track
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-6xl font-bold text-white tracking-[-0.035em] leading-[1.02]">
                Who is this{' '}
                <span
                  className="italic font-light bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  for?
                </span>
              </h2>
              <p className="mt-4 text-white/55 text-base md:text-lg font-light max-w-xl mx-auto">
                Pick the path that fits — we'll tailor your studio from the first frame.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              {OPTIONS.map(({ id, title, tagline, desc, Icon }, idx) => (
                <motion.button
                  key={id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.15 + idx * 0.08,
                  }}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelect(id)}
                  className="group relative text-left p-7 md:p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:border-[#0A84FF]/40 hover:bg-white/[0.05] backdrop-blur-2xl transition-all duration-500 overflow-hidden"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        'radial-gradient(80% 80% at 50% 0%, hsla(212,100%,52%,0.18), transparent 70%)',
                    }}
                  />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-6 group-hover:bg-[#0A84FF]/10 group-hover:border-[#0A84FF]/40 transition">
                      <Icon className="w-5 h-5 text-white/80 group-hover:text-[#9DCBFF]" />
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-white tracking-[-0.02em] mb-1.5">
                      {title}
                    </h3>
                    <p className="text-[11px] font-medium text-[#0A84FF]/80 tracking-[0.22em] uppercase mb-4">
                      {tagline}
                    </p>
                    <p className="text-sm text-white/60 leading-relaxed font-light">
                      {desc}
                    </p>
                    <div className="mt-7 inline-flex items-center gap-2 text-sm text-white/70 group-hover:text-white transition">
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CategoryChooserOverlay;