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
      <div
        className="relative flex items-center p-1 rounded-full"
        style={{
          background: 'hsla(0,0%,100%,0.025)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 8px 32px -12px rgba(0,0,0,0.5), inset 0 1px 0 hsla(0,0%,100%,0.04)',
        }}
      >
        {/* Sliding active pill */}
        <div
          ref={pillRef}
          className="absolute top-1 h-[calc(100%-8px)] rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"
          style={{
            left: pillStyle.left,
            width: pillStyle.width,
            background: 'linear-gradient(135deg, hsla(215,100%,60%,0.18) 0%, hsla(215,100%,60%,0.06) 100%)',
            boxShadow: '0 0 24px hsla(215,100%,60%,0.18), 0 0 48px hsla(215,100%,60%,0.08), inset 0 1px 0 hsla(0,0%,100%,0.08)',
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
                "relative z-10 flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full transition-all duration-500 select-none",
                isActive
                  ? "text-white"
                  : "text-white/35 hover:text-white/65"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 transition-all duration-500",
                isActive ? "text-[hsl(215,100%,70%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]" : "opacity-50"
              )} />
              <span className="text-[13px] font-light tracking-[0.01em]">{mode.label}</span>
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-light tabular-nums px-2 py-0.5 rounded-full transition-all duration-500",
                  isActive 
                    ? "bg-[hsla(215,100%,60%,0.18)] text-[hsl(215,100%,75%)]"
                    : "bg-white/[0.04] text-white/30"
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
