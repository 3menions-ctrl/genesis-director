import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock, Film, ScanFace, Layers } from 'lucide-react';

/**
 * Seedance 2.0 — short, dense, fully glassmorphic reveal.
 * One compact card. No opaque backdrop. Background image stays clear.
 */
export const SeedanceSection = memo(function SeedanceSection({
  onCta,
}: { onCta?: () => void }) {
  const reduce = useReducedMotion();

  // Verifiable capability claims — no fabricated benchmarks.
  const stats = [
    { icon: Film,     label: 'Clip length',  value: 'Up to 12s' },
    { icon: Clock,    label: 'Frame rate',   value: '24 fps' },
    { icon: ScanFace, label: 'Identity',     value: 'Face-locked' },
    { icon: Layers,   label: 'Chaining',     value: 'Last-frame carry' },
  ];

  return (
    <section
      id="seedance"
      aria-label="Introducing Seedance 2.0"
      className="relative z-10 px-6 py-20 md:py-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto max-w-5xl"
      >
        {/* Ambient glow behind the card — bleeds outside the glass */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10"
          style={{
            background:
              'radial-gradient(50% 60% at 50% 50%, hsla(212,100%,55%,0.22), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* THE GLASS CARD */}
        <div
          className="relative overflow-hidden rounded-[32px] px-8 md:px-14 py-12 md:py-16"
          style={{
            background:
              'linear-gradient(180deg, hsla(0,0%,100%,0.04), hsla(0,0%,100%,0.015))',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid hsla(0,0%,100%,0.10)',
            boxShadow:
              'inset 0 1px 0 hsla(0,0%,100%,0.10), 0 50px 120px -40px rgba(0,0,0,0.6), 0 0 80px -20px hsla(212,100%,55%,0.25)',
          }}
        >
          {/* Top hairline shine */}
          <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Soft orbital accent — subtle, no opacity bomb */}
          <motion.div
            aria-hidden
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute -right-24 -top-24 w-[340px] h-[340px] rounded-full border border-white/[0.06]"
          >
            <span
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: '#9DCBFF', boxShadow: '0 0 12px hsla(212,100%,60%,0.9)' }}
            />
          </motion.div>

          <div className="relative grid md:grid-cols-[1.2fr,1fr] gap-10 md:gap-14 items-center">
            {/* LEFT — title + copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-2xl">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full animate-ping bg-[#0A84FF] opacity-60" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-[#0A84FF]" />
                </span>
                <span className="text-[10px] tracking-[0.34em] uppercase text-white/75 font-medium">
                  Now Live · Generation Engine
                </span>
              </div>

              <h2
                className="font-display font-bold tracking-[-0.04em] mt-6 leading-[0.95]"
              >
                <span
                  className="block text-[64px] md:text-[88px]"
                  style={{
                    background:
                      'linear-gradient(180deg, #ffffff 0%, #9DCBFF 60%, #0A84FF 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 8px 32px hsla(212,100%,55%,0.3))',
                  }}
                >
                  Seedance
                </span>
                <span className="inline-flex items-baseline gap-3 mt-1">
                  <span
                    className="font-display text-4xl md:text-6xl"
                    style={{
                      fontStyle: 'italic',
                      background: 'linear-gradient(90deg, #5AC8FA, #ffffff)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    2.0
                  </span>
                  <span className="text-[10px] tracking-[0.32em] uppercase text-white/45 font-medium">
                    Generation
                  </span>
                </span>
              </h2>

              <p className="text-white/65 text-base md:text-lg font-light mt-6 max-w-md leading-relaxed">
                A dedicated motion engine for high-fidelity human and product
                shots. Pin it to a project, or let the router choose Seedance
                per shot when realism matters.
              </p>

              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={onCta}
                  className="group h-12 px-6 rounded-full text-sm font-medium text-white inline-flex items-center gap-2 transition-all hover:scale-[1.03]"
                  style={{
                    background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
                    boxShadow:
                      '0 0 32px hsla(212,100%,55%,0.5), inset 0 1px 0 hsla(0,0%,100%,0.25)',
                  }}
                >
                  <span>Try Seedance</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <a
                  href="#features"
                  className="h-12 px-5 rounded-full text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] inline-flex items-center transition-all"
                >
                  See it in motion
                </a>
              </div>
            </div>

            {/* RIGHT — compact stats stack */}
            <div className="grid grid-cols-2 gap-2.5">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10%' }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl px-4 py-5 border border-white/[0.08]"
                  style={{
                    background: 'hsla(0,0%,100%,0.03)',
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  }}
                >
                  <s.icon className="w-3.5 h-3.5 text-[#9DCBFF] mb-3" />
                  <p
                    className="font-display text-2xl md:text-3xl font-bold tracking-tight"
                    style={{
                      background: 'linear-gradient(180deg,#fff,#9DCBFF)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {s.value}
                  </p>
                  <p className="text-[10px] tracking-[0.22em] uppercase text-white/45 font-medium mt-1">
                    {s.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
});

SeedanceSection.displayName = 'SeedanceSection';