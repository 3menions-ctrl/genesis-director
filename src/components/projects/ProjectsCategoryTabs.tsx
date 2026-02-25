/**
 * ProjectsCategoryTabs — Refined editorial tabs
 * Inspired by Dribbble/Behance category navigation
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
    <div className="flex items-center justify-center mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <nav className="relative flex items-center gap-1">
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
                "relative flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-500 text-[13px] font-medium tracking-wide",
                isActive
                  ? "text-white"
                  : "text-white/30 hover:text-white/60"
              )}
            >
              {/* Active indicator — subtle pill glow */}
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-white/[0.07] border border-white/[0.10] shadow-[0_0_24px_rgba(124,58,237,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className={cn("w-3.5 h-3.5 transition-colors duration-500", isActive ? "text-primary/80" : "")} />
                {config.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] tabular-nums transition-all duration-500",
                    isActive ? "text-white/50" : "text-white/15"
                  )}>
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        
        {/* Bottom accent line */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </nav>
    </div>
  );
});

ProjectsCategoryTabs.displayName = 'ProjectsCategoryTabs';
export default ProjectsCategoryTabs;
