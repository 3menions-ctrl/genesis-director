import { memo, forwardRef } from 'react';
import { LucideIcon, Check, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Unified Pro-Dark theme — cinematic blue (Apple-Clean / Tesla-borderless)
// All modes share the same accent for a cohesive premium feel; subtle bias on the gradient differentiates them.
const MODE_GRADIENTS: Record<string, string> = {
  'text-to-video':  'radial-gradient(120% 100% at 0% 0%, hsla(215,100%,60%,0.18) 0%, hsla(215,100%,60%,0.04) 45%, transparent 75%)',
  'image-to-video': 'radial-gradient(120% 100% at 100% 0%, hsla(215,100%,60%,0.18) 0%, hsla(215,100%,60%,0.04) 45%, transparent 75%)',
  'avatar':         'radial-gradient(120% 100% at 50% 100%, hsla(215,100%,60%,0.18) 0%, hsla(215,100%,60%,0.04) 50%, transparent 75%)',
};
const DEFAULT_GRADIENT = MODE_GRADIENTS['text-to-video'];

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
  const gradient = MODE_GRADIENTS[id] || DEFAULT_GRADIENT;

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start p-7 rounded-3xl text-left transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden animate-fade-in border-0",
        "hover:-translate-y-1",
        isSelected
          ? "bg-white/[0.05] shadow-[0_0_0_1px_hsla(215,100%,60%,0.35),0_30px_80px_-30px_hsla(215,100%,50%,0.35)]"
          : "bg-white/[0.022] hover:bg-white/[0.04] hover:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
      )}
      style={{
        animationDelay: `${delay * 80}ms`,
        animationFillMode: 'both',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      }}
    >
      {/* Ambient cinematic wash — unified blue */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 pointer-events-none",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
        )}
        style={{ background: gradient }}
      />

      {/* Selected luminous edge */}
      {isSelected && (
        <div
          className="absolute -inset-px rounded-[25px] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, hsla(215,100%,60%,0.55), hsla(215,100%,70%,0.15), hsla(215,100%,60%,0.05))',
            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1px',
          }}
        />
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div
          className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center animate-scale-in"
          style={{
            background: 'linear-gradient(180deg, hsl(215,100%,68%) 0%, hsl(215,100%,55%) 100%)',
            boxShadow: '0 0 20px hsla(215,100%,60%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.25)',
          }}
        >
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
        </div>
      )}

      {/* Badge */}
      {(isPopular || isNew) && !isSelected && (
        <div className="absolute top-4 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-light uppercase tracking-[0.18em] flex items-center gap-1 bg-white/[0.05] text-white/60">
          {isNew ? <Sparkles className="w-2.5 h-2.5" strokeWidth={1.5} /> : <TrendingUp className="w-2.5 h-2.5" strokeWidth={1.5} />}
          {isNew ? 'New' : 'Popular'}
        </div>
      )}

      {/* Icon — minimal glass orb */}
      <div className="relative mb-5 mt-2">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700",
            isSelected
              ? "text-white"
              : "text-white/55 group-hover:text-white/85 group-hover:scale-105"
          )}
          style={{
            background: isSelected
              ? 'linear-gradient(180deg, hsla(215,100%,60%,0.25) 0%, hsla(215,100%,55%,0.10) 100%)'
              : 'hsla(0,0%,100%,0.035)',
            boxShadow: isSelected
              ? '0 0 32px hsla(215,100%,60%,0.45), inset 0 1px 0 hsla(0,0%,100%,0.10)'
              : 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
          }}
        >
          <Icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
      </div>

      {/* Text */}
      <h3 className={cn(
        "relative text-[16px] font-light tracking-[-0.012em] mb-2 transition-colors duration-500",
        isSelected ? "text-white" : "text-white/85 group-hover:text-white"
      )}>
        {name}
      </h3>
      <p className={cn(
        "relative text-[13px] leading-relaxed line-clamp-2 font-light tracking-[-0.005em] transition-colors duration-500",
        isSelected ? "text-white/55" : "text-white/40 group-hover:text-white/55"
      )}>
        {description}
      </p>
    </button>
  );
}));
