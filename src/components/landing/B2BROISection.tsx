import { memo } from 'react';

const STATS = [
  { value: '14×', label: 'More creative variants per sprint' },
  { value: '92%', label: 'Reduction in agency production cost' },
  { value: '< 6 min', label: 'From brief to first cut' },
  { value: '40+', label: 'Languages out of the box' },
];

export const B2BROISection = memo(function B2BROISection() {
  return (
    <section className="relative z-10 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0A84FF]/15 via-transparent to-[#0A84FF]/5 p-10 md:p-16">
          <div className="absolute -top-32 -right-32 w-[24rem] h-[24rem] rounded-full bg-[#0A84FF]/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-[24rem] h-[24rem] rounded-full bg-[#0A84FF]/10 blur-3xl pointer-events-none" />

          <div className="relative text-center mb-12">
            <p className="text-[11px] font-medium text-[#0A84FF] tracking-[0.22em] uppercase mb-3">
              The numbers
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
              The economics of an in-house studio.
            </h2>
            <p className="mt-4 text-white/55 max-w-2xl mx-auto font-light">
              Replace expensive shoots, freelance editors, and stock footage with
              one credit-based workspace.
            </p>
          </div>

          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-5 py-6 text-center"
              >
                <div className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">
                  {s.value}
                </div>
                <div className="text-[11px] tracking-[0.16em] uppercase text-white/40 mt-2 leading-snug">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

B2BROISection.displayName = 'B2BROISection';