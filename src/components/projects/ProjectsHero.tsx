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
    <div ref={ref} className="relative mb-6 sm:mb-8 animate-fade-in text-center">
      {/* Ambient glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-primary/[0.04] rounded-full blur-[140px] pointer-events-none" />
      
      <div className="relative">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.35em] text-primary/50 mb-3">
          Creative Library
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
          Your{' '}
          <span className="bg-gradient-to-r from-white via-white/90 to-white/40 bg-clip-text text-transparent">
            Studio
          </span>
        </h1>
        <p className="text-sm text-white/20 mt-2.5 max-w-md mx-auto">
          Films, training videos, and photo edits — all in one place.
        </p>
      </div>

      {/* Minimal stats row */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <StatDot label="Total" value={stats.total} />
        <StatDot label="Ready" value={stats.completed} accent />
        {stats.processing > 0 && <StatDot label="Active" value={stats.processing} pulse />}
        <StatDot label="Clips" value={stats.totalClips} />
      </div>

      {/* Gradient divider */}
      <div className="mt-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}));

function StatDot({ label, value, accent, pulse }: { label: string; value: number; accent?: boolean; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {pulse && <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />}
      <span className={cn(
        "text-base sm:text-lg font-bold tabular-nums",
        accent ? "text-primary" : "text-white/80"
      )}>{value}</span>
      <span className="text-[10px] text-white/20 uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}
