import { useState, useEffect, memo, forwardRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Coins, Sparkles, Check, Crown, Loader2, Zap, Building2, Shield,
  ArrowRight, X, Infinity as InfinityIcon, Film, Wand2, Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMounted } from '@/lib/safeAsync';
import { SafeComponent } from '@/components/ui/error-boundary';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  is_popular: boolean;
}

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseComplete?: () => void;
}

// Premium tier configuration — Pro-Dark, blue accent (matches marketing /pricing)
const TIER_CONFIG = {
  Mini: {
    icon: Sparkles,
    description: 'Quick top-up · ideal for one short story',
    features: ['1080p HD export', 'AI script generator', 'All cinematic engines', 'Email support'],
  },
  Starter: {
    icon: Zap,
    description: 'A weekend of cinematic experiments',
    features: ['1080p HD export', 'AI script generator', 'All cinematic engines', 'Standard support'],
  },
  Growth: {
    icon: Crown,
    description: 'Built for creators shipping every week',
    features: ['4K Ultra HD (2160p)', 'Priority render queue', 'Seedance Pro engine', 'Multi-character dialogue', 'Priority support'],
  },
  Agency: {
    icon: Building2,
    description: 'For studios and production teams',
    features: ['4K HDR export', 'Top-tier render queue', 'API access', 'White-glove onboarding', 'Dedicated success manager'],
  },
} as const;

const BASE_RATE_CENTS = 10; // 1 credit = $0.10

/**
 * CreditDial — luminous conic ring with credit count + clip estimate.
 * Mirrors the marketing /pricing dial for visual continuity.
 */
function CreditDial({ credits, clips, popular }: { credits: number; clips: string; popular?: boolean }) {
  const min = Math.log(90), max = Math.log(2500);
  const ratio = Math.min(1, Math.max(0.18, (Math.log(Math.max(credits, 90)) - min) / (max - min)));
  const deg = Math.round(ratio * 360);

  return (
    <div className="relative mx-auto w-[136px] h-[136px]">
      <div
        aria-hidden
        className={cn('absolute -inset-3 rounded-full blur-2xl transition-opacity duration-700',
          popular ? 'opacity-90' : 'opacity-40 group-hover:opacity-80')}
        style={{
          background: popular
            ? 'radial-gradient(closest-side, hsl(var(--primary) / 0.55), transparent 70%)'
            : 'radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from -90deg,
            hsl(var(--primary)) 0deg,
            hsl(var(--primary) / 0.85) ${deg * 0.5}deg,
            hsl(var(--primary) / 0.55) ${deg}deg,
            hsl(0 0% 100% / 0.04) ${deg}deg 360deg)`,
          padding: '2px',
          WebkitMask: 'radial-gradient(circle, transparent 64%, #000 65%)',
          mask: 'radial-gradient(circle, transparent 64%, #000 65%)',
        }}
      />
      <div className="absolute inset-[6px] rounded-full bg-[radial-gradient(closest-side,hsl(220_14%_5%/0.95),hsl(220_14%_2%/0.85))] border border-white/[0.06] backdrop-blur-xl" />
      <div
        aria-hidden
        className="absolute inset-[6px] rounded-full pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(160deg, hsl(0 0% 100% / 0.06) 0%, transparent 38%)' }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold text-white text-[26px] tabular-nums tracking-tight leading-none">
          {credits >= 1000 ? `${(credits / 1000).toFixed(credits % 1000 === 0 ? 0 : 1)}k` : credits}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/40 font-medium">credits</span>
        <div className="w-7 h-px bg-white/[0.08] my-1.5" />
        <span className="text-[10px] text-white/45 tabular-nums">{clips}</span>
      </div>
    </div>
  );
}

// Inner component with all the logic
const BuyCreditsModalInner = memo(forwardRef<HTMLDivElement, BuyCreditsModalProps>(
  function BuyCreditsModalInner({ open, onOpenChange, onPurchaseComplete }, ref) {
    const { user } = useAuth();
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
    const isMountedRef = useIsMounted();

    const fetchPackages = useCallback(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('credit_packages_public')
          .select('*')
          .order('credits', { ascending: true });

        if (!isMountedRef.current) return;

        if (error) {
          console.error('Error fetching packages:', error);
          toast.error('Failed to load credit packages');
        } else {
          setPackages(data || []);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Error:', err);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }, [isMountedRef]);

    useEffect(() => {
      if (open) {
        fetchPackages();
      }
    }, [open, fetchPackages]);

    const getCheckoutId = (packageName: string): string => {
      const nameMap: Record<string, string> = {
        'mini': 'mini',
        'starter': 'starter',
        'growth': 'growth',
        'agency': 'agency',
      };
      const key = packageName.toLowerCase().trim();
      const checkoutId = nameMap[key] || 'starter';
      console.log('[BuyCredits] getCheckoutId:', { packageName, key, checkoutId });
      return checkoutId;
    };

    const handlePurchase = useCallback(async (pkg: CreditPackage) => {
      if (!user) {
        toast.error('Please sign in to purchase credits');
        return;
      }

      const checkoutId = getCheckoutId(pkg.name);
      setPurchasing(pkg.id);
      
      try {
        const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
          body: {
            packageId: checkoutId,
            environment: getStripeEnvironment(),
            returnUrl: `${window.location.origin}/profile?payment=success&credits=${pkg.credits}&session_id={CHECKOUT_SESSION_ID}`,
          },
        });

        if (!isMountedRef.current) return;

        if (error) throw error;

        if (data?.clientSecret) {
          setCheckoutSecret(data.clientSecret);
        } else {
          throw new Error('No checkout session received');
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('Checkout error:', error);
        toast.error('Failed to start checkout. Please try again.');
      } finally {
        if (isMountedRef.current) {
        setPurchasing(null);
        }
      }
    }, [user, isMountedRef, onOpenChange]);

    const getTierConfig = (name: string) => {
      return TIER_CONFIG[name as keyof typeof TIER_CONFIG] || TIER_CONFIG.Starter;
    };

    const getClipsEstimate = (credits: number) => `~${Math.floor(credits / 10)} clips`;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform w-[94vw] max-w-6xl max-h-[90vh] p-0 bg-[hsl(220_14%_2%)] border-white/[0.06] overflow-hidden flex flex-col rounded-3xl shadow-[0_40px_120px_-20px_hsl(0_0%_0%/0.9)]"
          hideCloseButton
        >
          {/* Accessible title and description for screen readers */}
          <DialogTitle className="sr-only">Buy Credits</DialogTitle>
          <DialogDescription className="sr-only">
            Purchase credits for video generation
          </DialogDescription>
          
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-5 top-5 z-50 w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors border border-white/[0.06] backdrop-blur-md"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>

          {/* Ambient glow effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-[140px] left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full blur-[160px] opacity-70"
              style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.20), transparent 70%)' }}
            />
            <div
              className="absolute top-1/3 -left-32 w-[480px] h-[480px] rounded-full blur-[140px] opacity-40"
              style={{ background: 'radial-gradient(closest-side, hsl(var(--accent) / 0.14), transparent 70%)' }}
            />
            <div
              className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full blur-[120px] opacity-30"
              style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.12), transparent 70%)' }}
            />
          </div>

          <div className="flex-1 min-h-0 relative z-10 overflow-y-auto overscroll-contain">
            <div className="p-6 md:p-10 font-body">
              {/* Editorial header */}
              <div className="text-center mb-10 max-w-2xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full border border-white/[0.07] bg-white/[0.03] backdrop-blur-md mb-7"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-70 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-medium">
                    Buy Credits · Live
                  </span>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="font-display font-semibold tracking-[-0.03em] text-[34px] md:text-[44px] leading-[1.04] text-white"
                >
                  Fuel your{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        'linear-gradient(110deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 55%, hsl(var(--foreground)) 100%)',
                    }}
                  >
                    cinematic
                  </span>{' '}
                  pipeline.
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="text-[14px] text-white/45 mt-4 leading-relaxed"
                >
                  Pay only for what you create. <span className="text-white/70 tabular-nums">1 credit = $0.10</span> · roughly 10 credits per finished clip. Buy more, save more — no subscriptions.
                </motion.p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                </div>
              ) : (
                <>
                  {/* Pricing Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 items-start">
                    <AnimatePresence mode="wait">
                      {packages.map((pkg, index) => {
                        const tierConfig = getTierConfig(pkg.name);
                        const TierIcon = tierConfig.icon;
                        const isPopular = pkg.is_popular;
                        const baselineCents = pkg.credits * BASE_RATE_CENTS;
                        const savingsPct = baselineCents > pkg.price_cents
                          ? Math.round(((baselineCents - pkg.price_cents) / baselineCents) * 100)
                          : 0;
                        const perCredit = (pkg.price_cents / 100 / pkg.credits).toFixed(3);

                        return (
                          <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 36 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                            className={cn(
                              'relative group',
                              isPopular && 'lg:-mt-3'
                            )}
                          >
                            {/* Popular floating badge */}
                            {isPopular && (
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                                <div className="relative">
                                  <div className="absolute inset-0 rounded-full blur-md opacity-90"
                                       style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.7), transparent 70%)' }} />
                                  <div className="relative px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] inline-flex items-center gap-1.5 text-primary-foreground border border-[hsl(var(--primary)/0.5)] bg-gradient-to-b from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.7)]">
                                    <Gem className="w-3 h-3" />
                                    Most loved
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Animated conic border (popular only) */}
                            {isPopular && (
                              <div
                                aria-hidden
                                className="absolute -inset-px rounded-[30px] pointer-events-none opacity-90"
                                style={{
                                  background:
                                    'conic-gradient(from 0deg, hsl(var(--primary) / 0.0) 0%, hsl(var(--primary) / 0.55) 25%, hsl(var(--primary) / 0.0) 50%, hsl(var(--primary) / 0.45) 75%, hsl(var(--primary) / 0.0) 100%)',
                                  WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
                                  WebkitMaskComposite: 'xor',
                                  maskComposite: 'exclude',
                                  padding: '1px',
                                  animation: 'spin 8s linear infinite',
                                }}
                              />
                            )}

                            {/* Card */}
                            <div
                              className={cn(
                                'relative rounded-[28px] p-6 pt-8 overflow-hidden transition-all duration-500 border backdrop-blur-2xl',
                                isPopular
                                  ? 'border-[hsl(var(--primary)/0.28)] bg-gradient-to-b from-[hsl(220_14%_5%/0.85)] to-[hsl(220_14%_2%/0.95)] shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.06)]'
                                  : 'border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-white/[0.14] shadow-[0_20px_60px_-30px_hsl(0_0%_0%/0.8)]'
                              )}
                            >
                              {/* Top specular highlight */}
                              <div
                                aria-hidden
                                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                                style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)' }}
                              />

                              {/* Corner aurora */}
                              <div
                                aria-hidden
                                className={cn(
                                  'absolute -top-24 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-opacity duration-700',
                                  isPopular ? 'opacity-80' : 'opacity-0 group-hover:opacity-50'
                                )}
                                style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.32), transparent 70%)' }}
                              />

                              {/* Header row */}
                              <div className="relative flex items-center justify-between mb-5">
                                <div
                                  className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center border',
                                    isPopular
                                      ? 'bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.35)] text-[hsl(var(--primary))]'
                                      : 'bg-white/[0.04] border-white/[0.08] text-white/65'
                                  )}
                                >
                                  <TierIcon className="w-4 h-4" />
                                </div>
                                {savingsPct > 0 ? (
                                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--success))] inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)]">
                                    Save {savingsPct}%
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35 inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">
                                    Pay-as-you-go
                                  </div>
                                )}
                              </div>

                              {/* Title */}
                              <h3 className="font-display font-semibold text-white text-[20px] tracking-tight leading-none mb-2">
                                {pkg.name}
                              </h3>
                              <p className="text-[12.5px] text-white/40 leading-relaxed min-h-[34px] mb-5 max-w-[24ch]">
                                {tierConfig.description}
                              </p>

                              {/* Price */}
                              <div className="flex items-baseline gap-1.5 mb-6">
                                <span className="text-[11px] text-white/35 font-medium">$</span>
                                <span className="font-display font-semibold text-white text-[44px] leading-none tabular-nums tracking-[-0.03em]">
                                  {(pkg.price_cents / 100).toFixed(0)}
                                </span>
                                <span className="text-[11px] text-white/30 ml-1">one-time</span>
                              </div>

                              {/* Credit Dial */}
                              <div className="mb-5">
                                <CreditDial
                                  credits={pkg.credits}
                                  clips={getClipsEstimate(pkg.credits)}
                                  popular={isPopular}
                                />
                              </div>

                              {/* Per-credit micro-rate */}
                              <div className="mb-5 flex items-center justify-center gap-1.5 text-[10px] text-white/35">
                                <Wand2 className="w-3 h-3" />
                                <span className="tabular-nums">${perCredit}</span>
                                <span>/ credit</span>
                              </div>

                              {/* Hairline divider */}
                              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-5" />

                              {/* Features */}
                              <ul className="space-y-2.5 mb-6">
                                {tierConfig.features.map((feature, i) => (
                                  <li key={i} className="flex items-start gap-2.5">
                                    <span
                                      className={cn(
                                        'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 border',
                                        isPopular
                                          ? 'bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.35)] text-[hsl(var(--primary))]'
                                          : 'bg-white/[0.04] border-white/[0.06] text-white/60'
                                      )}
                                    >
                                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                                    </span>
                                    <span className="text-[12px] text-white/65 leading-relaxed">{feature}</span>
                                  </li>
                                ))}
                              </ul>

                              {/* CTA */}
                              <Button
                                onClick={() => handlePurchase(pkg)}
                                disabled={purchasing === pkg.id}
                                className={cn(
                                  'w-full h-11 rounded-2xl text-[13px] font-semibold transition-all duration-300 group/btn relative overflow-hidden',
                                  isPopular
                                    ? 'text-primary-foreground border border-[hsl(var(--primary)/0.5)] bg-gradient-to-b from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] hover:from-[hsl(var(--primary)/0.95)] hover:to-[hsl(var(--primary)/0.8)] shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.7),inset_0_1px_0_hsl(0_0%_100%/0.2)]'
                                    : 'bg-white/[0.05] hover:bg-white/[0.09] text-white/85 border border-white/[0.08] hover:border-white/[0.16]'
                                )}
                              >
                                <span
                                  aria-hidden
                                  className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
                                  style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.18), transparent)' }}
                                />
                                <span className="relative inline-flex items-center justify-center gap-1.5">
                                  {purchasing === pkg.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      Get {pkg.credits.toLocaleString()} credits
                                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                    </>
                                  )}
                                </span>
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Trust Points */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="max-w-3xl mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-md px-6 py-5"
                  >
                    <div className="flex items-center justify-center gap-x-8 gap-y-3 flex-wrap">
                      <div className="flex items-center gap-2 text-white/55">
                        <Shield className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                        <span className="text-[12px] font-medium">Secure via Stripe</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/55">
                        <InfinityIcon className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                        <span className="text-[12px] font-medium">Credits never expire</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/55">
                        <Film className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                        <span className="text-[12px] font-medium">Kling V3 + Seedance Pro</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/55">
                        <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                        <span className="text-[12px] font-medium">Zero-waste guarantee</span>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
));

// Exported wrapper with SafeComponent for crash isolation
export function BuyCreditsModal(props: BuyCreditsModalProps) {
  return (
    <SafeComponent name="BuyCreditsModal" fallback={null}>
      <BuyCreditsModalInner {...props} />
    </SafeComponent>
  );
}
