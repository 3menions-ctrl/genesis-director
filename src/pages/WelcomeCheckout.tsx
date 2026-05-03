import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { Logo } from '@/components/ui/Logo';
import { toast } from 'sonner';

/**
 * Post-signup checkout handoff. The pre-signup wizard captures plan choice
 * and routes here as `next=` after auth completes. We open Stripe Embedded
 * Checkout for the chosen price.
 */
export default function WelcomeCheckout() {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useSafeNavigation();
  const planId = params.get('plan') ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?mode=signup&next=${encodeURIComponent(`/welcome/checkout?plan=${planId}`)}`, { replace: true });
    }
  }, [user, authLoading, navigate, planId]);

  const fetchClientSecret = async (): Promise<string> => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/profile?payment=success&plan=${encodeURIComponent(planId)}&session_id={CHECKOUT_SESSION_ID}`;
      const { data, error } = await supabase.functions.invoke('create-plan-checkout', {
        body: { priceId: planId, environment: getStripeEnvironment(), returnUrl },
      });
      if (error || !data?.clientSecret) {
        const msg = error?.message || 'Failed to start checkout';
        setError(msg);
        toast.error(msg);
        throw new Error(msg);
      }
      return data.clientSecret;
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,14%,2%)]">
        <Loader2 className="w-6 h-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (!planId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(220,14%,2%)] text-white p-8 text-center">
        <p className="text-white/65 mb-4">No plan selected.</p>
        <button onClick={() => navigate('/pricing')} className="text-[#9DCBFF] underline">Choose a plan</button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[hsl(220,14%,2%)] text-white">
      <div aria-hidden className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at top, hsla(212,100%,40%,0.15), transparent 60%)' }}
      />
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <div className="flex justify-center mb-8"><Logo size="lg" /></div>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-[10px] tracking-[0.32em] uppercase text-[#9DCBFF] mb-3">Final step</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Confirm your plan</h1>
          <p className="text-white/55 text-sm mt-2">Secured by Stripe. Cancel anytime.</p>
        </motion.div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-2 md:p-4 overflow-hidden">
          {error ? (
            <div className="p-8 text-center">
              <p className="text-rose-300 text-sm mb-4">{error}</p>
              <button
                onClick={() => navigate('/projects')}
                className="text-[#9DCBFF] underline text-sm"
              >
                Continue to dashboard
              </button>
            </div>
          ) : (
            <EmbeddedCheckoutProvider
              stripe={getStripe()}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mt-8 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> SSL secure</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Powered by Stripe</span>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/projects')}
            className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2"
          >
            Skip for now — I'll choose later
          </button>
        </div>
      </div>
    </div>
  );
}