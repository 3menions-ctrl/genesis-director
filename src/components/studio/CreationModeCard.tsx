import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Check, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreationModeCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  isSelected: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  onClick: () => void;
  delay?: number;
}

// Wrapped with forwardRef for Framer Motion layoutId compatibility
export const CreationModeCard = memo(forwardRef<HTMLButtonElement, CreationModeCardProps>(function CreationModeCard({
  id,
  name,
  description,
  icon: Icon,
  isSelected,
  isPopular,
  isNew,
  onClick,
  delay = 0,
}, ref) {
  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-300",
        "backdrop-blur-xl",
        isSelected 
          ? "bg-white/[0.08] border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.08)]" 
          : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/15"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div 
          layoutId="creation-mode-indicator"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center"
        >
          <Check className="w-3.5 h-3.5 text-black" />
        </motion.div>
      )}

      {/* Badge */}
      {(isPopular || isNew) && !isSelected && (
        <div className={cn(
          "absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1",
          isNew 
            ? "bg-white/10 text-white/80 border border-white/20" 
            : "bg-white/10 text-white/80 border border-white/20"
        )}>
          {isNew ? <Sparkles className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
          {isNew ? 'New' : 'Popular'}
        </div>
      )}

      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300",
        isSelected 
          ? "bg-white text-black" 
          : "bg-white/[0.08] text-white/70 group-hover:bg-white/[0.12] group-hover:text-white"
      )}>
        <Icon className="w-6 h-6" />
      </div>

      {/* Text */}
      <h3 className={cn(
        "text-base font-semibold mb-1 transition-colors",
        isSelected ? "text-white" : "text-white/90"
      )}>
        {name}
      </h3>
      <p className="text-sm text-white/40 line-clamp-2">
        {description}
      </p>

      {/* Subtle hover glow */}
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 pointer-events-none",
        "bg-gradient-to-br from-white/[0.02] to-transparent",
        "group-hover:opacity-100"
      )} />
    </motion.button>
  );
}));
