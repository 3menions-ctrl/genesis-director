import { Coins, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserCredits } from '@/types/studio';
import { cn } from '@/lib/utils';

interface CreditsDisplayProps {
  credits: UserCredits;
  onBuyCredits?: () => void;
}

export function CreditsDisplay({ credits, onBuyCredits }: CreditsDisplayProps) {
  const usagePercentage = (credits.used / credits.total) * 100;
  const isLow = credits.remaining < credits.total * 0.2;
  const minutesRemaining = Math.floor(credits.remaining / 10);

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isLow ? "bg-red-500/20" : "bg-amber-500/20"
        )}>
          <Coins className={cn(
            "w-4 h-4",
            isLow ? "text-red-400" : "text-amber-400"
          )} />
        </div>
        <div>
          <p className="text-xs font-medium text-white">Credits</p>
          <p className="text-[10px] text-violet-300/60">Remaining</p>
        </div>
      </div>

      {/* Credits count */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-display font-bold text-white">
            {credits.remaining.toLocaleString()}
          </span>
          <span className="text-xs text-violet-300/60">
            / {credits.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              isLow ? "bg-red-500" : "bg-gradient-to-r from-violet-500 to-purple-500"
            )}
            style={{ width: `${100 - usagePercentage}%` }}
          />
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] text-violet-300/60">
          <Zap className="w-3 h-3" />
          <span>~{minutesRemaining} min of 4K content</span>
        </div>
      </div>

      {/* Buy button */}
      <Button
        onClick={onBuyCredits}
        className="w-full gap-1.5 h-9 text-xs bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white border-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Get More
      </Button>
    </div>
  );
}
