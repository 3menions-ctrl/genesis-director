import { memo, useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Sparkles, Zap, Film, Wand2, ArrowRight } from 'lucide-react';

/**
 * Epic Seedance 2.0 reveal — pinned cinematic section with parallax
 * orbital rings, stat constellation, and animated marquee headline.
 */
export const SeedanceSection = memo(function SeedanceSection({
  onCta,
}: { onCta?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const yBg = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);
  const yTitle = useTransform(scrollYProgress, [0, 1], ['12%', '-12%']);
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0.2, 1, 1, 0.2]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const ringRotateRev = useTransform(scrollYProgress, [0, 1], [0, -180]);

  return (
    <section
      ref={ref}
      id="seedance"
      className="relative z-10 overflow-hidden"
      style={{ minHeight: '120vh' }}
      aria-label="Introducing Seedance 2.0"
    >
      {/* Backdrop layer */}
      <motion.div
        aria-hidden
        style={{ y: reduce ? 0 : yBg }}
        className="absolute inset-0 -z-10"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, hsla(212,100%,40%,0.32), transparent 55%), radial-gradient(ellipse at 50% 100%, hsla(195,100%,55%,0.18), transparent 60%), #000',
          }}
        />
        {/* Faint grid */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(hsla(0,0%,100%,0.06) 1px, transparent 1px), linear-gradient(90deg, hsla(0,0%,100%,0.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage:
              'radial-gradient(ellipse at center, black 25%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 25%, transparent 75%)',
          }}
        />
      </motion.div>

      {/* Orbital rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          aria-hidden
          style={{ rotate: reduce ? 0 : ringRotate }}
          className="absolute w-[120vmin] h-[120vmin] rounded-full border border-white/[0.07]"
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
            style={{ background: '#9DCBFF', boxShadow: '0 0 18px hsla(212,100%,55%,0.9)' }}
          />
        </motion.div>
        <motion.div
          aria-hidden
          style={{ rotate: reduce ? 0 : ringRotateRev }}
          className="absolute w-[80vmin] h-[80vmin] rounded-full border border-white/[0.05]"
        >
          <div
            className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{ background: '#5AC8FA', boxShadow: '0 0 14px hsla(195,100%,60%,0.85)' }}
          />
        </motion.div>
        <motion.div
          aria-hidden
          style={{ rotate: reduce ? 0 : ringRotate }}
          className="absolute w-[44vmin] h-[44vmin] rounded-full border border-white/[0.08]"
        />
        {/* Core orb */}
        <motion.div
          aria-hidden
          animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-[18vmin] h-[18vmin] rounded-full"
          style={{
            background:
              'radial-gradient(circle, hsla(212,100%,70%,0.95), hsla(212,100%,45%,0.4) 45%, transparent 70%)',
            filter: 'blur(2px)',
            boxShadow:
              '0 0 120px 30px hsla(212,100%,55%,0.45), inset 0 0 60px hsla(195,100%,80%,0.4)',
          }}
        />
      </div>

      {/* Content */}
      <motion.div
        style={{ opacity }}
        className="relative max-w-7xl mx-auto px-6 md:px-10 pt-32 pb-40 text-center"
      >
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 0.7 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/12 bg-white/[0.04] backdrop-blur-md"
        >
          <span
            className="relative flex w-1.5 h-1.5"
          >
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#0A84FF', opacity: 0.6 }} />
            <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: '#0A84FF' }} />
          </span>
          <span className="text-[10px] tracking-[0.34em] uppercase text-white/75 font-medium">
            Now Live · Generation Engine
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          style={{ y: reduce ? 0 : yTitle }}
          className="font-display font-bold tracking-tight mt-8 leading-[0.92]"
        >
          <span className="block text-white/35 text-base md:text-lg tracking-[0.4em] uppercase mb-6 font-medium">
            Introducing
          </span>
          <span
            className="block text-[20vw] md:text-[14vw] lg:text-[180px]"
            style={{
              background:
                'linear-gradient(180deg, #ffffff 0%, #9DCBFF 55%, #0A84FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.04em',
              filter: 'drop-shadow(0 12px 60px hsla(212,100%,55%,0.35))',
            }}
          >
            Seedance
          </span>
          <motion.span
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-baseline gap-3 mt-2"
          >
            <span
              className="font-display text-5xl md:text-7xl lg:text-8xl"
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
            <span
              className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-white/45 font-medium"
            >
              Generation
            </span>
          </motion.span>
        </motion.h2>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-white/65 text-lg md:text-xl font-light max-w-2xl mx-auto mt-10 leading-relaxed"
        >
          A new motion engine. Cinematic in a single take, brand-locked across
          every shot, and shipped at the speed of thought.
        </motion.p>

        {/* Stats constellation */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-15%' }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-px mt-20 max-w-5xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] backdrop-blur"
        >
          <Stat icon={Zap} kicker="Render time" value="3.4s" copy="per cinematic second" />
          <Stat icon={Film} kicker="Native resolution" value="4K" copy="HDR · 24/30/60 fps" />
          <Stat icon={Wand2} kicker="Identity lock" value="99.2%" copy="character consistency" />
          <Stat icon={Sparkles} kicker="Shots per minute" value="40+" copy="throughput on Pro" />
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-14"
        >
          <button
            onClick={onCta}
            className="group relative h-14 px-8 rounded-full text-sm font-medium text-white inline-flex items-center gap-2 transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(90deg, #0A84FF, #5AC8FA)',
              boxShadow: '0 0 40px hsla(212,100%,55%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.25)',
            }}
          >
            <span>Generate with Seedance 2.0</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <a
            href="#features"
            className="h-14 px-7 rounded-full text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] inline-flex items-center transition-all"
          >
            See it in motion
          </a>
        </motion.div>
      </motion.div>

      {/* Bottom marquee */}
      <div
        className="relative border-y border-white/[0.06] py-5 overflow-hidden"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(10,132,255,0.08), rgba(0,0,0,0.85))',
        }}
      >
        <motion.div
          aria-hidden
          animate={reduce ? undefined : { x: ['0%', '-50%'] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
          className="flex gap-12 whitespace-nowrap will-change-transform"
        >
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex gap-12 items-center">
              {[
                'Seedance 2.0',
                'Cinematic motion',
                'Brand-locked identity',
                'Native 4K HDR',
                '4× faster',
                'Native dialogue',
                'Multi-character',
                'Production ready',
              ].map((word, i) => (
                <span key={`${dup}-${i}`} className="flex items-center gap-12">
                  <span
                    className="font-display text-3xl md:text-5xl font-bold tracking-tight"
                    style={{
                      background:
                        i % 2 === 0
                          ? 'linear-gradient(90deg,#fff,#9DCBFF)'
                          : 'linear-gradient(90deg,#9DCBFF,#0A84FF)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {word}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

function Stat({
  icon: Icon, kicker, value, copy,
}: { icon: React.ComponentType<{ className?: string }>; kicker: string; value: string; copy: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
      }}
      className="relative px-6 py-8 text-left bg-black/40 backdrop-blur"
    >
      <Icon className="w-4 h-4 text-[#9DCBFF] mb-4" />
      <p className="text-[10px] tracking-[0.28em] uppercase text-white/40 font-medium mb-2">
        {kicker}
      </p>
      <p
        className="font-display text-4xl md:text-5xl font-bold tracking-tight"
        style={{
          background: 'linear-gradient(180deg,#fff,#9DCBFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </p>
      <p className="text-xs text-white/50 mt-2 font-light">{copy}</p>
    </motion.div>
  );
}

SeedanceSection.displayName = 'SeedanceSection';
