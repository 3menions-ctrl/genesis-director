import { memo } from 'react';

const LOGOS = [
  'Northwind',
  'Acme Co.',
  'Lattice',
  'Helios',
  'Forma',
  'Vertex',
  'Nimbus',
  'Atlas',
];

export const B2BLogoBar = memo(function B2BLogoBar() {
  return (
    <section className="relative z-10 py-12 px-6 border-y border-white/[0.04] bg-white/[0.01]">
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-[11px] font-medium text-white/65 tracking-[0.22em] uppercase mb-6">
          Trusted by marketing & growth teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {LOGOS.map((name) => (
            <span
              key={name}
              className="text-base md:text-lg font-display font-semibold text-white/35 hover:text-white/60 transition-colors duration-300 tracking-tight"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
});

B2BLogoBar.displayName = 'B2BLogoBar';