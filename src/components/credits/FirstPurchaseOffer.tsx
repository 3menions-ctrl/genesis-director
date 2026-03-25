import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, ArrowRight, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

/**
 * Shows a 30% off banner for users who haven't purchased yet.
 * Uses the existing welcomeOffer flag in create-credit-checkout.
 */
export const FirstPurchaseOffer = memo(function FirstPurchaseOffer() {
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(true); // Default true to hide until we know

  useEffect(() => {
    if (!profile) return;
    // total_credits_purchased > 0 means they've bought before
    setHasPurchased((profile as any).total_credits_purchased > 0);
  }, [profile]);

  // Check localStorage for dismissal
  useEffect(() => {
    const key = `first_purchase_dismissed_${user?.id}`;
    if (localStorage.getItem(key) === 'true') {
      setDismissed(true);
    }
  }, [user?.id]);

  const handleDismiss = () => {
    setDismissed(true);
    if (user?.id) {
      localStorage.setItem(`first_purchase_dismissed_${user.id}`, 'true');
    }
  };

  const handleClaim = async () => {
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
        body: { packageId: 'starter', welcomeOffer: true },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Welcome offer checkout error:', err);
      setPurchasing(false);
    }
  };

  if (!user || hasPurchased || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-black/60 to-emerald-950/40 p-4 mb-4"
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent animate-pulse" style={{ animationDuration: '3s' }} />

        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center z-10"
        >
          <X className="w-3 h-3 text-white/40" />
        </button>

        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-sm font-semibold text-white">First Purchase: 30% OFF</h4>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                <Percent className="w-2.5 h-2.5" />
                Welcome
              </span>
            </div>
            <p className="text-xs text-white/40">
              New here? Get 30% off your first credit purchase — limited time.
            </p>
          </div>

          <Button
            onClick={handleClaim}
            disabled={purchasing}
            className="h-9 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold gap-1.5 shrink-0"
          >
            Claim Offer
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
