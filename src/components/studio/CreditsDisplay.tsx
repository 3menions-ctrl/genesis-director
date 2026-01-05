import { Coins, Zap, Sparkles, Check, AlertTriangle, LogIn, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserCredits } from '@/types/studio';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CREDIT_COSTS } from '@/hooks/useCreditBilling';

interface CreditsDisplayProps {
  credits: UserCredits;
  selectedShotCount?: number;
}

export function CreditsDisplay({ credits, selectedShotCount }: CreditsDisplayProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const usagePercentage = (credits.used / Math.max(credits.total, 1)) * 100;
  const isLow = credits.remaining < CREDIT_COSTS.TOTAL_PER_SHOT * 2;
  
  // Calculate what the user can afford with Iron-Clad pricing
  const requiredCredits = selectedShotCount ? selectedShotCount * CREDIT_COSTS.TOTAL_PER_SHOT : 0;
  const canAfford = credits.remaining >= requiredCredits;
  const creditsAfter = credits.remaining - requiredCredits;
  const affordableShots = Math.floor(credits.remaining / CREDIT_COSTS.TOTAL_PER_SHOT);

  // Not logged in - show sign in prompt
  if (!user) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Coins className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <p className="text-xs font-medium text-white">Production Credits</p>
            <p className="text-[10px] text-white/40">Sign in to track</p>
          </div>
        </div>

        <p className="text-xs text-white/50 mb-4">
          Sign in to get <span className="text-white font-semibold">50 free credits</span> and start creating Iron-Clad videos.
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
          <p className="text-xs font-medium text-white">Production Credits</p>
          <p className="text-[10px] text-white/40">Iron-Clad Billing</p>
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
        <p className="text-[10px] text-white/50 mt-1">
          ≈ {affordableShots} Iron-Clad shots available
        </p>
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

      {/* Two-phase billing breakdown */}
      <div className="space-y-2 mb-4">
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
          Cost Per Shot
        </p>
        <div className="p-3 rounded-lg bg-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">Pre-Production</span>
            <span className="text-xs font-semibold text-white/80">{CREDIT_COSTS.PRE_PRODUCTION} credits</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">Production</span>
            <span className="text-xs font-semibold text-white/80">{CREDIT_COSTS.PRODUCTION} credits</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">Total per shot</span>
            <span className="text-xs font-bold text-white">{CREDIT_COSTS.TOTAL_PER_SHOT} credits</span>
          </div>
        </div>
      </div>

      {/* Selected shots preview */}
      {selectedShotCount && selectedShotCount > 0 && (
        <div className={cn(
          "p-3 rounded-lg mb-4 border",
          canAfford 
            ? "bg-white/5 border-white/20" 
            : "bg-white/5 border-white/10"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-white/60" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                {selectedShotCount} Shot{selectedShotCount > 1 ? 's' : ''} Selected
              </span>
            </div>
            {canAfford ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-white/50" />
            )}
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/60">Cost</span>
            <span className="text-xs font-semibold text-white">{requiredCredits.toLocaleString()} credits</span>
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

      {/* Refund notice */}
      <p className="text-[10px] text-white/30 mb-4">
        Failed generations are automatically refunded
      </p>

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

// Export for backward compatibility
export const DURATION_CREDIT_OPTIONS = [
  { seconds: 4, label: '4 sec (Iron-Clad)', credits: CREDIT_COSTS.TOTAL_PER_SHOT },
] as const;
