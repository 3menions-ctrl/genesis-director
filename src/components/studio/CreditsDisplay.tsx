import { Coins, Zap, Plus, TrendingUp } from 'lucide-react';
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
    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl transition-colors",
            isLow 
              ? "bg-gradient-to-br from-destructive/20 to-destructive/10" 
              : "bg-gradient-to-br from-warning/20 to-amber-500/10"
          )}>
            <Coins className={cn(
              "w-5 h-5",
              isLow ? "text-destructive" : "text-warning"
            )} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Credits</p>
            <p className="text-xs text-muted-foreground">Per second of 4K video</p>
          </div>
        </div>
      </div>

      {/* Credits count */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gradient-warm">
            {credits.remaining.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            / {credits.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-3 mb-4">
        <Progress 
          value={100 - usagePercentage} 
          className={cn(
            "h-2",
            isLow && "[&>div]:bg-destructive"
          )}
        />
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="w-3 h-3" />
            <span>~{minutesRemaining} min of 4K content</span>
          </div>
          <div className="flex items-center gap-1.5 text-success">
            <TrendingUp className="w-3 h-3" />
            <span>{Math.round(100 - usagePercentage)}% remaining</span>
          </div>
        </div>
      </div>

      {/* Buy button */}
      <Button
        variant="premium"
        size="sm"
        onClick={onBuyCredits}
        className="w-full gap-2"
      >
        <Plus className="w-4 h-4" />
        Buy More Credits
      </Button>
    </div>
  );
}
