import { memo, forwardRef } from 'react';

/**
 * ProjectsHero — Ultra-minimal ambient header
 * No counters, no stats — just a refined ambient presence
 * Inspired by Apple TV+ and MUBI gallery headers
 */
export const ProjectsHero = memo(forwardRef<HTMLDivElement>(function ProjectsHero(_, ref) {
  return (
    <div ref={ref} className="relative mb-2 sm:mb-4 animate-fade-in">
      {/* Ambient glow — cinematic atmospheric light */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-primary/[0.04] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute -top-20 left-1/3 -translate-x-1/2 w-[400px] h-[200px] bg-accent/[0.02] rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}));

export default ProjectsHero;
