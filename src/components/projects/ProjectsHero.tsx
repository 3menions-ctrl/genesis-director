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
    <div ref={ref} className="relative mb-8 sm:mb-12 animate-fade-in">
      {/* Ambient glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        {/* Title group */}
        <div className="relative">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-primary/60 mb-2">
            Creative Library
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            Your <span className="bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent">Projects</span>
          </h1>
          <p className="text-sm text-white/25 mt-2 max-w-md">
            All your AI-generated films, photos, and training videos in one place.
          </p>
        </div>

        {/* Stats capsules */}
        <div className="flex items-center gap-3">
          <StatCapsule label="Total" value={stats.total} />
          <StatCapsule label="Ready" value={stats.completed} accent />
          {stats.processing > 0 && (
            <StatCapsule label="Active" value={stats.processing} pulse />
          )}
          <StatCapsule label="Clips" value={stats.totalClips} />
        </div>
      </div>

      {/* Gradient divider */}
      <div className="mt-6 sm:mt-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}));

function StatCapsule({ label, value, accent, pulse }: { label: string; value: number; accent?: boolean; pulse?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all",
      accent 
        ? "bg-primary/[0.06] border-primary/20" 
        : "bg-white/[0.02] border-white/[0.06]"
    )}>
      {pulse && (
        <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
      )}
      <span className={cn(
        "text-lg font-bold tabular-nums",
        accent ? "text-primary" : "text-white/90"
      )}>{value}</span>
      <span className="text-[10px] text-white/25 uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}
