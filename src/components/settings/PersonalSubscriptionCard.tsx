/**
 * PersonalSubscriptionCard — live version.
 *
 * Subscriptions are not for sale yet. We surface "free to start (first 5-sec video on Wan)" + a
 * pointer to Credits where the user can request a top-up.
 */
import { useState } from 'react';
import { Sparkles, ArrowRight, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getPaymentsProvider } from '@/lib/payments';

export function PersonalSubscriptionCard() {
  const navigate = useNavigate();
  const [openingPortal, setOpeningPortal] = useState(false);

  // P2-7: open the (Polar) customer billing portal. Copy across the app promised
  // a billing portal but NO button ever called it — subscribers had no in-app way
  // to manage/cancel their plan or view invoices.
  const handleManageBilling = async () => {
    setOpeningPortal(true);
    try {
      const provider = await getPaymentsProvider();
      const { url } = await provider.createPortalSession({ returnUrl: window.location.href });
      if (url) window.location.href = url;
      else throw new Error('No portal URL returned');
    } catch (e) {
      toast.error('Could not open the billing portal. Please try again.');
      setOpeningPortal(false);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/40 to-transparent" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/[0.10] border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary/60" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Plan</p>
            <p className="text-xl font-display font-light text-white">Free to start</p>
            <p className="text-[12px] text-white/45 mt-1">
              Your first 5-second video is free. Request more credits anytime.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleManageBilling}
            disabled={openingPortal}
            variant="ghost"
            className="text-foreground hover:bg-white/[0.06]"
          >
            {openingPortal ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4 mr-2" />
            )}
            Manage billing
          </Button>
          <Button
            onClick={() => navigate('/credits')}
            variant="ghost"
            className="text-foreground hover:bg-white/[0.06]"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Manage credits{' '}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
