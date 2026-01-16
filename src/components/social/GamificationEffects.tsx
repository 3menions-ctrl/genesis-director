import { Flame, Star, Gift, Zap } from 'lucide-react';
import { useGamification } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface StreakIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function StreakIndicator({ className, showLabel = false }: StreakIndicatorProps) {
  const { stats } = useGamification();
  const streak = stats?.current_streak || 0;

  // Determine streak tier for visual effects
  const getTier = () => {
    if (streak >= 100) return { color: 'text-purple-500', glow: 'shadow-purple-500/50', label: 'Legendary' };
    if (streak >= 30) return { color: 'text-yellow-500', glow: 'shadow-yellow-500/50', label: 'Epic' };
    if (streak >= 7) return { color: 'text-orange-500', glow: 'shadow-orange-500/50', label: 'Hot' };
    if (streak > 0) return { color: 'text-red-400', glow: '', label: 'Active' };
    return { color: 'text-muted-foreground', glow: '', label: 'Start streak!' };
  };

  const tier = getTier();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <motion.div
        animate={streak >= 7 ? {
          scale: [1, 1.1, 1],
        } : {}}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
        className={cn(
          "relative",
          streak >= 7 && `shadow-lg ${tier.glow}`
        )}
      >
        <Flame className={cn("w-6 h-6", tier.color)} />
        {streak >= 30 && (
          <Zap className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
        )}
      </motion.div>
      
      <div className="flex flex-col">
        <span className={cn("font-bold text-lg leading-none", tier.color)}>
          {streak}
        </span>
        {showLabel && (
          <span className="text-xs text-muted-foreground">{tier.label}</span>
        )}
      </div>
    </div>
  );
}

interface XPGainPopupProps {
  amount: number;
  reason?: string;
  onComplete?: () => void;
}

export function XPGainPopup({ amount, reason, onComplete }: XPGainPopupProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20 }}
        onAnimationComplete={onComplete}
        className="fixed bottom-24 right-8 z-50 pointer-events-none"
      >
        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <Star className="w-5 h-5 fill-current" />
          <span className="font-bold">+{amount} XP</span>
          {reason && (
            <span className="text-sm opacity-80">{reason}</span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface LevelUpModalProps {
  newLevel: number;
  onClose: () => void;
}

export function LevelUpModal({ newLevel, onClose }: LevelUpModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-8 text-center max-w-sm mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: 2,
            }}
            className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-xl shadow-primary/30"
          >
            <span className="text-4xl font-black text-primary-foreground">{newLevel}</span>
          </motion.div>
          
          <h2 className="text-2xl font-bold mb-2">Level Up!</h2>
          <p className="text-muted-foreground mb-4">
            Congratulations! You've reached level {newLevel}
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Gift className="w-4 h-4" />
            <span>New perks unlocked!</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
