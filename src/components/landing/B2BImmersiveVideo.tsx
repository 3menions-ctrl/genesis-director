import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Volume2, VolumeX } from 'lucide-react';
import heroVideo from '@/assets/landing-immersive-hero.mp4.asset.json';
import heroPoster from '@/assets/landing-immersive-hero.jpg';

export const B2BImmersiveVideo = memo(function B2BImmersiveVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative z-10 py-36 px-6">
      {/* Section ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, hsla(212,100%,50%,0.06), transparent 70%)',
        }}
      />
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-6">
            <span className="w-1 h-1 rounded-full bg-[#0A84FF]" />
            <p className="text-[10px] font-medium text-white/55 tracking-[0.32em] uppercase">
              See it in motion
            </p>
          </div>
          <h2 className="font-display text-5xl md:text-7xl font-bold text-white tracking-[-0.03em] leading-[0.98] max-w-4xl mx-auto">
            A studio
            <span className="bg-gradient-to-br from-white via-white/70 to-[#0A84FF] bg-clip-text text-transparent italic font-light"> at your fingertips.</span>
          </h2>
          <p className="mt-7 text-white/50 max-w-lg mx-auto text-[17px] font-light leading-[1.7]">
            Brief, generate, review and ship — every step happens inside one
            cinematic workspace.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Outer luminous halo */}
          <div
            className="pointer-events-none absolute -inset-10 rounded-[2.5rem] opacity-80"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 50%, hsla(212, 100%, 50%, 0.22), transparent 70%)',
              filter: 'blur(20px)',
            }}
          />

          {/* Glass frame */}
          <div
            className="relative rounded-[28px] overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, hsla(220, 14%, 8%, 0.6), hsla(220, 14%, 3%, 0.9))',
              border: '1px solid hsla(0, 0%, 100%, 0.08)',
              boxShadow:
                '0 1px 0 hsla(0,0%,100%,0.08) inset, 0 60px 140px -40px rgba(0,0,0,0.85), 0 0 100px -30px hsla(212, 100%, 50%, 0.25)',
            }}
          >
            {/* Top hairline */}
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-20" />

            {/* Browser chrome */}
            <div className="relative z-10 flex items-center gap-2 px-5 py-3 border-b border-white/[0.05] bg-black/40">
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-white/[0.04] text-[10px] tracking-widest uppercase text-white/65 font-mono">
                  studio.smallbridges.com
                </div>
              </div>
              <button
                onClick={() => {
                  setMuted((m) => {
                    if (ref.current) ref.current.muted = !m;
                    return !m;
                  });
                }}
                className="text-white/75 hover:text-white transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Video */}
            <div className="relative aspect-video bg-black">
              <video
                ref={ref}
                src={heroVideo.url}
                poster={heroPoster}
                muted={muted}
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
              {/* Cinematic letterbox vignette */}
              <div className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
              />
              {/* Soft play indicator if not in view */}
              {!inView && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom shine */}
            <div className="absolute inset-x-12 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Floating stat chips */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="hidden md:flex absolute -left-6 top-1/3 items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_hsl(142,70%,55%)]" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/75">Render</p>
              <p className="text-xs font-medium text-white tabular-nums">4m 12s · 1080p</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="hidden md:flex absolute -right-6 bottom-1/4 items-center gap-3 px-4 py-3 rounded-2xl border border-[#0A84FF]/30 bg-[#0A84FF]/[0.08] backdrop-blur-xl shadow-[0_20px_60px_-20px_hsla(212,100%,50%,0.4)]"
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/50">Brand-locked</p>
              <p className="text-xs font-medium text-white">12 variants ready</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
});

B2BImmersiveVideo.displayName = 'B2BImmersiveVideo';
