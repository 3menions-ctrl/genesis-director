import { motion } from 'framer-motion';
import { Sparkles, X, Zap } from 'lucide-react';
import { useState } from 'react';

interface PromotionalBannerProps {
  onDismiss?: () => void;
}

export const PromotionalBanner = ({ onDismiss }: PromotionalBannerProps) => {
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
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-500/30 p-4"
    >
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 animate-pulse" />
      
      {/* Sparkle decorations */}
      <div className="absolute top-2 left-4">
        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
      </div>
      <div className="absolute bottom-2 right-12">
        <Sparkles className="w-3 h-3 text-orange-400 animate-pulse delay-300" />
      </div>

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                50% OFF
              </span>
              <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                Limited Time
              </span>
            </div>
            <div className="text-sm text-white/70">
              Production costs slashed! <span className="text-white font-medium">Only 12 credits</span> per clip
              <span className="hidden sm:inline text-white/50 ml-1">(was 25 credits)</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
