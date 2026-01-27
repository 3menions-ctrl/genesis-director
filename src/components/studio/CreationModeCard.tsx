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
  gradient?: string;
  delay?: number;
}

export function CreationModeCard({
  id,
  name,
  description,
  icon: Icon,
  isSelected,
  isPopular,
  isNew,
  onClick,
  gradient = 'from-primary/20 to-secondary/20',
  delay = 0,
}: CreationModeCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-300",
        "bg-white/5 backdrop-blur-xl hover:bg-white/10",
        isSelected 
          ? "border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.1)]" 
          : "border-white/10 hover:border-white/20"
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
      {(isPopular || isNew) && (
        <div className={cn(
          "absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1",
          isNew 
            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" 
            : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
        )}>
          {isNew ? <Sparkles className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
          {isNew ? 'New' : 'Popular'}
        </div>
      )}

      {/* Icon with gradient background */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300",
        "bg-gradient-to-br",
        gradient,
        isSelected 
          ? "shadow-lg" 
          : "group-hover:scale-105"
      )}>
        <Icon className={cn(
          "w-6 h-6 transition-colors",
          isSelected ? "text-white" : "text-white/80"
        )} />
      </div>

      {/* Text */}
      <h3 className={cn(
        "text-base font-semibold mb-1 transition-colors",
        isSelected ? "text-white" : "text-white/90"
      )}>
        {name}
      </h3>
      <p className="text-sm text-white/50 line-clamp-2">
        {description}
      </p>

      {/* Hover glow effect */}
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 pointer-events-none",
        "bg-gradient-to-br",
        gradient,
        "group-hover:opacity-10"
      )} />
    </motion.button>
  );
}
