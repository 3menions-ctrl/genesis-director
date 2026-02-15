/**
 * WelcomeOfferModal - Shows Mini credit pack offer to new users
 * 
 * Displays immediately after onboarding, before they reach the library.
 * Beautiful, cinematic design encouraging first purchase.
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Sparkles, Film, Zap, ArrowRight, Loader2, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { SafeComponent } from '@/components/ui/error-boundary';

function WelcomeOfferModalInner() {
  const { user, profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [hasMarkedSeen, setHasMarkedSeen] = useState(false);

  // Show modal for new users who completed onboarding but haven't seen offer
  useEffect(() => {
    if (
      user &&
      profile &&
      profile.onboarding_completed &&
      profile.has_seen_welcome_offer === false
    ) {
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user, profile]);

  const markOfferSeen = useCallback(async () => {
    if (!user || hasMarkedSeen) return;
    setHasMarkedSeen(true);

    try {
      await supabase
        .from('profiles')
        .update({ has_seen_welcome_offer: true })
        .eq('id', user.id);
      await refreshProfile();
    } catch (err) {
      console.error('[WelcomeOfferModal] Failed to mark offer seen:', err);
    }
  }, [user, hasMarkedSeen, refreshProfile]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    markOfferSeen();
  }, [markOfferSeen]);

  const handlePurchase = useCallback(async () => {
    if (!user) return;
    setPurchasing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
        body: { packageId: 'mini' },
      });

      if (error) throw error;

      if (data?.url) {
        markOfferSeen();
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
      setPurchasing(false);
    }
  }, [user, markOfferSeen]);

  if (!user || !profile || !profile.onboarding_completed || profile.has_seen_welcome_offer !== false) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform w-[92vw] max-w-lg p-0 bg-[#050507] border-white/[0.08] overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogDescription className="sr-only">
          Welcome offer to purchase starter credits
        </DialogDescription>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-50 w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-amber-500/[0.08] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-violet-500/[0.06] rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 p-8 md:p-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">Welcome to ApeX Studio</span>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
              Ready to create your first film?
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
              Grab your starter credits and turn your first idea into a cinematic clip — it only takes one prompt.
            </p>
          </motion.div>

          {/* Mini Pack Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-6 mb-6"
          >
            {/* Glow ring */}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-amber-500/20 to-transparent opacity-50 blur-sm pointer-events-none" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Mini Pack</h3>
                  <p className="text-white/40 text-xs">Perfect first step</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">$9</div>
                  <div className="text-xs text-amber-400/80 font-medium">90 credits</div>
                </div>
              </div>

              {/* What you get */}
              <div className="space-y-2.5 mb-5">
                {[
                  { icon: Film, text: '~9 cinematic clips' },
                  { icon: Zap, text: 'AI script generation included' },
                  { icon: Sparkles, text: 'HD export quality' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-sm text-white/70">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold text-sm transition-all duration-300 shadow-lg shadow-amber-500/20"
              >
                {purchasing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Get Started for $9
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Skip link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <button
              onClick={handleClose}
              className="text-xs text-white/30 hover:text-white/50 transition-colors underline underline-offset-2"
            >
              I'll explore first
            </button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WelcomeOfferModal() {
  return (
    <SafeComponent name="WelcomeOfferModal" fallback={null}>
      <WelcomeOfferModalInner />
    </SafeComponent>
  );
}
