/**
 * ProjectsCategoryTabs — Premium category navigation inspired by ExamplesGallery
 * Clear, glassmorphic tab bar with counts and icons
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
  all: { label: 'All Projects', icon: Sparkles },
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
    <div className="flex items-center justify-center mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
      <div className="flex items-center gap-1 md:gap-1.5 p-1 md:p-1.5 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]">
        {(Object.keys(TAB_CONFIG) as ProjectTab[]).map((tab) => {
          const config = TAB_CONFIG[tab];
          const Icon = config.icon;
          const isActive = activeTab === tab;
          const count = counts[tab];

          // Hide tabs with 0 items (except 'all' and 'films')
          if (count === 0 && tab !== 'all' && tab !== 'films') return null;

          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl transition-all duration-300",
                isActive
                  ? "bg-white text-black shadow-lg shadow-white/10"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-medium whitespace-nowrap">{config.label}</span>
              <span className={cn(
                "text-[10px] md:text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center",
                isActive ? "bg-black/10" : "bg-white/[0.08]"
              )}>
                {count}
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
