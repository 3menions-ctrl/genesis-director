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
    <div className="glass p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "p-2 rounded-xl transition-colors",
          isLow ? "icon-container" : "icon-container-warning"
        )}>
          <Coins className={cn(
            "w-4 h-4",
            isLow ? "text-destructive" : "text-warning"
          )} />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Credits</p>
          <p className="text-[10px] text-muted-foreground">Remaining</p>
        </div>
      </div>

      {/* Credits count */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-display text-gradient-warm">
            {credits.remaining.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">
            / {credits.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <Progress 
          value={100 - usagePercentage} 
          className={cn(
            "h-1.5 bg-muted/30",
            isLow && "[&>div]:bg-destructive"
          )}
        />
        
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span>~{minutesRemaining} min of 4K content</span>
        </div>
      </div>

      {/* Buy button */}
      <Button
        variant="premium"
        size="sm"
        onClick={onBuyCredits}
        className="w-full gap-1.5 h-9 text-xs"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Get More
      </Button>
    </div>
  );
}