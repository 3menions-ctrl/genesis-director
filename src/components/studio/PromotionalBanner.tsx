import { motion } from 'framer-motion';
import { X, Zap, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PromotionalBannerProps {
  onDismiss?: () => void;
  variant?: 'default' | 'dark';
}

export const PromotionalBanner = ({ onDismiss, variant = 'default' }: PromotionalBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "relative overflow-hidden rounded-xl",
        variant === 'dark' 
          ? "bg-glossy-black shadow-obsidian border border-white/10" 
          : "glass-card border-foreground/10"
      )}
    >
      {/* Subtle gradient overlay */}
      <div className={cn(
        "absolute inset-0 pointer-events-none",
        variant === 'dark'
          ? "bg-gradient-to-r from-white/[0.03] via-transparent to-white/[0.03]"
          : "bg-gradient-to-r from-foreground/[0.02] via-transparent to-foreground/[0.02]"
      )} />

      <div className="relative flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
            variant === 'dark'
              ? "bg-white/10 backdrop-blur-sm"
              : "bg-foreground text-background shadow-lg"
          )}>
            <Zap className={cn("w-5 h-5", variant === 'dark' ? "text-white" : "")} />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-lg sm:text-xl font-bold",
                variant === 'dark' ? "text-white" : "hero-text"
              )}>
                Flexible Pricing
              </span>
              <span className={cn(
                "px-2.5 py-1 text-xs font-semibold uppercase tracking-wide rounded-full",
              variant === 'dark'
                  ? "bg-white/10 text-white/80 border border-white/20"
                  : "bg-foreground/10 text-foreground border border-foreground/20"
              )}>
                30s to 3min videos
              </span>
            </div>
            <div className={cn(
              "text-sm",
              variant === 'dark' ? "text-white/60" : "hero-text-secondary"
            )}>
              <span className={cn("font-medium", variant === 'dark' ? "text-white" : "hero-text")}>10 credits = 1 clip</span>
              <span className={cn(
                "hidden sm:inline ml-1",
                variant === 'dark' ? "text-white/40" : "text-muted-foreground"
              )}>• No limit on clips per video</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a 
            href="#pricing" 
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              variant === 'dark'
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            View Pricing
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={handleDismiss}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-lg transition-colors",
              variant === 'dark'
                ? "hover:bg-white/10 text-white/40 hover:text-white/70"
                : "hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
            )}
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
