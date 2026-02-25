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
    <div ref={ref} className="relative mb-4 sm:mb-6 animate-fade-in">
      {/* Ambient glow — subtle, no text */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-primary/[0.03] rounded-full blur-[160px] pointer-events-none" />
      
      {/* Minimal floating stats — whisper-level */}
      <div className="relative flex items-center justify-center gap-8">
        <StatChip value={stats.total} label="Projects" />
        <StatChip value={stats.completed} label="Ready" accent />
        {stats.processing > 0 && <StatChip value={stats.processing} label="Active" pulse />}
        <StatChip value={stats.totalClips} label="Clips" />
      </div>
    </div>
  );
}));

function StatChip({ label, value, accent, pulse }: { label: string; value: number; accent?: boolean; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {pulse && <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />}
      <span className={cn(
        "text-lg font-bold tabular-nums",
        accent ? "text-primary/80" : "text-white/50"
      )}>{value}</span>
      <span className="text-[10px] text-white/15 uppercase tracking-[0.15em] font-medium">{label}</span>
    </div>
  );
}

export default ProjectsHero;