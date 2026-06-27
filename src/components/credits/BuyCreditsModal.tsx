/**
 * BuyCreditsModal — pick a credit pack and check out via Polar.
 *
 * Selecting a pack opens hosted Polar Checkout (redirect). Credits are
 * granted server-side by the payments-webhook on checkout completion,
 * then reflected on return to /credits?payment=success.
 *
 * Same export name + props as before so existing call sites
 * (BillingSettings, CostConfirmationDialog, CreationHub, Pricing,
 * Profile) keep working unchanged.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent, EVENTS } from '@/lib/analytics/events';
import { useSafeNavigation } from '@/lib/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CREDIT_PACKAGES, approxClips, startCreditCheckout, type CreditPackage } from '@/lib/payments/creditPackages';

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseComplete?: () => void;
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [pending, setPending] = useState<CreditPackage['id'] | null>(null);

  // Funnel: the buy-credits surface was opened.
  useEffect(() => {
    if (open) trackEvent(EVENTS.BUY_CREDITS_OPENED);
  }, [open]);

  const buy = async (pkg: CreditPackage) => {
    if (!user) {
      onOpenChange(false);
      navigate('/auth');
      return;
    }
    if (pending) return;
    setPending(pkg.id);
    // Funnel: user committed to a pack and is being sent to Polar checkout.
    trackEvent(EVENTS.CHECKOUT_STARTED, { pkg: pkg.id, usd: pkg.price, credits: pkg.credits });
    try {
      await startCreditCheckout(pkg.id); // redirects on success
    } catch (e) {
      setPending(null);
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl text-white">
        <DialogTitle className="text-white text-[22px] font-display font-light flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> Buy credits
        </DialogTitle>
        <DialogDescription className="text-white/55 text-[13px]">
          Credits never expire. You&rsquo;re only charged once — there&rsquo;s no subscription. Secure checkout via Polar.
        </DialogDescription>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => buy(pkg)}
              disabled={!!pending}
              className={cn(
                'group relative text-left rounded-2xl border p-4 transition-colors disabled:opacity-60',
                pkg.popular
                  ? 'border-accent/40 bg-[hsl(var(--accent)/0.06)] hover:border-accent/60'
                  : 'border-white/[0.08] bg-white/[0.015] hover:border-white/25',
              )}
            >
              {pkg.popular && (
                <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-accent text-black text-[9px] font-mono uppercase tracking-[0.22em]">
                  Popular
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-white">{pkg.name}</span>
                <span className="text-[18px] font-display tabular-nums text-white">${pkg.price}</span>
              </div>
              <div className="mt-1 text-[12px] text-white/55">{pkg.blurb}</div>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-accent/85">
                {pending === pkg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {pkg.credits.toLocaleString()} credits · ~{approxClips(pkg.credits)} clips
              </div>
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">
          Refunds for failed renders land back in your balance automatically.
        </p>
      </DialogContent>
    </Dialog>
  );
}
