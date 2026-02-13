import { memo, forwardRef } from 'react';

/**
 * Ultra-minimal background for the Projects page.
 * Subtle grain texture + faint radial vignette. No busy SVGs or animated orbs.
 */
const ProjectsBackground = memo(forwardRef<HTMLDivElement, Record<string, never>>(function ProjectsBackground(_, ref) {
  return (
    <div ref={ref} className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep black base */}
      <div className="absolute inset-0 bg-[#030303]" />

      {/* Single ultra-subtle center glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(0 0% 100%), transparent 70%)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}));

export default ProjectsBackground;
