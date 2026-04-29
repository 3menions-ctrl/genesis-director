import { useState, memo, forwardRef } from 'react';
import { Coins, Zap, Sparkles, Check, AlertTriangle, LogIn, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserCredits } from '@/types/studio';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CREDIT_COSTS } from '@/hooks/useCreditBilling';
import { calculateCreditsRequired, calculateAffordableClips, CREDIT_SYSTEM } from '@/lib/creditSystem';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

interface CreditsDisplayProps {
  credits: UserCredits;
  selectedShotCount?: number;
}

export const CreditsDisplay = memo(forwardRef<HTMLDivElement, CreditsDisplayProps>(function CreditsDisplay({ credits, selectedShotCount }, ref) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showBuyModal, setShowBuyModal] = useState(false);
  
  const usagePercentage = (credits.used / Math.max(credits.total, 1)) * 100;
  const isLow = credits.remaining < CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP * 2;
  
  // Calculate with proper extended pricing (clips 7+ or >6s cost 15 instead of 10)
  const requiredCredits = selectedShotCount ? calculateCreditsRequired(selectedShotCount) : 0;
  const canAfford = credits.remaining >= requiredCredits;
  const creditsAfter = credits.remaining - requiredCredits;
  const affordableShots = calculateAffordableClips(credits.remaining);

  // Not logged in - show sign in prompt
  if (!user) {
    return (
      <div
        className="p-5 rounded-2xl"
        style={{
          background: 'hsla(0,0%,100%,0.025)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          boxShadow: '0 16px 48px -24px rgba(0,0,0,0.6), inset 0 1px 0 hsla(0,0%,100%,0.04)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'hsla(215,100%,60%,0.12)', boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)' }}>
            <Coins className="w-4 h-4" strokeWidth={1.5} style={{ color: 'hsla(215,100%,70%,0.9)' }} />
          </div>
          <div>
            <p className="text-xs font-light tracking-tight text-white/90">Production Credits</p>
            <p className="text-[10px] font-light text-white/40">Sign in to track</p>
          </div>
        </div>

        <p className="text-xs font-light text-white/50 mb-4 leading-relaxed">
          Sign in to track your credits and start creating videos.
        </p>

        <Button
          onClick={() => navigate('/auth')}
          className="w-full gap-1.5 h-9 text-xs font-light rounded-full border-0 transition-all duration-300"
          style={{
            background: 'linear-gradient(180deg, hsla(215,100%,60%,0.95) 0%, hsla(215,100%,55%,0.95) 100%)',
            color: 'white',
            boxShadow: '0 8px 24px -8px hsla(215,100%,60%,0.5), inset 0 1px 0 hsla(0,0%,100%,0.18)',
          }}
        >
          <LogIn className="w-3.5 h-3.5" strokeWidth={1.5} />
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div
      className="p-5 rounded-2xl"
      style={{
        background: 'hsla(0,0%,100%,0.025)',
        backdropFilter: 'blur(48px) saturate(180%)',
        WebkitBackdropFilter: 'blur(48px) saturate(180%)',
        boxShadow: '0 16px 48px -24px rgba(0,0,0,0.6), inset 0 1px 0 hsla(0,0%,100%,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: isLow ? 'hsla(28,100%,60%,0.14)' : 'hsla(215,100%,60%,0.12)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)',
          }}
        >
          <Coins className="w-4 h-4" strokeWidth={1.5} style={{ color: isLow ? 'hsla(28,100%,75%,0.95)' : 'hsla(215,100%,75%,0.95)' }} />
        </div>
        <div>
          <p className="text-xs font-light tracking-tight text-white/90">Production Credits</p>
          <p className="text-[10px] font-light tracking-wide text-white/40 uppercase">Iron-Clad</p>
        </div>
      </div>

      {/* Credits count */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-display font-light tracking-tight text-white">
            {credits.remaining.toLocaleString()}
          </span>
          <span className="text-[11px] font-light text-white/40">
            credits
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsla(0,0%,100%,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(0, 100 - usagePercentage)}%`,
              background: 'linear-gradient(90deg, hsla(215,100%,65%,0.95), hsla(200,100%,70%,0.95))',
              boxShadow: '0 0 12px hsla(215,100%,60%,0.45)',
            }}
          />
        </div>
      </div>

      {/* Selected shots preview */}
      {selectedShotCount && selectedShotCount > 0 && (
        <div
          className="p-3 rounded-xl mb-4"
          style={{
            background: canAfford ? 'hsla(215,100%,60%,0.06)' : 'hsla(0,0%,100%,0.03)',
            backdropFilter: 'blur(24px) saturate(160%)',
            boxShadow: canAfford
              ? 'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 0 0 1px hsla(215,100%,60%,0.18)'
              : 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />
              <span className="text-[10px] font-light uppercase tracking-[0.12em] text-white/40">
                {selectedShotCount} Shot{selectedShotCount > 1 ? 's' : ''} Selected
              </span>
            </div>
            {canAfford ? (
              <Check className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: 'hsla(215,100%,75%,0.95)' }} />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-light text-white/60">Cost</span>
            <span className="text-xs font-light tracking-tight text-white">{requiredCredits.toLocaleString()} credits</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-light tracking-tight text-white">
              {canAfford ? creditsAfter.toLocaleString() : `Need ${(requiredCredits - credits.remaining).toLocaleString()} more`}
            </span>
            {canAfford && <span className="text-[11px] font-light text-white/40">credits left</span>}
          </div>
        </div>
      )}


      {/* Buy button */}
      <Button
        onClick={() => setShowBuyModal(true)}
        className="w-full gap-1.5 h-10 text-xs font-light tracking-wide rounded-full border-0 transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(180deg, hsla(215,100%,60%,0.95) 0%, hsla(215,100%,55%,0.95) 100%)',
          color: 'white',
          boxShadow: '0 8px 24px -8px hsla(215,100%,60%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.18)',
        }}
      >
        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
        {!canAfford && requiredCredits > 0 ? 'Get More Credits' : 'Get More'}
      </Button>

      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal} 
      />
    </div>
  );
}));

// Export for backward compatibility
export const DURATION_CREDIT_OPTIONS = [
  { seconds: 6, label: '6 sec (Iron-Clad)', credits: CREDIT_COSTS.TOTAL_PER_SHOT },
] as const;
