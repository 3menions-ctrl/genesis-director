import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ProjectsHeroProps {
  stats: {
    total: number;
    completed: number;
    processing: number;
    totalClips: number;
  };
}

export const ProjectsHero = memo(forwardRef<HTMLDivElement, ProjectsHeroProps>(function ProjectsHero({ stats }, ref) {
  return (
    <div ref={ref} className="relative mb-6 sm:mb-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6">
        {/* Title */}
        <div>
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.2em] text-white/30 mb-1.5">
            Library
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Projects
          </h1>
        </div>

        {/* Minimal inline stats */}
        <div className="flex items-center gap-5 sm:gap-6 text-sm">
          <StatPill label="Total" value={stats.total} />
          <StatPill label="Ready" value={stats.completed} />
          {stats.processing > 0 && (
            <StatPill label="Active" value={stats.processing} active />
          )}
          <StatPill label="Clips" value={stats.totalClips} />
        </div>
      </div>

      {/* Hairline divider */}
      <div className="mt-5 sm:mt-6 h-px bg-white/[0.06]" />
    </div>
  );
}));

function StatPill({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {active && (
        <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
      )}
      <span className="text-white/80 font-semibold tabular-nums">{value}</span>
      <span className="text-white/25 text-xs uppercase tracking-wider">{label}</span>
    </div>
  );
}
