/**
 * ProjectsCategoryTabs — Premium glassmorphic tabs with glow
 */

import { memo } from 'react';
import { Film, Clapperboard, Image, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProjectTab = 'all' | 'films' | 'training' | 'photos';

interface ProjectsCategoryTabsProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  counts: {
    all: number;
    films: number;
    training: number;
    photos: number;
  };
}

const TAB_CONFIG: Record<ProjectTab, { label: string; icon: typeof Film }> = {
  all: { label: 'All', icon: Sparkles },
  films: { label: 'Films', icon: Clapperboard },
  training: { label: 'Training', icon: Film },
  photos: { label: 'Photos', icon: Image },
};

export const ProjectsCategoryTabs = memo(function ProjectsCategoryTabs({
  activeTab,
  onTabChange,
  counts,
}: ProjectsCategoryTabsProps) {
  return (
    <div className="flex items-center justify-center mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="relative flex items-center gap-0.5 p-1 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.06]">
        {(Object.keys(TAB_CONFIG) as ProjectTab[]).map((tab) => {
          const config = TAB_CONFIG[tab];
          const Icon = config.icon;
          const isActive = activeTab === tab;
          const count = counts[tab];

          if (count === 0 && tab !== 'all' && tab !== 'films') return null;

          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-400 text-xs font-medium",
                isActive
                  ? "text-white"
                  : "text-white/35 hover:text-white/60"
              )}
            >
              {/* Active glow backdrop */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.12] shadow-[0_0_20px_rgba(124,58,237,0.08)]" />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {config.label}
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums min-w-[18px] text-center",
                  isActive ? "bg-white/10 text-white/70" : "bg-white/[0.04] text-white/25"
                )}>
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ProjectsCategoryTabs.displayName = 'ProjectsCategoryTabs';
export default ProjectsCategoryTabs;