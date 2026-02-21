import { memo, forwardRef, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarType, AVATAR_TYPES, AVATAR_CATEGORIES } from '@/types/avatar-templates';

interface AvatarsCategoryTabsProps {
  activeType: AvatarType | 'all';
  onTypeChange: (type: AvatarType | 'all') => void;
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  totalCount: number;
  categoryCounts?: Record<string, number>;
}

export const AvatarsCategoryTabs = memo(forwardRef<HTMLDivElement, AvatarsCategoryTabsProps>(function AvatarsCategoryTabs({
  activeType,
  onTypeChange,
  activeCategory,
  onCategoryChange,
  totalCount,
  categoryCounts = {},
}, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  return (
    <div ref={ref} className="space-y-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
      {/* Row 1: Realistic / Animated type toggle */}
      <div className="flex items-center justify-center gap-2 md:gap-3 px-4">
        {AVATAR_TYPES.map((type) => {
          const isActive = activeType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => onTypeChange(type.id as AvatarType | 'all')}
              className={cn(
                "px-4 md:px-5 py-2 rounded-full transition-all duration-300",
                "flex items-center gap-2 text-sm font-medium",
                "border backdrop-blur-sm",
                isActive
                  ? "bg-violet-500/20 text-white border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                  : "bg-white/[0.02] text-white/50 border-white/[0.06] hover:bg-white/[0.05] hover:text-white/80 hover:border-white/[0.12]"
              )}
            >
              <span>{type.name}</span>
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 animate-scale-in" />
              )}
            </button>
          );
        })}
        <div className="ml-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <span className="text-xs text-white/40">{totalCount} avatar{totalCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Row 2: Scrollable tag-based category pills */}
      <div className="relative group max-w-5xl mx-auto px-4">
        {/* Left scroll button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={scrollRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 px-1"
        >
          {AVATAR_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === 'all' ? totalCount : (categoryCounts[cat.id] ?? 0);

            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full transition-all duration-200",
                  "flex items-center gap-1.5 text-xs md:text-sm font-medium whitespace-nowrap",
                  "border",
                  isActive
                    ? "bg-violet-500/15 text-white border-violet-500/40 shadow-sm"
                    : "bg-white/[0.02] text-white/45 border-white/[0.06] hover:bg-white/[0.05] hover:text-white/75 hover:border-white/[0.1]"
                )}
              >
                <span className="text-sm">{cat.icon}</span>
                <span>{cat.name}</span>
                {count > 0 && cat.id !== 'all' && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    isActive ? "bg-violet-500/30 text-violet-200" : "bg-white/[0.06] text-white/30"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right scroll button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}));

AvatarsCategoryTabs.displayName = 'AvatarsCategoryTabs';

export default AvatarsCategoryTabs;
