import { memo, useState } from 'react';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuyCreditsModal } from './BuyCreditsModal';
import { cn } from '@/lib/utils';

interface LowCreditBannerProps {
  creditsRemaining: number;
  /** Threshold below which the banner shows */
  threshold?: number;
  className?: string;
}

/**
 * Inline banner shown during creation when credits are running low.
 * More effective than toast notifications for conversion.
 */
export const LowCreditBanner = memo(function LowCreditBanner({
  creditsRemaining,
  threshold = 20,
  className,
}: LowCreditBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  if (dismissed || creditsRemaining > threshold || creditsRemaining < 0) return null;

  const isEmpty = creditsRemaining === 0;
  const isCritical = creditsRemaining <= 5;

  return (
    <>
      <div className={cn(
        "relative flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
        isEmpty
          ? "bg-red-500/10 border-red-500/20"
          : isCritical
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-white/5 border-white/10",
        className
      )}>
        <AlertTriangle className={cn(
          "w-4 h-4 shrink-0",
          isEmpty ? "text-red-400" : isCritical ? "text-amber-400" : "text-white/50"
        )} />
        
        <span className={cn(
          "flex-1 text-xs",
          isEmpty ? "text-red-300" : isCritical ? "text-amber-300" : "text-white/60"
        )}>
          {isEmpty
            ? "You're out of credits — top up to continue creating."
            : `${creditsRemaining} credits left — top up to avoid interruptions.`}
        </span>

        <Button
          size="sm"
          onClick={() => setShowBuyModal(true)}
          className={cn(
            "h-7 px-3 rounded-full text-xs font-medium gap-1.5 shrink-0",
            isEmpty
              ? "bg-red-500 hover:bg-red-400 text-white"
              : "bg-white hover:bg-white/90 text-black"
          )}
        >
          <Sparkles className="w-3 h-3" />
          {isEmpty ? 'Get Credits' : 'Top Up'}
        </Button>

        {!isEmpty && (
          <button
            onClick={() => setDismissed(true)}
            className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0"
          >
            <X className="w-3 h-3 text-white/30" />
          </button>
        )}
      </div>

      <BuyCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </>
  );
});
