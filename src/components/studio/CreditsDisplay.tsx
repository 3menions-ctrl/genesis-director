import { Coins, Zap, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserCredits } from '@/types/studio';
import { cn } from '@/lib/utils';

// Duration options with credit costs - shared with StoryWizard
export const DURATION_CREDIT_OPTIONS = [
  { seconds: 8, label: '8 sec', credits: 1000 },
  { seconds: 30, label: '30 sec', credits: 3500 },
  { seconds: 60, label: '1 min', credits: 7000 },
] as const;

interface CreditsDisplayProps {
  credits: UserCredits;
  onBuyCredits?: () => void;
  selectedDurationSeconds?: number;
}

export function CreditsDisplay({ credits, onBuyCredits, selectedDurationSeconds }: CreditsDisplayProps) {
  const usagePercentage = (credits.used / credits.total) * 100;
  const isLow = credits.remaining < credits.total * 0.2;
  
  // Calculate what the user can afford
  const getRequiredCredits = (seconds: number) => {
    const option = DURATION_CREDIT_OPTIONS.find(o => o.seconds === seconds);
    return option?.credits || 0;
  };
  
  const requiredCredits = selectedDurationSeconds ? getRequiredCredits(selectedDurationSeconds) : 0;
  const canAfford = credits.remaining >= requiredCredits;
  const creditsAfter = credits.remaining - requiredCredits;

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
          <p className="text-[10px] text-violet-300/60">Available Balance</p>
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
      </div>

      {/* Affordability breakdown */}
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-wider text-violet-300/50 font-semibold">
          Duration Costs
        </p>
        {DURATION_CREDIT_OPTIONS.map((option) => {
          const affordable = credits.remaining >= option.credits;
          const isSelected = selectedDurationSeconds === option.seconds;
          return (
            <div 
              key={option.seconds}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-all",
                isSelected && "bg-violet-500/20 border border-violet-500/30",
                !isSelected && "bg-white/5"
              )}
            >
              <div className="flex items-center gap-2">
                {affordable ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  affordable ? "text-white" : "text-red-300"
                )}>
                  {option.label}
                </span>
              </div>
              <span className={cn(
                "text-xs font-bold",
                affordable ? "text-violet-300" : "text-red-400"
              )}>
                {option.credits.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Selected duration preview */}
      {selectedDurationSeconds && requiredCredits > 0 && (
        <div className={cn(
          "p-3 rounded-lg mb-4 border",
          canAfford 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-red-500/10 border-red-500/30"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-violet-300/50">After Generation</span>
            {canAfford ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-lg font-bold",
              canAfford ? "text-emerald-400" : "text-red-400"
            )}>
              {canAfford ? creditsAfter.toLocaleString() : `Need ${(requiredCredits - credits.remaining).toLocaleString()} more`}
            </span>
            {canAfford && <span className="text-xs text-violet-300/60">credits left</span>}
          </div>
        </div>
      )}

      {/* Buy button */}
      <Button
        onClick={onBuyCredits}
        className={cn(
          "w-full gap-1.5 h-9 text-xs border-0",
          !canAfford && requiredCredits > 0
            ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white animate-pulse"
            : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {!canAfford && requiredCredits > 0 ? 'Get More Credits' : 'Get More'}
      </Button>
    </div>
  );
}
