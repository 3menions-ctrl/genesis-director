import { Coins, Zap, Plus } from 'lucide-react';
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

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            isLow ? "bg-destructive/20" : "bg-warning/20"
          )}>
            <Coins className={cn(
              "w-4 h-4",
              isLow ? "text-destructive" : "text-warning"
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Credits</p>
            <p className="text-xs text-muted-foreground">
              Per second of 4K video
            </p>
          </div>
        </div>
        <Button
          variant="premium"
          size="sm"
          onClick={onBuyCredits}
          className="gap-1"
        >
          <Plus className="w-3 h-3" />
          Buy More
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-gradient-warm">
            {credits.remaining.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">
            of {credits.total.toLocaleString()} total
          </span>
        </div>
        
        <Progress 
          value={100 - usagePercentage} 
          className={cn(
            "h-2",
            isLow && "[&>div]:bg-destructive"
          )}
        />

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span>~{Math.floor(credits.remaining / 10)} minutes of 4K content</span>
        </div>
      </div>
    </div>
  );
}
