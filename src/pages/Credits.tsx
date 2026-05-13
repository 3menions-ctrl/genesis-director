import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, Sparkles, Check, ArrowLeft, AlertTriangle, XCircle, Clock, RefreshCw, Settings } from 'lucide-react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCinemaEntitlement, useRefreshCinemaEntitlement } from '@/hooks/useCinemaEntitlement';
import { toast } from 'sonner';

type Cadence = 'monthly' | 'yearly';

interface CinemaTier {
  id: 'cinema_lite' | 'cinema_pro' | 'cinema_studio';
  name: string;
  tagline: string;
  monthly: { priceId: string; amount: number };
  yearly: { priceId: string; amount: number };
  fairUseSeconds: number;
  features: string[];
  highlighted?: boolean;
}

const TIERS: CinemaTier[] = [
  {
    id: 'cinema_lite',
    name: 'Cinema Lite',
    tagline: 'For solo creators stepping into cinematic work.',
    monthly: { priceId: 'cinema_lite_monthly', amount: 79 },
    yearly:  { priceId: 'cinema_lite_yearly',  amount: 790 },
    fairUseSeconds: 600,
    features: [
      '600 Cinema-seconds / month',
      'Quality Core included',
      'Standard render queue',
      'Email support',
    ],
  },
  {
    id: 'cinema_pro',
    name: 'Cinema Pro',
    tagline: 'The standard for working directors and studios.',
    monthly: { priceId: 'cinema_pro_monthly', amount: 199 },
    yearly:  { priceId: 'cinema_pro_yearly',  amount: 1990 },
    fairUseSeconds: 2000,
    features: [
      '2,000 Cinema-seconds / month',
      'Priority render queue',
      '4K upscale free',
      'Quality Core included',
    ],
    highlighted: true,
  },
  {
    id: 'cinema_studio',
    name: 'Cinema Studio',
    tagline: 'For agencies shipping at scale.',
    monthly: { priceId: 'cinema_studio_monthly', amount: 499 },
    yearly:  { priceId: 'cinema_studio_yearly',  amount: 4990 },
    fairUseSeconds: 6000,
    features: [
      '6,000 Cinema-seconds / month',
      'White-label exports',
      '3 team seats included',
      'Priority support',
    ],
  },
];

type ReturnStatus =
  | { kind: 'paid'; tier: string | null; remainingSeconds: number }
  | { kind: 'processing'; reason: string; priceId: string | null }
  | { kind: 'failed'; reason: string; priceId: string | null }
  | { kind: 'cancelled'; reason: string; priceId: string | null };

export default function Credits() {
  const { user } = useAuth();
  const { data: entitlement } = useCinemaEntitlement();
  const refreshEntitlement = useRefreshCinemaEntitlement();
  const [openingPortal, setOpeningPortal] = useState(false);

  const openCustomerPortal = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/credits`,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('Portal URL missing');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        msg.includes('no_subscription')
          ? 'No active subscription to manage yet.'
          : 'Could not open the billing portal. Please try again.',
      );
    } finally {
      setOpeningPortal(false);
    }
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [returnStatus, setReturnStatus] = useState<ReturnStatus | null>(null);
  const handledSessionRef = useRef<string | null>(null);

  // Detect post-checkout return (`?cinema=success&plan=…&session_id=…`).
  // Stripe always hits the return_url when Embedded Checkout closes — even
  // for declines — so we re-verify with Stripe via verify-cinema-checkout
  // before assuming success. Branch on the normalized state into a banner
  // (failed / cancelled / processing) or trigger the entitlement refresh
  // (paid). Strip the params either way so reloads don't replay it.
  useEffect(() => {
    const cinemaParam = searchParams.get('cinema');
    if (cinemaParam !== 'success' && cinemaParam !== 'cancelled') return;
    const sessionId = searchParams.get('session_id');
    const plan = searchParams.get('plan');
    const dedupKey = sessionId ?? `cancelled:${plan ?? 'none'}`;
    if (handledSessionRef.current === dedupKey) return;
    handledSessionRef.current = dedupKey;

    const stripParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('cinema');
      next.delete('plan');
      next.delete('session_id');
      setSearchParams(next, { replace: true });
    };

    // Explicit cancellation (user clicked our Cancel button before paying).
    if (cinemaParam === 'cancelled' || !sessionId) {
      setSelectedPriceId(null);
      setReturnStatus({
        kind: 'cancelled',
        reason: 'Checkout was cancelled. Your card was not charged.',
        priceId: plan,
      });
      stripParams();
      return;
    }

    setSelectedPriceId(null);
    setRefreshing(true);

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'verify-cinema-checkout',
          { body: { sessionId, environment: getStripeEnvironment() } },
        );
        const serverError = (data && typeof data === 'object' && 'error' in data) ? String((data as any).error) : null;
        if (fnError || serverError || !data?.state) {
          throw new Error(serverError || fnError?.message || 'Could not verify your checkout.');
        }

        const state = data.state as 'paid' | 'processing' | 'failed' | 'expired' | 'open' | 'unknown';
        const reason = (data.reason as string | null) ?? null;
        const verifiedPlan = (data.priceId as string | null) ?? plan;

        if (state === 'paid' || state === 'processing') {
          const ent = await refreshEntitlement({
            predicate: (e) => e.isActive && (!verifiedPlan || e.priceId === verifiedPlan || !!e.tier),
            maxMs: state === 'processing' ? 35_000 : 25_000,
          });
          if (ent.isActive) {
            setReturnStatus({
              kind: 'paid',
              tier: ent.tier,
              remainingSeconds: ent.remainingSeconds,
            });
            toast.success(
              `Cinema ${(ent.tier ?? '').replace('cinema_', '')} active — ${ent.remainingSeconds.toLocaleString()}s available`,
            );
          } else {
            setReturnStatus({
              kind: 'processing',
              reason: reason || 'Payment received. Your plan will activate shortly.',
              priceId: verifiedPlan,
            });
          }
        } else if (state === 'failed') {
          setReturnStatus({
            kind: 'failed',
            reason: reason || 'Your payment could not be completed. Please try again.',
            priceId: verifiedPlan,
          });
          toast.error(reason || 'Payment failed.');
        } else if (state === 'expired' || state === 'open') {
          setReturnStatus({
            kind: 'cancelled',
            reason: state === 'expired'
              ? 'Your checkout session expired. Please choose a plan to try again.'
              : 'Checkout was not completed. Your card was not charged.',
            priceId: verifiedPlan,
          });
        } else {
          setReturnStatus({
            kind: 'failed',
            reason: 'We could not confirm your payment. Please try again or contact support.',
            priceId: verifiedPlan,
          });
        }
      } catch (err) {
        console.error('[Credits] verify-cinema-checkout failed', err);
        setReturnStatus({
          kind: 'failed',
          reason: err instanceof Error ? err.message : 'Could not verify your checkout.',
          priceId: plan,
        });
        toast.error('Could not verify your checkout.');
      } finally {
        setRefreshing(false);
        stripParams();
      }
    })();
  }, [searchParams, refreshEntitlement, setSearchParams]);

  const selectedTier = useMemo(
    () => TIERS.find(t => t.monthly.priceId === selectedPriceId || t.yearly.priceId === selectedPriceId) ?? null,
    [selectedPriceId],
  );

  const fetchClientSecret = async (): Promise<string> => {
    if (!selectedPriceId) throw new Error('No plan selected');
    setError(null);
    const returnUrl = `${window.location.origin}/credits?cinema=success&plan=${encodeURIComponent(selectedPriceId)}&session_id={CHECKOUT_SESSION_ID}`;
    const { data, error: fnError } = await supabase.functions.invoke('create-cinema-checkout', {
      body: { priceId: selectedPriceId, environment: getStripeEnvironment(), returnUrl },
    });
    const serverError = (data && typeof data === 'object' && 'error' in data) ? String((data as any).error) : null;
    if (fnError || serverError || !data?.clientSecret) {
      const msg = serverError || fnError?.message || 'Could not start checkout. Please try again.';
      console.error('[Credits] create-cinema-checkout failed', { fnError, serverError, data });
      setError(msg);
      toast.error(msg);
      throw new Error(msg);
    }
    return data.clientSecret as string;
  };

  return (
    <div className="relative min-h-[calc(100vh-0px)] text-white">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at top, hsla(212,100%,40%,0.12), transparent 60%)' }}
      />

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-24">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <p className="text-[10px] tracking-[0.32em] uppercase text-[#9DCBFF] mb-3">Cinema Subscription</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Choose your tier of craft
          </h1>
          <p className="text-white/55 text-sm md:text-base mt-3 max-w-xl mx-auto">
            Unlock cinematic generation with monthly fair-use seconds. Cancel anytime.
          </p>

          {entitlement?.isActive && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active: {entitlement.tier?.replace('cinema_', 'Cinema ')} · {entitlement.remainingSeconds}s remaining
              </div>
              <button
                type="button"
                onClick={openCustomerPortal}
                disabled={openingPortal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.18] transition-colors text-white/80 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {openingPortal ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Settings className="w-3 h-3" />
                )}
                Manage subscription
              </button>
            </div>
          )}

          {refreshing && !returnStatus && (
            <div className="inline-flex items-center gap-2 mt-5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verifying your payment…
            </div>
          )}
        </motion.header>

        {/* Post-checkout return banner — failed / cancelled / processing */}
        <AnimatePresence>
          {returnStatus && returnStatus.kind !== 'paid' && !selectedPriceId && (
            <motion.div
              key={`status-${returnStatus.kind}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className={`mb-8 rounded-2xl border px-5 py-4 flex items-start gap-4 ${
                returnStatus.kind === 'failed'
                  ? 'border-rose-400/25 bg-rose-500/[0.06]'
                  : returnStatus.kind === 'processing'
                    ? 'border-[#0A84FF]/30 bg-[#0A84FF]/[0.06]'
                    : 'border-white/[0.10] bg-white/[0.03]'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {returnStatus.kind === 'failed' && <XCircle className="w-5 h-5 text-rose-300" />}
                {returnStatus.kind === 'processing' && <Clock className="w-5 h-5 text-[#9DCBFF]" />}
                {returnStatus.kind === 'cancelled' && <AlertTriangle className="w-5 h-5 text-amber-300/80" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {returnStatus.kind === 'failed' && 'Payment could not be completed'}
                  {returnStatus.kind === 'processing' && 'Payment is processing'}
                  {returnStatus.kind === 'cancelled' && 'Checkout cancelled'}
                </p>
                <p className="text-xs text-white/55 mt-0.5">{returnStatus.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {returnStatus.kind !== 'processing' && returnStatus.priceId && (
                  <button
                    onClick={() => {
                      const tier = TIERS.find(
                        t => t.monthly.priceId === returnStatus.priceId || t.yearly.priceId === returnStatus.priceId,
                      );
                      if (tier) {
                        setCadence(tier.yearly.priceId === returnStatus.priceId ? 'yearly' : 'monthly');
                      }
                      setReturnStatus(null);
                      setSelectedPriceId(returnStatus.priceId);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white text-xs font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Try again
                  </button>
                )}
                <button
                  onClick={() => setReturnStatus(null)}
                  className="text-xs text-white/40 hover:text-white/70 px-2"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!selectedPriceId ? (
            <motion.div
              key="picker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Cadence toggle */}
              <div className="flex justify-center mb-10">
                <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
                  {(['monthly','yearly'] as Cadence[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setCadence(c)}
                      className={`relative px-5 py-1.5 text-xs tracking-wide uppercase rounded-full transition-colors ${
                        cadence === c ? 'bg-[#0A84FF] text-white' : 'text-white/55 hover:text-white/80'
                      }`}
                    >
                      {c}
                      {c === 'yearly' && (
                        <span className="ml-1.5 text-[9px] text-emerald-300">−17%</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {TIERS.map((tier, i) => {
                  const price = tier[cadence];
                  const isCurrent = entitlement?.isActive && entitlement.tier === tier.id;
                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.08 * i }}
                      className={`relative rounded-3xl border p-7 flex flex-col ${
                        tier.highlighted
                          ? 'border-[#0A84FF]/40 bg-gradient-to-b from-[#0A84FF]/[0.08] to-white/[0.01]'
                          : 'border-white/[0.08] bg-white/[0.02]'
                      }`}
                    >
                      {tier.highlighted && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#0A84FF] text-[10px] tracking-[0.2em] uppercase text-white">
                          Most chosen
                        </div>
                      )}

                      <h3 className="font-display text-2xl font-semibold tracking-tight">{tier.name}</h3>
                      <p className="text-white/50 text-sm mt-1.5">{tier.tagline}</p>

                      <div className="mt-6 flex items-baseline gap-1.5">
                        <span className="text-4xl font-display font-bold">${price.amount}</span>
                        <span className="text-white/45 text-sm">/{cadence === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>

                      <ul className="mt-6 space-y-2.5 text-sm text-white/70 flex-1">
                        {tier.features.map(f => (
                          <li key={f} className="flex gap-2.5">
                            <Check className="w-4 h-4 text-[#9DCBFF] mt-0.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        disabled={isCurrent}
                        onClick={() => {
                          setError(null);
                          setSelectedPriceId(price.priceId);
                        }}
                        className={`mt-7 w-full h-11 rounded-full text-sm font-medium tracking-wide transition-all ${
                          isCurrent
                            ? 'bg-white/[0.04] text-white/40 cursor-not-allowed'
                            : tier.highlighted
                              ? 'bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white'
                              : 'bg-white/[0.06] hover:bg-white/[0.10] text-white'
                        }`}
                      >
                        {isCurrent ? 'Current plan' : `Choose ${tier.name}`}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-center text-[11px] text-white/35 mt-10">
                Prices in USD. Taxes calculated at checkout. Secured by Stripe.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="max-w-3xl mx-auto"
            >
              <button
                onClick={() => {
                  setSelectedPriceId(null);
                  setReturnStatus({
                    kind: 'cancelled',
                    reason: 'Checkout cancelled. Your card was not charged.',
                    priceId: selectedPriceId,
                  });
                }}
                className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white mb-5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Cancel and choose another plan
              </button>

              {selectedTier && (
                <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
                  <div>
                    <p className="text-[10px] tracking-[0.28em] uppercase text-[#9DCBFF]">Selected</p>
                    <p className="font-display text-lg font-semibold">{selectedTier.name}</p>
                  </div>
                  <p className="text-white/65 text-sm">
                    {selectedTier.fairUseSeconds.toLocaleString()}s / mo
                  </p>
                </div>
              )}

              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-2 md:p-4 overflow-hidden">
                {error ? (
                  <div className="p-8 text-center">
                    <p className="text-rose-300 text-sm mb-4">{error}</p>
                    <button
                      onClick={() => setSelectedPriceId(null)}
                      className="text-[#9DCBFF] underline text-sm"
                    >
                      Back to plans
                    </button>
                  </div>
                ) : !user ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-white/55 mx-auto" />
                  </div>
                ) : (
                  <EmbeddedCheckoutProvider
                    key={selectedPriceId}
                    stripe={getStripe()}
                    options={{ fetchClientSecret }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                )}
              </div>

              <div className="flex items-center justify-center gap-6 mt-6 text-[11px] text-white/40">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> SSL secure</span>
                <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Powered by Stripe</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}