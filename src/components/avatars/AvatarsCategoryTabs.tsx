import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Wand2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarType, AVATAR_TYPES } from '@/types/avatar-templates';

interface AvatarsCategoryTabsProps {
  activeType: AvatarType | 'all';
  onTypeChange: (type: AvatarType | 'all') => void;
  totalCount: number;
}

export const AvatarsCategoryTabs = memo(forwardRef<HTMLDivElement, AvatarsCategoryTabsProps>(function AvatarsCategoryTabs({
  activeType,
  onTypeChange,
  totalCount
}, ref) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex flex-wrap items-center justify-center gap-2 md:gap-3 px-4"
    >
      {AVATAR_TYPES.map((type) => {
        const isActive = activeType === type.id;
        const Icon = type.id === 'realistic' ? Camera : type.id === 'animated' ? Wand2 : Sparkles;
        
        return (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id as AvatarType | 'all')}
            className={cn(
              "relative px-4 md:px-6 py-2.5 md:py-3 rounded-full transition-all duration-300",
              "flex items-center gap-2 text-sm md:text-base font-medium",
              "border backdrop-blur-sm",
              isActive
                ? "bg-violet-500/20 text-white border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                : "bg-white/[0.02] text-white/50 border-white/[0.06] hover:bg-white/[0.05] hover:text-white/80 hover:border-white/[0.12]"
            )}
          >
            <Icon className={cn(
              "w-4 h-4 transition-colors",
              isActive ? "text-violet-400" : "text-white/40"
            )} />
            <span>{type.name}</span>
            
            {/* Active indicator dot */}
            {isActive && (
              <motion.span
                layoutId="activeTab"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400"
              />
            )}
          </button>
        );
      })}
      
      {/* Count badge */}
      <div className="ml-2 md:ml-4 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
        <span className="text-xs md:text-sm text-white/40">
          {totalCount} avatar{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </motion.div>
  );
}));

AvatarsCategoryTabs.displayName = 'AvatarsCategoryTabs';

export default AvatarsCategoryTabs;
