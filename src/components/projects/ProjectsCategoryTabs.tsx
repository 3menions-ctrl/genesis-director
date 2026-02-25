/**
 * ProjectsCategoryTabs — Premium gallery mode switcher
 * Splits between Video gallery and Image gallery
 */

import { memo, useState, useRef, useEffect } from 'react';
import { Film, Image, Sparkles, Clapperboard } from 'lucide-react';
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

type GalleryMode = 'videos' | 'images';

const MODES: { key: GalleryMode; label: string; icon: typeof Film; description: string }[] = [
  { key: 'videos', label: 'Videos', icon: Film, description: 'Films & Clips' },
  { key: 'images', label: 'Images', icon: Image, description: 'Photo Edits' },
];

export const ProjectsCategoryTabs = memo(function ProjectsCategoryTabs({
  activeTab,
  onTabChange,
  counts,
}: ProjectsCategoryTabsProps) {
  // Map the simple gallery mode to the existing tab system
  const currentMode: GalleryMode = activeTab === 'photos' ? 'images' : 'videos';
  
  const handleModeChange = (mode: GalleryMode) => {
    if (mode === 'images') {
      onTabChange('photos');
    } else {
      onTabChange('all');
    }
  };

  const videosCount = counts.films + counts.training;
  const imagesCount = counts.photos;

  const pillRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeButton = buttonsRef.current.get(currentMode);
    if (activeButton && pillRef.current) {
      const container = pillRef.current.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        setPillStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
        });
      }
    }
  }, [currentMode]);

  return (
    <div className="flex items-center justify-center mb-6 sm:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="relative flex items-center p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] shadow-[0_2px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]">
        {/* Sliding active pill */}
        <div
          ref={pillRef}
          className="absolute top-1 h-[calc(100%-8px)] rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"
          style={{
            left: pillStyle.left,
            width: pillStyle.width,
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.08) 100%)',
            boxShadow: '0 0 20px hsl(var(--primary) / 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid hsl(var(--primary) / 0.2)',
          }}
        />

        {MODES.map((mode) => {
          const isActive = currentMode === mode.key;
          const count = mode.key === 'videos' ? videosCount : imagesCount;
          const Icon = mode.icon;

          return (
            <button
              key={mode.key}
              ref={(el) => { if (el) buttonsRef.current.set(mode.key, el); }}
              onClick={() => handleModeChange(mode.key)}
              className={cn(
                "relative z-10 flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl transition-all duration-400 select-none",
                isActive
                  ? "text-white"
                  : "text-white/30 hover:text-white/55"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 transition-all duration-400",
                isActive ? "text-primary" : "opacity-40"
              )} />
              <span className="text-[13px] font-semibold tracking-wide">{mode.label}</span>
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-md transition-all duration-400",
                  isActive 
                    ? "bg-primary/20 text-primary" 
                    : "bg-white/[0.04] text-white/20"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

ProjectsCategoryTabs.displayName = 'ProjectsCategoryTabs';
export default ProjectsCategoryTabs;
