import { Coins, Zap, Sparkles, Check, AlertTriangle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserCredits } from '@/types/studio';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const usagePercentage = (credits.used / Math.max(credits.total, 1)) * 100;
  const isLow = credits.remaining < credits.total * 0.2;
  
  // Calculate what the user can afford
  const getRequiredCredits = (seconds: number) => {
    const option = DURATION_CREDIT_OPTIONS.find(o => o.seconds === seconds);
    return option?.credits || 0;
  };
  
  const requiredCredits = selectedDurationSeconds ? getRequiredCredits(selectedDurationSeconds) : 0;
  const canAfford = credits.remaining >= requiredCredits;
  const creditsAfter = credits.remaining - requiredCredits;

  // Not logged in - show sign in prompt
  if (!user) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Coins className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <p className="text-xs font-medium text-white">Credits</p>
            <p className="text-[10px] text-white/40">Sign in to track</p>
          </div>
        </div>

        <p className="text-xs text-white/50 mb-4">
          Sign in to get <span className="text-white font-semibold">50 free credits</span> and start creating videos.
        </p>

        <Button
          onClick={() => navigate('/auth')}
          className="w-full gap-1.5 h-9 text-xs bg-white hover:bg-white/90 text-black border-0"
        >
          <LogIn className="w-3.5 h-3.5" />
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isLow ? "bg-white/20" : "bg-white/10"
        )}>
          <Coins className="w-4 h-4 text-white/70" />
        </div>
        <div>
          <p className="text-xs font-medium text-white">Credits</p>
          <p className="text-[10px] text-white/40">Available Balance</p>
        </div>
      </div>

      {/* Credits count */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-display font-bold text-white">
            {credits.remaining.toLocaleString()}
          </span>
          <span className="text-xs text-white/40">
            / {credits.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all bg-white"
            )}
            style={{ width: `${Math.max(0, 100 - usagePercentage)}%` }}
          />
        </div>
      </div>

      {/* Affordability breakdown */}
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
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
                isSelected && "bg-white/10 border border-white/20",
                !isSelected && "bg-white/5"
              )}
            >
              <div className="flex items-center gap-2">
                {affordable ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-white/50" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  affordable ? "text-white" : "text-white/50"
                )}>
                  {option.label}
                </span>
              </div>
              <span className={cn(
                "text-xs font-bold",
                affordable ? "text-white/70" : "text-white/40"
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
            ? "bg-white/5 border-white/20" 
            : "bg-white/5 border-white/10"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/40">After Generation</span>
            {canAfford ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-white/50" />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-lg font-bold text-white"
            )}>
              {canAfford ? creditsAfter.toLocaleString() : `Need ${(requiredCredits - credits.remaining).toLocaleString()} more`}
            </span>
            {canAfford && <span className="text-xs text-white/40">credits left</span>}
          </div>
        </div>
      )}

      {/* Buy button */}
      <Button
        onClick={() => navigate('/profile')}
        className="w-full gap-1.5 h-9 text-xs bg-white hover:bg-white/90 text-black border-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {!canAfford && requiredCredits > 0 ? 'Get More Credits' : 'Get More'}
      </Button>
    </div>
  );
}
