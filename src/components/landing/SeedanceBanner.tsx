import { Sparkles, Zap } from 'lucide-react';

export function SeedanceBanner() {
  return (
    <section className="relative overflow-hidden py-32 px-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A84FF]/5 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, hsl(210 100% 56% / 0.6), transparent 60%)',
        }}
      />
      {/* Animated grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-10 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#0A84FF]" />
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/70 font-[Instrument_Sans]">
            Now Powered By
          </span>
        </div>

        {/* Massive wordmark */}
        <h2
          className="font-[Sora] font-black tracking-[-0.05em] leading-[0.85] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40"
          style={{
            fontSize: 'clamp(4rem, 16vw, 14rem)',
          }}
        >
          SEEDANCE
        </h2>

        {/* Version chip */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/30" />
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-[#0A84FF]/40 rounded-full" />
            <span
              className="relative font-[Sora] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#0A84FF] via-[#5AC8FA] to-[#0A84FF]"
              style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}
            >
              2.0
            </span>
          </div>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/30" />
        </div>

        {/* Subline */}
        <p className="mt-12 max-w-2xl mx-auto text-base md:text-lg text-white/60 font-[Instrument_Sans] leading-relaxed">
          The next generation cinematic engine. Hyper-real motion, native sound,
          and frame-perfect direction — built into every clip you create.
        </p>

        {/* Spec ticker */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[11px] font-medium tracking-[0.18em] uppercase text-white/40 font-[Instrument_Sans]">
          <span className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-[#0A84FF]" />
            1080p Native
          </span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Cinematic Motion</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Synced Audio</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Director-Grade Control</span>
        </div>
      </div>
    </section>
  );
}