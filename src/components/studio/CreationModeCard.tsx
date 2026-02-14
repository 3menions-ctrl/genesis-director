import { memo, forwardRef } from 'react';
import { LucideIcon, Check, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Cinematic color themes per mode
const MODE_THEMES: Record<string, {
  gradient: string;
  glow: string;
  iconBg: string;
  iconBgSelected: string;
  accentLine: string;
  badge: string;
}> = {
  'text-to-video': {
    gradient: 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/5',
    glow: 'shadow-[0_0_60px_rgba(139,92,246,0.15)]',
    iconBg: 'bg-violet-500/15 text-violet-300 group-hover:bg-violet-500/25 group-hover:text-violet-200',
    iconBgSelected: 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]',
    accentLine: 'from-transparent via-violet-500/50 to-transparent',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  },
  'image-to-video': {
    gradient: 'from-cyan-500/20 via-blue-500/10 to-teal-500/5',
    glow: 'shadow-[0_0_60px_rgba(6,182,212,0.15)]',
    iconBg: 'bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25 group-hover:text-cyan-200',
    iconBgSelected: 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]',
    accentLine: 'from-transparent via-cyan-500/50 to-transparent',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  'avatar': {
    gradient: 'from-amber-500/20 via-orange-500/10 to-rose-500/5',
    glow: 'shadow-[0_0_60px_rgba(245,158,11,0.15)]',
    iconBg: 'bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25 group-hover:text-amber-200',
    iconBgSelected: 'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    accentLine: 'from-transparent via-amber-500/50 to-transparent',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
};

const DEFAULT_THEME = MODE_THEMES['text-to-video'];

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
  const theme = MODE_THEMES[id] || DEFAULT_THEME;

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start p-6 rounded-2xl border text-left transition-all duration-500 overflow-hidden animate-fade-in",
        isSelected 
          ? cn("bg-white/[0.06] border-white/25", theme.glow)
          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]"
      )}
      style={{ animationDelay: `${delay * 80}ms`, animationFillMode: 'both' }}
    >
      {/* Ambient gradient background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 pointer-events-none",
        theme.gradient,
        isSelected ? "opacity-100" : "group-hover:opacity-60"
      )} />

      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-px bg-gradient-to-r transition-opacity duration-500",
        theme.accentLine,
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
      )} />

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg animate-scale-in">
          <Check className="w-3.5 h-3.5 text-black" />
        </div>
      )}

      {/* Badge */}
      {(isPopular || isNew) && !isSelected && (
        <div className={cn(
          "absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 border",
          theme.badge
        )}>
          {isNew ? <Sparkles className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
          {isNew ? 'New' : 'Popular'}
        </div>
      )}

      {/* Icon container with cinematic glow */}
      <div className="relative mb-5 mt-2">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
          isSelected ? theme.iconBgSelected : theme.iconBg
        )}>
          <Icon className="w-7 h-7" />
        </div>
        {/* Ambient glow behind icon when selected */}
        {isSelected && (
          <div className={cn(
            "absolute inset-0 rounded-2xl blur-xl opacity-40 -z-10 scale-150",
            theme.iconBgSelected
          )} />
        )}
      </div>

      {/* Text */}
      <h3 className={cn(
        "relative text-base font-semibold mb-1.5 transition-colors duration-300",
        isSelected ? "text-white" : "text-white/85 group-hover:text-white"
      )}>
        {name}
      </h3>
      <p className={cn(
        "relative text-sm leading-relaxed line-clamp-2 transition-colors duration-300",
        isSelected ? "text-white/50" : "text-white/35 group-hover:text-white/45"
      )}>
        {description}
      </p>

      {/* Bottom shimmer on hover */}
      <div className={cn(
        "absolute bottom-0 inset-x-0 h-px bg-gradient-to-r transition-opacity duration-500",
        theme.accentLine,
        isSelected ? "opacity-60" : "opacity-0 group-hover:opacity-40"
      )} />
    </button>
  );
}));
